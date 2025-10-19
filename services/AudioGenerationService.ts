import { supabase } from '../lib/supabase';
import { TTSChunkService, TextChunk } from './TTSChunkService';
import { AudioChunkManager, AudioChunkData } from './AudioChunkManager';
import { AudioCacheService } from './AudioCacheService';
import { TelemetryService } from './TelemetryService';

export interface GenerationProgress {
  totalChunks: number;
  chunksGenerated: number;
  chunksLoading: number;
  chunksFailed: number;
  isComplete: boolean;
}

export interface GenerationCallbacks {
  onChunkGenerated?: (chunk: AudioChunkData, progress: GenerationProgress) => void;
  onChunkFailed?: (chunkIndex: number, error: string, progress: GenerationProgress) => void;
  onFirstChunkReady?: (chunk: AudioChunkData) => void;
  onComplete?: (successfulChunks: number, totalChunks: number) => void;
  onProgress?: (progress: GenerationProgress) => void;
}

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

export class AudioGenerationService {
  private readonly MAX_CONCURRENT_REQUESTS = 3;
  private readonly RETRY_ATTEMPTS = 3;
  private readonly RETRY_DELAY = 1000; // Start with 1 second
  private readonly FIRST_CHUNK_PRIORITY_RETRIES = 5; // Extra retries for first chunk

  // De-duplicate in-flight requests by content-addressed key
  private static inFlightRequests: Map<string, Promise<AudioChunkData | null>> = new Map();

  private chunkManager: AudioChunkManager | null = null;
  private abortController: AbortController | null = null;
  private generationProgress: GenerationProgress = {
    totalChunks: 0,
    chunksGenerated: 0,
    chunksLoading: 0,
    chunksFailed: 0,
    isComplete: false
  };

  constructor(chunkManager?: AudioChunkManager) {
    this.chunkManager = chunkManager || null;
  }

  /**
   * Generate audio for text using chunking
   */
  async generateChunkedAudio(
    text: string,
    voiceStyle: string,
    language: string = 'en',
    callbacks?: GenerationCallbacks
  ): Promise<AudioChunkData[]> {
    // Cancel any existing generation
    this.cancel();
    
    this.abortController = new AbortController();
    const generatedChunks: AudioChunkData[] = [];

    try {
      // OPTIMIZATION: For short text, skip chunking entirely
      if (text.length <= 3900) {
        console.log('Text is short enough for single chunk - using fast path');
        const singleChunk: TextChunk = {
          chunkIndex: 0,
          totalChunks: 1,
          text: text,
          characterCount: text.length,
          estimatedDuration: Math.ceil(text.length / 15)
        };
        
        // Initialize timeline for single-chunk playback
        if (this.chunkManager) {
          this.chunkManager.initializeTimeline([
            {
              chunkIndex: 0,
              totalChunks: 1,
              text: text,
              estimatedDuration: singleChunk.estimatedDuration,
            },
          ]);
          this.chunkManager.setBufferAheadCount(1);
        }
        
        // Initialize progress
        this.generationProgress = {
          totalChunks: 1,
          chunksGenerated: 0,
          chunksLoading: 1,
          chunksFailed: 0,
          isComplete: false
        };
        
        if (callbacks?.onProgress) {
          callbacks.onProgress(this.generationProgress);
        }
        
        // Generate single chunk with priority retries
        const audioChunk = await this.generateSingleChunk(
          singleChunk,
          voiceStyle,
          language,
          this.FIRST_CHUNK_PRIORITY_RETRIES
        );
        
        if (audioChunk) {
          generatedChunks.push(audioChunk);
          this.updateProgress({ 
            chunksGenerated: 1,
            chunksLoading: 0,
            isComplete: true
          });
          
          if (this.chunkManager) {
            await this.chunkManager.addChunk(audioChunk);
          }
          
          if (callbacks?.onFirstChunkReady) {
            callbacks.onFirstChunkReady(audioChunk);
          }
          
          if (callbacks?.onChunkGenerated) {
            callbacks.onChunkGenerated(audioChunk, this.generationProgress);
          }
          
          if (callbacks?.onComplete) {
            callbacks.onComplete(1, 1);
          }
        } else {
          this.updateProgress({ 
            chunksFailed: 1,
            chunksLoading: 0,
            isComplete: true
          });
          
          if (callbacks?.onChunkFailed) {
            callbacks.onChunkFailed(0, 'Failed to generate audio', this.generationProgress);
          }
          
          if (callbacks?.onComplete) {
            callbacks.onComplete(0, 1);
          }
        }
        
        return generatedChunks;
      }
      
      // Split text into chunks for longer text
      console.log('Splitting text into chunks...');
      const textChunks = TTSChunkService.splitTextIntoChunks(text);
      
      // Optimize chunks (merge small ones)
      const optimizedChunks = TTSChunkService.optimizeChunks(textChunks);
      
      // Initialize chunk timeline with estimates so UI can reflect duration/progress before audio arrives
      if (this.chunkManager && optimizedChunks.length > 0) {
        this.chunkManager.initializeTimeline(
          optimizedChunks.map(c => ({
            chunkIndex: c.chunkIndex,
            totalChunks: c.totalChunks,
            estimatedDuration: c.estimatedDuration,
            text: c.text,
          }))
        );
        // Keep a small buffer of upcoming chunks loaded
        this.chunkManager.setBufferAheadCount(3);
      }
      
      // Validate chunks
      if (!TTSChunkService.validateChunks(optimizedChunks)) {
        throw new Error('Invalid text chunks detected');
      }

      const stats = TTSChunkService.getChunkStatistics(optimizedChunks);
      console.log('Chunk statistics:', stats);

      // Initialize progress
      this.generationProgress = {
        totalChunks: optimizedChunks.length,
        chunksGenerated: 0,
        chunksLoading: 0,
        chunksFailed: 0,
        isComplete: false
      };

      if (callbacks?.onProgress) {
        callbacks.onProgress(this.generationProgress);
      }

      // Generate first chunk with priority (for quick playback start)
      if (optimizedChunks.length > 0) {
        console.log('Generating first chunk with priority...');
        this.updateProgress({ chunksLoading: 1 });
        
        const firstChunk = await this.generateSingleChunk(
          optimizedChunks[0],
          voiceStyle,
          language,
          this.FIRST_CHUNK_PRIORITY_RETRIES
        );

        if (firstChunk) {
          generatedChunks.push(firstChunk);
          this.updateProgress({ 
            chunksGenerated: 1, 
            chunksLoading: this.generationProgress.chunksLoading - 1 
          });
          
          // Add to chunk manager if available
          if (this.chunkManager) {
            await this.chunkManager.addChunk(firstChunk);
          }
          
          // Notify first chunk is ready
          if (callbacks?.onFirstChunkReady) {
            callbacks.onFirstChunkReady(firstChunk);
          }
          
          if (callbacks?.onChunkGenerated) {
            callbacks.onChunkGenerated(firstChunk, this.generationProgress);
          }
        } else {
          this.updateProgress({ 
            chunksFailed: 1,
            chunksLoading: this.generationProgress.chunksLoading - 1 
          });
          
          if (callbacks?.onChunkFailed) {
            callbacks.onChunkFailed(0, 'Failed to generate first chunk', this.generationProgress);
          }
        }
      }

      // Generate remaining chunks in parallel (with concurrency limit)
      if (optimizedChunks.length > 1) {
        const remainingChunks = optimizedChunks.slice(1);
        console.log(`Generating ${remainingChunks.length} remaining chunks in parallel...`);
        
        const results = await this.generateChunksInParallel(
          remainingChunks,
          voiceStyle,
          language,
          callbacks
        );
        
        generatedChunks.push(...results);
      }

      // Mark as complete
      this.updateProgress({ isComplete: true });
      
      if (callbacks?.onComplete) {
        callbacks.onComplete(
          this.generationProgress.chunksGenerated,
          this.generationProgress.totalChunks
        );
      }

      console.log(`Audio generation complete: ${generatedChunks.length}/${optimizedChunks.length} chunks successful`);
      
      return generatedChunks;

    } catch (error) {
      console.error('Error generating chunked audio:', error);
      throw error;
    }
  }

  /**
   * Generate chunks in parallel with concurrency limit
   */
  private async generateChunksInParallel(
    chunks: TextChunk[],
    voiceStyle: string,
    language: string,
    callbacks?: GenerationCallbacks
  ): Promise<AudioChunkData[]> {
    const results: AudioChunkData[] = [];
    const queue = [...chunks];
    const inProgress = new Map<number, Promise<AudioChunkData | null>>();

    while (queue.length > 0 || inProgress.size > 0) {
      // Check if cancelled
      if (this.abortController?.signal.aborted) {
        break;
      }

      // Start new requests up to concurrency limit
      while (queue.length > 0 && inProgress.size < this.MAX_CONCURRENT_REQUESTS) {
        const chunk = queue.shift()!;
        
        this.updateProgress({ 
          chunksLoading: this.generationProgress.chunksLoading + 1 
        });

        const promise = this.generateSingleChunk(chunk, voiceStyle, language)
          .then(audioChunk => {
            if (audioChunk) {
              results.push(audioChunk);
              
              // Add to chunk manager if available
              if (this.chunkManager) {
                this.chunkManager.addChunk(audioChunk);
              }
              
              this.updateProgress({ 
                chunksGenerated: this.generationProgress.chunksGenerated + 1,
                chunksLoading: Math.max(0, this.generationProgress.chunksLoading - 1)
              });
              
              if (callbacks?.onChunkGenerated) {
                callbacks.onChunkGenerated(audioChunk, this.generationProgress);
              }
            } else {
              this.updateProgress({ 
                chunksFailed: this.generationProgress.chunksFailed + 1,
                chunksLoading: Math.max(0, this.generationProgress.chunksLoading - 1)
              });
              
              if (callbacks?.onChunkFailed) {
                callbacks.onChunkFailed(chunk.chunkIndex, 'Generation failed', this.generationProgress);
              }
            }
            
            inProgress.delete(chunk.chunkIndex);
            return audioChunk;
          })
          .catch(error => {
            console.error(`Error generating chunk ${chunk.chunkIndex}:`, error);
            
            this.updateProgress({ 
              chunksFailed: this.generationProgress.chunksFailed + 1,
              chunksLoading: Math.max(0, this.generationProgress.chunksLoading - 1)
            });
            
            if (callbacks?.onChunkFailed) {
              callbacks.onChunkFailed(chunk.chunkIndex, error.message, this.generationProgress);
            }
            
            inProgress.delete(chunk.chunkIndex);
            return null;
          });

        inProgress.set(chunk.chunkIndex, promise);
      }

      // Wait for at least one to complete before continuing
      if (inProgress.size > 0) {
        await Promise.race(inProgress.values());
      }
    }

    return results.filter(r => r !== null);
  }

  /**
   * Generate a single audio chunk
   */
  private async generateSingleChunk(
    chunk: TextChunk,
    voiceStyle: string,
    language: string,
    maxRetries?: number
  ): Promise<AudioChunkData | null> {
    let lastError: Error | null = null;
    // Ensure we always have a valid retry count
    const retries = typeof maxRetries === 'number' && maxRetries > 0 
      ? maxRetries 
      : this.RETRY_ATTEMPTS;
    
    console.log(`Starting chunk generation with ${retries} max retries (requested: ${maxRetries})`);

    // Build content-addressed cache key and consult local cache first
    const cacheService = AudioCacheService.getInstance();
    const cacheKey = await cacheService.buildKey({
      text: chunk.text,
      voiceStyle,
      language,
      speed: 1.0
    });

    // Join any in-flight request for the same key
    const existing = AudioGenerationService.inFlightRequests.get(cacheKey);
    if (existing) {
      console.log('Joining in-flight audio generation for key (prefix):', cacheKey.substring(0, 8));
      return await existing;
    }

    const cachedUri = await cacheService.getCachedUri(cacheKey);
    if (cachedUri) {
      console.log(`Client cache hit for chunk ${chunk.chunkIndex}`);
      TelemetryService.increment('audio_cache_client_hit');
      const audioChunk: AudioChunkData = {
        chunkIndex: chunk.chunkIndex,
        totalChunks: chunk.totalChunks,
        text: chunk.text,
        audio: '',
        characterCount: chunk.characterCount,
        estimatedDuration: chunk.estimatedDuration,
        fileUri: cachedUri
      };
      return audioChunk;
    } else {
      TelemetryService.increment('audio_cache_client_miss');
    }

    // Register this generation as in-flight so parallel callers dedupe
    let resolveInFlight: ((val: AudioChunkData | null) => void) | null = null;
    const inFlightPromise = new Promise<AudioChunkData | null>((resolve) => { resolveInFlight = resolve; });
    AudioGenerationService.inFlightRequests.set(cacheKey, inFlightPromise);

    for (let attempt = 0; attempt < retries; attempt++) {
      try {
        // Exponential backoff for retries
        if (attempt > 0) {
          // Longer delays for network errors
          const baseDelay = lastError?.message.includes('Network error') ? 3000 : this.RETRY_DELAY;
          const delay = baseDelay * Math.pow(2, attempt - 1);
          await this.delay(delay);
          console.log(`Retry ${attempt} for chunk ${chunk.chunkIndex} after ${delay}ms`);
        }

        // On retry attempts for network errors, try a simpler voice
        const useSimpleVoice = attempt > 1 && lastError?.message.includes('Network error');
        
        const request: ChunkRequest = {
          text: chunk.text,
          chunkIndex: chunk.chunkIndex,
          totalChunks: chunk.totalChunks,
          voiceStyle: useSimpleVoice ? 'casual' : voiceStyle, // Fallback to alloy voice
          language: language,
          speed: 1.0
        };
        
        if (useSimpleVoice) {
          console.log('Using fallback voice (alloy) due to network issues');
        }

        console.log(`Generating chunk ${chunk.chunkIndex + 1}/${chunk.totalChunks} (attempt ${attempt + 1})`);
        console.log('Request details:', {
          textLength: chunk.text.length,
          voiceStyle,
          language,
          chunkIndex: chunk.chunkIndex
        });

        const response = await supabase.functions.invoke<ChunkResponse>('generate-audio-chunk', {
          body: request
        });

        // Log the full response for debugging
        if (response.error || response.data?.error) {
          console.log('Supabase response with error:', {
            hasError: !!response.error,
            hasData: !!response.data,
            dataKeys: response.data ? Object.keys(response.data) : [],
            errorMessage: response.error?.message,
            dataError: response.data?.error?.substring(0, 200) // First 200 chars of error
          });
        }

        // Check both error field and data field for errors
        if (response.error) {
          console.error('Supabase function error:', response.error);
          
          // For non-2xx errors, the actual error details might still be in data
          if (response.data?.error) {
            console.error('Actual error from function:', response.data.error);
            
            // Check for specific error types
            if (response.data.error.includes('insufficient_quota') || response.data.error.includes('429')) {
              throw new Error('OpenAI API quota exceeded. Please check your OpenAI billing and add credits.');
            } else if (response.data.error.includes('OPENAI_API_KEY')) {
              throw new Error('OpenAI API key not configured. Please set it in Supabase secrets.');
            } else if (response.data.error.includes('401') || response.data.error.includes('Unauthorized')) {
              throw new Error('Invalid OpenAI API key. Please check your key in Supabase secrets.');
            }
            
            throw new Error(response.data.error);
          }
          
          // Try to get more details from the response
          const errorMessage = response.error.message || 'Failed to generate audio chunk';
          
          // Check for transient network errors that should be retried
          if (errorMessage.includes('Failed to send a request') || 
              errorMessage.includes('FunctionsFetchError') ||
              errorMessage.includes('network') ||
              errorMessage.includes('ECONNREFUSED')) {
            console.log('Network error detected, will retry...');
            throw new Error('Network error - retrying');
          }
          
          // Check if it's a function not found error
          if (errorMessage.includes('not found') || 
              errorMessage.includes('FunctionsRelayError') ||
              errorMessage.includes('404')) {
            throw new Error('Audio chunk generation function not deployed. Please run: npx supabase functions deploy generate-audio-chunk');
          }
          throw new Error(errorMessage);
        }
        
        const data = response.data;

        // Even if response.error is null, the actual error might be in data.error
        // This happens when the function returns a 500 status with error details
        if (!data && !response.error) {
          console.error('No data received from Supabase function');
          throw new Error('No data received from server');
        }

        // Check for errors in the data field (this is where 500 errors show up)
        if (data?.error) {
          console.error('Server returned error:', data.error);
          
          // Check for specific error types
          if (data.error.includes('insufficient_quota') || data.error.includes('429')) {
            throw new Error('OpenAI API quota exceeded. Please check your OpenAI billing and add credits.');
          } else if (data.error.includes('OPENAI_API_KEY')) {
            throw new Error('OpenAI API key not configured. Please set it in Supabase secrets.');
          } else if (data.error.includes('401') || data.error.includes('Unauthorized')) {
            throw new Error('Invalid OpenAI API key. Please check your key in Supabase secrets.');
          }
          
          throw new Error(data.error);
        }
        
        if (!data) {
          throw new Error('No data received from server');
        }

        if (!data.audio) {
          console.error('No audio in response:', data);
          throw new Error('No audio data in server response');
        }

        // Validate base64 audio
        if (!this.isValidBase64(data.audio)) {
          throw new Error('Invalid audio data received');
        }

        const audioChunk: AudioChunkData = {
          chunkIndex: chunk.chunkIndex,
          totalChunks: chunk.totalChunks,
          text: chunk.text,
          audio: data.audio,
          characterCount: chunk.characterCount,
          estimatedDuration: chunk.estimatedDuration
        };

        // Persist to local cache for offline playback
        try {
          const saved = await cacheService.saveByParams(
            { text: chunk.text, voiceStyle, language, speed: 1.0 },
            data.audio,
            undefined,
            (data as any).etag
          );
          audioChunk.fileUri = saved.fileUri;
        } catch (e) {
          console.warn('Failed to save audio chunk to cache:', e);
        }

        // Instrument Supabase cache status if provided
        const supaCache = (data as any).cache;
        if (supaCache === 'hit') {
          TelemetryService.increment('supabase_chunk_cache_hit');
        } else if (supaCache === 'miss') {
          TelemetryService.increment('supabase_chunk_cache_miss');
        }

        console.log(`Chunk ${chunk.chunkIndex + 1} generated successfully`);
        if (resolveInFlight) {
          resolveInFlight(audioChunk);
          AudioGenerationService.inFlightRequests.delete(cacheKey);
        }
        return audioChunk;

      } catch (error: any) {
        lastError = error instanceof Error ? error : new Error(String(error));
        console.error(`Attempt ${attempt + 1} failed for chunk ${chunk.chunkIndex}:`, lastError.message);
        
        // Don't retry if cancelled
        if (this.abortController?.signal.aborted) {
          console.log('Generation cancelled by user');
          break;
        }
        
        // Don't retry if it's a deployment issue
        if (lastError.message.includes('not deployed')) {
          console.error('Function not deployed, stopping retries');
          break;
        }
        
        // Don't retry if it's a quota issue
        if (lastError.message.includes('quota exceeded')) {
          console.error('OpenAI quota exceeded, stopping retries');
          break;
        }
        
        // Don't retry if it's an API key issue
        if (lastError.message.includes('API key')) {
          console.error('API key issue, stopping retries');
          break;
        }
      }
    }

    const errorMessage = lastError?.message || 'Unknown error occurred';
    console.error(`Failed to generate chunk ${chunk.chunkIndex} after ${retries} attempts:`, errorMessage);
    if (resolveInFlight) {
      resolveInFlight(null);
      AudioGenerationService.inFlightRequests.delete(cacheKey);
    }
    return null;
  }

  /**
   * Update progress and notify callbacks
   */
  private updateProgress(updates: Partial<GenerationProgress>) {
    this.generationProgress = {
      ...this.generationProgress,
      ...updates
    };
  }

  /**
   * Validate base64 string
   */
  private isValidBase64(str: string): boolean {
    if (!str || str.length < 100) {
      return false;
    }
    
    try {
      // Check if it's valid base64
      const regex = /^[A-Za-z0-9+/]*={0,2}$/;
      return regex.test(str.replace(/\s/g, ''));
    } catch {
      return false;
    }
  }

  /**
   * Helper to delay execution
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Cancel ongoing generation
   */
  cancel() {
    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
    }
    
    this.generationProgress = {
      totalChunks: 0,
      chunksGenerated: 0,
      chunksLoading: 0,
      chunksFailed: 0,
      isComplete: false
    };
  }

  /**
   * Get current generation progress
   */
  getProgress(): GenerationProgress {
    return { ...this.generationProgress };
  }

  /**
   * Set chunk manager
   */
  setChunkManager(manager: AudioChunkManager) {
    this.chunkManager = manager;
  }
}