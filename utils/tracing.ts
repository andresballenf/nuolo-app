// Lightweight tracing utility to mark and measure app performance milestones
// This is a simple placeholder to capture metrics like TTFP (time-to-first-playable)
// and TTC (time-to-complete). It can be swapped with a full-fledged telemetry later.

const marks: Record<string, number> = {};

export function mark(name: string): void {
  marks[name] = Date.now();
}

export function measure(name: string, startMark: string, endMark?: string): number | null {
  const start = marks[startMark];
  const end = endMark ? marks[endMark] : Date.now();
  if (typeof start !== 'number' || typeof end !== 'number') {
    return null;
  }
  const duration = Math.max(0, end - start);
  // Keep the measurement accessible for debugging if needed
  marks[name] = duration;
  return duration;
}

export function getMark(name: string): number | undefined {
  return marks[name];
}

export function clearMarks(): void {
  Object.keys(marks).forEach(k => delete marks[k]);
}

export type PerfEvents = {
  onTTFP?: (ms: number) => void;
  onTTC?: (ms: number) => void;
};
