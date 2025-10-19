import * as FileSystem from 'expo-file-system';
import * as Crypto from 'expo-crypto';
import { storage } from '../lib/utils';
import { supabase } from '../lib/supabase';
import { TelemetryService } from './TelemetryService';

export interface AudioCacheKeyParams {
  text: string;
  voiceStyle: string; // can be user style or direct OpenAI voice name
  language?: string;
  speed?: number;
}

export interface AudioCacheMetadata {
  key: string;
  fileUri: string;
  createdAt: number;
  ttlMs: number;
  etag?: string;
  sizeBytes?: number;
  voice: string; // resolved OpenAI voice
  language: string;
  speed: number;
  version: number;
}

/**
 * AudioCacheService
 * - Builds content-addressed keys for audio chunks from text + voice + language + speed
 * - Persists audio files to FileSystem.documentDirectory for offline playback
 * - Stores metadata with TTL in AsyncStorage
 * - Provides helpers for background prefetch
 */
export class AudioCacheService {
  private static instance: AudioCacheService | null = null;
  private static readonly STORAGE_META_PREFIX = 'audio_cache_meta:';
  private static readonly CACHE_DIR = `${FileSystem.documentDirectory}audio_cache/`;
  private static readonly DEFAULT_TTL_MS = 14 * 24 * 60 * 60 * 1000; // 14 days
  private static readonly VERSION = 1;

  // Optional: de-duplicate concurrent prefetch/fetches per key
  private inFlight: Map<string, Promise<string | null>> = new Map();

  static getInstance(): AudioCacheService {
    if (!AudioCacheService.instance) {
      AudioCacheService.instance = new AudioCacheService();
    }
    return AudioCacheService.instance;
  }

  // Public API

  async buildKey(params: AudioCacheKeyParams): Promise<string> {
    const normalized = await this.buildNormalizedDescriptor(params);
    const json = JSON.stringify(normalized);
    const hashHex = await Crypto.digestStringAsync(
      Crypto.CryptoDigestAlgorithm.SHA256,
      json,
      { encoding: Crypto.CryptoEncoding.HEX }
    );
    return hashHex;
  }

  async getCachedUriByParams(params: AudioCacheKeyParams): Promise<string | null> {
    const key = await this.buildKey(params);
    return this.getCachedUri(key);
  }

  async getCachedUri(key: string): Promise<string | null> {
    try {
      const meta = await storage.getObject<AudioCacheMetadata>(AudioCacheService.STORAGE_META_PREFIX + key);
      if (!meta) return null;

      // TTL check
      const age = Date.now() - meta.createdAt;
      if (age > meta.ttlMs) {
        await this.delete(key, meta.fileUri);
        TelemetryService.increment('audio_cache_expired');
        return null;
      }

      // File existence check
      const info = await FileSystem.getInfoAsync(meta.fileUri);
      if (!info.exists) {
        await this.delete(key, meta.fileUri);
        TelemetryService.increment('audio_cache_stale_missing_file');
        return null;
      }

      TelemetryService.increment('audio_cache_hit');
      return meta.fileUri;
    } catch (e) {
      console.warn('AudioCacheService getCachedUri error:', e);
      return null;
    }
  }

  async saveByParams(params: AudioCacheKeyParams, base64Audio: string, ttlMs: number = AudioCacheService.DEFAULT_TTL_MS, etag?: string): Promise<{ key: string; fileUri: string; }> {
    const key = await this.buildKey(params);
    const fileUri = await this.save(key, base64Audio, params, ttlMs, etag);
    return { key, fileUri };
  }

  async save(key: string, base64Audio: string, params: AudioCacheKeyParams, ttlMs: number = AudioCacheService.DEFAULT_TTL_MS, etag?: string): Promise<string> {
    // Ensure directory exists
    await this.ensureCacheDir();

    // Construct path deterministically for content-addressed key
    const filePath = `${AudioCacheService.CACHE_DIR}${key}.mp3`;

    // Write base64 to file
    // Base64 should not contain data URI prefix
    const cleanBase64 = base64Audio.replace(/^data:audio\/[^;]+;base64,/, '');
    await FileSystem.writeAsStringAsync(filePath, cleanBase64, { encoding: FileSystem.EncodingType.Base64 });

    const meta: AudioCacheMetadata = {
      key,
      fileUri: filePath,
      createdAt: Date.now(),
      ttlMs,
      etag,
      voice: this.mapVoiceStyleToOpenAI(params.voiceStyle),
      language: params.language || 'en',
      speed: params.speed || 1.0,
      version: AudioCacheService.VERSION,
    };

    await storage.setObject(AudioCacheService.STORAGE_META_PREFIX + key, meta);
    TelemetryService.increment('audio_cache_saved');
    return filePath;
  }

  async prefetch(paramsList: AudioCacheKeyParams[], concurrency: number = 2): Promise<void> {
    const queue = [...paramsList];
    const workers: Promise<void>[] = [];

    const runWorker = async () => {
      while (queue.length > 0) {
        const params = queue.shift()!;
        const key = await this.buildKey(params);

        // Skip if exists
        const existing = await this.getCachedUri(key);
        if (existing) continue;

        // De-duplicate concurrent prefetches
        if (this.inFlight.has(key)) {
          await this.inFlight.get(key);
          continue;
        }

        const p = (async () => {
          try {
            // Ask backend to generate chunk and save locally
            const { data, error } = await supabase.functions.invoke<any>('generate-audio-chunk', {
              body: {
                text: params.text,
                chunkIndex: 0,
                totalChunks: 1,
                voiceStyle: params.voiceStyle,
                language: params.language || 'en',
                speed: params.speed || 1.0,
              }
            });
            if (error || !data || !data.audio) {
              console.warn('AudioCacheService prefetch error:', error || data);
              return null;
            }

            await this.save(key, data.audio, params, AudioCacheService.DEFAULT_TTL_MS, data.etag);
            TelemetryService.increment('audio_cache_prefetch_success');
            return 'ok';
          } catch (e) {
            console.warn('AudioCacheService prefetch failed:', e);
            TelemetryService.increment('audio_cache_prefetch_failed');
            return null;
          } finally {
            this.inFlight.delete(key);
          }
        })();

        this.inFlight.set(key, p.then(() => null));
        await p;
      }
    };

    for (let i = 0; i < concurrency; i++) {
      workers.push(runWorker());
    }

    await Promise.all(workers);
  }

  // Internals

  private async ensureCacheDir() {
    const info = await FileSystem.getInfoAsync(AudioCacheService.CACHE_DIR);
    if (!info.exists) {
      await FileSystem.makeDirectoryAsync(AudioCacheService.CACHE_DIR, { intermediates: true });
    }
  }

  private async delete(key: string, fileUri: string) {
    try {
      await FileSystem.deleteAsync(fileUri, { idempotent: true });
    } catch {}
    await storage.removeItem(AudioCacheService.STORAGE_META_PREFIX + key);
  }

  private async buildNormalizedDescriptor(params: AudioCacheKeyParams): Promise<{ t: string; v: string; l: string; s: string; ver: number; }> {
    const text = (params.text || '').trim();
    const voice = this.mapVoiceStyleToOpenAI(params.voiceStyle);
    const language = (params.language || 'en').toLowerCase();
    const speedNum = typeof params.speed === 'number' && !Number.isNaN(params.speed) ? params.speed : 1.0;
    const speed = speedNum.toFixed(2); // normalize to 2 decimals

    return { t: text, v: voice, l: language, s: speed, ver: AudioCacheService.VERSION };
  }

  private mapVoiceStyleToOpenAI(voiceStyle: string): string {
    const map: Record<string, string> = {
      casual: 'alloy',
      formal: 'onyx',
      energetic: 'nova',
      calm: 'shimmer',
    };
    const openAiVoices = ['alloy', 'echo', 'fable', 'onyx', 'nova', 'shimmer'];
    if (openAiVoices.includes(voiceStyle)) {
      return voiceStyle;
    }
    return map[voiceStyle] || 'alloy';
  }
}
