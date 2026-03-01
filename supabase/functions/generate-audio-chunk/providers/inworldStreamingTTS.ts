/**
 * Inworld Streaming TTS Provider
 *
 * Uses Inworld's streaming endpoint for progressive audio delivery.
 * Streaming endpoint: POST https://api.inworld.ai/tts/v1/voice:stream
 *   - Max 2,000 characters per request
 *   - Returns NDJSON with base64 audio segments as they're synthesized
 *   - TTFA: <200ms regardless of text length
 *
 * For texts > 2,000 chars, automatically splits into segments and pipelines them.
 * This is transparent to the caller, who receives a seamless stream of AudioSegments.
 *
 * Env vars:
 *   INWORLD_API_KEY       - Base64-encoded API key
 *   INWORLD_TTS_MODEL     - "inworld-tts-1.5-max" (default) or "inworld-tts-1.5-mini"
 */

import { logInfo, logWarn, logError } from '../../attraction-info/secureLogger.ts';

const STREAMING_ENDPOINT = 'https://api.inworld.ai/tts/v1/voice:stream';
const MAX_STREAM_CHARS = 2000;
const MAX_CONCURRENT_SEGMENTS = 3;

// Voice ID mapping (streaming endpoint uses voiceId, not voice.name)
const VOICE_ID_MAP: Record<string, string> = {
  'Ashley': 'Ashley',
  'Edward': 'Edward',
  'Alex': 'Alex',
  'Sarah': 'Sarah',
  'Craig': 'Craig',
  'Deborah': 'Deborah',
  'Dennis': 'Dennis',
  'Elizabeth': 'Elizabeth',
  'Mark': 'Mark',
  'Olivia': 'Olivia',
  'Ronald': 'Ronald',
  'Theodore': 'Theodore',
};

// Voice style to voice ID
const VOICE_STYLE_MAP: Record<string, string> = {
  'casual': 'Ashley',
  'formal': 'Edward',
  'energetic': 'Alex',
  'calm': 'Sarah',
};

export interface AudioSegment {
  audioBuffer: ArrayBuffer;
  segmentIndex: number;
  totalSegments: number;
  characterCount: number;
  isLast: boolean;
}

export class InworldStreamingTTS {
  private apiKey: string;
  private model: string;

  constructor() {
    this.apiKey = Deno.env.get('INWORLD_API_KEY') ?? '';
    this.model = Deno.env.get('INWORLD_TTS_MODEL') ?? 'inworld-tts-1.5-max';
  }

  /**
   * Map voice style string to Inworld voice ID
   */
  mapVoiceStyle(voiceStyle: string | undefined): string {
    if (!voiceStyle) return 'Ashley';
    return VOICE_STYLE_MAP[voiceStyle] || VOICE_ID_MAP[voiceStyle] || voiceStyle;
  }

  /**
   * Stream audio for text of any length.
   * Automatically splits into ≤2,000 char segments and streams each.
   * First segment starts streaming immediately; remaining pipeline concurrently.
   */
  async *streamSpeech(
    text: string,
    voice: string,
    language: string,
    speed: number,
  ): AsyncGenerator<AudioSegment, void, unknown> {
    const voiceId = VOICE_ID_MAP[voice] || VOICE_STYLE_MAP[voice] || voice;
    const textSegments = this.splitForStreaming(text);
    const totalSegments = textSegments.length;

    logInfo('audio', 'Starting Inworld streaming synthesis', {
      totalChars: text.length,
      segments: totalSegments,
      voiceId,
      model: this.model,
    });

    // Stream first segment with priority (lowest latency to first audio)
    if (textSegments.length > 0) {
      const firstAudio = await this.synthesizeSegment(textSegments[0], voiceId, language, speed);
      yield {
        audioBuffer: firstAudio,
        segmentIndex: 0,
        totalSegments,
        characterCount: textSegments[0].length,
        isLast: totalSegments === 1,
      };
    }

    // Pipeline remaining segments with bounded concurrency
    if (textSegments.length > 1) {
      const remaining = textSegments.slice(1);
      yield* this.pipelineSegments(remaining, voiceId, language, speed, totalSegments);
    }
  }

  /**
   * Pipeline remaining segments with bounded concurrency.
   * Yields in order even though generation may be concurrent.
   */
  private async *pipelineSegments(
    segments: string[],
    voiceId: string,
    language: string,
    speed: number,
    totalSegments: number,
  ): AsyncGenerator<AudioSegment, void, unknown> {
    // Pre-generate with bounded concurrency, yield in order
    const results = new Map<number, ArrayBuffer>();
    let nextYield = 1; // First segment (index 0) already yielded
    let nextStart = 0;
    const inflight = new Map<number, Promise<{ index: number; audio: ArrayBuffer }>>();

    const startNext = () => {
      if (nextStart >= segments.length) return;
      const idx = nextStart;
      const globalIdx = idx + 1; // +1 because first segment already yielded
      nextStart++;

      const p = this.synthesizeSegment(segments[idx], voiceId, language, speed)
        .then(audio => ({ index: globalIdx, audio }))
        .catch(err => {
          logError('audio', `Streaming segment ${globalIdx} failed`, { error: err?.message });
          // Return empty audio on failure so stream can continue
          return { index: globalIdx, audio: new ArrayBuffer(0) };
        });

      inflight.set(globalIdx, p);
    };

    // Prime the pool
    for (let i = 0; i < MAX_CONCURRENT_SEGMENTS && i < segments.length; i++) {
      startNext();
    }

    while (inflight.size > 0) {
      // Wait for any to complete
      const settled = await Promise.race(inflight.values());
      inflight.delete(settled.index);
      results.set(settled.index, settled.audio);

      // Start next if available
      startNext();

      // Yield in order
      while (results.has(nextYield)) {
        const audio = results.get(nextYield)!;
        results.delete(nextYield);

        if (audio.byteLength > 0) {
          yield {
            audioBuffer: audio,
            segmentIndex: nextYield,
            totalSegments,
            characterCount: segments[nextYield - 1]?.length ?? 0,
            isLast: nextYield === totalSegments - 1,
          };
        }

        nextYield++;
      }
    }
  }

  /**
   * Synthesize a single segment (≤2,000 chars) via the streaming endpoint.
   * Reads the full streaming response and returns concatenated audio.
   */
  private async synthesizeSegment(
    text: string,
    voiceId: string,
    language: string,
    speed: number,
  ): Promise<ArrayBuffer> {
    const requestBody: Record<string, unknown> = {
      text,
      voiceId,
      modelId: this.model,
      audioConfig: {
        audioEncoding: 'MP3',
        sampleRateHertz: 48000,
        bitRate: 128000,
      },
    };

    // Only add speakingRate if not default
    if (speed !== 1.0) {
      (requestBody.audioConfig as Record<string, unknown>).speakingRate = speed;
    }

    const response = await fetch(STREAMING_ENDPOINT, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Inworld streaming API error: ${response.status} - ${errorText}`);
    }

    // Read streaming response and concatenate audio chunks
    return await this.readStreamingResponse(response);
  }

  /**
   * Read the streaming NDJSON response from Inworld.
   * Each line contains { result: { audioContent: "base64..." } }
   * Concatenate all audio chunks into a single ArrayBuffer.
   */
  private async readStreamingResponse(response: Response): Promise<ArrayBuffer> {
    const contentType = response.headers.get('content-type') || '';

    // If response is raw audio (not JSON/NDJSON), return directly
    if (contentType.includes('audio')) {
      return response.arrayBuffer();
    }

    // Handle NDJSON streaming response
    if (!response.body) {
      throw new Error('No response body from Inworld streaming endpoint');
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    const audioChunks: Uint8Array[] = [];

    try {
      while (true) {
        const { done, value } = await reader.read();

        if (done) {
          // Process remaining buffer
          if (buffer.trim()) {
            this.parseAndCollectAudio(buffer, audioChunks);
          }
          break;
        }

        buffer += decoder.decode(value, { stream: true });

        // Process complete lines
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.trim()) {
            this.parseAndCollectAudio(line, audioChunks);
          }
        }
      }
    } finally {
      reader.releaseLock();
    }

    if (audioChunks.length === 0) {
      throw new Error('No audio data received from Inworld streaming endpoint');
    }

    // Concatenate all audio chunks
    return this.concatenateBuffers(audioChunks);
  }

  /**
   * Parse a single NDJSON line and extract audio content.
   */
  private parseAndCollectAudio(line: string, audioChunks: Uint8Array[]): void {
    try {
      const parsed = JSON.parse(line);

      // Handle error responses
      if (parsed.error) {
        logWarn('audio', 'Inworld streaming error in response', { error: parsed.error.message });
        return;
      }

      // Extract audio content from result
      const audioContent = parsed.result?.audioContent || parsed.audioContent;
      if (audioContent) {
        const binaryStr = atob(audioContent);
        const bytes = new Uint8Array(binaryStr.length);
        for (let i = 0; i < binaryStr.length; i++) {
          bytes[i] = binaryStr.charCodeAt(i);
        }
        audioChunks.push(bytes);
      }
    } catch (e) {
      // Not valid JSON - might be partial line or non-JSON content
      logWarn('audio', 'Failed to parse streaming line', { line: line.substring(0, 100) });
    }
  }

  /**
   * Concatenate multiple Uint8Array buffers into a single ArrayBuffer.
   */
  private concatenateBuffers(chunks: Uint8Array[]): ArrayBuffer {
    const totalLength = chunks.reduce((sum, chunk) => sum + chunk.byteLength, 0);
    const result = new Uint8Array(totalLength);
    let offset = 0;
    for (const chunk of chunks) {
      result.set(chunk, offset);
      offset += chunk.byteLength;
    }
    return result.buffer;
  }

  /**
   * Split text into segments of ≤2,000 chars at natural boundaries.
   * Respects sentence boundaries for natural speech.
   */
  private splitForStreaming(text: string): string[] {
    if (!text || text.trim().length === 0) return [];
    if (text.length <= MAX_STREAM_CHARS) return [text.trim()];

    const segments: string[] = [];
    let remaining = text.trim();

    while (remaining.length > 0) {
      if (remaining.length <= MAX_STREAM_CHARS) {
        segments.push(remaining);
        break;
      }

      const chunk = remaining.substring(0, MAX_STREAM_CHARS);
      const breakPoint = this.findBreakPoint(chunk);
      const segment = chunk.substring(0, breakPoint);
      segments.push(segment);
      remaining = remaining.substring(segment.length).trim();
    }

    return segments;
  }

  /**
   * Find the best point to break text for natural speech.
   */
  private findBreakPoint(text: string): number {
    // Priority 1: Break at paragraph
    const lastParagraph = text.lastIndexOf('\n\n');
    if (lastParagraph > MAX_STREAM_CHARS * 0.5) {
      return lastParagraph + 2;
    }

    // Priority 2: Break at sentence endings
    const sentenceEndings = ['. ', '! ', '? ', '.\n', '!\n', '?\n'];
    let bestSentence = -1;
    for (const ending of sentenceEndings) {
      const idx = text.lastIndexOf(ending);
      if (idx > bestSentence && idx > MAX_STREAM_CHARS * 0.5) {
        bestSentence = idx + ending.length;
      }
    }
    if (bestSentence > 0) return bestSentence;

    // Priority 3: Break at punctuation
    const punctuation = [', ', '; ', ': ', ' - '];
    let bestPunct = -1;
    for (const punct of punctuation) {
      const idx = text.lastIndexOf(punct);
      if (idx > bestPunct && idx > MAX_STREAM_CHARS * 0.6) {
        bestPunct = idx + punct.length;
      }
    }
    if (bestPunct > 0) return bestPunct;

    // Priority 4: Break at last space
    const lastSpace = text.lastIndexOf(' ');
    if (lastSpace > MAX_STREAM_CHARS * 0.7) {
      return lastSpace + 1;
    }

    return MAX_STREAM_CHARS;
  }
}
