import { AudioChunkData } from './AudioChunkManager';

export interface StreamResponse {
  type: 'text' | 'metadata' | 'audio_chunk' | 'complete' | 'error';
  content?: string;
  chunk?: AudioChunkData;
  totalChunks?: number;
  totalCharacters?: number;
  estimatedDuration?: number;
  error?: string;
  timestamp: number;
}

export interface StreamHandlerCallbacks {
  onText?: (text: string) => void;
  onMetadata?: (metadata: { totalChunks: number; totalCharacters: number; estimatedDuration: number }) => void;
  onChunk?: (chunk: AudioChunkData) => void;
  onComplete?: () => void;
  onError?: (error: string) => void;
}

export class AudioStreamHandler {
  private abortController: AbortController | null = null;
  private retryAttempts: Map<number, number> = new Map();
  private readonly MAX_RETRIES = 3;
  private readonly RETRY_DELAY = 1000; // Start with 1 second

  /**
   * Stream audio chunks from the server
   */
  public async streamAudio(
    url: string,
    requestBody: any,
    callbacks: StreamHandlerCallbacks
  ): Promise<void> {
    // Cancel any existing stream
    this.cancel();

    this.abortController = new AbortController();
    this.retryAttempts.clear();

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${requestBody.supabaseAnonKey || ''}`,
        },
        body: JSON.stringify({
          ...requestBody,
          useChunkedAudio: true,
          streamAudio: true
        }),
        signal: this.abortController.signal
      });

      if (!response.ok) {
        throw new Error(`Server error: ${response.status} ${response.statusText}`);
      }

      if (!response.body) {
        throw new Error('No response body received');
      }

      // Read the streaming response
      await this.processStream(response.body, callbacks);

    } catch (error: any) {
      if (error.name === 'AbortError') {
        console.log('Stream cancelled');
        return;
      }

      console.error('Stream error:', error);
      if (callbacks.onError) {
        callbacks.onError(error.message || 'Stream processing failed');
      }
    }
  }

  /**
   * Process the streaming response
   */
  private async processStream(
    stream: ReadableStream<Uint8Array>,
    callbacks: StreamHandlerCallbacks
  ): Promise<void> {
    const reader = stream.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    try {
      while (true) {
        const { done, value } = await reader.read();
        
        if (done) {
          // Process any remaining buffer
          if (buffer.trim()) {
            this.processLine(buffer, callbacks);
          }
          break;
        }

        // Decode chunk and add to buffer
        buffer += decoder.decode(value, { stream: true });

        // Process complete lines
        const lines = buffer.split('\n');
        buffer = lines.pop() || ''; // Keep incomplete line in buffer

        for (const line of lines) {
          if (line.trim()) {
            this.processLine(line, callbacks);
          }
        }
      }
    } finally {
      reader.releaseLock();
    }
  }

  /**
   * Process a single line from the stream
   */
  private processLine(line: string, callbacks: StreamHandlerCallbacks) {
    try {
      const response: StreamResponse = JSON.parse(line);
      
      switch (response.type) {
        case 'text':
          if (callbacks.onText && response.content) {
            callbacks.onText(response.content);
          }
          break;

        case 'metadata':
          if (callbacks.onMetadata && response.totalChunks !== undefined) {
            callbacks.onMetadata({
              totalChunks: response.totalChunks,
              totalCharacters: response.totalCharacters || 0,
              estimatedDuration: response.estimatedDuration || 0
            });
          }
          break;

        case 'audio_chunk':
          if (callbacks.onChunk && response.chunk) {
            // Reset retry count for successful chunk
            this.retryAttempts.delete(response.chunk.chunkIndex);
            callbacks.onChunk(response.chunk);
          }
          break;

        case 'complete':
          if (callbacks.onComplete) {
            callbacks.onComplete();
          }
          break;

        case 'error':
          if (callbacks.onError && response.error) {
            callbacks.onError(response.error);
          }
          break;

        default:
          console.warn('Unknown stream response type:', response.type);
      }
    } catch (error) {
      console.error('Error parsing stream line:', error, 'Line:', line);
    }
  }

  /**
   * Fetch audio chunks without streaming (batch mode)
   */
  public async fetchAudioChunks(
    url: string,
    requestBody: any
  ): Promise<{
    text: string;
    chunks: AudioChunkData[];
    metadata: any;
  }> {
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${requestBody.supabaseAnonKey || ''}`,
        },
        body: JSON.stringify({
          ...requestBody,
          useChunkedAudio: true,
          streamAudio: false // Batch mode
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Server error: ${response.status} - ${errorText}`);
      }

      const data = await response.json();

      if (data.error) {
        throw new Error(data.error);
      }

      return {
        text: data.info || '',
        chunks: data.audioChunks || [],
        metadata: data.metadata || {}
      };

    } catch (error: any) {
      console.error('Fetch error:', error);
      throw new Error(`Failed to fetch audio: ${error.message}`);
    }
  }

  /**
   * Retry a failed chunk
   */
  public async retryChunk(
    url: string,
    chunkIndex: number,
    text: string,
    voiceStyle: string,
    openAiApiKey?: string
  ): Promise<AudioChunkData | null> {
    const attempts = this.retryAttempts.get(chunkIndex) || 0;
    
    if (attempts >= this.MAX_RETRIES) {
      console.error(`Max retries reached for chunk ${chunkIndex}`);
      return null;
    }

    this.retryAttempts.set(chunkIndex, attempts + 1);
    
    // Exponential backoff
    const delay = this.RETRY_DELAY * Math.pow(2, attempts);
    await this.delay(delay);

    try {
      console.log(`Retrying chunk ${chunkIndex}, attempt ${attempts + 1}/${this.MAX_RETRIES}`);
      
      // Make a specific request for just this chunk
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text: text,
          voiceStyle: voiceStyle,
          chunkIndex: chunkIndex,
          generateSingleChunk: true,
          openAiApiKey: openAiApiKey
        })
      });

      if (!response.ok) {
        throw new Error(`Retry failed: ${response.status}`);
      }

      const data = await response.json();
      
      if (data.chunk) {
        this.retryAttempts.delete(chunkIndex); // Success, reset retry count
        return data.chunk as AudioChunkData;
      }

      return null;

    } catch (error) {
      console.error(`Retry failed for chunk ${chunkIndex}:`, error);
      
      // Try again if we have retries left
      if (attempts + 1 < this.MAX_RETRIES) {
        return this.retryChunk(url, chunkIndex, text, voiceStyle, openAiApiKey);
      }
      
      return null;
    }
  }

  /**
   * Cancel the current stream
   */
  public cancel() {
    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
    }
    this.retryAttempts.clear();
  }

  /**
   * Helper to delay execution
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Check if streaming is active
   */
  public isStreaming(): boolean {
    return this.abortController !== null && !this.abortController.signal.aborted;
  }

  /**
   * Get retry statistics
   */
  public getRetryStats() {
    return {
      totalRetries: Array.from(this.retryAttempts.values()).reduce((sum, count) => sum + count, 0),
      chunksWithRetries: this.retryAttempts.size,
      retryDetails: Array.from(this.retryAttempts.entries()).map(([chunk, count]) => ({
        chunkIndex: chunk,
        attempts: count
      }))
    };
  }
}