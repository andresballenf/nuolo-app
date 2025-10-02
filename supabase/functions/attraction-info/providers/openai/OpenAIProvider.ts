// OpenAI Provider Implementation
// Wraps existing openaiService.ts logic into IAIProvider interface

import { generatePrompt } from '../../promptGenerator.ts';
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
    const prompt = generatePrompt(
      options.attractionName,
      options.attractionAddress || '',
      options.userLocation,
      options.preferences
    );

    const language = options.preferences?.language || 'en';
    console.log(`[OpenAI] Generating content in language: ${language}`);

    const fallbackModels = [
      'gpt-4o',
      'gpt-4o-mini',
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
    console.log('[OpenAI] Audio generation options:', {
      model: 'tts-1-hd',
      voice: options.voice,
      textLength: text.length,
      speed: options.speed || 1.0,
    });

    const audioOptions = {
      model: 'tts-1-hd',
      input: text,
      voice: this.mapVoiceStyle(options.voice),
      speed: options.speed || 1.0,
    };

    try {
      const audioData = await this.callTts('tts-1-hd', audioOptions);
      console.log('[OpenAI] Received audio buffer (primary). Size:', audioData.byteLength);

      const audioBase64 = arrayBufferToBase64(audioData);

      return {
        audioData,
        audioBase64,
        format: 'mp3',
        voiceUsed: audioOptions.voice,
        modelUsed: 'tts-1-hd',
      };
    } catch (primaryErr) {
      console.warn('[OpenAI] Primary TTS failed, falling back to tts-1:', primaryErr);

      const fallbackAudioData = await this.callTts('tts-1', audioOptions);
      console.log('[OpenAI] Received audio buffer (fallback). Size:', fallbackAudioData.byteLength);

      const audioBase64 = arrayBufferToBase64(fallbackAudioData);

      return {
        audioData: fallbackAudioData,
        audioBase64,
        format: 'mp3',
        voiceUsed: audioOptions.voice,
        modelUsed: 'tts-1',
      };
    }
  }

  // Private methods (migrated from openaiService.ts)

  private async callChatModel(model: string, prompt: string, language: string): Promise<string> {
    const languageNames: Record<string, string> = {
      en: 'English',
      es: 'Spanish',
      fr: 'French',
      de: 'German',
      it: 'Italian',
      pt: 'Portuguese',
      ru: 'Russian',
      ja: 'Japanese',
      ko: 'Korean',
      zh: 'Chinese (Simplified)',
    };

    const targetLanguage = languageNames[language] || 'English';
    const languageInstruction =
      language && language !== 'en'
        ? `IMPORTANT: You MUST respond ENTIRELY in ${targetLanguage}. Every word of your response must be in ${targetLanguage}, not English.`
        : '';

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
            content: `You are a local tour guide speaking live to visitors, not writing a book or article.

Respond in a clear, natural, conversational tone as if speaking aloud. Use contractions, short sentences, and varied pacing so it sounds like someone talking while walking with the listener.

Instruction priority
- Identity resolution and factual accuracy
- Detail guidance depth vs brevity
- Clarity and spoken style
- Word count target (soft goal) dont try to reach a minimum if you dont have enough information

Voice and tone
- Use simple spoken language, not literary or flowery writing.
- Avoid travel blog or fiction book style.
- Limit adjectives and metaphors to what is necessary for clarity.
- Imagine you are talking live, not reading a prepared script.
- Never invent facts, myths, or stories. If little is known, say so plainly.
- Do not format as lists or headings in the final output.
Style constraints
- Use simple spoken language, not literary or flowery writing.
- Avoid travel blog or fiction book style.
- Limit adjectives and metaphors to what is necessary for clarity.
- Imagine you are talking live, not reading a prepared script.
- Never invent facts, myths, or stories. If little is known, say so plainly.
- Do not format as lists or headings in the final output.

Immersion rules
- Keep the feel spontaneous and conversational, as if walking together.
- Do not mention being an AI or that this is scripted.
- Use only the requested language. Adapt fluently without naming the language unless asked.${languageInstruction ? '\n\n' + languageInstruction : ''}`,
          },
          { role: 'user', content: prompt },
        ],
        temperature: 0.9,
        max_tokens: 800,
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
