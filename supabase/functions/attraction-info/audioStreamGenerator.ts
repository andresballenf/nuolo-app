import { TTSChunkService, TextChunk } from './ttsChunkService.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

export interface AudioChunk {
  chunkIndex: number;
  totalChunks: number;
  text: string;
  audio: string; // Base64 encoded MP3
  characterCount: number;
  estimatedDuration: number;
  actualDuration?: number; // Will be set after audio generation
}

export interface AudioGenerationOptions {
  text: string;
  voice: string;
  speed?: number;
  language?: string;
  testMode?: boolean;
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
    try {
      console.log(`Generating audio for chunk ${chunk.chunkIndex + 1}/${chunk.totalChunks}`);
      console.log(`Chunk size: ${chunk.characterCount} characters`);

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
          console.log(`[CACHE HIT] ${objectPath}`);
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
        console.log(`[CACHE MISS] ${objectPath}, proceeding with TTS`, e?.message || e);
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
        };

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
          console.warn(`OpenAI TTS API error for chunk ${chunk.chunkIndex} with model ${model}:`, errorText);
          continue;
        }

        const audioBuffer = await response.arrayBuffer();
        console.log(`Audio generated for chunk ${chunk.chunkIndex} with ${model}, size: ${audioBuffer.byteLength} bytes`);

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
            console.warn('Failed to upload audio chunk to storage:', uploadError);
          } else {
            console.log(`[CACHE STORE] Uploaded ${objectPath}`);
          }
        } catch (e) {
          console.warn('Error uploading to storage:', e);
        }

        return {
          chunkIndex: chunk.chunkIndex,
          totalChunks: chunk.totalChunks,
          text: chunk.text,
          audio: base64Audio,
          characterCount: chunk.characterCount,
          estimatedDuration: chunk.estimatedDuration,
          actualDuration: actualDuration
        };
      }

      throw lastError || new Error('All OpenAI TTS models failed for chunk generation');
    } catch (error) {
      console.error(`Error generating audio for chunk ${chunk.chunkIndex}:`, error);
      throw new Error(`Failed to generate audio for chunk ${chunk.chunkIndex}: ${error.message}`);
    }
  }

  /**
   * Stream generate audio for all text chunks
   */
  static async *streamGenerateAudio(
    options: AudioGenerationOptions,
    openAiApiKey: string
  ): AsyncGenerator<AudioChunk, void, unknown> {
    // Map voice style to OpenAI voice
    const openAiVoice = this.mapVoiceToOpenAI(options.voice);
    const speed = options.speed || this.DEFAULT_SPEED;

    // Split text into chunks
    const textChunks = TTSChunkService.splitTextIntoChunks(options.text);
    
    if (textChunks.length === 0) {
      console.warn('No text chunks to generate audio for');
      return;
    }

    // Log chunk statistics
    const stats = TTSChunkService.getChunkStatistics(textChunks);
    console.log('Text chunking complete:', {
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

    // Generate audio for each chunk and yield as it's ready
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
        
        console.log(`Streamed chunk ${chunk.chunkIndex + 1}/${chunk.totalChunks}`);
      } catch (error) {
        console.error(`Failed to generate chunk ${chunk.chunkIndex}:`, error);
        // Continue with next chunk even if one fails
        // The client will handle missing chunks
      }
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
