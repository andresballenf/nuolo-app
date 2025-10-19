import { Audio, InterruptionModeAndroid, InterruptionModeIOS } from 'expo-av';
import * as FileSystem from 'expo-file-system';
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
  sound: Audio.Sound;
  fileUri: string;
  duration: number;
}

export class AudioChunkManager {
  private chunks: Map<number, AudioChunkData> = new Map();
  private loadedSounds: Map<number, LoadedChunk> = new Map();
  private currentSound: Audio.Sound | null = null;
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

  constructor() {
    this.configureAudioSession();
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

    // If we were buffering for this chunk, resume playback
    if (this.isBuffering && this.waitingForChunkIndex === chunk.chunkIndex) {
      this.isBuffering = false;
      this.waitingForChunkIndex = null;
      if (this.isPlaying) {
        await this.playChunk(chunk.chunkIndex);
      }
    }
    
    this.emitStateChange();
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

    // Check if already loaded
    if (this.loadedSounds.has(chunkIndex)) {
      return this.loadedSounds.get(chunkIndex)!;
    }

    try {
      console.log(`Pre-loading chunk ${chunkIndex + 1}/${chunk.totalChunks}`);
      
      // Save base64 to file
      const filename = `audio_chunk_${Date.now()}_${chunkIndex}.mp3`;
      const fileUri = `${FileSystem.cacheDirectory}${filename}`;
      
      // Clean base64 and write to file
      const cleanBase64 = chunk.audio.replace(/^data:audio\/[^;]+;base64,/, '');
      await FileSystem.writeAsStringAsync(fileUri, cleanBase64, {
        encoding: FileSystem.EncodingType.Base64,
      });

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

  /**
   * Play audio starting from a specific chunk
   */
  public async play(startChunkIndex: number = 0) {
    if (this.chunks.size === 0) {
      console.warn('No chunks available to play');
      return;
    }

    this.isPlaying = true;
    this.currentChunkIndex = startChunkIndex;
    
    await this.playChunk(startChunkIndex);
    this.startPositionTracking();
  }

  /**
   * Play a specific chunk
   */
  private async playChunk(chunkIndex: number) {
    try {
      // Attempt to load the requested chunk. If it's not available yet, buffer and wait.
      const loadedChunk = await this.preloadChunk(chunkIndex);
      if (!loadedChunk) {
        console.warn(`Chunk ${chunkIndex} not yet available - buffering`);
        this.isBuffering = true;
        this.waitingForChunkIndex = chunkIndex;
        await this.pause();
        await this.currentSound?.unloadAsync();
        this.currentSound = null;
        this.emitStateChange();
        return;
      }

      // Stop current sound if playing
      if (this.currentSound) {
        await this.currentSound.stopAsync();
        await this.currentSound.unloadAsync();
      }

      this.currentSound = loadedChunk.sound;
      this.currentChunkIndex = chunkIndex;
      this.isBuffering = false;
      this.waitingForChunkIndex = null;

      // Preload several chunks ahead while this one plays
      this.preloadAheadFrom(chunkIndex);

      // Set up playback status update
      loadedChunk.sound.setOnPlaybackStatusUpdate((status) => {
        if (status.isLoaded) {
          if (status.didJustFinish) {
            this.handleChunkComplete(chunkIndex);
          }
        }
      });

      // Start playing
      await loadedChunk.sound.playAsync();
      console.log(`Playing chunk ${chunkIndex + 1}/${this.expectedTotalChunks || this.chunks.size}`);
      if (chunkIndex === 0) {
        PerfTracer.mark('first_playback');
      }

      this.emitStateChange();
    } catch (error) {
      console.error(`Error playing chunk ${chunkIndex}:`, error);
      // Try next expected chunk
      const nextIndex = chunkIndex + 1;
      if (this.expectedTotalChunks > 0 ? nextIndex < this.expectedTotalChunks : nextIndex < this.chunks.size) {
        await this.playChunk(nextIndex);
      } else {
        this.handleAllChunksComplete();
      }
    }
  }

  /**
   * Handle chunk completion
   */
  private async handleChunkComplete(chunkIndex: number) {
    console.log(`Chunk ${chunkIndex + 1} completed`);
    
    if (this.onChunkComplete) {
      this.onChunkComplete(chunkIndex);
    }

    // Determine next index based on expected total
    const nextIndex = chunkIndex + 1;
    const hasMore = this.expectedTotalChunks > 0
      ? nextIndex < this.expectedTotalChunks
      : nextIndex < this.chunks.size;

    // Play next chunk if we expect more and are still playing
    if (this.isPlaying && hasMore) {
      await this.playChunk(nextIndex);
    } else {
      this.handleAllChunksComplete();
    }
  }

  /**
   * Handle all chunks complete
   */
  private handleAllChunksComplete() {
    console.log('All chunks completed');
    this.isPlaying = false;
    this.stopPositionTracking();
    
    if (this.onAllChunksComplete) {
      this.onAllChunksComplete();
    }
    
    this.emitStateChange();
  }

  /**
   * Pause playback
   */
  public async pause() {
    if (this.currentSound && this.isPlaying) {
      await this.currentSound.pauseAsync();
      this.isPlaying = false;
      this.stopPositionTracking();
      this.emitStateChange();
    }
  }

  /**
   * Resume playback
   */
  public async resume() {
    if (this.currentSound && !this.isPlaying) {
      await this.currentSound.playAsync();
      this.isPlaying = true;
      this.startPositionTracking();
      this.emitStateChange();
    }
  }

  /**
   * Stop playback and cleanup
   */
  public async stop() {
    this.isPlaying = false;
    this.stopPositionTracking();
    
    if (this.currentSound) {
      await this.currentSound.stopAsync();
      await this.currentSound.unloadAsync();
      this.currentSound = null;
    }
    
    this.currentChunkIndex = -1;
    this.emitStateChange();
  }

  /**
   * Seek to a specific position across all chunks
   */
  public async seek(positionMs: number) {
    // Find which chunk this position falls into
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
    
    // If different chunk, load and play from position
    if (targetChunkIndex !== this.currentChunkIndex) {
      await this.stop();
      await this.play(targetChunkIndex);
    }
    
    // Seek within the chunk
    if (this.currentSound) {
      await this.currentSound.setPositionAsync(positionInChunk);
    }
    
    this.emitStateChange();
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
    await this.stop();
    
    // Unload all sounds
    for (const loadedChunk of this.loadedSounds.values()) {
      try {
        await loadedChunk.sound.unloadAsync();
        // Delete cached file
        await FileSystem.deleteAsync(loadedChunk.fileUri, { idempotent: true });
      } catch (error) {
        console.error('Error cleaning up chunk:', error);
      }
    }
    
    this.chunks.clear();
    this.loadedSounds.clear();
    this.chunkStartTimes.clear();
    this.totalDuration = 0;
    this.currentChunkIndex = -1;
    this.expectedTotalChunks = 0;
    this.estimatedChunkDurations.clear();
    this.isBuffering = false;
    this.waitingForChunkIndex = null;
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
