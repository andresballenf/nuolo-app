/**
 * OpenAI TTS Provider
 *
 * Uses gpt-4o-mini-tts with fallback to gpt-4o-audio-preview and tts-1.
 * This is the existing behavior extracted into a provider interface.
 */

import type { TTSProvider, TTSProviderResult } from './factory.ts';

const VOICE_MAP: Record<string, string> = {
  'casual': 'alloy',
  'formal': 'onyx',
  'energetic': 'nova',
  'calm': 'shimmer',
};

export class OpenAITTSProvider implements TTSProvider {
  readonly name = 'openai';
  private apiKey: string;

  constructor() {
    this.apiKey = Deno.env.get('OPENAI_API_KEY') ?? '';
  }

  mapVoiceStyle(voiceStyle: string | undefined): string {
    if (!voiceStyle) return 'alloy';
    return VOICE_MAP[voiceStyle] || voiceStyle;
  }

  async generateSpeech(
    text: string,
    voice: string,
    _language: string,
    speed: number,
  ): Promise<TTSProviderResult> {
    const candidateModels = ['gpt-4o-mini-tts', 'gpt-4o-audio-preview', 'tts-1'];
    let lastError: Error | null = null;

    for (const model of candidateModels) {
      const response = await fetch('https://api.openai.com/v1/audio/speech', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model,
          input: text,
          voice,
          response_format: 'mp3',
          speed,
        }),
      });

      if (response.ok) {
        return {
          audioBuffer: await response.arrayBuffer(),
          contentType: 'audio/mpeg',
        };
      }

      const errorText = await response.text();
      lastError = new Error(`OpenAI TTS API error (${model}): ${response.status} - ${errorText}`);
      console.warn(`[openaiTTS] Model failed (${model}), trying next fallback:`, lastError.message);
    }

    throw lastError || new Error('All OpenAI TTS models failed');
  }
}
