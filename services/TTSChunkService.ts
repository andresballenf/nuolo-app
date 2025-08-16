export interface TextChunk {
  chunkIndex: number;
  totalChunks: number;
  text: string;
  characterCount: number;
  estimatedDuration: number; // in seconds
}

export class TTSChunkService {
  private static readonly MAX_CHUNK_SIZE = 3900; // Leave buffer for OpenAI TTS API limit of 4096
  private static readonly AVG_CHARS_PER_SECOND = 15; // Average speaking rate for estimation

  /**
   * Split text into chunks suitable for TTS processing
   * Respects sentence boundaries and punctuation for natural pauses
   */
  static splitTextIntoChunks(text: string): TextChunk[] {
    if (!text || text.trim().length === 0) {
      return [];
    }

    const chunks: TextChunk[] = [];
    let remainingText = text.trim();
    let chunkIndex = 0;

    while (remainingText.length > 0) {
      const chunk = this.extractNextChunk(remainingText);
      
      chunks.push({
        chunkIndex,
        totalChunks: 0, // Will be updated after all chunks are created
        text: chunk,
        characterCount: chunk.length,
        estimatedDuration: Math.ceil(chunk.length / this.AVG_CHARS_PER_SECOND)
      });

      remainingText = remainingText.substring(chunk.length).trim();
      chunkIndex++;
    }

    // Update total chunks count
    const totalChunks = chunks.length;
    chunks.forEach(chunk => {
      chunk.totalChunks = totalChunks;
    });

    console.log(`Split text into ${totalChunks} chunks:`, {
      totalCharacters: text.length,
      chunks: chunks.map(c => ({
        index: c.chunkIndex,
        length: c.characterCount,
        preview: c.text.substring(0, 50) + '...'
      }))
    });

    return chunks;
  }

  /**
   * Extract the next chunk from the text, respecting boundaries
   */
  private static extractNextChunk(text: string): string {
    // If text is already under the limit, return it as-is
    if (text.length <= this.MAX_CHUNK_SIZE) {
      return text;
    }

    // Start with max chunk size
    let chunkText = text.substring(0, this.MAX_CHUNK_SIZE);
    
    // Find the best break point (in order of preference)
    const breakPoint = this.findBestBreakPoint(chunkText);
    
    if (breakPoint > 0) {
      chunkText = chunkText.substring(0, breakPoint);
    }

    return chunkText;
  }

  /**
   * Find the best point to break the text for natural speech
   */
  private static findBestBreakPoint(text: string): number {
    // Priority 1: Break at paragraph (double newline)
    const lastParagraph = text.lastIndexOf('\n\n');
    if (lastParagraph > this.MAX_CHUNK_SIZE * 0.5) {
      return lastParagraph + 2; // Include the newlines
    }

    // Priority 2: Break at sentence endings (. ! ?)
    const sentenceEndings = ['. ', '! ', '? ', '.\n', '!\n', '?\n'];
    let bestSentenceEnd = -1;
    
    for (const ending of sentenceEndings) {
      const index = text.lastIndexOf(ending);
      if (index > bestSentenceEnd && index > this.MAX_CHUNK_SIZE * 0.5) {
        bestSentenceEnd = index + ending.length;
      }
    }
    
    if (bestSentenceEnd > 0) {
      return bestSentenceEnd;
    }

    // Priority 3: Break at other punctuation (, ; :)
    const punctuation = [', ', '; ', ': ', ' - '];
    let bestPunctuation = -1;
    
    for (const punct of punctuation) {
      const index = text.lastIndexOf(punct);
      if (index > bestPunctuation && index > this.MAX_CHUNK_SIZE * 0.6) {
        bestPunctuation = index + punct.length;
      }
    }
    
    if (bestPunctuation > 0) {
      return bestPunctuation;
    }

    // Priority 4: Break at newline
    const lastNewline = text.lastIndexOf('\n');
    if (lastNewline > this.MAX_CHUNK_SIZE * 0.6) {
      return lastNewline + 1;
    }

    // Priority 5: Break at last space (avoid breaking words)
    const lastSpace = text.lastIndexOf(' ');
    if (lastSpace > this.MAX_CHUNK_SIZE * 0.7) {
      return lastSpace + 1;
    }

    // Fallback: Just break at max size (should rarely happen)
    return this.MAX_CHUNK_SIZE;
  }

  /**
   * Validate that chunks are within size limits
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
      
      if (chunk.text.length === 0) {
        console.error(`Chunk ${chunk.chunkIndex} is empty`);
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
        chunkSizes: [],
        minChunkSize: 0,
        maxChunkSize: 0
      };
    }

    const chunkSizes = chunks.map(c => c.characterCount);
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

  /**
   * Merge chunks if they're too small (optimization)
   */
  static optimizeChunks(chunks: TextChunk[]): TextChunk[] {
    const MIN_CHUNK_SIZE = 500; // Don't create chunks smaller than this
    const optimized: TextChunk[] = [];
    let currentChunk: TextChunk | null = null;

    for (const chunk of chunks) {
      if (!currentChunk) {
        currentChunk = { ...chunk };
      } else if (
        currentChunk.characterCount < MIN_CHUNK_SIZE &&
        currentChunk.characterCount + chunk.characterCount <= this.MAX_CHUNK_SIZE
      ) {
        // Merge small chunks
        currentChunk.text += ' ' + chunk.text;
        currentChunk.characterCount = currentChunk.text.length;
        currentChunk.estimatedDuration = Math.ceil(currentChunk.characterCount / this.AVG_CHARS_PER_SECOND);
      } else {
        optimized.push(currentChunk);
        currentChunk = { ...chunk };
      }
    }

    if (currentChunk) {
      optimized.push(currentChunk);
    }

    // Re-index chunks
    optimized.forEach((chunk, index) => {
      chunk.chunkIndex = index;
      chunk.totalChunks = optimized.length;
    });

    return optimized;
  }
}