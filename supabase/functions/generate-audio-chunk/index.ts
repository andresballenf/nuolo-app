import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const openAiApiKey = Deno.env.get('OPENAI_API_KEY');

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
  language?: string;
  speed?: number;
}

interface ChunkResponse {
  chunkIndex: number;
  totalChunks: number;
  audio: string; // Base64
  characterCount: number;
  error?: string;
  cache?: 'hit' | 'miss';
  etag?: string;
}

// Map user voice preferences to OpenAI voices
const VOICE_MAP: Record<string, string> = {
  'casual': 'alloy',
  'formal': 'onyx',
  'energetic': 'nova',
  'calm': 'shimmer'
};

function mapVoiceStyle(voiceStyle?: string): string {
  if (!voiceStyle) return 'alloy';
  return VOICE_MAP[voiceStyle] || voiceStyle;
}

async function generateAudioChunk(
  text: string,
  voice: string,
  speed: number = 1.0
): Promise<ArrayBuffer> {
  const candidateModels = ['gpt-4o-mini-tts', 'gpt-4o-audio-preview', 'tts-1'];
  let lastError: Error | null = null;

  for (const model of candidateModels) {
    const response = await fetch('https://api.openai.com/v1/audio/speech', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAiApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        input: text,
        voice: voice,
        response_format: 'mp3',
        speed: speed
      }),
    });

    if (response.ok) {
      return await response.arrayBuffer();
    }

    const errorText = await response.text();
    lastError = new Error(`OpenAI TTS API error (${model}): ${response.status} - ${errorText}`);
    console.warn(`[generate-audio-chunk] TTS model failed (${model}), trying next fallback`, lastError.message);
  }

  throw lastError || new Error('All OpenAI TTS models failed');
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

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const requestData: ChunkRequest = await req.json();
    
    // Validate input
    if (!requestData.text || requestData.text.length === 0) {
      return new Response(JSON.stringify({
        error: 'Text is required',
        chunkIndex: requestData.chunkIndex || 0,
        totalChunks: requestData.totalChunks || 1
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Check text length (max 4096 for OpenAI TTS)
    if (requestData.text.length > 4096) {
      return new Response(JSON.stringify({
        error: 'Text exceeds maximum length of 4096 characters',
        chunkIndex: requestData.chunkIndex || 0,
        totalChunks: requestData.totalChunks || 1
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    console.log(`Generating audio for chunk ${requestData.chunkIndex + 1}/${requestData.totalChunks}`);
    console.log(`Text length: ${requestData.text.length} characters`);
    
    // Map voice style
    const voice = mapVoiceStyle(requestData.voiceStyle);
    const speed = requestData.speed || 1.0;
    const language = (requestData.language || 'en').toLowerCase();
    
    console.log(`Using voice: ${voice}, speed: ${speed}`);

    // Build content-addressed key and try Supabase Storage cache first
    const descriptor = JSON.stringify({ t: requestData.text.trim(), v: voice, l: language, s: speed.toFixed(2), ver: 1 });
    const cacheKey = await sha256Hex(descriptor);
    const objectPath = `v1/${language}/${voice}/${speed.toFixed(2)}/${cacheKey}.mp3`;

    const sb = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

    // Attempt cache lookup
    try {
      const { data: blob } = await sb.storage.from(AUDIO_BUCKET).download(objectPath);
      if (blob) {
        const buf = await blob.arrayBuffer();
        const base64Audio = arrayBufferToBase64(buf);
        console.log(`[CACHE HIT] ${objectPath}`);
        const response: ChunkResponse & { cache: 'hit'; etag: string } = {
          chunkIndex: requestData.chunkIndex || 0,
          totalChunks: requestData.totalChunks || 1,
          audio: base64Audio,
          characterCount: requestData.text.length,
          cache: 'hit',
          etag: cacheKey
        };
        return new Response(JSON.stringify(response), {
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json',
            'Cache-Control': `public, max-age=${TTL_SECONDS}`,
            'ETag': cacheKey,
            'X-Cache': 'HIT'
          }
        });
      }
    } catch (e) {
      console.log(`[CACHE MISS] ${objectPath} - proceeding to generate`, e?.message || e);
    }
    
    // Cache miss: Generate audio
    const audioBuffer = await generateAudioChunk(requestData.text, voice, speed);
    const base64Audio = arrayBufferToBase64(audioBuffer);

    // Write-through to Supabase Storage for future reuse
    try {
      const blob = new Blob([audioBuffer], { type: 'audio/mpeg' });
      const { error: uploadError } = await sb.storage
        .from(AUDIO_BUCKET)
        .upload(objectPath, blob, {
          upsert: true,
          contentType: 'audio/mpeg',
          cacheControl: `${TTL_SECONDS}`
        });
      if (uploadError) {
        console.warn('Failed to upload audio chunk to storage:', uploadError.message || uploadError);
      } else {
        console.log(`[CACHE STORE] Uploaded ${objectPath}`);
      }
    } catch (e) {
      console.warn('Error uploading to storage:', e);
    }
    
    // Return response
    const response: ChunkResponse & { cache: 'miss'; etag: string } = {
      chunkIndex: requestData.chunkIndex || 0,
      totalChunks: requestData.totalChunks || 1,
      audio: base64Audio,
      characterCount: requestData.text.length,
      cache: 'miss',
      etag: cacheKey
    };
    
    return new Response(JSON.stringify(response), {
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json',
        'Cache-Control': `public, max-age=${TTL_SECONDS}`,
        'ETag': cacheKey,
        'X-Cache': 'MISS'
      }
    });
    
  } catch (error) {
    console.error('Error generating audio chunk:', error);
    
    return new Response(JSON.stringify({
      error: error.message || 'Failed to generate audio chunk',
      chunkIndex: 0,
      totalChunks: 1
    }), {
      status: 500,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      }
    });
  }
});
