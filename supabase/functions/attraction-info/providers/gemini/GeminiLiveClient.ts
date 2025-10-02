// Gemini Live API Client
// WebSocket client for Gemini 2.5 Flash Native Audio Preview

/**
 * Gemini Live API Client for real-time audio generation
 *
 * Based on Gemini documentation:
 * https://ai.google.dev/gemini-api/docs/live-audio
 *
 * Model: gemini-2.5-flash-preview-native-audio
 * Audio format: PCM 16-bit, 16kHz mono
 */

export interface GeminiLiveMessage {
  type: 'setup' | 'input' | 'output' | 'error' | 'complete';
  data?: any;
  text?: string;
  audioChunk?: Int16Array;
  error?: string;
}

export interface GeminiLiveOptions {
  apiKey: string;
  model: string;
  systemPrompt: string;
  userPrompt: string;
}

export class GeminiLiveClient {
  private ws: WebSocket | null = null;
  private apiKey: string;
  private model: string;
  private systemPrompt: string;
  private userPrompt: string;

  // Collected data
  private textChunks: string[] = [];
  private audioChunks: Int16Array[] = [];

  constructor(options: GeminiLiveOptions) {
    this.apiKey = options.apiKey;
    this.model = options.model || 'gemini-2.5-flash-preview-native-audio';
    this.systemPrompt = options.systemPrompt;
    this.userPrompt = options.userPrompt;
  }

  /**
   * Connect to Gemini Live API and generate content + audio
   */
  async generateContentAndAudio(): Promise<{
    text: string;
    audioChunks: Int16Array[];
  }> {
    return new Promise((resolve, reject) => {
      try {
        // Construct WebSocket URL with API key
        const wsUrl = `wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1alpha.GenerativeService.BidiGenerateContent?key=${this.apiKey}`;

        console.log('[Gemini] Connecting to Live API...');
        this.ws = new WebSocket(wsUrl);

        this.ws.onopen = () => {
          console.log('[Gemini] WebSocket connected');
          this.sendSetup();
          this.sendUserInput();
        };

        this.ws.onmessage = (event) => {
          try {
            const message = JSON.parse(event.data);
            this.handleMessage(message);
          } catch (error) {
            console.error('[Gemini] Error parsing message:', error);
          }
        };

        this.ws.onerror = (error) => {
          console.error('[Gemini] WebSocket error:', error);
          reject(new Error('Gemini WebSocket connection error'));
        };

        this.ws.onclose = () => {
          console.log('[Gemini] WebSocket closed');

          // Return collected data
          const text = this.textChunks.join('');
          const audioChunks = this.audioChunks;

          if (text.length === 0 && audioChunks.length === 0) {
            reject(new Error('No content received from Gemini'));
          } else {
            resolve({ text, audioChunks });
          }
        };

        // Timeout after 60 seconds
        setTimeout(() => {
          if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            console.warn('[Gemini] Timeout reached, closing connection');
            this.ws.close();
          }
        }, 60000);
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Send setup configuration
   */
  private sendSetup(): void {
    const setupMessage = {
      setup: {
        model: `models/${this.model}`,
        generationConfig: {
          responseModalities: ['text', 'audio'],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: {
                voiceName: 'Puck', // Default voice, can be configured
              },
            },
          },
        },
        systemInstruction: {
          parts: [
            {
              text: this.systemPrompt,
            },
          ],
        },
      },
    };

    console.log('[Gemini] Sending setup message');
    this.ws?.send(JSON.stringify(setupMessage));
  }

  /**
   * Send user input (prompt)
   */
  private sendUserInput(): void {
    const inputMessage = {
      clientContent: {
        turns: [
          {
            role: 'user',
            parts: [
              {
                text: this.userPrompt,
              },
            ],
          },
        ],
        turnComplete: true,
      },
    };

    console.log('[Gemini] Sending user input');
    this.ws?.send(JSON.stringify(inputMessage));
  }

  /**
   * Handle incoming messages from Gemini
   */
  private handleMessage(message: any): void {
    // Handle server content (text and audio)
    if (message.serverContent) {
      const { modelTurn } = message.serverContent;

      if (modelTurn?.parts) {
        for (const part of modelTurn.parts) {
          // Handle text content
          if (part.text) {
            console.log('[Gemini] Received text chunk:', part.text.substring(0, 50));
            this.textChunks.push(part.text);
          }

          // Handle audio content (inline data)
          if (part.inlineData && part.inlineData.mimeType === 'audio/pcm') {
            const base64Audio = part.inlineData.data;
            const pcmData = this.base64ToPcm(base64Audio);
            console.log('[Gemini] Received audio chunk, size:', pcmData.length);
            this.audioChunks.push(pcmData);
          }
        }
      }

      // Check if turn is complete
      if (modelTurn?.turnComplete) {
        console.log('[Gemini] Turn complete, closing connection');
        this.ws?.close();
      }
    }

    // Handle errors
    if (message.error) {
      console.error('[Gemini] Server error:', message.error);
      this.ws?.close();
    }
  }

  /**
   * Convert Base64 to PCM Int16Array
   */
  private base64ToPcm(base64: string): Int16Array {
    // Decode Base64 to binary string
    const binaryString = atob(base64);

    // Convert binary string to Uint8Array
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }

    // Convert Uint8Array to Int16Array (PCM 16-bit)
    const pcmData = new Int16Array(bytes.buffer);
    return pcmData;
  }

  /**
   * Clean up resources
   */
  dispose(): void {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }
}
