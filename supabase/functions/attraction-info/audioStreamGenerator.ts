import { TTSChunkService, TextChunk } from './ttsChunkService.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { startTimer, endTimer, logInfo, logWarn, logError } from './secureLogger.ts';

export interface AudioChunk {
  chunkIndex: number;
  totalChunks: number;
  text: string;
  audio: string; // Base64 encoded MP3
  characterCount: number;
  estimatedDuration: number; // seconds
  estimatedMs?: number; // milliseconds
  actualDuration?: number; // Will be set after audio generation
}

export interface AudioGenerationOptions {
  text: string;
  voice: string;
  speed?: number;
  language?: string;
  testMode?: boolean;
  progressiveAudio?: boolean; // prioritize a small first chunk and concurrent pipeline
  concurrency?: number; // bounded concurrency for remaining chunks
  firstChunkTargetSeconds?: number; // ~10–15 seconds for first chunk
}

export interface VoiceMapping {
  casual: string;
  formal: string;
  energetic: string;
  calm: string;
}

export class AudioStreamGenerator {
  private static readonly OPENAI_API_URL = 'https://api.openai.com/v1/audio/speech';
  private static readonly DEFAULT_SPEED = 1.0;
  
  // Supabase Storage config
  private static readonly SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
  private static readonly SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? Deno.env.get('SUPABASE_ANON_KEY') ?? '';
  private static readonly AUDIO_BUCKET = Deno.env.get('AUDIO_CHUNKS_BUCKET') ?? 'audio-chunks';
  private static readonly TTL_SECONDS = parseInt(Deno.env.get('AUDIO_CHUNK_TTL') ?? '1209600', 10);
  
  // Voice mapping from user preferences to OpenAI voices
  private static readonly VOICE_MAP: VoiceMapping = {
    casual: 'alloy',
    formal: 'onyx',
    energetic: 'nova',
    calm: 'shimmer'
  };

  private static async sha256Hex(input: string): Promise<string> {
    const data = new TextEncoder().encode(input);
    const hash = await crypto.subtle.digest('SHA-256', data);
    const bytes = new Uint8Array(hash);
    return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
  }

  private static getSupabase() {
    return createClient(this.SUPABASE_URL, this.SERVICE_ROLE_KEY);
  }

  private static buildObjectPath(language: string, voice: string, speed: number, key: string): string {
    return `v1/${language}/${voice}/${speed.toFixed(2)}/${key}.mp3`;
  }

  /**
   * Generate audio for a single text chunk
   */
  static async generateAudioForChunk(
    chunk: TextChunk,
    voice: string,
    openAiApiKey: string,
    speed: number = this.DEFAULT_SPEED,
    language: string = 'en'
  ): Promise<AudioChunk> {
    const timerId = startTimer(`tts_chunk_${chunk.chunkIndex}`);
    try {
      logInfo('audio', `Generating audio for chunk ${chunk.chunkIndex + 1}/${chunk.totalChunks}`, {
        chunkIndex: chunk.chunkIndex,
        totalChunks: chunk.totalChunks,
        size: chunk.characterCount,
        speed,
      });

      // Content-addressed cache lookup in Supabase Storage
      const normalizedLang = (language || 'en').toLowerCase();
      const descriptor = JSON.stringify({ t: chunk.text.trim(), v: voice, l: normalizedLang, s: speed.toFixed(2), ver: 1 });
      const cacheKey = await this.sha256Hex(descriptor);
      const objectPath = this.buildObjectPath(normalizedLang, voice, speed, cacheKey);
      try {
        const { data: blob } = await this.getSupabase().storage.from(this.AUDIO_BUCKET).download(objectPath);
        if (blob) {
          const buf = await blob.arrayBuffer();
          const base64Audio = this.arrayBufferToBase64(buf);
          const actualDuration = Math.round(buf.byteLength / 16000);
          logInfo('audio', `[CACHE HIT] ${objectPath}`, { chunkIndex: chunk.chunkIndex });
          return {
            chunkIndex: chunk.chunkIndex,
            totalChunks: chunk.totalChunks,
            text: chunk.text,
            audio: base64Audio,
            characterCount: chunk.characterCount,
            estimatedDuration: chunk.estimatedDuration,
            actualDuration
          };
        }
      } catch (e) {
        logInfo('audio', `[CACHE MISS] ${objectPath}, proceeding with TTS`, { error: e?.message || e });
      }
      
      const candidateModels = ['gpt-4o-mini-tts', 'gpt-4o-audio-preview', 'tts-1'];
      let lastError: Error | null = null;

      for (const model of candidateModels) {
        const requestBody = {
          model,
          input: chunk.text,
          voice: voice,
          response_format: 'mp3',
          speed: speed
        } as const;

        const response = await fetch(this.OPENAI_API_URL, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${openAiApiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(requestBody),
        });

        if (!response.ok) {
          const errorText = await response.text();
          lastError = new Error(`TTS API error (${model}): ${response.status} - ${errorText}`);
          logWarn('audio', `OpenAI TTS API error for chunk ${chunk.chunkIndex} with model ${model}`, {
            status: response.status,
            error: errorText?.slice(0, 200)
          });
          continue;
        }

        const audioBuffer = await response.arrayBuffer();
        logInfo('audio', `Audio generated for chunk ${chunk.chunkIndex} with ${model}`, {
          bytes: audioBuffer.byteLength,
        });

        const base64Audio = this.arrayBufferToBase64(audioBuffer);
        const actualDuration = Math.round(audioBuffer.byteLength / 16000);

        // Write-through to Supabase Storage for future reuse
        try {
          const blob = new Blob([audioBuffer], { type: 'audio/mpeg' });
          const objectPath = this.buildObjectPath((language || 'en').toLowerCase(), voice, speed, await this.sha256Hex(JSON.stringify({ t: chunk.text.trim(), v: voice, l: (language || 'en').toLowerCase(), s: speed.toFixed(2), ver: 1 })));
          const { error: uploadError } = await this.getSupabase()
            .storage.from(this.AUDIO_BUCKET)
            .upload(objectPath, blob, { upsert: true, contentType: 'audio/mpeg', cacheControl: `${this.TTL_SECONDS}` });
          if (uploadError) {
            logWarn('audio', 'Failed to upload audio chunk to storage', { error: uploadError.message });
          } else {
            logInfo('audio', `[CACHE STORE] Uploaded ${objectPath}`, { chunkIndex: chunk.chunkIndex });
          }
        } catch (e) {
          logWarn('audio', 'Error uploading to storage', { error: e?.message || e });
        }

        // Adjust estimated duration based on requested speed for better accuracy
        const estimatedDuration = Math.max(1, Math.round(chunk.characterCount / (15 * Math.max(0.5, speed))));

        const duration = endTimer(timerId, `tts_chunk_${chunk.chunkIndex}`, true);
        logInfo('audio', 'Chunk generation timing', {
          chunkIndex: chunk.chunkIndex,
          durationMs: duration,
        });

        return {
          chunkIndex: chunk.chunkIndex,
          totalChunks: chunk.totalChunks,
          text: chunk.text,
          audio: base64Audio,
          characterCount: chunk.characterCount,
          estimatedDuration,
          estimatedMs: estimatedDuration * 1000,
          actualDuration: actualDuration
        };
      }

      throw lastError || new Error('All OpenAI TTS models failed for chunk generation');
    } catch (error: any) {
      endTimer(timerId, `tts_chunk_${chunk.chunkIndex}`, false);
      logError('audio', `Error generating audio for chunk ${chunk.chunkIndex}`, {
        error: error?.message || String(error)
      });
      throw new Error(`Failed to generate audio for chunk ${chunk.chunkIndex}: ${error.message}`);
    }
  }

  /**
   * Stream generate audio for all text chunks
   * If progressiveAudio is true, immediately yield a small first chunk,
   * then pipeline remaining chunks with bounded concurrency.
   */
  static async *streamGenerateAudio(
    options: AudioGenerationOptions,
    openAiApiKey: string
  ): AsyncGenerator<AudioChunk, void, unknown> {
    // Map voice style to OpenAI voice
    const openAiVoice = this.mapVoiceToOpenAI(options.voice);
    const speed = options.speed || this.DEFAULT_SPEED;

    const progressive = !!options.progressiveAudio;
    const concurrency = Math.max(1, Math.min(6, options.concurrency ?? (progressive ? 3 : 1)));

    // Split text into chunks with optional priority first chunk configuration
    const textChunks = TTSChunkService.splitTextIntoChunks(options.text, {
      prioritizeFirstChunk: progressive,
      firstChunkTargetSeconds: options.firstChunkTargetSeconds ?? 12,
      avgCharsPerSecond: 15,
      maxChunkSize: 3900,
    });
    
    if (textChunks.length === 0) {
      logWarn('audio', 'No text chunks to generate audio for');
      return;
    }

    // Log chunk statistics
    const stats = TTSChunkService.getChunkStatistics(textChunks);
    logInfo('audio', 'Text chunking complete', {
      totalChunks: stats.totalChunks,
      totalCharacters: stats.totalCharacters,
      averageChunkSize: stats.averageChunkSize,
      estimatedTotalDuration: stats.estimatedTotalDuration,
      minChunkSize: stats.minChunkSize,
      maxChunkSize: stats.maxChunkSize
    });

    // Validate chunks before processing
    if (!TTSChunkService.validateChunks(textChunks)) {
      throw new Error('Invalid text chunks detected');
    }

    if (!progressive || textChunks.length === 1) {
      // Legacy sequential behavior
      for (const chunk of textChunks) {
        try {
          const audioChunk = await this.generateAudioForChunk(
            chunk,
            openAiVoice,
            openAiApiKey,
            speed,
            options.language || 'en'
          );
          yield audioChunk;
          logInfo('audio', `Streamed chunk ${chunk.chunkIndex + 1}/${chunk.totalChunks}`);
        } catch (error) {
          logError('audio', `Failed to generate chunk ${chunk.chunkIndex}`, {
            error: (error as Error).message
          });
          // Continue with next chunk even if one fails
        }
      }
      return;
    }

    // Progressive mode: generate first chunk immediately
    try {
      const firstChunk = await this.generateAudioForChunk(
        textChunks[0],
        openAiVoice,
        openAiApiKey,
        speed
      );
      yield firstChunk;
      logInfo('audio', 'Streamed priority first chunk', { index: firstChunk.chunkIndex });
    } catch (error) {
      logError('audio', 'Failed to generate first chunk in progressive mode', { error: (error as Error).message });
      // If first chunk fails, continue with remaining chunks sequentially to recover
    }

    // Pipeline remaining chunks with bounded concurrency
    const remaining = textChunks.slice(1);
    if (remaining.length === 0) return;

    let nextIdx = 0;
    const inflight = new Set<Promise<{ idx: number; result?: AudioChunk }>>();

    const startNext = () => {
      if (nextIdx >= remaining.length) return;
      const idx = nextIdx++;
      const chunk = remaining[idx];
      const p = this.generateAudioForChunk(chunk, openAiVoice, openAiApiKey, speed)
        .then((res) => ({ idx: chunk.chunkIndex, result: res }))
        .catch((err) => {
          logError('audio', `Chunk generation failed`, { index: chunk.chunkIndex, error: err?.message });
          return { idx: chunk.chunkIndex } as { idx: number; result?: AudioChunk };
        });
      inflight.add(p);
    };

    // Prime the pool
    for (let i = 0; i < concurrency && i < remaining.length; i++) {
      startNext();
    }

    while (inflight.size > 0) {
      const settled = await Promise.race(inflight);
      inflight.delete(settled as any);
      if (settled.result) {
        yield settled.result;
        logInfo('audio', 'Streamed concurrent chunk', { index: settled.idx });
      }
      startNext();
    }
  }

  /**
   * Generate all audio chunks at once (non-streaming)
   */
  static async generateAllAudioChunks(
    options: AudioGenerationOptions,
    openAiApiKey: string
  ): Promise<AudioChunk[]> {
    const chunks: AudioChunk[] = [];
    for await (const chunk of this.streamGenerateAudio(options, openAiApiKey)) {
      chunks.push(chunk);
    }
    return chunks;
  }

  /**
   * Map user voice preference to OpenAI voice
   */
  private static mapVoiceToOpenAI(voiceStyle: string): string {
    // Check if it's already an OpenAI voice name
    const openAiVoices = ['alloy', 'echo', 'fable', 'onyx', 'nova', 'shimmer'];
    if (openAiVoices.includes(voiceStyle)) {
      return voiceStyle;
    }

    // Map from user preference
    return this.VOICE_MAP[voiceStyle as keyof VoiceMapping] || 'alloy';
  }

  /**
   * Convert ArrayBuffer to base64 string
   */
  private static arrayBufferToBase64(buffer: ArrayBuffer): string {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    const chunkSize = 0x8000; // Process in 32KB chunks to avoid stack overflow
    
    for (let i = 0; i < bytes.length; i += chunkSize) {
      const chunk = bytes.slice(i, i + chunkSize);
      binary += String.fromCharCode.apply(null, Array.from(chunk));
    }
    
    return btoa(binary);
  }

  /**
   * Validate base64 audio data
   */
  static validateAudioData(base64Audio: string): boolean {
    if (!base64Audio || base64Audio.length < 100) {
      return false;
    }

    // Check if it's valid base64
    try {
      atob(base64Audio);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get metadata for generated audio chunks
   */
  static getAudioMetadata(chunks: AudioChunk[]) {
    if (!chunks || chunks.length === 0) {
      return {
        totalChunks: 0,
        totalDuration: 0,
        totalSize: 0
      };
    }

    const totalDuration = chunks.reduce(
      (sum, chunk) => sum + (chunk.actualDuration || chunk.estimatedDuration),
      0
    );

    const totalSize = chunks.reduce(
      (sum, chunk) => sum + chunk.audio.length,
      0
    );

    return {
      totalChunks: chunks.length,
      totalDuration,
      totalSize,
      averageChunkDuration: totalDuration / chunks.length,
      averageChunkSize: totalSize / chunks.length
    };
  }
}
