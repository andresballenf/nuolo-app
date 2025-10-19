/*
 * Lightweight performance tracing utility for the end-to-end audio pipeline.
 *
 * Features
 * - start/mark/end traces with arbitrary attributes and marks
 * - compute TTFP (time-to-first-playable/chunk) and TTC (time-to-complete)
 * - keep a ring buffer of recent traces for diagnostics overlay
 */

export type TraceStatus = 'active' | 'success' | 'error' | 'cancelled';

export interface PerfMark {
  label: string;
  at: number;
  data?: Record<string, any>;
}

export interface PerfTraceRecord {
  id: string;
  name: string;
  startTime: number;
  endTime?: number;
  status: TraceStatus;
  errorMessage?: string;
  attrs: Record<string, any>;
  marks: PerfMark[];
  metrics?: {
    durationMs: number;
    ttfpMs?: number; // time to first playable (first chunk ready or playback started)
    ttcMs?: number;  // time to completion (generation/streaming complete)
  };
}

class PerfTracerImpl {
  private traces = new Map<string, PerfTraceRecord>();
  private recent: PerfTraceRecord[] = [];
  private maxRecent = 50;
  private activeAudioTraceId: string | null = null;

  start(name: string, attrs: Record<string, any> = {}): string {
    const id = `${name}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const rec: PerfTraceRecord = {
      id,
      name,
      startTime: Date.now(),
      status: 'active',
      attrs: { ...attrs },
      marks: [],
    };
    this.traces.set(id, rec);
    // Track audio trace as the active one so components can mark without passing IDs around
    if (name.startsWith('audio')) {
      this.activeAudioTraceId = id;
    }
    return id;
  }

  mark(idOrLabel: string, labelOrData?: string | Record<string, any>, maybeData?: Record<string, any>) {
    // Convenience: if the first param looks like a label, attach to active audio trace
    let id: string | undefined;
    let label: string;
    let data: Record<string, any> | undefined;

    if (this.traces.has(idOrLabel)) {
      id = idOrLabel;
      label = (labelOrData as string) || 'mark';
      data = maybeData;
    } else {
      id = this.activeAudioTraceId || undefined;
      label = idOrLabel;
      data = (labelOrData as Record<string, any>) || undefined;
    }

    if (!id) return; // No active trace to attach to

    const rec = this.traces.get(id);
    if (!rec) return;

    rec.marks.push({ label, at: Date.now(), data });
  }

  end(id?: string, status: TraceStatus = 'success', errorMessage?: string): PerfTraceRecord | null {
    const resolvedId = id || this.activeAudioTraceId || null;
    if (!resolvedId) return null;

    const rec = this.traces.get(resolvedId);
    if (!rec) return null;

    rec.endTime = Date.now();
    rec.status = status;
    rec.errorMessage = errorMessage;

    // Compute metrics
    const durationMs = (rec.endTime - rec.startTime);
    const firstPlayable = rec.marks.find(m => m.label === 'first_chunk_ready' || m.label === 'first_playback');
    const completed = rec.marks.find(m => m.label === 'generation_complete' || m.label === 'stream_complete');

    rec.metrics = {
      durationMs,
      ttfpMs: firstPlayable ? (firstPlayable.at - rec.startTime) : undefined,
      ttcMs: completed ? (completed.at - rec.startTime) : durationMs,
    };

    // Maintain recents ring buffer
    this.recent.push({ ...rec });
    if (this.recent.length > this.maxRecent) {
      this.recent.shift();
    }

    // Clear active audio trace if we just ended it
    if (this.activeAudioTraceId === resolvedId) {
      this.activeAudioTraceId = null;
    }

    return rec;
  }

  getActiveAudioTraceId(): string | null {
    return this.activeAudioTraceId;
  }

  getTrace(id: string): PerfTraceRecord | undefined {
    return this.traces.get(id);
  }

  getRecentTraces(limit: number = 20): PerfTraceRecord[] {
    return this.recent.slice(-limit);
  }
}

export const PerfTracer = new PerfTracerImpl();
