import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import "https://deno.land/x/xhr@0.1.0/mod.ts";

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
  const response = await fetch('https://api.openai.com/v1/audio/speech', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${openAiApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'tts-1-hd',
      input: text,
      voice: voice,
      response_format: 'mp3',
      speed: speed
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`OpenAI TTS API error: ${response.status} - ${errorText}`);
  }

  return await response.arrayBuffer();
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
    
    console.log(`Using voice: ${voice}, speed: ${speed}`);
    
    // Generate audio
    const audioBuffer = await generateAudioChunk(requestData.text, voice, speed);
    
    // Convert to base64
    const base64Audio = arrayBufferToBase64(audioBuffer);
    
    console.log(`Audio generated successfully. Size: ${audioBuffer.byteLength} bytes`);
    
    // Return response
    const response: ChunkResponse = {
      chunkIndex: requestData.chunkIndex || 0,
      totalChunks: requestData.totalChunks || 1,
      audio: base64Audio,
      characterCount: requestData.text.length
    };
    
    return new Response(JSON.stringify(response), {
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
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