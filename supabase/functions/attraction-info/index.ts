import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { generateAttractionInfo } from './openaiService.ts';
import { processAudioGeneration } from './audioProcessor.ts';
import { applyRateLimit, recordRequestCompletion, getUserIdFromRequest } from './rateLimiter.ts';
import { 
  withRequestTimeout, 
  timeoutOpenAITextGeneration, 
  timeoutOpenAIAudioGeneration,
  getHealthStatus 
} from './timeoutControls.ts';
import { 
  createSecureError, 
  getErrorStatistics
} from './secureErrorHandler.ts';
import { 
  logger,
  setLogContext,
  logInfo,
  logError,
  logWarn,
  logSecurityEvent,
  startTimer,
  endTimer,
  getLogStats
} from './secureLogger.ts';

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

// Generate unique request ID
function generateRequestId(): string {
  return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

// Security: Restrict CORS to allowed origins
const getAllowedOrigins = () => {
  // In production, only allow your domains
  const allowedOrigins = [
    'http://localhost:8081', // Expo dev server
    'http://localhost:19006', // Expo web
    'https://your-production-domain.com', // Replace with actual domain
    // Add your actual production domains here
  ];
  
  // Allow local development
  if (Deno.env.get('DENO_DEPLOYMENT_ID') === undefined) {
    allowedOrigins.push('http://localhost:3000', 'http://127.0.0.1:3000');
  }
  
  return allowedOrigins;
};

const getCorsHeaders = (origin: string | null) => {
  const allowedOrigins = getAllowedOrigins();
  const allowedOrigin = origin && allowedOrigins.includes(origin) ? origin : 'null';
  
  return {
    'Access-Control-Allow-Origin': allowedOrigin,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Credentials': 'true',
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'X-XSS-Protection': '1; mode=block'
  };
};

function buildFallbackInfo(attractionName: string | undefined, theme: string | undefined) {
  const name = attractionName || 'this spot';
  const topic = theme || 'history and culture';
  return `Here's a quick overview of ${name} while I reconnect. This place has layers of ${topic} woven into its streets and stories. Take a slow look around—notice the textures, the sounds, and the rhythm of people passing by. If you have a moment, step a little closer to any plaque or architectural detail you see; small clues often reveal the best stories.`;
}

serve(async (req) => {
  return withRequestTimeout(async () => {
    const origin = req.headers.get('origin');
    const corsHeaders = getCorsHeaders(origin);
    
    // Handle CORS preflight requests
    if (req.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }
    
    // Health check endpoint
    if (new URL(req.url).pathname === '/health') {
      const healthStatus = getHealthStatus();
      const errorStats = getErrorStatistics();
      const logStats = getLogStats();
      
      logInfo('health', 'Health check requested');
      
      return new Response(JSON.stringify({
        ...healthStatus,
        errorStatistics: errorStats,
        logStatistics: logStats,
        timestamp: new Date().toISOString()
      }), {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      });
    }

  // Apply rate limiting
  const rateLimitResult = await applyRateLimit(req);
  
  if (!rateLimitResult.allowed) {
    logSecurityEvent({
      type: 'rate_limit',
      action: 'request_blocked',
      result: 'blocked',
      severity: 'medium',
      metadata: {
        retryAfter: rateLimitResult.retryAfter,
        clientIP: req.headers.get('x-forwarded-for') || 'unknown'
      }
    });
    
    return new Response(JSON.stringify({
      error: rateLimitResult.error,
      errorType: 'rate_limit_exceeded',
      retryAfter: rateLimitResult.retryAfter
    }), {
      status: 429,
      headers: {
        ...corsHeaders,
        ...rateLimitResult.headers,
        'Content-Type': 'application/json'
      }
    });
  }

  let requestSuccessful = false;
  const userId = getUserIdFromRequest(req);
  const requestId = generateRequestId();
  const requestTimer = startTimer('total_request');
  
  // Set logging context for this request
  setLogContext({
    requestId,
    userId,
    component: 'attraction-info',
    startTime: Date.now()
  });
  
  logInfo('request', `Starting request: ${req.method} ${new URL(req.url).pathname}`, {
    method: req.method,
    url: new URL(req.url).pathname,
    userAgent: req.headers.get('user-agent'),
    origin: req.headers.get('origin')
  });
  
  try {
    const url = new URL(req.url);
    const pathname = url.pathname;
    
    // Parse and validate request body
    const requestData = await req.json();
    
    // Input validation
    if (typeof requestData !== 'object' || requestData === null) {
      logSecurityEvent({
        type: 'input_validation',
        action: 'invalid_request_body',
        result: 'blocked',
        severity: 'low'
      });
      
      const validationError = createSecureError(
        new Error('Invalid request body'), 
        'request_validation', 
        userId
      );
      return new Response(JSON.stringify(validationError), {
        status: 400,
        headers: { ...corsHeaders, ...rateLimitResult.headers, 'Content-Type': 'application/json' }
      });
    }
    
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
    
    // Validate required fields
    if (!attractionName || typeof attractionName !== 'string' || attractionName.length > 200) {
      const validationError = createSecureError(
        new Error('Valid attraction name is required (max 200 chars)'), 
        'attraction_name_validation', 
        userId
      );
      return new Response(JSON.stringify(validationError), {
        status: 400,
        headers: { ...corsHeaders, ...rateLimitResult.headers, 'Content-Type': 'application/json' }
      });
    }
    
    if (!userLocation || typeof userLocation.lat !== 'number' || typeof userLocation.lng !== 'number') {
      const validationError = createSecureError(
        new Error('Valid user location coordinates are required'), 
        'location_validation', 
        userId
      );
      return new Response(JSON.stringify(validationError), {
        status: 400,
        headers: { ...corsHeaders, ...rateLimitResult.headers, 'Content-Type': 'application/json' }
      });
    }
    
    // Sanitize inputs to prevent injection
    const sanitizedAttractionName = attractionName.replace(/[<>]/g, '').trim();
    const sanitizedAttractionAddress = attractionAddress ? attractionAddress.replace(/[<>]/g, '').trim() : '';

    logInfo('request', 'Request parameters validated and sanitized', {
      attractionName: '[ATTRACTION_NAME]', // Don't log actual attraction name for privacy
      language: preferences?.language || 'en',
      testMode,
      streamAudio,
      useChunkedAudio,
      voiceStyle: preferences?.voiceStyle || 'casual',
      hasLocation: true,
      hasPreferences: Object.keys(preferences).length > 0
    });

    // Generate or use existing text with timeout protection
    let generatedInfo = existingText;
    if (!generatedInfo) {
      const textTimer = startTimer('text_generation');
      logInfo('ai', 'Starting text generation');
      
      try {
        generatedInfo = await timeoutOpenAITextGeneration(async () => {
          return generateAttractionInfo(
            sanitizedAttractionName,
            sanitizedAttractionAddress,
            userLocation,
            preferences,
            openAiApiKey
          );
        });
        
        const duration = endTimer(textTimer, 'text_generation', true);
        logInfo('ai', 'Text generation completed successfully', {
          duration,
          textLength: generatedInfo.length
        });
        
      } catch (textError) {
        const duration = endTimer(textTimer, 'text_generation', false);
        const secureError = createSecureError(
          textError as Error, 
          'openai_text_generation', 
          userId
        );
        
        logError('ai', 'Text generation failed, using fallback', {
          duration,
          errorType: secureError.errorType,
          errorCode: secureError.errorCode
        });
        
        generatedInfo = buildFallbackInfo(sanitizedAttractionName, preferences?.theme);
      }
    } else {
      logInfo('ai', 'Using existing text content');
    }

    // Handle chunked audio generation with streaming (if available)
    if (generateAudio && useChunkedAudio && AudioStreamGenerator && TTSChunkService) {
      logInfo('audio', 'Starting chunked audio generation with streaming');
      
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
        logInfo('audio', 'Starting audio streaming mode');
        
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
              const secureError = createSecureError(
                error as Error, 
                'audio_streaming', 
                userId
              );
              console.error('Streaming error:', secureError);
              const errorResponse = {
                type: 'error',
                error: secureError.error,
                errorCode: secureError.errorCode,
                timestamp: Date.now()
              };
              controller.enqueue(
                new TextEncoder().encode(JSON.stringify(errorResponse) + '\n')
              );
              controller.close();
            }
          }
        });

        requestSuccessful = true;
        return new Response(stream, {
          headers: {
            ...corsHeaders,
            ...rateLimitResult.headers,
            'Content-Type': 'application/x-ndjson', // Newline-delimited JSON
            'Transfer-Encoding': 'chunked',
            'Cache-Control': 'no-cache'
          }
        });
      } else {
        // Non-streaming: Generate all chunks and return at once
        console.log("Generating all audio chunks...");
        
        try {
          const audioChunks = await timeoutOpenAIAudioGeneration(async () => {
            return AudioStreamGenerator.generateAllAudioChunks(
              audioOptions,
              openAiApiKey
            );
          });
          
          const metadata = AudioStreamGenerator.getAudioMetadata(audioChunks);
          
          requestSuccessful = true;
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
              ...rateLimitResult.headers,
              'Content-Type': 'application/json'
            }
          });
        } catch (audioError) {
          const secureError = createSecureError(
            audioError as Error, 
            'openai_audio_generation', 
            userId
          );
          console.error('Audio generation error:', secureError);
          return new Response(JSON.stringify({
            info: generatedInfo,
            audioChunks: [],
            ...secureError
          }), {
            headers: {
              ...corsHeaders,
              ...rateLimitResult.headers,
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
        const audioResponse = await timeoutOpenAIAudioGeneration(async () => {
          return processAudioGeneration(
            generatedInfo,
            preferences,
            testMode,
            false, // iosSafari
            openAiApiKey
          );
        });
        requestSuccessful = true;
        return new Response(JSON.stringify(audioResponse), {
          headers: {
            ...corsHeaders,
            ...rateLimitResult.headers,
            'Content-Type': 'application/json'
          }
        });
      } catch (audioError) {
        const secureError = createSecureError(
          audioError as Error, 
          'fallback_audio_generation', 
          userId
        );
        console.error('Fallback audio generation error:', secureError);
        return new Response(JSON.stringify({
          info: generatedInfo,
          audio: null,
          ...secureError
        }), {
          headers: {
            ...corsHeaders,
            ...rateLimitResult.headers,
            'Content-Type': 'application/json'
          }
        });
      }
    }

    // Default response: Just return the text (no audio)
    requestSuccessful = true;
    const totalDuration = endTimer(requestTimer, 'total_request', true);
    
    logInfo('response', 'Returning text-only response', {
      totalDuration,
      textLength: generatedInfo.length,
      audioRequested: generateAudio
    });
    
    return new Response(JSON.stringify({
      info: generatedInfo,
      audio: null
    }), {
      headers: {
        ...corsHeaders,
        ...rateLimitResult.headers,
        'Content-Type': 'application/json'
      }
    });

  } catch (error) {
    const totalDuration = endTimer(requestTimer, 'total_request', false);
    const secureError = createSecureError(
      error as Error, 
      'server_error', 
      userId
    );
    
    logError('server', 'Request failed with unhandled error', {
      totalDuration,
      errorType: secureError.errorType,
      errorCode: secureError.errorCode,
      stack: Deno.env.get('DENO_DEPLOYMENT_ID') ? undefined : (error as Error).stack
    });
    
    return new Response(JSON.stringify(secureError), {
      status: 500,
      headers: {
        ...corsHeaders,
        ...rateLimitResult.headers,
        'Content-Type': 'application/json'
      }
    });
  } finally {
    // Record request completion for rate limiting tracking
    recordRequestCompletion(req, requestSuccessful);
    
    // Clear logging context
    logger.clearContext();
    
    logInfo('request', 'Request completed', {
      success: requestSuccessful,
      requestId
    });
  }
  }, 120000); // 2 minute timeout for entire request
});