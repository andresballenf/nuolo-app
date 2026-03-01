/**
 * Inworld TTS Provider
 *
 * Uses Inworld TTS-1.5 Max (or Mini) via REST API.
 *
 * Env vars:
 *   INWORLD_API_KEY      - Base64-encoded API key from Inworld Portal
 *   INWORLD_TTS_MODEL    - "inworld-tts-1.5-max" (default) or "inworld-tts-1.5-mini"
 *
 * API: POST https://api.inworld.ai/tts/v1alpha/text:synthesize
 * Auth: Authorization: Basic <INWORLD_API_KEY>
 */

import type { TTSProvider, TTSProviderResult } from './factory.ts';

const ENDPOINT = 'https://api.inworld.ai/tts/v1alpha/text:synthesize';

// Map user voice styles to Inworld voices.
// Inworld voices: Alex, Ashley, Craig, Deborah, Dennis, Edward, Elizabeth,
// Heitor, Julia, Maitê, Mark, Olivia, Priya, Ronald, Sarah, Shaun, Theodore, Timothy, Wendy
const VOICE_MAP: Record<string, string> = {
  'casual': 'Ashley',
  'formal': 'Edward',
  'energetic': 'Alex',
  'calm': 'Sarah',
};

// Language code mapping: Inworld uses BCP-47 style codes
const LANGUAGE_MAP: Record<string, string> = {
  'en': 'en-US',
  'es': 'es-ES',
  'fr': 'fr-FR',
  'de': 'de-DE',
  'it': 'it-IT',
  'pt': 'pt-BR',
  'ru': 'ru-RU',
  'ja': 'ja-JP',
  'ko': 'ko-KR',
  'zh': 'zh-CN',
  'nl': 'nl-NL',
  'pl': 'pl-PL',
  'hi': 'hi-IN',
  'ar': 'ar-SA',
  'he': 'he-IL',
};

export class InworldTTSProvider implements TTSProvider {
  readonly name = 'inworld';
  private apiKey: string;
  private model: string;

  constructor() {
    this.apiKey = Deno.env.get('INWORLD_API_KEY') ?? '';
    this.model = Deno.env.get('INWORLD_TTS_MODEL') ?? 'inworld-tts-1.5-max';
  }

  mapVoiceStyle(voiceStyle: string | undefined): string {
    if (!voiceStyle) return 'Ashley';
    return VOICE_MAP[voiceStyle] || voiceStyle;
  }

  async generateSpeech(
    text: string,
    voice: string,
    language: string,
    speed: number,
  ): Promise<TTSProviderResult> {
    const languageCode = LANGUAGE_MAP[language] || language;

    const requestBody: Record<string, unknown> = {
      input: { text },
      voice: { name: voice },
      output: { format: 'MP3' },
      model: this.model,
    };

    // Add language if not English (default)
    if (languageCode && languageCode !== 'en-US') {
      (requestBody.voice as Record<string, unknown>).language_code = languageCode;
    }

    // Add speaking rate if not default
    if (speed !== 1.0) {
      requestBody.speaking_rate = speed;
    }

    const response = await fetch(ENDPOINT, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Inworld TTS API error: ${response.status} - ${errorText}`);
    }

    const contentType = response.headers.get('content-type') || '';

    // If response is raw audio (not JSON), return it directly
    if (contentType.includes('audio')) {
      return {
        audioBuffer: await response.arrayBuffer(),
        contentType: contentType || 'audio/mpeg',
      };
    }

    // Otherwise parse as JSON
    const responseData = await response.json();

    // Inworld returns base64-encoded audio in the response
    if (responseData.audio_content) {
      const binaryStr = atob(responseData.audio_content);
      const bytes = new Uint8Array(binaryStr.length);
      for (let i = 0; i < binaryStr.length; i++) {
        bytes[i] = binaryStr.charCodeAt(i);
      }
      return {
        audioBuffer: bytes.buffer,
        contentType: 'audio/mpeg',
      };
    }

    // Some Inworld endpoints return a URL to the audio file
    if (responseData.audio_url) {
      const audioResponse = await fetch(responseData.audio_url);
      if (!audioResponse.ok) {
        throw new Error(`Failed to download Inworld audio: ${audioResponse.status}`);
      }
      return {
        audioBuffer: await audioResponse.arrayBuffer(),
        contentType: 'audio/mpeg',
      };
    }

    throw new Error('Inworld TTS: unexpected response format - no audio_content or audio_url found');
  }
}
