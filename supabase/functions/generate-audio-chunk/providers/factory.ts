/**
 * TTS Provider Factory
 *
 * Configurable TTS provider system. Set TTS_PROVIDER env var to switch:
 *   - "openai"  → OpenAI gpt-4o-mini-tts (existing behavior)
 *   - "inworld" → Inworld TTS-1.5 Max/Mini
 */

import { OpenAITTSProvider } from './openaiTTS.ts';
import { InworldTTSProvider } from './inworldTTS.ts';

export interface TTSProviderResult {
  audioBuffer: ArrayBuffer;
  contentType: string; // e.g. 'audio/mpeg'
}

export interface TTSProvider {
  readonly name: string;

  generateSpeech(
    text: string,
    voice: string,
    language: string,
    speed: number,
  ): Promise<TTSProviderResult>;

  /** Map a user-facing voice style (casual/formal/energetic/calm) to a provider voice ID */
  mapVoiceStyle(voiceStyle: string | undefined): string;
}

export type TTSProviderName = 'openai' | 'inworld';

export function createTTSProvider(providerName?: string): TTSProvider {
  const name = (providerName || Deno.env.get('TTS_PROVIDER') || 'openai').toLowerCase() as TTSProviderName;

  switch (name) {
    case 'inworld':
      return new InworldTTSProvider();
    case 'openai':
    default:
      return new OpenAITTSProvider();
  }
}
