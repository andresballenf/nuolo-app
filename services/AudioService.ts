import * as FileSystem from 'expo-file-system';

export interface AudioState {
  isLoaded: boolean;
  isPlaying: boolean;
  position: number;
  duration: number;
  volume: number;
}

// Simple AudioService for now - we'll integrate with expo-audio hooks in components
export class AudioService {
  private static instance: AudioService | null = null;
  private audioState: AudioState = {
    isLoaded: false,
    isPlaying: false,
    position: 0,
    duration: 0,
    volume: 1.0,
  };

  static getInstance(): AudioService {
    if (!AudioService.instance) {
      AudioService.instance = new AudioService();
    }
    return AudioService.instance;
  }

  async saveBase64ToFile(base64Data: string, mimeType: string = 'audio/mpeg'): Promise<string> {
    try {
      // Remove data URL prefix if present
      const cleanBase64 = base64Data.replace(/^data:audio\/[^;]+;base64,/, '');
      
      // Generate unique filename
      const filename = `audio_${Date.now()}.${this.getFileExtension(mimeType)}`;
      const fileUri = `${FileSystem.cacheDirectory}${filename}`;
      
      // Write base64 data to file
      await FileSystem.writeAsStringAsync(fileUri, cleanBase64, {
        encoding: FileSystem.EncodingType.Base64,
      });
      
      return fileUri;
    } catch (error) {
      console.error('Error saving base64 to file:', error);
      throw error;
    }
  }

  private getFileExtension(mimeType: string): string {
    switch (mimeType) {
      case 'audio/mpeg':
      case 'audio/mp3':
        return 'mp3';
      case 'audio/wav':
        return 'wav';
      case 'audio/ogg':
        return 'ogg';
      case 'audio/aac':
        return 'aac';
      default:
        return 'mp3';
    }
  }

  getState(): AudioState {
    return { ...this.audioState };
  }

  setState(newState: Partial<AudioState>): void {
    this.audioState = { ...this.audioState, ...newState };
  }
}