import { supabase } from '../lib/supabase';
import { PerfTracer, PerfTraceRecord } from '../utils/perfTrace';
import { getFeatureFlag } from '../config/featureFlags';

interface AudioMetricRow {
  created_at?: string;
  name: string; // e.g., 'audio_pipeline'
  ttfp_ms?: number | null;
  ttc_ms?: number | null;
  duration_ms: number;
  success: boolean;
  error_message?: string | null;
  device?: string | null;
  os?: string | null;
  app_version?: string | null;
}

type CounterMap = Record<string, number>;

class TelemetryServiceImpl {
  private buffer: AudioMetricRow[] = [];
  private maxBuffer = 20;
  private flushing = false;
  private static counters: CounterMap = {};

  recordTrace(trace: PerfTraceRecord) {
    if (!getFeatureFlag('telemetry_enabled')) return;
    const row: AudioMetricRow = {
      name: trace.name,
      ttfp_ms: trace.metrics?.ttfpMs ?? null,
      ttc_ms: trace.metrics?.ttcMs ?? null,
      duration_ms: trace.metrics?.durationMs ?? (trace.endTime && (trace.endTime - trace.startTime)) || 0,
      success: trace.status === 'success',
      error_message: trace.errorMessage || null,
      device: null,
      os: null,
      app_version: null,
    };

    this.buffer.push(row);
    if (this.buffer.length >= this.maxBuffer) {
      this.flush().catch(() => {});
    }
  }

  async flush(): Promise<void> {
    if (this.flushing || this.buffer.length === 0) return;
    if (!getFeatureFlag('telemetry_enabled')) {
      this.buffer = [];
      return;
    }

    this.flushing = true;
    const payload = this.buffer.splice(0, this.buffer.length);

    try {
      const { error } = await supabase.from('audio_pipeline_metrics').insert(payload);
      if (error) {
        // Put back on buffer for a later attempt
        this.buffer.unshift(...payload);
      }
    } finally {
      this.flushing = false;
    }
  }

  // React Query hook: call on query errors/success for network timing breadcrumbs
  logReactQueryEvent(event: {
    type: 'query' | 'mutation';
    key: string;
    status: 'success' | 'error';
    durationMs?: number;
    errorMessage?: string;
  }) {
    // For now, just attach a perf mark to the active audio trace
    PerfTracer.mark('rq_event', {
      type: event.type,
      key: event.key,
      status: event.status,
      durationMs: event.durationMs,
      errorMessage: event.errorMessage,
    });
  }

  getRecentTraces(limit = 20) {
    return PerfTracer.getRecentTraces(limit);
  }

  async fetchPercentiles(limit = 200): Promise<{ p50: number | null; p95: number | null; samples: number }>
  {
    const { data, error } = await supabase
      .from('audio_pipeline_metrics')
      .select('duration_ms')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error || !data) return { p50: null, p95: null, samples: 0 };

    const durations = data.map(d => d.duration_ms).filter((n: number | null) => typeof n === 'number') as number[];
    durations.sort((a, b) => a - b);

    const percentile = (p: number) => {
      if (durations.length === 0) return null;
      const idx = Math.ceil(p * durations.length) - 1;
      return durations[Math.max(0, Math.min(idx, durations.length - 1))];
    };

    return {
      p50: percentile(0.5),
      p95: percentile(0.95),
      samples: durations.length,
    };
  }

  // Simple in-memory counter methods from main branch
  static increment(name: string, by: number = 1) {
    if (!name) return;
    TelemetryServiceImpl.counters[name] = (TelemetryServiceImpl.counters[name] || 0) + by;
  }

  static get(name: string): number {
    return TelemetryServiceImpl.counters[name] || 0;
  }

  static getAll(): CounterMap {
    return { ...TelemetryServiceImpl.counters };
  }

  static reset() {
    TelemetryServiceImpl.counters = {};
  }
}

export const TelemetryService = new TelemetryServiceImpl();
