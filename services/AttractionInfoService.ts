import { supabase } from '../lib/supabase';
import { AudioStreamHandler, StreamHandlerCallbacks } from './AudioStreamHandler';
import { AudioChunkData } from './AudioChunkManager';
import { PerfTracer } from '../utils/perfTrace';
import { deriveSpatialHints } from '../utils/geo';

// Timed transcript segment interface used for karaoke-style highlighting
export interface TranscriptWordTiming {
  text: string;
  startMs: number;
  endMs: number;
}

export interface TranscriptSegment {
  text: string;
  startMs: number;
  endMs: number;
  words?: TranscriptWordTiming[];
}

interface UserLocation {
  lat: number;
  lng: number;
}

interface UserPreferences {
  theme: string;
  audioLength: string;
  voiceStyle: string;
  language?: string;
  aiProvider?: 'openai' | 'gemini';
}

interface AttractionInfoRequest {
  attractionName: string;
  attractionAddress: string;
  userLocation: UserLocation;
  preferences: UserPreferences;
  // Optional POI location to derive relative orientation (will not be exposed in text)
  poiLocation?: UserLocation;
  // Derived hints to help LLM with orientation without exposing raw coords
  spatialHints?: {
    bearing?: number;
    cardinal16?: string;
    cardinal8?: string;
    distanceMeters?: number;
    distanceText?: string;
    relative?: string;
  };
  userHeading?: number;
  generateAudio?: boolean;
  streamAudio?: boolean;
  testMode?: boolean;
  iosSafari?: boolean;
  existingText?: string;
  // New optional fields to control backend model behavior
  model?: string; // e.g. "gpt-4.1-mini"
  ttsModel?: string; // e.g. "gpt-4o-mini-tts"
  returnWordTimestamps?: boolean; // request sentence/word timings
  aiProvider?: 'openai' | 'gemini'; // AI provider selection
}

interface AttractionInfoResponse {
  info?: string;
  audio?: string;
  error?: string;
  transcriptSegments?: TranscriptSegment[];
  modelUsed?: string;
  voiceUsed?: string;
}

export class AttractionInfoService {
  private static streamHandler: AudioStreamHandler | null = null;
  
  /**
   * Get or create stream handler instance
   */
  private static getStreamHandler(): AudioStreamHandler {
    if (!this.streamHandler) {
      this.streamHandler = new AudioStreamHandler();
    }
    return this.streamHandler;
  }
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
      retryAttempt?: number;
      poiLocation?: UserLocation;
      userHeading?: number;
    } = {}
  ): Promise<AttractionInfoResponse> {
    const currentAttempt = options.retryAttempt || 0;
    const maxRetries = 2; // Allow up to 2 retries for timeout issues
    
    try {
      // Derive spatial hints if POI location is provided
      const spatialHints = options.poiLocation
        ? deriveSpatialHints({
            user: userLocation,
            poi: options.poiLocation,
            lang: (preferences.language || 'en') as 'en' | 'es',
            heading: options.userHeading,
          })
        : undefined;

      const requestData: AttractionInfoRequest = {
        attractionName,
        attractionAddress,
        userLocation,
        preferences: {
          ...preferences,
          language: preferences.language || 'en', // Default to English if not specified
        },
        poiLocation: options.poiLocation,
        spatialHints,
        userHeading: options.userHeading,
        generateAudio: options.generateAudio || false,
        streamAudio: options.streamAudio || false,
        testMode: options.testMode || false,
        iosSafari: false, // React Native doesn't need Safari-specific handling
        existingText: options.existingText,
        model: 'gpt-4.1-mini',
        ttsModel: 'gpt-4o-mini-tts',
        returnWordTimestamps: true,
        aiProvider: preferences.aiProvider || 'openai', // Pass AI provider selection to backend at top level
      };

      console.log('🤖 AI Provider selected:', requestData.aiProvider);

      console.log('Calling attraction-info edge function with:', {
        attractionName,
        attractionAddress,
        userLocation,
        preferences,
        options,
      });

      // Add timeout and better error handling
      // Deep-dive content can take longer, especially in other languages
      const controller = new AbortController();
      const timeoutMs = preferences.audioLength === 'deep-dive' ? 60000 : 30000; // 60s for deep-dive, 30s for others
      const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

      try {
        PerfTracer.mark('edge_call_start', { fn: 'attraction-info' });
        const callStart = Date.now();
        const { data, error } = await supabase.functions.invoke('attraction-info', {
          body: JSON.stringify(requestData),
        });

        clearTimeout(timeoutId);
        PerfTracer.mark('edge_call_end', { fn: 'attraction-info', durationMs: Date.now() - callStart });

        if (error) {
          console.error('Supabase edge function error:', error);
          // Check for specific error types
          if (error.message?.includes('Failed to send')) {
            throw new Error('Connection error: Please check your internet connection and try again');
          }
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
          transcriptSegments: data.transcriptSegments,
          modelUsed: data.modelUsed,
          voiceUsed: data.voiceUsed,
        };
      } catch (timeoutError) {
        if (controller.signal.aborted) {
          // If it's a timeout and we haven't exceeded retries, try again
          if (currentAttempt < maxRetries) {
            console.log(`Request timeout on attempt ${currentAttempt + 1}, retrying...`);
            
            // Wait a bit before retrying
            await new Promise(resolve => setTimeout(resolve, 2000));
            
            // Retry with incremented attempt counter
            return this.generateAttractionInfo(
              attractionName,
              attractionAddress,
              userLocation,
              preferences,
              { ...options, retryAttempt: currentAttempt + 1 }
            );
          }
          
          throw new Error('Request timeout: The server took too long to respond. Please try again.');
        }
        throw timeoutError;
      }
    } catch (error) {
      console.error(`Error in generateAttractionInfo (attempt ${currentAttempt + 1}):`, error);
      
      // Return a more user-friendly error message
      let errorMessage = 'Unknown error occurred';
      
      if (error instanceof Error) {
        if (error.message.includes('Connection error')) {
          errorMessage = 'Connection error: Please check your internet connection';
        } else if (error.message.includes('timeout')) {
          errorMessage = 'Request timed out. Please try again';
        } else if (error.message.includes('Failed to send')) {
          errorMessage = 'Unable to connect to server. Please check your internet connection';
        } else {
          errorMessage = error.message;
        }
      }
      
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
    testMode: boolean = false,
    extras?: { poiLocation?: UserLocation; userHeading?: number }
  ): Promise<string> {
    const response = await this.generateAttractionInfo(
      attractionName,
      attractionAddress,
      userLocation,
      preferences,
      { testMode, ...(extras || {}) }
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
    testMode: boolean = false,
    extras?: { poiLocation?: UserLocation; userHeading?: number }
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
        ...(extras || {})
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
    testMode: boolean = false,
    extras?: { poiLocation?: UserLocation; userHeading?: number }
  ): Promise<{ text: string; audio: string; transcriptSegments?: TranscriptSegment[] }> {
    const response = await this.generateAttractionInfo(
      attractionName,
      attractionAddress,
      userLocation,
      preferences,
      {
        generateAudio: true,
        streamAudio: true,
        testMode,
        ...(extras || {})
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
      transcriptSegments: response.transcriptSegments,
    };
  }

  /**
   * Preferred helper: Generate narrative text, HD TTS audio, and timed transcript
   */
  static async generateNarrativeWithAudio(
    attractionName: string,
    attractionAddress: string,
    userLocation: UserLocation,
    preferences: UserPreferences,
    testMode: boolean = false,
    extras?: { poiLocation?: UserLocation; userHeading?: number }
  ): Promise<{ text: string; audio: string; transcriptSegments?: TranscriptSegment[] }> {
    const result = await this.generateAttractionInfo(
      attractionName,
      attractionAddress,
      userLocation,
      preferences,
      {
        generateAudio: true,
        streamAudio: true,
        testMode,
        ...(extras || {})
      }
    );

    if (result.error) {
      throw new Error(result.error);
    }

    if (!result.info || !result.audio) {
      throw new Error('Incomplete narrative generation response');
    }

    return {
      text: result.info,
      audio: result.audio,
      transcriptSegments: result.transcriptSegments,
    };
  }

  /**
   * Stream generate text and audio with chunking support
   */
  static async streamGenerateTextAndAudio(
    attractionName: string,
    attractionAddress: string,
    userLocation: UserLocation,
    preferences: UserPreferences,
    callbacks: StreamHandlerCallbacks,
    testMode: boolean = false,
    extras?: { poiLocation?: UserLocation; userHeading?: number }
  ): Promise<void> {
    const streamHandler = this.getStreamHandler();
    
    const spatialHints = extras?.poiLocation
      ? deriveSpatialHints({
          user: userLocation,
          poi: extras.poiLocation,
          lang: (preferences.language || 'en') as 'en' | 'es',
          heading: extras.userHeading,
        })
      : undefined;

    const requestData: AttractionInfoRequest = {
      attractionName,
      attractionAddress,
      userLocation,
      preferences: {
        ...preferences,
        language: preferences.language || 'en',
      },
      poiLocation: extras?.poiLocation,
      spatialHints,
      userHeading: extras?.userHeading,
      generateAudio: true,
      streamAudio: true,
      testMode,
      model: 'gpt-4.1-mini',
      ttsModel: 'gpt-4o-mini-tts',
      aiProvider: preferences.aiProvider || 'openai', // Pass AI provider selection
    };

    try {
      // Use the new streaming endpoint
      const { data, error } = await supabase.functions.invoke('attraction-info', {
        body: requestData
      });
      
      // If the edge function doesn't support streaming, throw error to trigger fallback
      if (error || !data) {
        throw new Error(error?.message || 'Streaming not supported');
      }
      
      // Process the response
      if (callbacks.onText && data.info) {
        callbacks.onText(data.info);
      }
      
      if (callbacks.onComplete) {
        callbacks.onComplete();
      }
    } catch (error) {
      console.error('Stream generation error:', error);
      if (callbacks.onError) {
        callbacks.onError(error instanceof Error ? error.message : 'Stream generation failed');
      }
    }
  }

  /**
   * Generate text and audio chunks (non-streaming)
   */
  static async generateTextAndAudioChunks(
    attractionName: string,
    attractionAddress: string,
    userLocation: UserLocation,
    preferences: UserPreferences,
    testMode: boolean = false,
    extras?: { poiLocation?: UserLocation; userHeading?: number }
  ): Promise<{
    text: string;
    chunks: AudioChunkData[];
    metadata: any;
  }> {
    const streamHandler = this.getStreamHandler();
    
    const spatialHints = extras?.poiLocation
      ? deriveSpatialHints({
          user: userLocation,
          poi: extras.poiLocation,
          lang: (preferences.language || 'en') as 'en' | 'es',
          heading: extras.userHeading,
        })
      : undefined;

    const requestData: AttractionInfoRequest = {
      attractionName,
      attractionAddress,
      userLocation,
      preferences: {
        ...preferences,
        language: preferences.language || 'en',
      },
      poiLocation: extras?.poiLocation,
      spatialHints,
      userHeading: extras?.userHeading,
      generateAudio: true,
      streamAudio: false, // Batch mode
      testMode,
      model: 'gpt-4.1-mini',
      ttsModel: 'gpt-4o-mini-tts',
      aiProvider: preferences.aiProvider || 'openai', // Pass AI provider selection
    };

    try {
      const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || '';
      const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '';
      
      PerfTracer.mark('edge_fetch_chunks_start');
      const fetchStart = Date.now();
      const result = await streamHandler.fetchAudioChunks(
        `${supabaseUrl}/functions/v1/attraction-info`,
        { ...requestData, supabaseAnonKey }
      );
      PerfTracer.mark('edge_fetch_chunks_end', { durationMs: Date.now() - fetchStart });
      
      return result;
    } catch (error) {
      console.error('Chunk generation error:', error);
      throw new Error(
        error instanceof Error ? error.message : 'Failed to generate audio chunks'
      );
    }
  }

  /**
   * Cancel any ongoing streaming
   */
  static cancelStreaming() {
    if (this.streamHandler) {
      this.streamHandler.cancel();
    }
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
