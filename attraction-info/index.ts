import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { generateAttractionInfo } from './openaiService.ts';
import { processAudioGeneration } from './audioProcessor.ts';
const openAiApiKey = Deno.env.get('OPENAI_API_KEY');
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
};
function buildFallbackInfo(attractionName: string | undefined, theme: string | undefined) {
  const name = attractionName || 'this spot';
  const topic = theme || 'history and culture';
  return `Here’s a quick overview of ${name} while I reconnect. This place has layers of ${topic} woven into its streets and stories. Take a slow look around—notice the textures, the sounds, and the rhythm of people passing by. If you have a moment, step a little closer to any plaque or architectural detail you see; small clues often reveal the best stories.`;
}

serve(async (req)=>{
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      headers: corsHeaders
    });
  }
  try {
    const { attractionName, attractionAddress, userLocation, preferences = {}, generateAudio = false, streamAudio = false, testMode = false, customText, iosSafari = false, existingText } = await req.json();
    console.log("Generating info for:", attractionName);
    console.log("User preferences:", preferences);
    console.log("Test mode:", testMode ? "ON - using shorter text" : "OFF - using full text");
    console.log("Custom text provided:", customText ? "YES" : "NO");
    console.log("Stream audio mode:", streamAudio ? "ON" : "OFF");
    console.log("iOS Safari mode:", iosSafari ? "ON" : "OFF");
    console.log("Safari optimized audio:", preferences?.safariOptimizedAudio ? "ON" : "OFF");
    // Use existingText, customText, or generate new info
    let generatedInfo = existingText || customText;
    if (!generatedInfo) {
      try {
        generatedInfo = await generateAttractionInfo(attractionName, attractionAddress, userLocation, preferences, openAiApiKey);
      } catch (textError) {
        console.error('Text generation error:', textError);
        generatedInfo = buildFallbackInfo(attractionName, preferences?.theme);
      }
    }
    // Generate audio if requested
    if (generateAudio && generatedInfo) {
      try {
        const audioResponse = await processAudioGeneration(generatedInfo, preferences, testMode, iosSafari, openAiApiKey);
        return new Response(JSON.stringify(audioResponse), {
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json'
          }
        });
      } catch (audioError) {
        console.error('Audio generation error:', audioError);
        return new Response(JSON.stringify({
          info: generatedInfo,
          audio: null,
          error: audioError.message,
          errorType: 'audio_generation'
        }), {
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json'
          }
        });
      }
    }
    return new Response(JSON.stringify({
      info: generatedInfo,
      audio: null
    }), {
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      }
    });
  } catch (error) {
    console.error('Error in attraction-info function:', error);
    return new Response(JSON.stringify({
      error: error.message
    }), {
      status: 500,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      }
    });
  }
});
