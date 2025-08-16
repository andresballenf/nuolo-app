import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { generateAttractionInfo } from './openaiService.ts';
import { processAudioGeneration } from './audioProcessor.ts';

// Import new chunking services with error handling
let AudioStreamGenerator: any;
let TTSChunkService: any;
let AudioGenerationOptions: any;

try {
  const audioStreamModule = await import('./audioStreamGenerator.ts');
  AudioStreamGenerator = audioStreamModule.AudioStreamGenerator;
  AudioGenerationOptions = audioStreamModule.AudioGenerationOptions;
  
  const ttsChunkModule = await import('./ttsChunkService.ts');
  TTSChunkService = ttsChunkModule.TTSChunkService;
} catch (error) {
  console.warn('New chunking modules not available, using fallback:', error);
}

const openAiApiKey = Deno.env.get('OPENAI_API_KEY');

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
};

function buildFallbackInfo(attractionName: string | undefined, theme: string | undefined) {
  const name = attractionName || 'this spot';
  const topic = theme || 'history and culture';
  return `Here's a quick overview of ${name} while I reconnect. This place has layers of ${topic} woven into its streets and stories. Take a slow look around—notice the textures, the sounds, and the rhythm of people passing by. If you have a moment, step a little closer to any plaque or architectural detail you see; small clues often reveal the best stories.`;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const pathname = url.pathname;
    
    // Parse request body
    const requestData = await req.json();
    const {
      attractionName,
      attractionAddress,
      userLocation,
      preferences = {},
      generateAudio = false,
      streamAudio = false,
      testMode = false,
      existingText,
      useChunkedAudio = false // New flag for chunked audio generation
    } = requestData;

    console.log("Request received:", {
      attractionName,
      language: preferences?.language || 'en',
      testMode,
      streamAudio,
      useChunkedAudio,
      voiceStyle: preferences?.voiceStyle || 'casual'
    });

    // Generate or use existing text
    let generatedInfo = existingText;
    if (!generatedInfo) {
      try {
        generatedInfo = await generateAttractionInfo(
          attractionName,
          attractionAddress,
          userLocation,
          preferences,
          openAiApiKey
        );
      } catch (textError) {
        console.error('Text generation error:', textError);
        generatedInfo = buildFallbackInfo(attractionName, preferences?.theme);
      }
    }

    // Handle chunked audio generation with streaming (if available)
    if (generateAudio && useChunkedAudio && AudioStreamGenerator && TTSChunkService) {
      console.log("Starting chunked audio generation...");
      
      // Prepare audio generation options
      const audioOptions: AudioGenerationOptions = {
        text: generatedInfo,
        voice: preferences.voiceStyle || 'casual',
        speed: 1.0,
        language: preferences.language || 'en',
        testMode: testMode
      };

      // If streaming is requested, return a streaming response
      if (streamAudio) {
        console.log("Streaming audio chunks...");
        
        // Create a readable stream for the response
        const stream = new ReadableStream({
          async start(controller) {
            try {
              // First, send the text content
              const textResponse = {
                type: 'text',
                content: generatedInfo,
                timestamp: Date.now()
              };
              controller.enqueue(
                new TextEncoder().encode(JSON.stringify(textResponse) + '\n')
              );

              // Get chunk statistics first
              const chunks = TTSChunkService.splitTextIntoChunks(generatedInfo);
              const stats = TTSChunkService.getChunkStatistics(chunks);
              
              // Send metadata about chunks
              const metadataResponse = {
                type: 'metadata',
                totalChunks: stats.totalChunks,
                totalCharacters: stats.totalCharacters,
                estimatedDuration: stats.estimatedTotalDuration,
                timestamp: Date.now()
              };
              controller.enqueue(
                new TextEncoder().encode(JSON.stringify(metadataResponse) + '\n')
              );

              // Stream generate audio chunks
              for await (const audioChunk of AudioStreamGenerator.streamGenerateAudio(audioOptions, openAiApiKey)) {
                const chunkResponse = {
                  type: 'audio_chunk',
                  chunk: audioChunk,
                  timestamp: Date.now()
                };
                
                // Send each chunk as a JSON line
                controller.enqueue(
                  new TextEncoder().encode(JSON.stringify(chunkResponse) + '\n')
                );
                
                console.log(`Sent chunk ${audioChunk.chunkIndex + 1}/${audioChunk.totalChunks}`);
              }

              // Send completion signal
              const completionResponse = {
                type: 'complete',
                timestamp: Date.now()
              };
              controller.enqueue(
                new TextEncoder().encode(JSON.stringify(completionResponse) + '\n')
              );
              
              controller.close();
            } catch (error) {
              console.error('Streaming error:', error);
              const errorResponse = {
                type: 'error',
                error: error.message,
                timestamp: Date.now()
              };
              controller.enqueue(
                new TextEncoder().encode(JSON.stringify(errorResponse) + '\n')
              );
              controller.close();
            }
          }
        });

        return new Response(stream, {
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/x-ndjson', // Newline-delimited JSON
            'Transfer-Encoding': 'chunked',
            'Cache-Control': 'no-cache'
          }
        });
      } else {
        // Non-streaming: Generate all chunks and return at once
        console.log("Generating all audio chunks...");
        
        try {
          const audioChunks = await AudioStreamGenerator.generateAllAudioChunks(
            audioOptions,
            openAiApiKey
          );
          
          const metadata = AudioStreamGenerator.getAudioMetadata(audioChunks);
          
          return new Response(JSON.stringify({
            info: generatedInfo,
            audioChunks: audioChunks,
            metadata: metadata,
            modelUsed: 'gpt-4o',
            ttsModel: 'tts-1-hd',
            voiceUsed: audioOptions.voice
          }), {
            headers: {
              ...corsHeaders,
              'Content-Type': 'application/json'
            }
          });
        } catch (audioError) {
          console.error('Audio generation error:', audioError);
          return new Response(JSON.stringify({
            info: generatedInfo,
            audioChunks: [],
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
    }

    // Fallback to old audio generation method if requested
    if (generateAudio && !useChunkedAudio) {
      console.log("Using fallback audio generation method...");
      try {
        const audioResponse = await processAudioGeneration(
          generatedInfo,
          preferences,
          testMode,
          false, // iosSafari
          openAiApiKey
        );
        return new Response(JSON.stringify(audioResponse), {
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json'
          }
        });
      } catch (audioError) {
        console.error('Fallback audio generation error:', audioError);
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

    // Default response: Just return the text (no audio)
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
      error: error.message,
      errorType: 'server_error'
    }), {
      status: 500,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      }
    });
  }
});