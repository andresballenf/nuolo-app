import { supabase } from '../lib/supabase';

interface UserLocation {
  lat: number;
  lng: number;
}

interface UserPreferences {
  theme: string;
  audioLength: string;
  voiceStyle: string;
}

interface AttractionInfoRequest {
  attractionName: string;
  attractionAddress: string;
  userLocation: UserLocation;
  preferences: UserPreferences;
  generateAudio?: boolean;
  streamAudio?: boolean;
  testMode?: boolean;
  iosSafari?: boolean;
  existingText?: string;
}

interface AttractionInfoResponse {
  info?: string;
  audio?: string;
  error?: string;
}

export class AttractionInfoService {
  /**
   * Generate attraction information using Supabase edge function
   */
  static async generateAttractionInfo(
    attractionName: string,
    attractionAddress: string,
    userLocation: UserLocation,
    preferences: UserPreferences,
    options: {
      generateAudio?: boolean;
      streamAudio?: boolean;
      testMode?: boolean;
      existingText?: string;
    } = {}
  ): Promise<AttractionInfoResponse> {
    try {
      const requestData: AttractionInfoRequest = {
        attractionName,
        attractionAddress,
        userLocation,
        preferences,
        generateAudio: options.generateAudio || false,
        streamAudio: options.streamAudio || false,
        testMode: options.testMode || false,
        iosSafari: false, // React Native doesn't need Safari-specific handling
        existingText: options.existingText,
      };

      console.log('Calling attraction-info edge function with:', {
        attractionName,
        attractionAddress,
        userLocation,
        preferences,
        options,
      });

      const { data, error } = await supabase.functions.invoke('attraction-info', {
        body: requestData,
      });

      if (error) {
        console.error('Supabase edge function error:', error);
        throw new Error(error.message || 'Failed to generate attraction information');
      }

      if (!data) {
        throw new Error('No data received from server');
      }

      if (data.error) {
        throw new Error(data.error);
      }

      if (!data.info && !options.generateAudio) {
        throw new Error('No information received from server');
      }

      return {
        info: data.info,
        audio: data.audio,
      };
    } catch (error) {
      console.error('Error in generateAttractionInfo:', error);
      
      // Return a more user-friendly error message
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      
      return {
        error: `Failed to generate attraction information: ${errorMessage}`,
      };
    }
  }

  /**
   * Generate just the text information (no audio)
   */
  static async generateTextInfo(
    attractionName: string,
    attractionAddress: string,
    userLocation: UserLocation,
    preferences: UserPreferences,
    testMode: boolean = false
  ): Promise<string> {
    const response = await this.generateAttractionInfo(
      attractionName,
      attractionAddress,
      userLocation,
      preferences,
      { testMode }
    );

    if (response.error) {
      throw new Error(response.error);
    }

    if (!response.info) {
      throw new Error('No information received from server');
    }

    return response.info;
  }

  /**
   * Generate audio for existing text
   */
  static async generateAudio(
    attractionName: string,
    attractionAddress: string,
    userLocation: UserLocation,
    preferences: UserPreferences,
    existingText: string,
    testMode: boolean = false
  ): Promise<string> {
    const response = await this.generateAttractionInfo(
      attractionName,
      attractionAddress,
      userLocation,
      preferences,
      {
        generateAudio: true,
        streamAudio: true,
        testMode,
        existingText,
      }
    );

    if (response.error) {
      throw new Error(response.error);
    }

    if (!response.audio) {
      throw new Error('No audio data received from server');
    }

    // Validate that it's valid base64 audio data
    if (typeof response.audio !== 'string' || !response.audio.match(/^[A-Za-z0-9+/=]+$/)) {
      throw new Error('Invalid audio data format received');
    }

    return response.audio;
  }

  /**
   * Generate both text and audio in one call
   */
  static async generateTextAndAudio(
    attractionName: string,
    attractionAddress: string,
    userLocation: UserLocation,
    preferences: UserPreferences,
    testMode: boolean = false
  ): Promise<{ text: string; audio: string }> {
    const response = await this.generateAttractionInfo(
      attractionName,
      attractionAddress,
      userLocation,
      preferences,
      {
        generateAudio: true,
        streamAudio: true,
        testMode,
      }
    );

    if (response.error) {
      throw new Error(response.error);
    }

    if (!response.info) {
      throw new Error('No text information received from server');
    }

    if (!response.audio) {
      throw new Error('No audio data received from server');
    }

    // Validate audio format
    if (typeof response.audio !== 'string' || !response.audio.match(/^[A-Za-z0-9+/=]+$/)) {
      throw new Error('Invalid audio data format received');
    }

    return {
      text: response.info,
      audio: response.audio,
    };
  }

  /**
   * Validate audio data format
   */
  static validateAudioData(audioData: string): boolean {
    return typeof audioData === 'string' && 
           audioData.length > 0 && 
           audioData.match(/^[A-Za-z0-9+/=]+$/) !== null;
  }

  /**
   * Validate user location
   */
  static validateUserLocation(location: UserLocation): boolean {
    return (
      typeof location.lat === 'number' &&
      typeof location.lng === 'number' &&
      location.lat >= -90 &&
      location.lat <= 90 &&
      location.lng >= -180 &&
      location.lng <= 180
    );
  }

  /**
   * Get error message for common failures
   */
  static getErrorMessage(error: any): string {
    if (typeof error === 'string') {
      return error;
    }

    if (error instanceof Error) {
      // Handle specific error types
      if (error.message.includes('network')) {
        return 'Network error. Please check your internet connection and try again.';
      }
      
      if (error.message.includes('timeout')) {
        return 'Request timed out. Please try again.';
      }
      
      if (error.message.includes('permission')) {
        return 'Permission denied. Please check your app permissions.';
      }
      
      return error.message;
    }

    return 'An unexpected error occurred. Please try again.';
  }
}