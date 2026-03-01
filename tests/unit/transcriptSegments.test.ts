import { buildTranscriptSegments } from '../../utils/transcriptSegments';

function assertCondition(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(message);
  }
}

{
  const segments = buildTranscriptSegments('Alpha beta. Gamma delta.', 10000);
  assertCondition(segments.length === 2, 'should split text into sentence segments');
  assertCondition(segments[0].startMs === 0, 'first segment should start at 0');
  assertCondition(segments[segments.length - 1].endMs === 10000, 'last segment should end at total duration');
  assertCondition(
    segments.every(segment => Array.isArray(segment.words) && segment.words.length > 0),
    'each segment should contain word timings'
  );
}

{
  const empty = buildTranscriptSegments('', 5000);
  assertCondition(empty.length === 0, 'empty text should produce no segments');
}

{
  const zeroDuration = buildTranscriptSegments('Single sentence.', 0);
  assertCondition(zeroDuration.length === 0, 'non-positive duration should produce no segments');
}

console.log('transcriptSegments.test: OK');
