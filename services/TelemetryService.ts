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
  private maxBufferCap = 200;
  private autoFlushIntervalMs = 15_000;
  private autoFlushTimer: ReturnType<typeof setInterval> | null = null;
  private flushing = false;
  private analyticsConsentGranted = false;
  private static counters: CounterMap = {};

  private isTelemetryEnabled(): boolean {
    return getFeatureFlag('telemetry_enabled') && this.analyticsConsentGranted;
  }

  setAnalyticsConsent(granted: boolean) {
    this.analyticsConsentGranted = granted;
    if (!granted) {
      this.buffer = [];
    }
  }

  recordTrace(trace: PerfTraceRecord) {
    if (!this.isTelemetryEnabled()) return;
    const durationMs =
      trace.metrics?.durationMs ??
      (trace.endTime != null ? trace.endTime - trace.startTime : null);

    const row: AudioMetricRow = {
      name: trace.name,
      ttfp_ms: trace.metrics?.ttfpMs ?? null,
      ttc_ms: trace.metrics?.ttcMs ?? null,
      duration_ms: durationMs ?? 0,
      success: trace.status === 'success',
      error_message: trace.errorMessage || null,
      device: null,
      os: null,
      app_version: null,
    };

    this.buffer.push(row);
    if (this.buffer.length > this.maxBufferCap) {
      const droppedCount = this.buffer.length - this.maxBufferCap;
      this.buffer.splice(0, droppedCount);
      TelemetryServiceImpl.increment('telemetry_dropped_buffer_overflow', droppedCount);
    }

    if (this.buffer.length >= this.maxBuffer) {
      this.flush().catch(() => {});
    }
  }

  startAutoFlush(intervalMs: number = this.autoFlushIntervalMs) {
    if (this.autoFlushTimer) return;

    this.autoFlushIntervalMs = Math.max(5_000, intervalMs);
    this.autoFlushTimer = setInterval(() => {
      this.flush().catch(() => {});
    }, this.autoFlushIntervalMs);
  }

  stopAutoFlush() {
    if (!this.autoFlushTimer) return;
    clearInterval(this.autoFlushTimer);
    this.autoFlushTimer = null;
  }

  async flush(): Promise<void> {
    if (this.flushing || this.buffer.length === 0) return;
    if (!this.isTelemetryEnabled()) {
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
        if (this.buffer.length > this.maxBufferCap) {
          const droppedCount = this.buffer.length - this.maxBufferCap;
          this.buffer.splice(0, droppedCount);
          TelemetryServiceImpl.increment('telemetry_dropped_retry_overflow', droppedCount);
        }
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
    if (!this.isTelemetryEnabled()) return;
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
  increment(name: string, by: number = 1) {
    TelemetryServiceImpl.increment(name, by);
  }

  static increment(name: string, by: number = 1) {
    if (!name) return;
    TelemetryServiceImpl.counters[name] = (TelemetryServiceImpl.counters[name] || 0) + by;
  }

  get(name: string): number {
    return TelemetryServiceImpl.get(name);
  }

  static get(name: string): number {
    return TelemetryServiceImpl.counters[name] || 0;
  }

  getAll(): CounterMap {
    return TelemetryServiceImpl.getAll();
  }

  static getAll(): CounterMap {
    return { ...TelemetryServiceImpl.counters };
  }

  reset() {
    TelemetryServiceImpl.reset();
  }

  static reset() {
    TelemetryServiceImpl.counters = {};
  }
}

export const TelemetryService = new TelemetryServiceImpl();
