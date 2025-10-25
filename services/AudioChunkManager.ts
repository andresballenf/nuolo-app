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
  private playbackLock: Promise<void> = Promise.resolve();

  constructor() {
    this.configureAudioSession();
  }

  private async acquirePlaybackLock(label: string): Promise<() => void> {
    console.log(`[AudioChunkManager] Waiting for playback lock (${label})`);
    let releaseLock!: () => void;
    const nextLock = new Promise<void>(resolve => {
      releaseLock = resolve;
    });
    const previousLock = this.playbackLock;
    this.playbackLock = previousLock.then(() => nextLock);
    await previousLock;
    console.log(`[AudioChunkManager] Acquired playback lock (${label})`);
    let released = false;
    return () => {
      if (released) return;
      released = true;
      console.log(`[AudioChunkManager] Released playback lock (${label})`);
      releaseLock();
    };
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
          return existing;
        }
        await existing.sound.unloadAsync();
      } catch (error) {
        console.warn(`Existing sound for chunk ${chunkIndex} was not reusable:`, error);
      }
      this.loadedSounds.delete(chunkIndex);
    }

    try {
      console.log(`Pre-loading chunk ${chunkIndex + 1}/${chunk.totalChunks}`);
      
      // Determine audio file source: prefer provided cached fileUri if available
      let fileUri: string;
      if (chunk.fileUri) {
        fileUri = chunk.fileUri;
        console.log(`Using cached file for chunk ${chunkIndex}: ${fileUri}`);
      } else {
        // Save base64 to a temporary cache file
        const filename = `audio_chunk_${Date.now()}_${chunkIndex}.mp3`;
        fileUri = `${FileSystem.cacheDirectory}${filename}`;
        
        // Clean base64 and write to file
        const cleanBase64 = chunk.audio.replace(/^data:audio\/[^;]+;base64,/, '');
        await FileSystem.writeAsStringAsync(fileUri, cleanBase64, {
          encoding: FileSystem.EncodingType.Base64,
        });
      }

      // Create sound object
      const { sound } = await Audio.Sound.createAsync(
        { uri: fileUri },
        {
          shouldPlay: false,
          volume: 1.0,
          rate: 1.0,
          shouldCorrectPitch: true,
        }
      );

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
  private preloadAheadFrom(currentIndex: number) {
    if (this.bufferAheadCount <= 0) return;
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

    try {
      this.currentSound.setOnPlaybackStatusUpdate(undefined);
    } catch (error) {
      console.warn('Error detaching playback status listener:', error);
    }

    try {
      const status = await this.currentSound.getStatusAsync();
      if (status.isLoaded) {
        await this.currentSound.stopAsync();
      }
    } catch (error) {
      console.error('Error stopping current sound:', error);
    }

    try {
      await this.currentSound.unloadAsync();
    } catch (error) {
      console.error('Error unloading current sound:', error);
    }

    this.currentSound = null;

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
      const resumeOnReady = this.shouldResumeAfterBuffer || this.isPlaying;
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

      loadedChunk.sound.setOnPlaybackStatusUpdate(undefined);
      loadedChunk.sound.setOnPlaybackStatusUpdate(async (status: PlaybackStatus) => {
        if (!status.isLoaded || !status.didJustFinish) {
          return;
        }
        if (this.currentChunkIndex !== chunkIndex) {
          return;
        }
        try {
          await this.handleChunkComplete(chunkIndex);
        } catch (error) {
          console.error('Error completing chunk playback:', error);
        }
      });

      console.log(`Playing chunk ${chunkIndex + 1}/${this.expectedTotalChunks || this.chunks.size}`);
      await loadedChunk.sound.playAsync();
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
   */
  private async handleChunkComplete(chunkIndex: number) {
    await this.withPlaybackLock(`chunk-${chunkIndex}-complete`, async () => {
      await this.handleChunkCompleteInternal(chunkIndex);
    });
  }

  private async handleChunkCompleteInternal(chunkIndex: number) {
    console.log(`Chunk ${chunkIndex + 1} completed`);

    if (this.onChunkComplete) {
      this.onChunkComplete(chunkIndex);
    }

    const nextIndex = chunkIndex + 1;
    const hasMore = this.expectedTotalChunks > 0
      ? nextIndex < this.expectedTotalChunks
      : nextIndex < this.chunks.size;

    if (!this.shouldResumeAfterBuffer && !this.isPlaying) {
      console.log(`[AudioChunkManager] Skipping completion handling for chunk ${chunkIndex + 1} (playback inactive)`);
      return;
    }

    if (hasMore && this.shouldResumeAfterBuffer) {
      await this.playChunkInternal(nextIndex);
      return;
    }

    await this.stopAndUnloadCurrentSound();
    await this.handleAllChunksCompleteInternal();
  }

  /**
   * Handle all chunks complete
   */
  private async handleAllChunksCompleteInternal() {
    console.log('All chunks completed');
    this.isPlaying = false;
    this.shouldResumeAfterBuffer = false;
    this.isBuffering = false;
    this.waitingForChunkIndex = null;
    this.stopPositionTracking();

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

    for (const [index, startTime] of this.chunkStartTimes.entries()) {
      const chunk = this.chunks.get(index);
      if (!chunk) continue;

      const chunkDuration = (chunk.actualDuration || chunk.estimatedDuration) * 1000;
      const chunkEndTime = startTime + chunkDuration;

      if (positionMs >= startTime && positionMs < chunkEndTime) {
        targetChunkIndex = index;
        positionInChunk = positionMs - startTime;
        break;
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
   * Start position tracking
   */
  private startPositionTracking() {
    this.stopPositionTracking();
    
    this.positionUpdateInterval = setInterval(async () => {
      if (this.currentSound && this.isPlaying) {
        try {
          const status = await this.currentSound.getStatusAsync();
          if (status.isLoaded) {
            this.emitStateChange();
          }
        } catch (error) {
          console.error('Error tracking position:', error);
        }
      }
    }, 100);
  }

  /**
   * Stop position tracking
   */
  private stopPositionTracking() {
    if (this.positionUpdateInterval) {
      clearInterval(this.positionUpdateInterval);
      this.positionUpdateInterval = undefined;
    }
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
