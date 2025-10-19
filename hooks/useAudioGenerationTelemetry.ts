import { useMemo } from 'react';
import { useAudio } from '../contexts/AudioContext';
import type { GenerationProgress } from '../services/AudioGenerationService';

export type GenerationStage = 'idle' | 'script' | 'first_chunk' | 'buffering' | 'ready' | 'error';

export interface TelemetryState {
  stage: GenerationStage;
  ttfpMs?: number; // measured time-to-first-playable
  etaToFirstChunkMs?: number;
  etaToCompleteMs?: number;
  progressPercent?: number; // generation progress across chunks
  label: string; // human-readable status for UI
}

/**
 * Derives progressive generation telemetry from AudioContext state.
 * Keeps transcript interactions responsive by avoiding any blocking effects.
 */
export function useAudioGenerationTelemetry(): TelemetryState {
  const audio = useAudio();

  const telemetry = useMemo<TelemetryState>(() => {
    const {
      isGeneratingAudio,
      generationError,
      generationProgress,
      isUsingChunks,
      scriptStartedAt,
      generationStartedAt,
      firstAudioAt,
    } = audio;

    const now = Date.now();

    // Baseline estimates used before we have real data
    const BASELINE_TTFP_MS = 2500; // typical 2–3s for first chunk
    const CONCURRENCY = 3; // matches AudioGenerationService MAX_CONCURRENT_REQUESTS

    // Error state takes precedence
    if (generationError) {
      return {
        stage: 'error',
        label: generationError,
      };
    }

    // Not generating and no chunks: idle or ready
    if (!isGeneratingAudio && !isUsingChunks) {
      return {
        stage: audio.currentTrack ? 'ready' : 'idle',
        label: audio.currentTrack ? 'Ready' : 'Idle',
      };
    }

    // Stage 1: script generation (before we flip to chunked generation)
    if (isGeneratingAudio && !isUsingChunks) {
      const elapsed = scriptStartedAt ? now - scriptStartedAt : undefined;
      const eta = elapsed !== undefined ? Math.max(500, 2000 - elapsed) : 2000;
      return {
        stage: 'script',
        etaToFirstChunkMs: eta + BASELINE_TTFP_MS, // rough combined ETA until first audio
        label: `Generating script… · ETA ${Math.ceil((eta + BASELINE_TTFP_MS) / 1000)}s`,
      };
    }

    // Stage 2: chunked generation is active but first chunk not yet ready
    if (isGeneratingAudio && isUsingChunks && !firstAudioAt) {
      const elapsedSinceTTS = generationStartedAt ? now - generationStartedAt : 0;
      const etaFirst = Math.max(300, BASELINE_TTFP_MS - elapsedSinceTTS);

      const label = formatFirstChunkLabel(generationProgress, etaFirst);

      return {
        stage: 'first_chunk',
        etaToFirstChunkMs: etaFirst,
        label,
      };
    }

    // Stage 3: first chunk ready or playing, keep buffering remaining
    if (isUsingChunks && firstAudioAt) {
      const progress = generationProgress;
      const total = progress?.totalChunks ?? 0;
      const done = progress?.chunksGenerated ?? 0;
      const failed = progress?.chunksFailed ?? 0;
      const remaining = Math.max(0, total - done - failed);

      // Estimate avg time per chunk from observed duration since first audio
      const elapsedSinceFirst = Math.max(1, now - firstAudioAt);
      const completedAfterFirst = Math.max(1, done - 1); // exclude first chunk from avg
      const avgChunkMs = completedAfterFirst > 0 ? elapsedSinceFirst / completedAfterFirst : 1500;
      const batches = Math.ceil(remaining / CONCURRENCY);
      const etaComplete = remaining > 0 ? Math.max(300, Math.round(batches * avgChunkMs)) : 0;

      return {
        stage: remaining > 0 ? 'buffering' : 'ready',
        etaToCompleteMs: etaComplete,
        progressPercent: total > 0 ? done / total : undefined,
        label: remaining > 0
          ? `Buffering remaining (${done}/${total}) · ETA ${Math.ceil(etaComplete / 1000)}s`
          : 'All audio ready',
      };
    }

    // Default
    return {
      stage: 'idle',
      label: 'Idle',
    };
  }, [audio]);

  return telemetry;
}

function formatFirstChunkLabel(progress?: GenerationProgress, etaMs?: number) {
  const eta = etaMs !== undefined ? ` · ETA ${Math.ceil(etaMs / 1000)}s` : '';
  if (!progress || progress.totalChunks === 0) {
    return `TTS: preparing first audio…${eta}`;
  }
  return `TTS: preparing first audio (1/${progress.totalChunks})${eta}`;
}
