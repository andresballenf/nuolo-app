// Minimal secure logger for the generate-audio-chunk function
// Provides startTimer/endTimer compatible with attraction-info implementation

export function startTimer(operation: string): string {
  const id = `${operation}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  (globalThis as any).__timerStart = (globalThis as any).__timerStart || {};
  (globalThis as any).__timerStart[id] = Date.now();
  console.log(JSON.stringify({ component: 'timer', event: 'start', operation, id, ts: new Date().toISOString() }));
  return id;
}

export function endTimer(timerId: string, operation: string, success: boolean = true): number {
  const store = (globalThis as any).__timerStart || {};
  const start = store[timerId] || Date.now();
  const duration = Date.now() - start;
  console.log(JSON.stringify({ component: 'timer', event: 'end', operation, id: timerId, duration, success, ts: new Date().toISOString() }));
  return duration;
}
