import type { TranscriptSegment } from '../services/AttractionInfoService';

/**
 * Builds proportional sentence/word timings for karaoke highlighting fallback.
 */
export function buildTranscriptSegments(text: string, durationMs: number): TranscriptSegment[] {
  const sentences = text
    .split(/(?<=[.!?])\s+/)
    .map(s => s.trim())
    .filter(Boolean);

  if (!sentences.length || durationMs <= 0) return [];

  const totalChars = sentences.reduce((sum, sentence) => sum + sentence.length, 0) || 1;
  let cursor = 0;

  return sentences.map(sentence => {
    const portion = sentence.length / totalChars;
    const segmentDuration = portion * durationMs;
    const startMs = Math.round(cursor);
    const endMs = Math.round(cursor + segmentDuration);

    const wordsRaw = sentence.split(/\s+/).filter(Boolean);
    const wordsTotalChars = wordsRaw.reduce((sum, word) => sum + word.length, 0) || 1;
    let wordCursor = startMs;
    const words = wordsRaw.map((word, index) => {
      const wordPortion = word.length / wordsTotalChars;
      const wordDuration = wordPortion * (endMs - startMs);
      const wordStart = Math.round(wordCursor);
      const wordEnd = index === wordsRaw.length - 1 ? endMs : Math.round(wordCursor + wordDuration);
      wordCursor += wordDuration;
      return { text: word, startMs: wordStart, endMs: wordEnd };
    });

    cursor += segmentDuration;
    return { text: sentence, startMs, endMs, words };
  });
}
