import { Audio } from 'expo-av';
import * as FileSystem from 'expo-file-system';

export interface AudioLoadResult {
  sound: Audio.Sound;
  duration: number;
}

export interface AudioStreamOptions {
  volume?: number;
  shouldPlay?: boolean;
  isLooping?: boolean;
}

/**
 * Service for handling Base64 encoded audio streaming and playback
 * Optimized for React Native and expo-audio
 */
export class Base64AudioService {
  private static instance: Base64AudioService;
  private audioCache: Map<string, string> = new Map();

  private constructor() {}

  static getInstance(): Base64AudioService {
    if (!Base64AudioService.instance) {
      Base64AudioService.instance = new Base64AudioService();
    }
    return Base64AudioService.instance;
  }

  /**
   * Load audio from Base64 data
   */
  async loadFromBase64(
    base64Data: string,
    options: AudioStreamOptions = {}
  ): Promise<AudioLoadResult> {
    try {
      const {
        volume = 1.0,
        shouldPlay = false,
        isLooping = false,
      } = options;

      // Validate Base64 data
      if (!this.isValidBase64(base64Data)) {
        throw new Error('Invalid Base64 audio data');
      }

      // Create temporary file URI for audio data
      const audioUri = await this.createAudioUri(base64Data);

      // Load audio with expo-audio
      const { sound, status } = await Audio.Sound.createAsync(
        { uri: audioUri },
        {
          shouldPlay,
          volume,
          isLooping,
        }
      );

      if (!status.isLoaded) {
        throw new Error('Failed to load audio');
      }

      return {
        sound,
        duration: status.durationMillis || 0,
      };
    } catch (error) {
      console.error('Error loading Base64 audio:', error);
      throw new Error(`Failed to load audio: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Create audio URI from Base64 data
   */
  private async createAudioUri(base64Data: string): Promise<string> {
    try {
      // Check cache first
      const cacheKey = this.generateCacheKey(base64Data);
      if (this.audioCache.has(cacheKey)) {
        return this.audioCache.get(cacheKey)!;
      }

      // Create data URI for immediate playback
      const audioUri = `data:audio/mp3;base64,${base64Data}`;
      
      // Cache the URI
      this.audioCache.set(cacheKey, audioUri);
      
      return audioUri;
    } catch (error) {
      console.error('Error creating audio URI:', error);
      throw error;
    }
  }

  /**
   * Alternative method: Save Base64 to temporary file
   * Use this if data URI method has issues on certain platforms
   */
  private async createTempFile(base64Data: string): Promise<string> {
    try {
      const filename = `audio_${Date.now()}.mp3`;
      const fileUri = `${FileSystem.cacheDirectory}${filename}`;
      
      // Write Base64 data to file
      await FileSystem.writeAsStringAsync(fileUri, base64Data, {
        encoding: FileSystem.EncodingType.Base64,
      });

      return fileUri;
    } catch (error) {
      console.error('Error creating temp file:', error);
      throw error;
    }
  }

  /**
   * Validate Base64 data format
   */
  private isValidBase64(base64String: string): boolean {
    if (!base64String || typeof base64String !== 'string') {
      return false;
    }

    // Check if string matches Base64 pattern
    const base64Regex = /^[A-Za-z0-9+/]*={0,2}$/;
    
    // Remove whitespace and check pattern
    const cleanString = base64String.replace(/\s/g, '');
    
    // Check length (must be multiple of 4) and pattern
    return cleanString.length % 4 === 0 && base64Regex.test(cleanString);
  }

  /**
   * Generate cache key for Base64 data
   */
  private generateCacheKey(base64Data: string): string {
    // Use a simple hash of the first and last parts of the string
    const start = base64Data.substring(0, 50);
    const end = base64Data.substring(base64Data.length - 50);
    return `${start}_${end}_${base64Data.length}`;
  }

  /**
   * Clear audio cache
   */
  clearCache(): void {
    this.audioCache.clear();
  }

  /**
   * Get cache size
   */
  getCacheSize(): number {
    return this.audioCache.size;
  }

  /**
   * Preload audio for smoother playback
   */
  async preloadAudio(base64Data: string): Promise<void> {
    try {
      await this.createAudioUri(base64Data);
      console.log('Audio preloaded successfully');
    } catch (error) {
      console.error('Error preloading audio:', error);
    }
  }

  /**
   * Estimate audio duration from Base64 size (rough approximation)
   */
  estimateDuration(base64Data: string): number {
    // Very rough estimate: 1MB of MP3 ≈ 60 seconds at 128kbps
    // Base64 encoding increases size by ~33%
    const base64Bytes = base64Data.length * 0.75; // Convert from Base64 to actual bytes
    const approximateMB = base64Bytes / (1024 * 1024);
    const estimatedSeconds = approximateMB * 60;
    
    return Math.max(30, estimatedSeconds * 1000); // Return in milliseconds, minimum 30 seconds
  }

  /**
   * Validate audio quality and format
   */
  async validateAudioData(base64Data: string): Promise<boolean> {
    try {
      // Quick validation checks
      if (!this.isValidBase64(base64Data)) {
        return false;
      }

      // Check minimum size (at least 1KB)
      if (base64Data.length < 1000) {
        return false;
      }

      // Try to create URI (this will throw if data is invalid)
      await this.createAudioUri(base64Data);
      
      return true;
    } catch (error) {
      console.error('Audio validation failed:', error);
      return false;
    }
  }

  /**
   * Clean up temporary files and cache
   */
  async cleanup(): Promise<void> {
    try {
      // Clear in-memory cache
      this.clearCache();

      // Clean up any temporary files in cache directory
      const cacheInfo = await FileSystem.getInfoAsync(FileSystem.cacheDirectory!);
      if (cacheInfo.exists) {
        const files = await FileSystem.readDirectoryAsync(FileSystem.cacheDirectory!);
        const audioFiles = files.filter(file => file.startsWith('audio_') && file.endsWith('.mp3'));
        
        for (const file of audioFiles) {
          const filePath = `${FileSystem.cacheDirectory}${file}`;
          await FileSystem.deleteAsync(filePath, { idempotent: true });
        }
      }

      console.log('Audio service cleanup completed');
    } catch (error) {
      console.error('Error during cleanup:', error);
    }
  }

  /**
   * Get audio format info from Base64 data
   */
  getAudioInfo(base64Data: string): {
    sizeKB: number;
    estimatedDuration: number;
    isValid: boolean;
  } {
    const isValid = this.isValidBase64(base64Data);
    const sizeBytes = base64Data.length * 0.75; // Convert Base64 to actual bytes
    const sizeKB = Math.round(sizeBytes / 1024);
    const estimatedDuration = this.estimateDuration(base64Data);

    return {
      sizeKB,
      estimatedDuration,
      isValid,
    };
  }
}