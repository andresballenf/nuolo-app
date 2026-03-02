import * as FileSystem from 'expo-file-system';
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
  lastAccessedAt: number;
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
 * - Uses synchronous FNV-1a hash (~0.1ms) instead of async SHA-256 (~10-20ms)
 * - Persists audio files to FileSystem.documentDirectory for offline playback
 * - Stores metadata with TTL + LRU tracking in AsyncStorage
 * - Enforces 200MB disk budget via LRU eviction
 * - Provides helpers for background prefetch
 */
export class AudioCacheService {
  private static instance: AudioCacheService | null = null;
  private static readonly STORAGE_META_PREFIX = 'audio_cache_meta:';
  private static readonly CACHE_DIR = `${FileSystem.documentDirectory}audio_cache/`;
  private static readonly DEFAULT_TTL_MS = 14 * 24 * 60 * 60 * 1000; // 14 days
  private static readonly VERSION = 2; // bumped for FNV-1a migration
  private static readonly MAX_CACHE_BYTES = 200 * 1024 * 1024; // 200 MB
  private static readonly AVG_CHUNK_BYTES = 480_000; // ~480KB per audio chunk (estimated)

  // Optional: de-duplicate concurrent prefetch/fetches per key
  private inFlight: Map<string, Promise<string | null>> = new Map();

  // In-memory index for fast LRU decisions (populated lazily)
  private metaIndex: Map<string, { lastAccessedAt: number; sizeBytes: number }> = new Map();
  private metaIndexLoaded = false;
  private evictionRunning = false;

  static getInstance(): AudioCacheService {
    if (!AudioCacheService.instance) {
      AudioCacheService.instance = new AudioCacheService();
    }
    return AudioCacheService.instance;
  }

  // ─── Public API ──────────────────────────────────────────────

  /**
   * Build a content-addressed cache key using synchronous FNV-1a.
   * ~100x faster than the previous async SHA-256 approach.
   */
  async buildKey(params: AudioCacheKeyParams): Promise<string> {
    const normalized = this.buildNormalizedDescriptor(params);
    const json = JSON.stringify(normalized);
    return AudioCacheService.fnv1aHash(json);
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
        this.metaIndex.delete(key);
        TelemetryService.increment('audio_cache_expired');
        return null;
      }

      // File existence check
      const info = await FileSystem.getInfoAsync(meta.fileUri);
      if (!info.exists) {
        await this.delete(key, meta.fileUri);
        this.metaIndex.delete(key);
        TelemetryService.increment('audio_cache_stale_missing_file');
        return null;
      }

      // Update last-accessed timestamp (fire-and-forget for speed)
      const now = Date.now();
      meta.lastAccessedAt = now;
      storage.setObject(AudioCacheService.STORAGE_META_PREFIX + key, meta).catch(() => {});
      this.metaIndex.set(key, {
        lastAccessedAt: now,
        sizeBytes: meta.sizeBytes || AudioCacheService.AVG_CHUNK_BYTES,
      });

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
    const cleanBase64 = base64Audio.replace(/^data:audio\/[^;]+;base64,/, '');
    await FileSystem.writeAsStringAsync(filePath, cleanBase64, { encoding: FileSystem.EncodingType.Base64 });

    // Estimate file size from base64 length (~75% of base64 length = binary size)
    const estimatedSize = Math.round(cleanBase64.length * 0.75);

    const now = Date.now();
    const meta: AudioCacheMetadata = {
      key,
      fileUri: filePath,
      createdAt: now,
      lastAccessedAt: now,
      ttlMs,
      etag,
      sizeBytes: estimatedSize,
      voice: this.mapVoiceStyleToOpenAI(params.voiceStyle),
      language: params.language || 'en',
      speed: params.speed || 1.0,
      version: AudioCacheService.VERSION,
    };

    await storage.setObject(AudioCacheService.STORAGE_META_PREFIX + key, meta);
    this.metaIndex.set(key, { lastAccessedAt: now, sizeBytes: estimatedSize });
    TelemetryService.increment('audio_cache_saved');

    // Trigger LRU eviction in background if we might be over budget
    this.maybeEvict();

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

  // ─── Internals ───────────────────────────────────────────────

  /**
   * FNV-1a hash — synchronous, ~0.1ms per call.
   * Produces a 16-char hex string (64-bit, split into two 32-bit halves).
   * Not cryptographic, but perfectly adequate for content-addressed cache keys.
   */
  private static fnv1aHash(input: string): string {
    // FNV-1a 32-bit (first half)
    let h1 = 0x811c9dc5;
    for (let i = 0; i < input.length; i++) {
      h1 ^= input.charCodeAt(i);
      h1 = Math.imul(h1, 0x01000193);
    }

    // FNV-1a 32-bit (second half, seeded differently for more bits)
    let h2 = 0x050c5d1f;
    for (let i = 0; i < input.length; i++) {
      h2 ^= input.charCodeAt(i);
      h2 = Math.imul(h2, 0x01000193);
    }

    const hex1 = (h1 >>> 0).toString(16).padStart(8, '0');
    const hex2 = (h2 >>> 0).toString(16).padStart(8, '0');
    return hex1 + hex2;
  }

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

  private buildNormalizedDescriptor(params: AudioCacheKeyParams): { t: string; v: string; l: string; s: string; ver: number; } {
    const text = (params.text || '').trim();
    const voice = this.mapVoiceStyleToOpenAI(params.voiceStyle);
    const language = (params.language || 'en').toLowerCase();
    const speedNum = typeof params.speed === 'number' && !Number.isNaN(params.speed) ? params.speed : 1.0;
    const speed = speedNum.toFixed(2);

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

  // ─── LRU Eviction ───────────────────────────────────────────

  /**
   * Lazy-load the meta index from AsyncStorage.
   * Scans all keys with the cache prefix once per session.
   */
  private async loadMetaIndex(): Promise<void> {
    if (this.metaIndexLoaded) return;
    try {
      const allKeys = await storage.getAllKeys();
      const cacheKeys = allKeys.filter((k: string) => k.startsWith(AudioCacheService.STORAGE_META_PREFIX));

      for (const storageKey of cacheKeys) {
        const meta = await storage.getObject<AudioCacheMetadata>(storageKey);
        if (meta) {
          this.metaIndex.set(meta.key, {
            lastAccessedAt: meta.lastAccessedAt || meta.createdAt,
            sizeBytes: meta.sizeBytes || AudioCacheService.AVG_CHUNK_BYTES,
          });
        }
      }
    } catch (e) {
      console.warn('AudioCacheService loadMetaIndex error:', e);
    }
    this.metaIndexLoaded = true;
  }

  /**
   * Trigger LRU eviction if estimated total size exceeds the budget.
   * Runs in background — does not block the calling save().
   */
  private maybeEvict(): void {
    if (this.evictionRunning) return;

    // Quick estimate from in-memory index
    let totalSize = 0;
    for (const entry of this.metaIndex.values()) {
      totalSize += entry.sizeBytes;
    }

    if (totalSize <= AudioCacheService.MAX_CACHE_BYTES) return;

    this.evictionRunning = true;
    this.runEviction(totalSize).finally(() => {
      this.evictionRunning = false;
    });
  }

  private async runEviction(currentTotalSize: number): Promise<void> {
    await this.loadMetaIndex();

    // Sort by lastAccessedAt ascending (oldest first)
    const entries = Array.from(this.metaIndex.entries())
      .sort((a, b) => a[1].lastAccessedAt - b[1].lastAccessedAt);

    let remaining = currentTotalSize;
    const target = AudioCacheService.MAX_CACHE_BYTES * 0.8; // Evict down to 80% to avoid thrashing
    let evicted = 0;

    for (const [key, entry] of entries) {
      if (remaining <= target) break;

      try {
        const meta = await storage.getObject<AudioCacheMetadata>(AudioCacheService.STORAGE_META_PREFIX + key);
        if (meta) {
          await this.delete(key, meta.fileUri);
          remaining -= entry.sizeBytes;
          this.metaIndex.delete(key);
          evicted++;
        }
      } catch (e) {
        console.warn('AudioCacheService eviction error for key:', key, e);
      }
    }

    if (evicted > 0) {
      console.log(`[AudioCacheService] LRU eviction: removed ${evicted} entries, freed ~${Math.round((currentTotalSize - remaining) / 1024 / 1024)}MB`);
      TelemetryService.increment('audio_cache_eviction_count', evicted);
    }
  }
}
