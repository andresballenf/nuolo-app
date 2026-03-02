import * as FileSystem from 'expo-file-system';
import {
  Audio,
  InterruptionModeAndroid,
  InterruptionModeIOS,
  type AudioSoundInstance,
  type PlaybackStatus,
} from '../lib/ExpoAudioCompat';
import { PerfTracer } from '../utils/perfTrace';
import { TextChunk } from './TTSChunkService';

export interface AudioChunkData {
  chunkIndex: number;
  totalChunks: number;
  text: string;
  audio: string; // Base64
  characterCount: number;
  estimatedDuration: number;
  actualDuration?: number;
  fileUri?: string; // Optional: local file URI for cached audio
}

export interface ChunkPlaybackState {
  currentChunkIndex: number;
  totalChunks: number;
  isPlaying: boolean;
  isLoading: boolean;
  currentPosition: number; // Position within current chunk
  totalPosition: number; // Position across all chunks
  currentDuration: number; // Duration of current chunk
  totalDuration: number; // Total duration of all chunks
}

interface LoadedChunk {
  chunk: AudioChunkData;
  sound: AudioSoundInstance;
  fileUri: string;
  duration: number;
}

export class AudioChunkManager {
  private chunks: Map<number, AudioChunkData> = new Map();
  private loadedSounds: Map<number, LoadedChunk> = new Map();
  private currentSound: AudioSoundInstance | null = null;
  private currentChunkIndex: number = -1;
  private isPlaying: boolean = false;
  private onStateChange?: (state: ChunkPlaybackState) => void;
  private onChunkComplete?: (chunkIndex: number) => void;
  private onAllChunksComplete?: () => void;
  private positionUpdateInterval?: ReturnType<typeof setInterval>;
  private totalDuration: number = 0;
  private chunkStartTimes: Map<number, number> = new Map(); // Cumulative start time for each chunk
  private expectedTotalChunks: number = 0; // Total chunks expected (from metadata)
  private estimatedChunkDurations: Map<number, number> = new Map(); // seconds estimates per chunk
  private bufferAheadCount: number = 2; // how many chunks to keep preloaded ahead
  private isBuffering: boolean = false; // waiting for the next chunk to arrive
  private waitingForChunkIndex: number | null = null;
  private shouldResumeAfterBuffer: boolean = false;

  // Mutex-based playback lock with timeout (replaces Promise-chain lock)
  private lockHeld: boolean = false;
  private lockQueue: Array<() => void> = [];
  private static readonly LOCK_TIMEOUT_MS = 5000;

  // Throttled position emission (~4Hz instead of 10Hz polling)
  private lastPositionEmitMs: number = 0;
  private static readonly POSITION_THROTTLE_MS = 250;

  constructor() {
    this.configureAudioSession();
  }

  private async acquirePlaybackLock(label: string): Promise<() => void> {
    if (!this.lockHeld) {
      this.lockHeld = true;
      let released = false;
      return () => {
        if (released) return;
        released = true;
        this.releaseLock();
      };
    }

    // Wait in queue with timeout
    return new Promise<() => void>((resolve, reject) => {
      const timer = setTimeout(() => {
        // Remove from queue on timeout
        const idx = this.lockQueue.indexOf(grant);
        if (idx >= 0) this.lockQueue.splice(idx, 1);
        console.warn(`[AudioChunkManager] Lock timeout after ${AudioChunkManager.LOCK_TIMEOUT_MS}ms (${label})`);
        // Force-release and grant to prevent deadlock
        this.lockHeld = true;
        let released = false;
        resolve(() => {
          if (released) return;
          released = true;
          this.releaseLock();
        });
      }, AudioChunkManager.LOCK_TIMEOUT_MS);

      const grant = () => {
        clearTimeout(timer);
        this.lockHeld = true;
        let released = false;
        resolve(() => {
          if (released) return;
          released = true;
          this.releaseLock();
        });
      };
      this.lockQueue.push(grant);
    });
  }

  private releaseLock(): void {
    if (this.lockQueue.length > 0) {
      const next = this.lockQueue.shift()!;
      next();
    } else {
      this.lockHeld = false;
    }
  }

  private async withPlaybackLock<T>(label: string, fn: () => Promise<T>): Promise<T> {
    const release = await this.acquirePlaybackLock(label);
    try {
      return await fn();
    } finally {
      release();
    }
  }

  /**
   * Configure audio session for optimal playback
   */
  private async configureAudioSession() {
    try {
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
        staysActiveInBackground: true,
        interruptionModeIOS: InterruptionModeIOS.MixWithOthers,
        playsInSilentModeIOS: true,
        shouldDuckAndroid: false,
        interruptionModeAndroid: InterruptionModeAndroid.DoNotMix,
        playThroughEarpieceAndroid: false,
      });
    } catch (error) {
      console.error('Failed to configure audio session:', error);
      try {
        await Audio.setAudioModeAsync({
          allowsRecordingIOS: false,
          staysActiveInBackground: true,
          playsInSilentModeIOS: true,
          shouldDuckAndroid: false,
          playThroughEarpieceAndroid: false,
        });
        console.log('Audio session configured with fallback settings in AudioChunkManager');
      } catch (fallbackError) {
        console.error('AudioChunkManager fallback audio session configuration failed:', fallbackError);
      }
    }
  }

  /**
   * Set state change callback
   */
  public setOnStateChange(callback: (state: ChunkPlaybackState) => void) {
    this.onStateChange = callback;
  }

  /**
   * Set chunk complete callback
   */
  public setOnChunkComplete(callback: (chunkIndex: number) => void) {
    this.onChunkComplete = callback;
  }

  /**
   * Set all chunks complete callback
   */
  public setOnAllChunksComplete(callback: () => void) {
    this.onAllChunksComplete = callback;
  }

  /**
   * Initialize timeline with expected chunks and their estimated durations.
   * This enables stable transcript alignment and total duration before audio arrives.
   */
  public initializeTimeline(chunks: Pick<TextChunk, 'chunkIndex' | 'totalChunks' | 'estimatedDuration' | 'text'>[]) {
    if (!chunks || chunks.length === 0) return;
    // Store expected totals and estimates
    this.expectedTotalChunks = chunks[0].totalChunks || chunks.length;
    this.estimatedChunkDurations.clear();
    for (const c of chunks) {
      this.estimatedChunkDurations.set(c.chunkIndex, c.estimatedDuration);
    }
    // Pre-seed start times based on estimates for all expected indices
    this.recalculateDurations();
    this.emitStateChange();
  }

  /**
   * Configure how many chunks should be preloaded ahead of the currently playing chunk.
   */
  public setBufferAheadCount(count: number) {
    this.bufferAheadCount = Math.max(0, Math.min(5, Math.floor(count)));
  }

  /**
   * Approximate buffer health between 0 and 1 based on how many upcoming chunks
   * are already preloaded in memory relative to the desired bufferAheadCount.
   */
  public getBufferHealth(): number {
    if (this.bufferAheadCount <= 0) return 1;
    const start = this.currentChunkIndex >= 0 ? this.currentChunkIndex + 1 : 0;
    let loadedAhead = 0;
    for (let i = 0; i < this.bufferAheadCount; i++) {
      const idx = start + i;
      if (this.loadedSounds.has(idx)) loadedAhead++;
    }
    return Math.max(0, Math.min(1, loadedAhead / this.bufferAheadCount));
  }

  /**
   * Add a chunk to the manager
   */
  public async addChunk(chunk: AudioChunkData) {
    this.chunks.set(chunk.chunkIndex, chunk);

    // Ensure expected totals and estimates are tracked
    if (this.expectedTotalChunks === 0 && chunk.totalChunks > 0) {
      this.expectedTotalChunks = chunk.totalChunks;
    }
    if (!this.estimatedChunkDurations.has(chunk.chunkIndex)) {
      this.estimatedChunkDurations.set(chunk.chunkIndex, chunk.estimatedDuration);
    }
    
    // Update total duration and chunk start times
    this.recalculateDurations();
    
    // Pre-load the chunk if it's within the ahead-of-playback buffer
    const shouldPreload =
      (this.currentChunkIndex < 0 && chunk.chunkIndex < this.bufferAheadCount) ||
      (this.currentChunkIndex >= 0 &&
        chunk.chunkIndex > this.currentChunkIndex &&
        chunk.chunkIndex <= this.currentChunkIndex + this.bufferAheadCount);
    if (shouldPreload) {
      await this.preloadChunk(chunk.chunkIndex);
    }

    let emittedFromResume = false;

    if (this.isBuffering && this.waitingForChunkIndex === chunk.chunkIndex) {
      await this.withPlaybackLock(`buffer-resolved-${chunk.chunkIndex}`, async () => {
        this.isBuffering = false;
        this.waitingForChunkIndex = null;

        if (this.shouldResumeAfterBuffer) {
          await this.playChunkInternal(chunk.chunkIndex);
          emittedFromResume = true;
          return;
        }

        await this.emitStateChange();
        emittedFromResume = true;
      });
    }
    
    if (!emittedFromResume) {
      await this.emitStateChange();
    }
  }

  /**
   * Recalculate total duration and chunk start times
   */
  private recalculateDurations() {
    let cumulativeTime = 0;

    // If we know the expected total chunks, compute timeline over full range with estimates
    if (this.expectedTotalChunks > 0) {
      for (let i = 0; i < this.expectedTotalChunks; i++) {
        this.chunkStartTimes.set(i, cumulativeTime);
        const chunk = this.chunks.get(i);
        const durationSec = chunk?.actualDuration
          || chunk?.estimatedDuration
          || this.estimatedChunkDurations.get(i)
          || 0;
        cumulativeTime += durationSec * 1000;
      }
      this.totalDuration = cumulativeTime;
      return;
    }

    // Fallback: compute timeline from whatever chunks we have
    const sortedChunks = Array.from(this.chunks.values()).sort((a, b) => a.chunkIndex - b.chunkIndex);
    for (const chunk of sortedChunks) {
      this.chunkStartTimes.set(chunk.chunkIndex, cumulativeTime);
      const duration = chunk.actualDuration || chunk.estimatedDuration;
      cumulativeTime += duration * 1000; // Convert to milliseconds
    }
    this.totalDuration = cumulativeTime;
  }

  /**
   * Pre-load a chunk for faster playback
   */
  private async preloadChunk(chunkIndex: number): Promise<LoadedChunk | null> {
    const chunk = this.chunks.get(chunkIndex);
    if (!chunk) {
      console.warn(`Chunk ${chunkIndex} not found`);
      return null;
    }

    const existing = this.loadedSounds.get(chunkIndex);
    if (existing) {
      try {
        existing.sound.setOnPlaybackStatusUpdate(undefined);
        const status = await existing.sound.getStatusAsync();
        if (status.isLoaded) {
          // CRITICAL: If the sound is playing, it means something external is controlling it
          // We MUST unload and recreate to ensure clean state
          if (status.isPlaying) {
            console.warn(`[PreloadChunk] Found playing sound for chunk ${chunkIndex}, unloading and recreating`);
            await existing.sound.stopAsync();
            await existing.sound.unloadAsync();
            this.loadedSounds.delete(chunkIndex);
            // Fall through to recreate the sound
          } else {
            return existing;
          }
        } else {
          await existing.sound.unloadAsync();
          this.loadedSounds.delete(chunkIndex);
        }
      } catch (error) {
        console.warn(`Existing sound for chunk ${chunkIndex} was not reusable:`, error);
        this.loadedSounds.delete(chunkIndex);
      }
    }

    try {
      console.log(`Pre-loading chunk ${chunkIndex + 1}/${chunk.totalChunks}`);
      
      // Determine audio file source: prefer provided cached fileUri if available
      let fileUri: string;
      if (chunk.fileUri) {
        fileUri = chunk.fileUri;
        console.log(`Using cached file for chunk ${chunkIndex}: ${fileUri}`);
      } else if (chunk.audio) {
        // Save base64 to a temporary cache file
        const filename = `audio_chunk_${Date.now()}_${chunkIndex}.mp3`;
        fileUri = `${FileSystem.cacheDirectory}${filename}`;

        // Clean base64 and write to file
        const cleanBase64 = chunk.audio.replace(/^data:audio\/[^;]+;base64,/, '');
        await FileSystem.writeAsStringAsync(fileUri, cleanBase64, {
          encoding: FileSystem.EncodingType.Base64,
        });

        // Free base64 from memory now that it's persisted to disk
        chunk.fileUri = fileUri;
        chunk.audio = '';
      } else {
        console.warn(`Chunk ${chunkIndex} has no fileUri and no audio data`);
        return null;
      }

      // Create sound object - CRITICAL: ensure it never auto-plays
      const { sound } = await Audio.Sound.createAsync(
        { uri: fileUri },
        {
          shouldPlay: false,
          volume: 1.0, // Normal volume - we'll stop it if it auto-plays
          rate: 1.0,
          shouldCorrectPitch: true,
        }
      );

      // CRITICAL: Expo Audio has a bug where sounds can auto-play despite shouldPlay:false
      // This is expected behavior that we handle gracefully - not an actual error
      const postCreateStatus = await sound.getStatusAsync();
      if (postCreateStatus.isLoaded && postCreateStatus.isPlaying) {
        console.warn(`[PreloadChunk] Expo Audio bug detected: Sound auto-played for chunk ${chunkIndex} (stopping and resetting)`);
        await sound.stopAsync();
        // Reset position to ensure clean playback when intentionally started
        await sound.setPositionAsync(0);
      }

      // Get actual duration
      const status = await sound.getStatusAsync();
      const duration = status.isLoaded ? (status.durationMillis || 0) : 0;

      const loadedChunk: LoadedChunk = {
        chunk,
        sound,
        fileUri,
        duration
      };

      this.loadedSounds.set(chunkIndex, loadedChunk);
      
      // Update chunk with actual duration
      chunk.actualDuration = Math.ceil(duration / 1000);
      this.recalculateDurations();
      
      console.log(`Chunk ${chunkIndex} loaded: ${duration}ms`);
      
      return loadedChunk;
    } catch (error) {
      console.error(`Error preloading chunk ${chunkIndex}:`, error);
      return null;
    }
  }

  /**
   * Pre-load up to bufferAheadCount chunks ahead of the current index if available
   */
  private async preloadAheadFrom(currentIndex: number) {
    if (this.bufferAheadCount <= 0) return;

    // First, ensure all preloaded sounds that aren't current are stopped
    // This handles the Expo Audio bug where sounds auto-play despite shouldPlay:false
    for (const [idx, loaded] of this.loadedSounds.entries()) {
      if (idx !== currentIndex) {
        try {
          const status = await loaded.sound.getStatusAsync();
          if (status.isLoaded && status.isPlaying) {
            console.warn(`[PreloadAhead] Found rogue playing sound for chunk ${idx}, stopping it`);
            await loaded.sound.stopAsync();
            await loaded.sound.setPositionAsync(0);
          }
        } catch (error) {
          console.warn(`[PreloadAhead] Error checking chunk ${idx}:`, error);
        }
      }
    }

    // Now preload ahead
    for (let i = 1; i <= this.bufferAheadCount; i++) {
      const idx = currentIndex + i;
      if (this.chunks.has(idx)) {
        // Fire and forget
        this.preloadChunk(idx);
      }
    }
  }

  private async stopAndUnloadCurrentSound() {
    if (!this.currentSound) {
      return;
    }

    const activeChunkIndex = this.currentChunkIndex;
    const soundToStop = this.currentSound;

    // Immediately clear reference to prevent reuse during async operations
    this.currentSound = null;

    try {
      soundToStop.setOnPlaybackStatusUpdate(undefined);
    } catch (error) {
      console.warn('Error detaching playback status listener:', error);
    }

    try {
      const status = await soundToStop.getStatusAsync();
      if (status.isLoaded) {
        // Force stop if playing
        if (status.isPlaying) {
          await soundToStop.stopAsync();
          // Wait a brief moment to ensure stop completes
          await new Promise(resolve => setTimeout(resolve, 50));
        }
      }
    } catch (error) {
      console.error('Error stopping current sound:', error);
    }

    try {
      await soundToStop.unloadAsync();
    } catch (error) {
      console.error('Error unloading current sound:', error);
    }

    if (activeChunkIndex >= 0) {
      this.loadedSounds.delete(activeChunkIndex);
    }

    console.log(`[AudioChunkManager] Current sound stopped and unloaded (chunk ${activeChunkIndex})`);
  }

  private async pauseInternal() {
    if (this.currentSound) {
      try {
        const status = await this.currentSound.getStatusAsync();
        if (status.isLoaded && status.isPlaying) {
          await this.currentSound.pauseAsync();
        }
      } catch (error) {
        console.error('Error pausing playback:', error);
      }
    }
    this.isPlaying = false;
    this.shouldResumeAfterBuffer = false;
    this.stopPositionTracking();
  }

  private async resumeInternal(): Promise<boolean> {
    if (this.currentSound) {
      try {
        const status = await this.currentSound.getStatusAsync();
        if (status.isLoaded && !status.isPlaying) {
          await this.currentSound.playAsync();
          this.isPlaying = true;
          this.shouldResumeAfterBuffer = true;
          this.startPositionTracking();
          return true;
        }
        if (status.isLoaded && status.isPlaying) {
          this.isPlaying = true;
          this.shouldResumeAfterBuffer = true;
          this.startPositionTracking();
          return true;
        }
        console.log('[AudioChunkManager] Current sound not loaded, reloading chunk');
      } catch (error) {
        console.error('Error resuming playback:', error);
      }
    }

    if (this.chunks.size === 0) {
      return false;
    }

    const targetChunk = this.currentChunkIndex >= 0 ? this.currentChunkIndex : 0;
    await this.playChunkInternal(targetChunk);
    return false;
  }

  private async stopInternal() {
    this.isPlaying = false;
    this.shouldResumeAfterBuffer = false;
    this.stopPositionTracking();
    await this.stopAndUnloadCurrentSound();
    this.currentChunkIndex = -1;
    this.isBuffering = false;
    this.waitingForChunkIndex = null;
  }

  /**
   * Play audio starting from a specific chunk
   */
  public async play(startChunkIndex: number = 0) {
    if (this.chunks.size === 0) {
      console.warn('No chunks available to play');
      return;
    }

    await this.withPlaybackLock('play', async () => {
      this.shouldResumeAfterBuffer = true;
      await this.playChunkInternal(startChunkIndex);
    });
  }

  private async playChunkInternal(chunkIndex: number) {
    try {
      console.log(`[PlayChunkInternal] START chunk ${chunkIndex}, currentChunkIndex=${this.currentChunkIndex}, isPlaying=${this.isPlaying}`);

      const resumeOnReady = this.shouldResumeAfterBuffer || this.isPlaying;

      // CRITICAL: Ensure previous sound is completely stopped before proceeding
      await this.stopAndUnloadCurrentSound();

      const loadedChunk = await this.preloadChunk(chunkIndex);
      if (!loadedChunk) {
        console.warn(`Chunk ${chunkIndex} not yet available - buffering`);
        this.currentChunkIndex = chunkIndex;
        this.isBuffering = true;
        this.waitingForChunkIndex = chunkIndex;
        this.shouldResumeAfterBuffer = resumeOnReady;
        this.isPlaying = false;
        this.stopPositionTracking();
        await this.emitStateChange();
        return;
      }

      this.currentSound = loadedChunk.sound;
      this.currentChunkIndex = chunkIndex;
      this.isBuffering = false;
      this.waitingForChunkIndex = null;

      this.preloadAheadFrom(chunkIndex);

      // Clear any previous listener before playback
      loadedChunk.sound.setOnPlaybackStatusUpdate(undefined);

      console.log(`[PlayChunkInternal] About to start playback of chunk ${chunkIndex + 1}/${this.expectedTotalChunks || this.chunks.size}`);

      // CRITICAL: Verify sound is not already playing before starting
      const prePlayStatus = await loadedChunk.sound.getStatusAsync();
      if (prePlayStatus.isLoaded && prePlayStatus.isPlaying) {
        console.warn(`[PlayChunkInternal] Sound already playing for chunk ${chunkIndex}, stopping first`);
        await loadedChunk.sound.stopAsync();
        await loadedChunk.sound.setPositionAsync(0);
      }

      await loadedChunk.sound.playAsync();
      console.log(`[PlayChunkInternal] Playback STARTED for chunk ${chunkIndex + 1}`);

      if (chunkIndex === 0) {
        PerfTracer.mark('first_playback');
      }

      this.isPlaying = true;
      this.shouldResumeAfterBuffer = true;
      this.startPositionTracking();
      await this.emitStateChange();
    } catch (error) {
      console.error(`Error playing chunk ${chunkIndex}:`, error);
      const nextIndex = chunkIndex + 1;
      const hasMore = this.expectedTotalChunks > 0
        ? nextIndex < this.expectedTotalChunks
        : nextIndex < this.chunks.size;

      if (hasMore) {
        await this.playChunkInternal(nextIndex);
      } else {
        await this.stopAndUnloadCurrentSound();
        await this.handleAllChunksCompleteInternal();
      }
    }
  }

  /**
   * Handle chunk completion
   * NOTE: This is called from within the didJustFinish callback and must acquire its own lock
   * to ensure sequential chunk transitions
   */
  private async handleChunkComplete(chunkIndex: number) {
    await this.withPlaybackLock(`chunk-${chunkIndex}-complete`, async () => {
      console.log(`[HandleChunkComplete] Chunk ${chunkIndex + 1} completed`);
      console.log(`[HandleChunkComplete] shouldResumeAfterBuffer=${this.shouldResumeAfterBuffer}, isPlaying=${this.isPlaying}`);

      if (this.onChunkComplete) {
        this.onChunkComplete(chunkIndex);
      }

      const nextIndex = chunkIndex + 1;
      const hasMore = this.expectedTotalChunks > 0
        ? nextIndex < this.expectedTotalChunks
        : nextIndex < this.chunks.size;

      console.log(`[HandleChunkComplete] nextIndex=${nextIndex}, hasMore=${hasMore}, expectedTotalChunks=${this.expectedTotalChunks}`);

      if (!this.shouldResumeAfterBuffer && !this.isPlaying) {
        console.log(`[HandleChunkComplete] Skipping completion handling for chunk ${chunkIndex + 1} (playback inactive)`);
        return;
      }

      if (hasMore && this.shouldResumeAfterBuffer) {
        console.log(`[HandleChunkComplete] Transitioning to chunk ${nextIndex + 1}`);
        await this.playChunkInternal(nextIndex);
        return;
      }

      console.log(`[HandleChunkComplete] All chunks complete, staying at end position`);
      // Don't unload the sound - keep it at the end position so user can see progress
      // Just stop playback and tracking
      if (this.currentSound) {
        try {
          const status = await this.currentSound.getStatusAsync();
          if (status.isLoaded && status.isPlaying) {
            await this.currentSound.pauseAsync();
          }
        } catch (error) {
          console.error('Error pausing at completion:', error);
        }
      }
      await this.handleAllChunksCompleteInternal();
    });
  }

  /**
   * Handle all chunks complete
   */
  private async handleAllChunksCompleteInternal() {
    console.log('All chunks completed - staying at end position');
    this.isPlaying = false;
    this.shouldResumeAfterBuffer = false;
    this.isBuffering = false;
    this.waitingForChunkIndex = null;
    this.stopPositionTracking();

    // Note: We keep currentSound and currentChunkIndex intact so the player
    // shows the final position at the end of the last chunk

    if (this.onAllChunksComplete) {
      this.onAllChunksComplete();
    }

    await this.emitStateChange();
  }

  /**
   * Pause playback
   */
  public async pause() {
    await this.withPlaybackLock('pause', async () => {
      await this.pauseInternal();
      await this.emitStateChange();
    });
  }

  /**
   * Resume playback
   */
  public async resume() {
    await this.withPlaybackLock('resume', async () => {
      this.shouldResumeAfterBuffer = true;
      const shouldEmit = await this.resumeInternal();
      if (shouldEmit) {
        await this.emitStateChange();
      }
    });
  }

  /**
   * Stop playback and cleanup
   */
  public async stop() {
    await this.withPlaybackLock('stop', async () => {
      await this.stopInternal();
      await this.emitStateChange();
    });
  }

  /**
   * Seek to a specific position across all chunks
   */
  public async seek(positionMs: number) {
    await this.withPlaybackLock('seek', async () => {
      await this.seekInternal(positionMs);
    });
  }

  private async seekInternal(positionMs: number) {
    let targetChunkIndex = 0;
    let positionInChunk = positionMs;

    // Binary search on sorted chunkStartTimes for O(log n) seek
    const totalChunks = this.expectedTotalChunks || this.chunks.size;
    if (totalChunks > 0) {
      let lo = 0;
      let hi = totalChunks - 1;
      while (lo <= hi) {
        const mid = (lo + hi) >>> 1;
        const startTime = this.chunkStartTimes.get(mid) ?? 0;
        if (positionMs < startTime) {
          hi = mid - 1;
        } else {
          // positionMs >= startTime — this could be the target, check if within chunk
          const chunk = this.chunks.get(mid);
          const chunkDuration = chunk
            ? (chunk.actualDuration || chunk.estimatedDuration) * 1000
            : (this.estimatedChunkDurations.get(mid) ?? 0) * 1000;
          const chunkEndTime = startTime + chunkDuration;
          if (positionMs < chunkEndTime) {
            targetChunkIndex = mid;
            positionInChunk = positionMs - startTime;
            break;
          }
          lo = mid + 1;
        }
      }
      // If loop exhausted without break, clamp to last chunk
      if (lo > hi) {
        targetChunkIndex = Math.max(0, totalChunks - 1);
        const startTime = this.chunkStartTimes.get(targetChunkIndex) ?? 0;
        positionInChunk = positionMs - startTime;
      }
    }

    const needsChunkChange = targetChunkIndex !== this.currentChunkIndex || !this.currentSound;

    if (needsChunkChange) {
      this.shouldResumeAfterBuffer = true;
      await this.playChunkInternal(targetChunkIndex);
    }

    if (this.currentSound) {
      try {
        await this.currentSound.setPositionAsync(positionInChunk);
      } catch (error) {
        console.error('Error seeking within chunk:', error);
      }
    }

    if (!needsChunkChange) {
      await this.emitStateChange();
    }
  }

  /**
   * Start event-driven position tracking via setOnPlaybackStatusUpdate.
   * Replaces the previous 100ms setInterval polling approach.
   * Throttles emissions to ~4Hz (250ms) to reduce native bridge overhead.
   */
  private startPositionTracking() {
    this.stopPositionTracking();

    if (!this.currentSound) return;

    // The didJustFinish handler is already set in playChunkInternal.
    // Here we only need position/progress updates — attach a general status listener.
    // NOTE: setOnPlaybackStatusUpdate replaces any existing listener, so we
    // re-attach the didJustFinish logic within this unified handler.
    const chunkIndexAtStart = this.currentChunkIndex;
    const soundAtStart = this.currentSound;

    this.currentSound.setOnPlaybackStatusUpdate((status: PlaybackStatus) => {
      if (!status.isLoaded) return;

      // ── Rogue sound detection (replaces the separate 1s interval) ──
      // If this sound is no longer the current sound, stop it
      if (this.currentSound !== soundAtStart) {
        if (status.isPlaying) {
          soundAtStart.stopAsync().catch(() => {});
        }
        soundAtStart.setOnPlaybackStatusUpdate(undefined);
        return;
      }

      // ── didJustFinish handling ──
      if (status.didJustFinish) {
        if (this.currentChunkIndex === chunkIndexAtStart) {
          this.handleChunkComplete(chunkIndexAtStart).catch(error => {
            console.error('Error completing chunk playback:', error);
          });
        }
        return;
      }

      // ── Throttled position emission (~4Hz) ──
      const now = Date.now();
      if (now - this.lastPositionEmitMs >= AudioChunkManager.POSITION_THROTTLE_MS) {
        this.lastPositionEmitMs = now;
        this.emitStateChange();
      }
    });
  }

  /**
   * Stop position tracking by removing the status listener.
   */
  private stopPositionTracking() {
    // Clear any legacy interval if still running
    if (this.positionUpdateInterval) {
      clearInterval(this.positionUpdateInterval);
      this.positionUpdateInterval = undefined;
    }

    // The event-driven listener will be replaced on next startPositionTracking
    // or removed when the sound is unloaded. No explicit removal needed here
    // because playChunkInternal always calls setOnPlaybackStatusUpdate(undefined)
    // before setting a new listener.
  }

  /**
   * Get current playback state
   */
  public async getPlaybackState(): Promise<ChunkPlaybackState> {
    let currentPosition = 0;
    let currentDuration = 0;
    
    if (this.currentSound) {
      try {
        const status = await this.currentSound.getStatusAsync();
        if (status.isLoaded) {
          currentPosition = status.positionMillis || 0;
          currentDuration = status.durationMillis || 0;
        }
      } catch (error) {
        console.error('Error getting playback status:', error);
      }
    }
    
    // Calculate total position across all chunks
    const chunkStartTime = this.chunkStartTimes.get(this.currentChunkIndex) || 0;
    const totalPosition = chunkStartTime + currentPosition;
    
    return {
      currentChunkIndex: this.currentChunkIndex,
      totalChunks: this.expectedTotalChunks || this.chunks.size,
      isPlaying: this.isPlaying,
      isLoading: this.isBuffering,
      currentPosition,
      totalPosition,
      currentDuration,
      totalDuration: this.totalDuration
    };
  }

  /**
   * Emit state change
   */
  private async emitStateChange() {
    if (this.onStateChange) {
      const state = await this.getPlaybackState();
      this.onStateChange(state);
    }
  }

  /**
   * Clear all chunks and cleanup
   */
  public async clear() {
    await this.withPlaybackLock('clear', async () => {
      await this.stopInternal();

      const loadedChunks = Array.from(this.loadedSounds.values());
      this.loadedSounds.clear();

      for (const loadedChunk of loadedChunks) {
        try {
          loadedChunk.sound.setOnPlaybackStatusUpdate(undefined);
          await loadedChunk.sound.unloadAsync();
          const cacheDir = FileSystem.cacheDirectory || '';
          if (loadedChunk.fileUri.startsWith(cacheDir)) {
            await FileSystem.deleteAsync(loadedChunk.fileUri, { idempotent: true });
          }
        } catch (error) {
          console.error('Error cleaning up chunk:', error);
        }
      }

      this.chunks.clear();
      this.chunkStartTimes.clear();
      this.totalDuration = 0;
      this.currentChunkIndex = -1;
      this.expectedTotalChunks = 0;
      this.estimatedChunkDurations.clear();
      this.isBuffering = false;
      this.waitingForChunkIndex = null;
      this.shouldResumeAfterBuffer = false;

      await this.emitStateChange();
    });
  }

  /**
   * Free base64 audio data for a chunk that has been persisted to disk.
   * This reclaims ~640KB per chunk while retaining the fileUri for playback.
   */
  public clearBase64(chunkIndex: number): void {
    const chunk = this.chunks.get(chunkIndex);
    if (chunk && chunk.audio && chunk.fileUri) {
      chunk.audio = '';
    }
  }

  /**
   * Get total number of chunks
   */
  public getTotalChunks(): number {
    return this.expectedTotalChunks || this.chunks.size;
  }

  /**
   * Check if a chunk is loaded
   */
  public isChunkLoaded(chunkIndex: number): boolean {
    return this.loadedSounds.has(chunkIndex);
  }

  /**
   * Get chunk text for transcript display
   */
  public getChunkText(chunkIndex: number): string | null {
    const chunk = this.chunks.get(chunkIndex);
    return chunk ? chunk.text : null;
  }

  /**
   * Get all chunks text combined
   */
  public getAllText(): string {
    const sortedChunks = Array.from(this.chunks.values()).sort((a, b) => a.chunkIndex - b.chunkIndex);
    return sortedChunks.map(chunk => chunk.text).join(' ');
  }
}
