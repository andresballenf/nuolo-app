export interface TextChunk {
  chunkIndex: number;
  totalChunks: number;
  text: string;
  characterCount: number;
  estimatedDuration: number; // in seconds
}

export interface ChunkingConfig {
  // Maximum characters per chunk (hard ceiling)
  maxChunkSize?: number;
  // Average speaking rate chars/sec
  avgCharsPerSecond?: number;
  // When prioritizing the first chunk, target this many seconds of speech
  firstChunkTargetSeconds?: number; // ~10–15s recommended
  // Cap for the first chunk in characters (after applying natural breakpoints)
  firstChunkMaxChars?: number;
  // Whether to create a much smaller first chunk for fast start
  prioritizeFirstChunk?: boolean;
}

export class TTSChunkService {
  private static readonly DEFAULT_MAX_CHUNK_SIZE = 3900; // Leave buffer for OpenAI TTS API limit of 4096
  private static readonly AVG_CHARS_PER_SECOND = 15; // Average speaking rate

  /**
   * Split text into chunks suitable for TTS processing
   * Respects sentence boundaries and punctuation for natural pauses
   */
  static splitTextIntoChunks(text: string, config: ChunkingConfig = {}): TextChunk[] {
    if (!text || text.trim().length === 0) {
      return [];
    }

    const maxChunkSize = config.maxChunkSize ?? this.DEFAULT_MAX_CHUNK_SIZE;
    const avgCps = config.avgCharsPerSecond ?? this.AVG_CHARS_PER_SECOND;
    const prioritizeFirst = !!config.prioritizeFirstChunk;
    const targetFirstSeconds = config.firstChunkTargetSeconds ?? 12; // default ~12s
    const targetFirstChars = Math.max(120, Math.floor(targetFirstSeconds * avgCps));
    const firstChunkMaxChars = Math.min(
      maxChunkSize,
      config.firstChunkMaxChars ?? Math.max(180, Math.floor(targetFirstChars * 1.6)) // allow some headroom for natural break
    );

    const chunks: TextChunk[] = [];
    let remainingText = text.trim();
    let chunkIndex = 0;

    // If we want a small priority first chunk, extract it with a lower max size
    if (prioritizeFirst && remainingText.length > 0) {
      const first = this.extractNextChunk(remainingText, firstChunkMaxChars);
      const firstLen = first.length;
      if (firstLen > 0) {
        chunks.push({
          chunkIndex,
          totalChunks: 0,
          text: first,
          characterCount: firstLen,
          estimatedDuration: Math.ceil(firstLen / avgCps)
        });
        remainingText = remainingText.substring(firstLen).trim();
        chunkIndex++;
      }
    }

    // Extract remaining chunks with the standard maximum size
    while (remainingText.length > 0) {
      const chunkText = this.extractNextChunk(remainingText, maxChunkSize);
      const len = chunkText.length;

      chunks.push({
        chunkIndex,
        totalChunks: 0, // Will be updated after all chunks are created
        text: chunkText,
        characterCount: len,
        estimatedDuration: Math.ceil(len / avgCps)
      });

      remainingText = remainingText.substring(len).trim();
      chunkIndex++;
    }

    // Update total chunks count
    chunks.forEach((chunk) => {
      chunk.totalChunks = chunks.length;
    });

    return chunks;
  }

  /**
   * Extract the next chunk from the text, respecting boundaries
   */
  private static extractNextChunk(text: string, maxChunkSize: number): string {
    // If text is already under the limit, return it as-is
    if (text.length <= maxChunkSize) {
      return text;
    }

    // Start with max chunk size
    let chunkText = text.substring(0, maxChunkSize);

    // Find the best break point (in order of preference)
    const breakPoint = this.findBestBreakPoint(chunkText, maxChunkSize);

    if (breakPoint > 0) {
      chunkText = chunkText.substring(0, breakPoint);
    }

    return chunkText;
  }

  /**
   * Find the best point to break the text for natural speech
   */
  private static findBestBreakPoint(text: string, maxChunkSize: number): number {
    // Priority 1: Break at paragraph (double newline)
    const lastParagraph = text.lastIndexOf('\n\n');
    if (lastParagraph > maxChunkSize * 0.5) {
      return lastParagraph + 2; // Include the newlines
    }

    // Priority 2: Break at sentence endings (. ! ?)
    const sentenceEndings = ['. ', '! ', '? ', '.\n', '!\n', '?\n'];
    let bestSentenceEnd = -1;

    for (const ending of sentenceEndings) {
      const index = text.lastIndexOf(ending);
      if (index > bestSentenceEnd && index > maxChunkSize * 0.5) {
        bestSentenceEnd = index + ending.length;
      }
    }

    if (bestSentenceEnd > 0) {
      return bestSentenceEnd;
    }

    // Priority 3: Break at other punctuation (, ; : -)
    const punctuation = [', ', '; ', ': ', ' - '];
    let bestPunctuation = -1;

    for (const punct of punctuation) {
      const index = text.lastIndexOf(punct);
      if (index > bestPunctuation && index > maxChunkSize * 0.6) {
        bestPunctuation = index + punct.length;
      }
    }

    if (bestPunctuation > 0) {
      return bestPunctuation;
    }

    // Priority 4: Break at newline
    const lastNewline = text.lastIndexOf('\n');
    if (lastNewline > maxChunkSize * 0.6) {
      return lastNewline + 1;
    }

    // Priority 5: Break at last space (avoid breaking words)
    const lastSpace = text.lastIndexOf(' ');
    if (lastSpace > maxChunkSize * 0.7) {
      return lastSpace + 1;
    }

    // Fallback: Just break at max size (should rarely happen)
    return maxChunkSize;
  }

  /**
   * Validate that chunks can be properly reconstructed
   */
  static validateChunks(chunks: TextChunk[]): boolean {
    if (!chunks || chunks.length === 0) {
      return true;
    }

    // Check that all chunks are within size limits
    for (const chunk of chunks) {
      if (chunk.text.length > 4096) {
        console.error(`Chunk ${chunk.chunkIndex} exceeds TTS API limit: ${chunk.text.length} chars`);
        return false;
      }
    }

    // Check chunk indices are sequential
    for (let i = 0; i < chunks.length; i++) {
      if (chunks[i].chunkIndex !== i) {
        console.error(`Chunk index mismatch at position ${i}`);
        return false;
      }
    }

    return true;
  }

  /**
   * Calculate total estimated duration for all chunks
   */
  static calculateTotalDuration(chunks: TextChunk[]): number {
    return chunks.reduce((total, chunk) => total + chunk.estimatedDuration, 0);
  }

  /**
   * Get summary statistics for the chunks
   */
  static getChunkStatistics(chunks: TextChunk[]) {
    if (!chunks || chunks.length === 0) {
      return {
        totalChunks: 0,
        totalCharacters: 0,
        averageChunkSize: 0,
        estimatedTotalDuration: 0,
        chunkSizes: []
      };
    }

    const chunkSizes = chunks.map((c) => c.characterCount);
    const totalCharacters = chunkSizes.reduce((sum, size) => sum + size, 0);

    return {
      totalChunks: chunks.length,
      totalCharacters,
      averageChunkSize: Math.round(totalCharacters / chunks.length),
      estimatedTotalDuration: this.calculateTotalDuration(chunks),
      chunkSizes,
      minChunkSize: Math.min(...chunkSizes),
      maxChunkSize: Math.max(...chunkSizes)
    };
  }
}
