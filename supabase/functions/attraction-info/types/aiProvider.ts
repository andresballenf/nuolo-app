// AI Provider Interface - Abstraction layer for different AI services

export interface AIGenerationOptions {
  attractionName: string;
  attractionAddress?: string;
  userLocation: {
    lat: number;
    lng: number;
  };
  // Optional POI location for relative orientation derivation
  poiLocation?: {
    lat: number;
    lng: number;
  };
  // Optional pre-derived spatial hints from client
  spatialHints?: {
    bearing?: number;
    cardinal16?: string;
    cardinal8?: string;
    distanceMeters?: number;
    distanceText?: string;
    relative?: string;
  };
  userHeading?: number;
  // Optional situational context for richer narration
  situationalContext?: {
    season?: 'spring' | 'summer' | 'fall' | 'winter';
    timeOfDay?: 'morning' | 'afternoon' | 'evening' | 'night';
    crowdLevel?: 'quiet' | 'moderate' | 'busy';
    recentEvents?: string;
  };
  preferences: {
    theme?: string;
    audioLength?: 'short' | 'medium' | 'deep-dive';
    language?: string;
    voiceStyle?: 'casual' | 'formal' | 'energetic' | 'calm';
  };
}

export interface AudioGenerationOptions {
  text: string;
  voice: string;
  speed?: number;
  language?: string;
  testMode?: boolean;
}

export interface AIGenerationResult {
  content: string;
  modelUsed: string;
}

export interface AudioGenerationResult {
  audioData: ArrayBuffer;
  audioBase64: string;
  format: 'mp3' | 'wav' | 'pcm';
  voiceUsed: string;
  modelUsed?: string;
}

export interface SimultaneousGenerationResult {
  content: string;
  audioData: ArrayBuffer;
  audioBase64: string;
  format: 'mp3' | 'wav' | 'pcm';
  modelUsed: string;
  voiceUsed: string;
}

/**
 * Core AI Provider Interface
 *
 * Implementations:
 * - OpenAIProvider: Uses OpenAI GPT for text + OpenAI TTS for audio (two-step process)
 * - GeminiProvider: Uses Gemini 2.5 Flash Native Audio (single-step process)
 */
export interface IAIProvider {
  /**
   * Generate narrative content for an attraction
   */
  generateContent(options: AIGenerationOptions): Promise<AIGenerationResult>;

  /**
   * Generate audio from text
   */
  generateAudio(text: string, options: AudioGenerationOptions): Promise<AudioGenerationResult>;

  /**
   * Check if provider supports simultaneous content + audio generation
   */
  supportsSimultaneousGeneration(): boolean;

  /**
   * Generate content and audio simultaneously (if supported)
   * Throws error if not supported
   */
  generateSimultaneous?(options: AIGenerationOptions & AudioGenerationOptions): Promise<SimultaneousGenerationResult>;

  /**
   * Get provider name for logging/debugging
   */
  getProviderName(): string;
}
