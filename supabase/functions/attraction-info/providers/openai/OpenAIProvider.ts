// OpenAI Provider Implementation
// Wraps existing openaiService.ts logic into IAIProvider interface

import { generatePrompt } from '../../promptGenerator.ts';
import type { AttractionPreferences, AttractionTheme, SupportedLanguage } from '../../promptGenerator.ts';
import {
  IAIProvider,
  AIGenerationOptions,
  AudioGenerationOptions,
  AIGenerationResult,
  AudioGenerationResult
} from '../../types/aiProvider.ts';
import { arrayBufferToBase64 } from '../../audio/AudioProcessor.ts';

export class OpenAIProvider implements IAIProvider {
  constructor(private apiKey: string) {}

  getProviderName(): string {
    return 'OpenAI';
  }

  supportsSimultaneousGeneration(): boolean {
    return false; // OpenAI requires separate text and audio calls
  }

  async generateContent(options: AIGenerationOptions): Promise<AIGenerationResult> {
    const normalizedPreferences = this.sanitizePreferences(options.preferences);
    const prompt = generatePrompt(
      options.attractionName,
      options.attractionAddress || '',
      options.userLocation,
      normalizedPreferences,
      options.poiLocation,
      options.spatialHints,
      options.situationalContext
    );

    const language = normalizedPreferences.language || 'en';
    console.log(`[OpenAI] Generating content in language: ${language}`);

    const fallbackModels = [
      'gpt-4.1-mini',
      'gpt-4o-mini',
      'gpt-4o',
      'gpt-4-turbo',
      'gpt-4',
      'gpt-3.5-turbo',
    ];

    let lastError: Error | null = null;

    for (const model of fallbackModels) {
      try {
        console.log(`[OpenAI] Attempting text generation with model: ${model}`);
        const content = await this.callChatModel(model, prompt, language);

        return {
          content,
          modelUsed: model,
        };
      } catch (err) {
        lastError = err as Error;
        console.error(`[OpenAI] Model failed (${model}):`, err);
        continue;
      }
    }

    throw new Error(lastError?.message || 'All OpenAI chat models failed');
  }

  async generateAudio(
    text: string,
    options: AudioGenerationOptions
  ): Promise<AudioGenerationResult> {
    const candidateModels = ['gpt-4o-mini-tts', 'gpt-4o-audio-preview', 'tts-1'];

    const baseOptions = {
      input: text,
      voice: this.mapVoiceStyle(options.voice),
      speed: options.speed || 1.0,
    };

    let lastError: Error | null = null;

    for (const model of candidateModels) {
      const audioOptions = { ...baseOptions, model };
      console.log('[OpenAI] Attempting audio generation with model:', {
        model,
        voice: audioOptions.voice,
        textLength: text.length,
        speed: audioOptions.speed,
      });

      try {
        const audioData = await this.callTts(model, audioOptions);
        console.log(`[OpenAI] Audio buffer received (${model}). Size:`, audioData.byteLength);

        const audioBase64 = arrayBufferToBase64(audioData);

        return {
          audioData,
          audioBase64,
          format: 'mp3',
          voiceUsed: audioOptions.voice,
          modelUsed: model,
        };
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        console.warn(`[OpenAI] TTS model failed (${model}), trying next fallback:`, lastError.message);
      }
    }

    throw new Error(lastError?.message || 'All OpenAI TTS models failed');
  }

  // Private methods (migrated from openaiService.ts)

  private async callChatModel(model: string, prompt: string, language: string): Promise<string> {
    // System prompt is now handled by promptGenerator.ts modular blocks
    // Keep minimal system-level guidance here for model behavior
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        messages: [
          {
            role: 'system',
            content: `You are a professional tour guide. Follow all instructions in the user message precisely, maintaining the voice and structure specified.`,
          },
          { role: 'user', content: prompt },
        ],
        temperature: 0.65,
        max_tokens: 1500,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      const message = data?.error?.message || 'Unknown chat error';
      throw new Error(message);
    }

    return data.choices[0].message.content;
  }

  private async callTts(model: string, audioOptions: any): Promise<ArrayBuffer> {
    const opts = { ...audioOptions, model };

    const audioResponse = await fetch('https://api.openai.com/v1/audio/speech', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(opts),
    });

    if (!audioResponse.ok) {
      const errorText = await audioResponse.text();
      throw new Error(errorText);
    }

    return audioResponse.arrayBuffer();
  }

  private sanitizePreferences(preferences?: AttractionPreferences | {
    theme?: string;
    audioLength?: 'short' | 'medium' | 'deep-dive';
    language?: string;
    voiceStyle?: string;
  }): AttractionPreferences {
    const allowedThemes: AttractionTheme[] = ['history', 'nature', 'architecture', 'culture', 'general'];
    const allowedAudioLengths = ['short', 'medium', 'deep-dive'] as const;
    const allowedLanguages: SupportedLanguage[] = ['en', 'es', 'fr', 'de', 'it', 'pt', 'ru', 'ja', 'ko', 'zh'];

    const sanitized: AttractionPreferences = {};
    const themeCandidate = typeof preferences?.theme === 'string' ? preferences.theme : undefined;
    const audioLengthCandidate = preferences?.audioLength;
    const voiceStyleCandidate = typeof preferences?.voiceStyle === 'string' ? preferences.voiceStyle : undefined;
    const languageCandidate = typeof preferences?.language === 'string' ? preferences.language : undefined;

    if (themeCandidate && allowedThemes.includes(themeCandidate as AttractionTheme)) {
      sanitized.theme = themeCandidate as AttractionTheme;
    }

    if (audioLengthCandidate && allowedAudioLengths.includes(audioLengthCandidate)) {
      sanitized.audioLength = audioLengthCandidate;
    }

    if (voiceStyleCandidate) {
      sanitized.voiceStyle = voiceStyleCandidate;
    }

    if (languageCandidate && allowedLanguages.includes(languageCandidate as SupportedLanguage)) {
      sanitized.language = languageCandidate as SupportedLanguage;
    }

    return sanitized;
  }

  private mapVoiceStyle(voiceStyle: string): string {
    // Map user preferences to OpenAI voice options
    const voiceMapping: Record<string, string> = {
      casual: 'nova',
      formal: 'onyx',
      energetic: 'shimmer',
      calm: 'alloy',
    };

    return voiceMapping[voiceStyle] || 'nova';
  }
}
