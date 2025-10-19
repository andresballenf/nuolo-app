import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { startTimer, endTimer, logInfo, logWarn, logError } from '../attraction-info/secureLogger.ts';

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
  voice?: string; // direct OpenAI voice (overrides voiceStyle)
  language?: string;
  speed?: number;
  segmentId?: string;
}

interface ChunkResponse {
  chunkIndex: number;
  totalChunks: number;
  audio: string; // Base64
  characterCount: number;
  estimatedMs?: number;
  segmentId?: string;
  error?: string;
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

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const requestTimer = startTimer('chunk_request');

  try {
    const requestData: ChunkRequest = await req.json();
    const { segmentId } = requestData;
    
    // Validate input
    if (!requestData.text || requestData.text.length === 0) {
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

    // Check text length (max 4096 for OpenAI TTS)
    if (requestData.text.length > 4096) {
      const res = {
        error: 'Text exceeds maximum length of 4096 characters',
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
    });
    
    // Voice selection precedence: explicit voice > voiceStyle mapping
    const voice = (requestData.voice && requestData.voice.length > 0)
      ? requestData.voice
      : mapVoiceStyle(requestData.voiceStyle);
    const speed = requestData.speed || 1.0;
    
    logInfo('audio', 'Chunk TTS parameters', { voice, speed, segmentId });

    const ttsTimer = startTimer('tts_api_call');
    // Generate audio
    const audioBuffer = await generateAudioChunk(requestData.text, voice, speed);
    const ttsDuration = endTimer(ttsTimer, 'tts_api_call', true);
    
    // Convert to base64
    const base64Audio = arrayBufferToBase64(audioBuffer);
    
    logInfo('audio', 'Audio chunk generated', {
      bytes: audioBuffer.byteLength,
      segmentId,
      ttsDurationMs: ttsDuration,
    });
    
    // Prepare response
    const estimatedMs = Math.round((requestData.text.length / 15) * (1000 / Math.max(0.5, speed)));

    const response: ChunkResponse = {
      chunkIndex: requestData.chunkIndex || 0,
      totalChunks: requestData.totalChunks || 1,
      audio: base64Audio,
      characterCount: requestData.text.length,
      estimatedMs,
      segmentId,
    };
    
    const totalDuration = endTimer(requestTimer, 'chunk_request', true);
    logInfo('audio', 'Chunk request completed', { durationMs: totalDuration, segmentId });

    return new Response(JSON.stringify(response), {
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      }
    });
    
  } catch (error: any) {
    endTimer(requestTimer, 'chunk_request', false);
    logError('audio', 'Error generating audio chunk', { error: error?.message });
    
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
