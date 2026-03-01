import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { startTimer, endTimer, logInfo, logWarn, logError } from '../attraction-info/secureLogger.ts';
import { createTTSProvider } from './providers/factory.ts';
import { InworldStreamingTTS } from './providers/inworldStreamingTTS.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
};

interface ChunkRequest {
  text: string;
  chunkIndex: number;
  totalChunks: number;
  voiceStyle?: string;
  voice?: string; // direct voice name (overrides voiceStyle)
  language?: string;
  speed?: number;
  segmentId?: string;
  stream?: boolean; // Enable streaming mode (Inworld only)
}

interface ChunkResponse {
  chunkIndex: number;
  totalChunks: number;
  audio: string; // Base64
  characterCount: number;
  estimatedMs?: number;
  segmentId?: string;
  error?: string;
  cache?: 'hit' | 'miss';
  etag?: string;
  ttsProvider?: string;
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  const chunkSize = 0x8000; // 32KB chunks to avoid stack overflow

  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.slice(i, i + chunkSize);
    binary += String.fromCharCode.apply(null, Array.from(chunk));
  }

  return btoa(binary);
}

async function sha256Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const hash = await crypto.subtle.digest('SHA-256', data);
  const bytes = new Uint8Array(hash);
  return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
}

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? Deno.env.get('SUPABASE_ANON_KEY') ?? '';
const AUDIO_BUCKET = Deno.env.get('AUDIO_CHUNKS_BUCKET') ?? 'audio-chunks';
const TTL_SECONDS = parseInt(Deno.env.get('AUDIO_CHUNK_TTL') ?? '1209600', 10); // default 14 days

// Initialize TTS provider from env var (TTS_PROVIDER: "openai" | "inworld")
const ttsProvider = createTTSProvider();

// Max text length varies by provider; Inworld supports up to 500K, OpenAI up to 4096
const MAX_TEXT_LENGTH = ttsProvider.name === 'openai' ? 4096 : 500_000;

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const requestTimer = startTimer('chunk_request');

  try {
    const totalTimer = startTimer('ga_chunk_total');
    const requestData: ChunkRequest = await req.json();
    const { segmentId } = requestData;

    // Validate input
    if (!requestData.text || requestData.text.length === 0) {
      endTimer(totalTimer, 'ga_chunk_total', false);
      const res = {
        error: 'Text is required',
        chunkIndex: requestData.chunkIndex || 0,
        totalChunks: requestData.totalChunks || 1,
        segmentId,
      };
      return new Response(JSON.stringify(res), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Check text length
    if (requestData.text.length > MAX_TEXT_LENGTH) {
      endTimer(totalTimer, 'ga_chunk_total', false);
      const res = {
        error: `Text exceeds maximum length of ${MAX_TEXT_LENGTH} characters`,
        chunkIndex: requestData.chunkIndex || 0,
        totalChunks: requestData.totalChunks || 1,
        segmentId,
      };
      return new Response(JSON.stringify(res), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    logInfo('audio', `Generating audio chunk ${requestData.chunkIndex + 1}/${requestData.totalChunks}`, {
      chunkIndex: requestData.chunkIndex,
      totalChunks: requestData.totalChunks,
      segmentId,
      chars: requestData.text.length,
      ttsProvider: ttsProvider.name,
    });

    // Voice selection: explicit voice > voiceStyle mapping via active provider
    const voice = (requestData.voice && requestData.voice.length > 0)
      ? requestData.voice
      : ttsProvider.mapVoiceStyle(requestData.voiceStyle);
    const speed = requestData.speed || 1.0;
    const language = (requestData.language || 'en').toLowerCase();

    logInfo('audio', 'Chunk TTS parameters', { voice, speed, segmentId, provider: ttsProvider.name });

    // Build content-addressed key. Include provider name so caches don't collide.
    const descriptor = JSON.stringify({
      t: requestData.text.trim(),
      v: voice,
      l: language,
      s: speed.toFixed(2),
      p: ttsProvider.name,
      ver: 2,
    });
    const cacheKey = await sha256Hex(descriptor);
    const objectPath = `v2/${ttsProvider.name}/${language}/${voice}/${speed.toFixed(2)}/${cacheKey}.mp3`;

    const sb = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

    // ─── STREAMING MODE (Inworld only) ───────────────────────────────
    // When stream=true AND provider is Inworld, return progressive NDJSON
    // matching the StreamResponse protocol used by AudioStreamHandler.ts
    if (requestData.stream && ttsProvider.name === 'inworld') {
      logInfo('audio', 'Streaming mode requested', { chars: requestData.text.length, segmentId });

      // Cache check: if cached, return single non-streamed JSON (faster than streaming)
      try {
        const { data: cachedBlob } = await sb.storage.from(AUDIO_BUCKET).download(objectPath);
        if (cachedBlob) {
          const buf = await cachedBlob.arrayBuffer();
          const base64Audio = arrayBufferToBase64(buf);
          const estimatedMs = Math.round((requestData.text.length / 15) * (1000 / Math.max(0.5, speed)));
          logInfo('audio', `[STREAM CACHE HIT] ${objectPath}`, { segmentId });

          // Return as single-chunk NDJSON for protocol consistency
          const encoder = new TextEncoder();
          const lines = [
            JSON.stringify({ type: 'metadata', totalChunks: 1, totalCharacters: requestData.text.length, estimatedDuration: estimatedMs / 1000, timestamp: Date.now() }),
            JSON.stringify({ type: 'audio_chunk', chunk: { chunkIndex: 0, totalChunks: 1, text: '', audio: base64Audio, characterCount: requestData.text.length, estimatedDuration: estimatedMs / 1000 }, timestamp: Date.now() }),
            JSON.stringify({ type: 'complete', timestamp: Date.now() }),
          ];
          const body = encoder.encode(lines.join('\n') + '\n');

          endTimer(requestTimer, 'chunk_request', true);
          endTimer(totalTimer, 'ga_chunk_total', true);
          return new Response(body, {
            headers: {
              ...corsHeaders,
              'Content-Type': 'text/plain; charset=utf-8',
              'X-Cache': 'HIT',
              'X-TTS-Provider': ttsProvider.name,
              'X-Stream': 'true',
            }
          });
        }
      } catch (_e: any) {
        logInfo('audio', `[STREAM CACHE MISS] ${objectPath}`, { segmentId });
      }

      // Cache miss → stream from Inworld with progressive NDJSON delivery
      const streamingTTS = new InworldStreamingTTS();
      const streamVoice = (requestData.voice && requestData.voice.length > 0)
        ? requestData.voice
        : streamingTTS.mapVoiceStyle(requestData.voiceStyle);

      const allAudioBuffers: ArrayBuffer[] = []; // Collect for background caching

      const readableStream = new ReadableStream({
        async start(controller) {
          const encoder = new TextEncoder();
          const enqueue = (obj: Record<string, unknown>) => {
            controller.enqueue(encoder.encode(JSON.stringify(obj) + '\n'));
          };

          try {
            // Estimate total segments for metadata (text.length / 2000 rounded up)
            const estimatedSegments = Math.ceil(requestData.text.length / 2000);
            const estimatedDuration = Math.round((requestData.text.length / 15) * (1 / Math.max(0.5, speed)));

            // Send metadata first
            enqueue({
              type: 'metadata',
              totalChunks: estimatedSegments,
              totalCharacters: requestData.text.length,
              estimatedDuration,
              timestamp: Date.now(),
            });

            let segmentCount = 0;
            for await (const segment of streamingTTS.streamSpeech(requestData.text, streamVoice, language, speed)) {
              const base64 = arrayBufferToBase64(segment.audioBuffer);
              allAudioBuffers.push(segment.audioBuffer);

              const chunkEstMs = Math.round((segment.characterCount / 15) * (1000 / Math.max(0.5, speed)));

              enqueue({
                type: 'audio_chunk',
                chunk: {
                  chunkIndex: segment.segmentIndex,
                  totalChunks: segment.totalSegments,
                  text: '', // Not needed for playback
                  audio: base64,
                  characterCount: segment.characterCount,
                  estimatedDuration: chunkEstMs / 1000,
                },
                timestamp: Date.now(),
              });

              segmentCount++;
              logInfo('audio', `[STREAM] Sent segment ${segment.segmentIndex + 1}/${segment.totalSegments}`, {
                bytes: segment.audioBuffer.byteLength,
                segmentId,
              });
            }

            // Send completion
            enqueue({ type: 'complete', timestamp: Date.now() });
            controller.close();

            logInfo('audio', `[STREAM COMPLETE] ${segmentCount} segments streamed`, { segmentId });

            // Background: concatenate and cache full audio for future requests
            try {
              const totalLength = allAudioBuffers.reduce((sum, b) => sum + b.byteLength, 0);
              const merged = new Uint8Array(totalLength);
              let offset = 0;
              for (const buf of allAudioBuffers) {
                merged.set(new Uint8Array(buf), offset);
                offset += buf.byteLength;
              }
              const cacheBlob = new Blob([merged], { type: 'audio/mpeg' });
              const { error: uploadError } = await sb.storage
                .from(AUDIO_BUCKET)
                .upload(objectPath, cacheBlob, { upsert: true, contentType: 'audio/mpeg', cacheControl: `${TTL_SECONDS}` });
              if (uploadError) {
                logWarn('audio', '[STREAM CACHE STORE] Upload failed', { error: uploadError.message });
              } else {
                logInfo('audio', `[STREAM CACHE STORE] ${objectPath}`, { bytes: totalLength });
              }
            } catch (cacheErr: any) {
              logWarn('audio', '[STREAM CACHE STORE] Error', { error: cacheErr?.message });
            }

          } catch (err: any) {
            logError('audio', 'Streaming generation failed', { error: err?.message, segmentId });
            const encoder2 = new TextEncoder();
            controller.enqueue(encoder2.encode(JSON.stringify({
              type: 'error',
              error: err?.message || 'Streaming generation failed',
              timestamp: Date.now(),
            }) + '\n'));
            controller.close();
          }
        }
      });

      endTimer(requestTimer, 'chunk_request', true);
      endTimer(totalTimer, 'ga_chunk_total', true);

      return new Response(readableStream, {
        headers: {
          ...corsHeaders,
          'Content-Type': 'text/plain; charset=utf-8',
          'Transfer-Encoding': 'chunked',
          'X-Cache': 'MISS',
          'X-TTS-Provider': ttsProvider.name,
          'X-Stream': 'true',
        }
      });
    }

    // ─── NON-STREAMING MODE (OpenAI or Inworld without stream flag) ──

    // Attempt cache lookup
    try {
      const { data: blob } = await sb.storage.from(AUDIO_BUCKET).download(objectPath);
      if (blob) {
        const buf = await blob.arrayBuffer();
        const base64Audio = arrayBufferToBase64(buf);
        const estimatedMs = Math.round((requestData.text.length / 15) * (1000 / Math.max(0.5, speed)));
        logInfo('audio', `[CACHE HIT] ${objectPath}`, { chunkIndex: requestData.chunkIndex, segmentId });
        const response: ChunkResponse = {
          chunkIndex: requestData.chunkIndex || 0,
          totalChunks: requestData.totalChunks || 1,
          audio: base64Audio,
          characterCount: requestData.text.length,
          estimatedMs,
          segmentId,
          cache: 'hit',
          etag: cacheKey,
          ttsProvider: ttsProvider.name,
        };
        return new Response(JSON.stringify(response), {
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json',
            'Cache-Control': `public, max-age=${TTL_SECONDS}`,
            'ETag': cacheKey,
            'X-Cache': 'HIT',
            'X-TTS-Provider': ttsProvider.name,
          }
        });
      }
    } catch (e: any) {
      logInfo('audio', `[CACHE MISS] ${objectPath} - proceeding to generate`, { error: e?.message || e });
    }

    // Cache miss: Generate audio via configured provider
    const ttsTimer = startTimer('tts_api_call');
    const result = await ttsProvider.generateSpeech(requestData.text, voice, language, speed);
    const ttsDuration = endTimer(ttsTimer, 'tts_api_call', true);
    const base64Audio = arrayBufferToBase64(result.audioBuffer);

    logInfo('audio', 'Audio chunk generated', {
      bytes: result.audioBuffer.byteLength,
      segmentId,
      ttsDurationMs: ttsDuration,
      provider: ttsProvider.name,
    });

    // Write-through to Supabase Storage for future reuse
    try {
      const blob = new Blob([result.audioBuffer], { type: result.contentType });
      const { error: uploadError } = await sb.storage
        .from(AUDIO_BUCKET)
        .upload(objectPath, blob, {
          upsert: true,
          contentType: result.contentType,
          cacheControl: `${TTL_SECONDS}`
        });
      if (uploadError) {
        logWarn('audio', 'Failed to upload audio chunk to storage', { error: uploadError.message || uploadError });
      } else {
        logInfo('audio', `[CACHE STORE] Uploaded ${objectPath}`, { chunkIndex: requestData.chunkIndex });
      }
    } catch (e: any) {
      logWarn('audio', 'Error uploading to storage', { error: e?.message || e });
    }

    // Prepare response
    const estimatedMs = Math.round((requestData.text.length / 15) * (1000 / Math.max(0.5, speed)));

    const response: ChunkResponse = {
      chunkIndex: requestData.chunkIndex || 0,
      totalChunks: requestData.totalChunks || 1,
      audio: base64Audio,
      characterCount: requestData.text.length,
      estimatedMs,
      segmentId,
      cache: 'miss',
      etag: cacheKey,
      ttsProvider: ttsProvider.name,
    };

    const totalDuration = endTimer(requestTimer, 'chunk_request', true);
    endTimer(totalTimer, 'ga_chunk_total', true);
    logInfo('audio', 'Chunk request completed', { durationMs: totalDuration, segmentId, provider: ttsProvider.name });

    return new Response(JSON.stringify(response), {
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json',
        'Cache-Control': `public, max-age=${TTL_SECONDS}`,
        'ETag': cacheKey,
        'X-Cache': 'MISS',
        'X-TTS-Provider': ttsProvider.name,
      }
    });

  } catch (error: any) {
    endTimer(requestTimer, 'chunk_request', false);
    logError('audio', 'Error generating audio chunk', { error: error?.message, provider: ttsProvider.name });

    return new Response(JSON.stringify({
      error: error?.message || 'Failed to generate audio chunk',
      chunkIndex: 0,
      totalChunks: 1,
      ttsProvider: ttsProvider.name,
    }), {
      status: 500,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      }
    });
  }
});
