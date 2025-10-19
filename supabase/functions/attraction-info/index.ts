import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { generateAttractionInfo } from './openaiService.ts';
import { processAudioGeneration } from './audioProcessor.ts';
import { applyRateLimit, recordRequestCompletion, getUserIdFromRequest } from './rateLimiter.ts';
import { AIProviderFactory } from './factory/AIProviderFactory.ts';
import type { AudioGenerationOptions as AudioGenerationOptionsType } from './audioStreamGenerator.ts';
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
import { redactSpatialSensitiveData } from './spatialRedaction.ts';

// Import new chunking services with error handling
let AudioStreamGenerator: any;
let TTSChunkService: any;

try {
  const audioStreamModule = await import('./audioStreamGenerator.ts');
  AudioStreamGenerator = audioStreamModule.AudioStreamGenerator;

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
  const rawUserId = getUserIdFromRequest(req);
  const userId: string | undefined = rawUserId ?? undefined;
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
      poiLocation,
      spatialHints,
      userHeading,
      preferences = {},
      generateAudio = false,
      streamAudio = false,
      testMode = false,
      existingText,
      useChunkedAudio = false, // New flag for chunked audio generation
      progressive_audio = false, // New flag to enable priority-first progressive streaming
      aiProvider = preferences.aiProvider || 'openai' // AI provider from preferences or top-level field
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
      progressiveAudio: progressive_audio,
      aiProvider,
      voiceStyle: preferences?.voiceStyle || 'casual',
      hasLocation: true,
      hasPreferences: Object.keys(preferences).length > 0
    });

    // Generate or use existing text with timeout protection
    let generatedInfo = existingText;
    let audioResult: any = null;
    let providerUsed = 'unknown';
    let textModelUsed = 'gpt-4.1-mini';

    // Create AI provider based on request
    let provider;
    try {
      provider = await AIProviderFactory.createProvider(aiProvider);
      providerUsed = provider.getProviderName();
      logInfo('ai', `Using AI provider: ${providerUsed}`);
    } catch (providerError) {
      logWarn('ai', `Failed to create ${aiProvider} provider, falling back to OpenAI`, {
        error: (providerError as Error).message
      });
      provider = await AIProviderFactory.createProvider('openai');
      providerUsed = 'OpenAI (fallback)';
    }

    if (!generatedInfo) {
      const textTimer = startTimer('text_generation');
      logInfo('ai', 'Starting content generation');

      try {
        // Check if provider supports simultaneous generation and audio is requested
        if (
          generateAudio &&
          provider.supportsSimultaneousGeneration() &&
          typeof provider.generateSimultaneous === 'function'
        ) {
          logInfo('ai', 'Using simultaneous content + audio generation');

          const simultaneousResult = await timeoutOpenAITextGeneration(async () => {
            return provider.generateSimultaneous!({
              attractionName: sanitizedAttractionName,
              attractionAddress: sanitizedAttractionAddress,
              userLocation,
              poiLocation,
              spatialHints,
              userHeading,
              preferences,
              text: '', // Will be generated
              voice: preferences.voiceStyle || 'casual',
              speed: 1.0,
              language: preferences.language || 'en',
              testMode,
            });
          });

          generatedInfo = simultaneousResult.content;
          textModelUsed = simultaneousResult.modelUsed || textModelUsed;
          audioResult = {
            audio: simultaneousResult.audioBase64,
            audioData: simultaneousResult.audioData,
            format: simultaneousResult.format,
            voiceUsed: simultaneousResult.voiceUsed,
          };

          const duration = endTimer(textTimer, 'simultaneous_generation', true);
          logInfo('ai', 'Simultaneous generation completed successfully', {
            duration,
            textLength: generatedInfo.length,
            audioSize: simultaneousResult.audioData.byteLength
          });
        } else {
          // Generate text only
          const contentResult = await timeoutOpenAITextGeneration(async () => {
            return provider.generateContent({
              attractionName: sanitizedAttractionName,
              attractionAddress: sanitizedAttractionAddress,
              userLocation,
              poiLocation,
              spatialHints,
              userHeading,
              preferences,
            });
          });

          generatedInfo = contentResult.content;
          textModelUsed = contentResult.modelUsed || textModelUsed;

          const duration = endTimer(textTimer, 'text_generation', true);
          logInfo('ai', 'Text generation completed successfully', {
            duration,
            textLength: generatedInfo.length,
            modelUsed: textModelUsed
          });
        }

      } catch (textError) {
        const duration = endTimer(textTimer, 'text_generation', false);
        const secureError = createSecureError(
          textError as Error,
          'ai_content_generation',
          userId
        );

        logError('ai', 'Content generation failed, using fallback', {
          duration,
          errorType: secureError.errorType,
          errorCode: secureError.errorCode
        });

        generatedInfo = buildFallbackInfo(sanitizedAttractionName, preferences?.theme);
      }
    } else {
      logInfo('ai', 'Using existing text content');
    }

    // Apply spatial redaction as a safety net (feature-flag, default ON)
    try {
      const enableRedaction = (Deno.env.get('ENABLE_SPATIAL_REDACTION') ?? 'true').toLowerCase() !== 'false';
      if (enableRedaction && typeof generatedInfo === 'string') {
        const before = generatedInfo.length;
        generatedInfo = redactSpatialSensitiveData(generatedInfo);
        const after = generatedInfo.length;
        if (before !== after) {
          logInfo('security', 'Applied spatial redaction to generated text', { before, after });
        }
      }
    } catch (_err) {
      // Never fail the request due to redaction issues
      logWarn('security', 'Spatial redaction failed, continuing without redaction');
    }

    // Handle chunked audio generation with streaming (if available)
    if (generateAudio && useChunkedAudio && AudioStreamGenerator && TTSChunkService) {
      logInfo('audio', 'Starting chunked audio generation with streaming');
      
      // Prepare audio generation options
      const audioOptions: AudioGenerationOptionsType = {
        text: generatedInfo,
        voice: preferences.voiceStyle || 'casual',
        speed: 1.0,
        language: preferences.language || 'en',
        testMode: testMode,
        progressiveAudio: progressive_audio,
        concurrency: 3,
        firstChunkTargetSeconds: 12,
      };

      // If streaming is requested, return a streaming response
      if (streamAudio) {
        logInfo('audio', 'Starting audio streaming mode');
        
        // Create a readable stream for the response
        const stream = new ReadableStream({
          async start(controller) {
            const tId = startTimer('stream_audio_generation');
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
              const chunks = TTSChunkService.splitTextIntoChunks(generatedInfo, {
                prioritizeFirstChunk: progressive_audio,
                firstChunkTargetSeconds: 12,
                avgCharsPerSecond: 15,
                maxChunkSize: 3900,
              });
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
              endTimer(tId, 'stream_audio_generation', true);
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
              endTimer(tId, 'stream_audio_generation', false);
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
          const batchTimer = startTimer('batch_chunk_generation');
          const audioChunks = await timeoutOpenAIAudioGeneration(async () => {
            return AudioStreamGenerator.generateAllAudioChunks(
              audioOptions,
              openAiApiKey
            );
          });
          endTimer(batchTimer, 'batch_chunk_generation', true);
          
          const metadata = AudioStreamGenerator.getAudioMetadata(audioChunks);
          
          requestSuccessful = true;
          return new Response(JSON.stringify({
            info: generatedInfo,
            audioChunks: audioChunks,
            metadata: metadata,
            modelUsed: textModelUsed,
            ttsModel: 'gpt-4o-mini-tts',
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
            userId ?? undefined
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

    // Generate audio separately if not already done via simultaneous generation
    if (generateAudio && !useChunkedAudio && !audioResult) {
      console.log("Generating audio separately from text...");
      try {
        const audioTimer = startTimer('audio_generation');
        const audioGenResult = await timeoutOpenAIAudioGeneration(async () => {
          return provider.generateAudio(generatedInfo, {
            text: generatedInfo,
            voice: preferences.voiceStyle || 'casual',
            speed: 1.0,
            language: preferences.language || 'en',
            testMode,
          });
        });
        endTimer(audioTimer, 'audio_generation', true);

        audioResult = {
          audio: audioGenResult.audioBase64,
          audioData: audioGenResult.audioData,
          format: audioGenResult.format,
          voiceUsed: audioGenResult.voiceUsed,
          modelUsed: audioGenResult.modelUsed || 'gpt-4o-mini-tts',
        };

        logInfo('audio', 'Audio generation completed successfully', {
          audioSize: audioGenResult.audioData.byteLength,
          format: audioGenResult.format
        });

        requestSuccessful = true;
        return new Response(JSON.stringify({
          info: generatedInfo,
          ...audioResult,
          modelUsed: textModelUsed,
        }), {
          headers: {
            ...corsHeaders,
            ...rateLimitResult.headers,
            'Content-Type': 'application/json'
          }
        });
      } catch (audioError) {
        // Close audio_generation timer as failed
        // Note: if the failure happened before the timer was created, this is a no-op
        try {
          endTimer('audio_generation', 'audio_generation', false);
        } catch (_) {}
        const secureError = createSecureError(
          audioError as Error,
          'audio_generation',
          userId ?? undefined
        );
        console.error('Audio generation error:', secureError);
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

    // If simultaneous generation already produced audio, return it
    if (audioResult) {
      requestSuccessful = true;
      return new Response(JSON.stringify({
        info: generatedInfo,
        ...audioResult,
        modelUsed: audioResult.modelUsed || textModelUsed,
      }), {
        headers: {
          ...corsHeaders,
          ...rateLimitResult.headers,
          'Content-Type': 'application/json'
        }
      });
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
      userId ?? undefined
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
