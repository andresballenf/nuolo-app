import { useEffect, useRef, useCallback } from 'react';
import { LocationService } from '../services/LocationService';
import { AudioCacheService, type AudioCacheKeyParams } from '../services/AudioCacheService';
import { AttractionInfoService } from '../services/AttractionInfoService';
import { logger } from '../lib/logger';
import type { PointOfInterest } from '../services/GooglePlacesService';

/**
 * Proximity-based audio pre-fetching (Area 6 perf optimization).
 *
 * When the user is within PREFETCH_RADIUS_M of an attraction whose audio
 * isn't already cached, this hook generates the script text in the background,
 * splits it into TTS-sized chunks, and caches the audio via
 * AudioCacheService.prefetch().  On tap the audio plays from cache (<200ms TTFA).
 *
 * Constraints:
 *  - Only the single nearest uncached attraction is prefetched
 *  - At most 1 prefetch runs concurrently
 *  - Automatically cancels if the component unmounts
 */

const PREFETCH_RADIUS_M = 200;
const MAX_CHUNK_CHARS = 500; // aligned with AudioGenerationService chunk sizes

interface PrefetchOptions {
  voiceStyle?: string;
  language?: string;
  /** Master switch — set false to disable all prefetching */
  enabled?: boolean;
}

export function useProximityPrefetch(
  attractions: PointOfInterest[],
  userLatitude: number | null,
  userLongitude: number | null,
  options: PrefetchOptions = {},
) {
  const {
    voiceStyle = 'casual',
    language = 'en',
    enabled = true,
  } = options;

  // Track which attraction IDs we've already prefetched this session
  const prefetchedIds = useRef(new Set<string>());
  // ID of the attraction currently being prefetched (only 1 at a time)
  const activePrefetchId = useRef<string | null>(null);
  // Abort controller so we can cancel in-flight work on unmount
  const abortRef = useRef<AbortController | null>(null);

  const prefetchAttraction = useCallback(
    async (
      attraction: PointOfInterest,
      userLat: number,
      userLng: number,
    ) => {
      if (activePrefetchId.current) return; // concurrency gate
      if (prefetchedIds.current.has(attraction.id)) return;

      activePrefetchId.current = attraction.id;
      const abort = new AbortController();
      abortRef.current = abort;

      try {
        logger.info(`[Prefetch] Starting for "${attraction.name}"`);

        // ── Step 1: Generate script text (no audio) ──────────────
        const text = await AttractionInfoService.generateTextInfo(
          attraction.name,
          attraction.description || '',
          { lat: userLat, lng: userLng },
          {
            theme: 'general',
            audioLength: 'medium',
            voiceStyle,
            language,
          },
          false, // testMode
          {
            poiLocation: {
              lat: attraction.coordinate.latitude,
              lng: attraction.coordinate.longitude,
            },
          },
        );

        if (abort.signal.aborted) return;
        if (!text || text.length === 0) {
          logger.warn(`[Prefetch] Empty text for "${attraction.name}", skipping`);
          return;
        }

        // ── Step 2: Split text into TTS-sized chunks ─────────────
        const chunks = splitTextForPrefetch(text, MAX_CHUNK_CHARS);

        // ── Step 3: Build cache-key params for each chunk ────────
        const paramsList: AudioCacheKeyParams[] = chunks.map((chunk) => ({
          text: chunk,
          voiceStyle,
          language,
          speed: 1.0,
        }));

        // ── Step 4: Prefetch TTS audio (AudioCacheService deduplicates) ──
        if (abort.signal.aborted) return;
        const cache = AudioCacheService.getInstance();
        await cache.prefetch(paramsList, 1); // concurrency 1 for polite background work

        if (!abort.signal.aborted) {
          prefetchedIds.current.add(attraction.id);
          logger.info(
            `[Prefetch] Completed for "${attraction.name}" (${chunks.length} chunks)`,
          );
        }
      } catch (e) {
        if (!abort.signal.aborted) {
          logger.warn(`[Prefetch] Error for "${attraction.name}":`, e);
        }
      } finally {
        activePrefetchId.current = null;
        abortRef.current = null;
      }
    },
    [voiceStyle, language],
  );

  useEffect(() => {
    if (
      !enabled ||
      userLatitude == null ||
      userLongitude == null ||
      attractions.length === 0
    ) {
      return;
    }

    // Find the nearest uncached attraction within PREFETCH_RADIUS_M
    let nearest: PointOfInterest | null = null;
    let nearestDist = Infinity;

    for (const poi of attractions) {
      if (prefetchedIds.current.has(poi.id)) continue;

      const dist = LocationService.haversineDistance(
        userLatitude,
        userLongitude,
        poi.coordinate.latitude,
        poi.coordinate.longitude,
      );

      if (dist < PREFETCH_RADIUS_M && dist < nearestDist) {
        nearest = poi;
        nearestDist = dist;
      }
    }

    if (nearest && !activePrefetchId.current) {
      prefetchAttraction(nearest, userLatitude, userLongitude);
    }

    // Cancel in-flight prefetch on cleanup (location/attractions changed)
    return () => {
      abortRef.current?.abort();
    };
  }, [attractions, userLatitude, userLongitude, enabled, prefetchAttraction]);

  // Clean up on full unmount
  useEffect(() => {
    return () => {
      abortRef.current?.abort();
    };
  }, []);

  return {
    /** Number of attractions prefetched this session */
    prefetchedCount: prefetchedIds.current.size,
    /** Reset the prefetch tracker (e.g. on user preference change) */
    clearPrefetchCache: () => prefetchedIds.current.clear(),
  };
}

// ─── Helpers ──────────────────────────────────────────────────────────

/**
 * Split text into chunks of approximately maxChars by sentence boundaries.
 * Mirrors the chunking logic in AudioGenerationService.
 */
function splitTextForPrefetch(text: string, maxChars: number): string[] {
  const sentences = text.match(/[^.!?]+[.!?]+/g) || [text];
  const chunks: string[] = [];
  let current = '';

  for (const sentence of sentences) {
    if (current.length + sentence.length > maxChars && current.length > 0) {
      chunks.push(current.trim());
      current = sentence;
    } else {
      current += sentence;
    }
  }

  if (current.trim()) {
    chunks.push(current.trim());
  }

  return chunks;
}
