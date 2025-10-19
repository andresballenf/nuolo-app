"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TelemetryService = void 0;
const supabase_1 = require("../lib/supabase");
const perfTrace_1 = require("../utils/perfTrace");
const featureFlags_1 = require("../config/featureFlags");
class TelemetryServiceImpl {
    constructor() {
        this.buffer = [];
        this.maxBuffer = 20;
        this.flushing = false;
        this.counters = {};
    }
    recordTrace(trace) {
        var _a, _b, _c, _d, _e, _f;
        if (!(0, featureFlags_1.getFeatureFlag)('telemetry_enabled'))
            return;
        const durationMs = (_b = (_a = trace.metrics) === null || _a === void 0 ? void 0 : _a.durationMs) !== null && _b !== void 0 ? _b : (trace.endTime != null ? trace.endTime - trace.startTime : null);
        const row = {
            name: trace.name,
            ttfp_ms: (_d = (_c = trace.metrics) === null || _c === void 0 ? void 0 : _c.ttfpMs) !== null && _d !== void 0 ? _d : null,
            ttc_ms: (_f = (_e = trace.metrics) === null || _e === void 0 ? void 0 : _e.ttcMs) !== null && _f !== void 0 ? _f : null,
            duration_ms: durationMs !== null && durationMs !== void 0 ? durationMs : 0,
            success: trace.status === 'success',
            error_message: trace.errorMessage || null,
            device: null,
            os: null,
            app_version: null,
        };
        this.buffer.push(row);
        if (this.buffer.length >= this.maxBuffer) {
            this.flush().catch(() => { });
        }
    }
    async flush() {
        if (this.flushing || this.buffer.length === 0)
            return;
        if (!(0, featureFlags_1.getFeatureFlag)('telemetry_enabled')) {
            this.buffer = [];
            return;
        }
        this.flushing = true;
        const payload = this.buffer.splice(0, this.buffer.length);
        try {
            const { error } = await supabase_1.supabase.from('audio_pipeline_metrics').insert(payload);
            if (error) {
                // Put back on buffer for a later attempt
                this.buffer.unshift(...payload);
            }
        }
        finally {
            this.flushing = false;
        }
    }
    // React Query hook: call on query errors/success for network timing breadcrumbs
    logReactQueryEvent(event) {
        // For now, just attach a perf mark to the active audio trace
        perfTrace_1.PerfTracer.mark('rq_event', {
            type: event.type,
            key: event.key,
            status: event.status,
            durationMs: event.durationMs,
            errorMessage: event.errorMessage,
        });
    }
    getRecentTraces(limit = 20) {
        return perfTrace_1.PerfTracer.getRecentTraces(limit);
    }
    async fetchPercentiles(limit = 200) {
        const { data, error } = await supabase_1.supabase
            .from('audio_pipeline_metrics')
            .select('duration_ms')
            .order('created_at', { ascending: false })
            .limit(limit);
        if (error || !data)
            return { p50: null, p95: null, samples: 0 };
        const durations = data.map(d => d.duration_ms).filter((n) => typeof n === 'number');
        durations.sort((a, b) => a - b);
        const percentile = (p) => {
            if (durations.length === 0)
                return null;
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
    increment(name, by = 1) {
        if (!name)
            return;
        this.counters[name] = (this.counters[name] || 0) + by;
    }
    get(name) {
        return this.counters[name] || 0;
    }
    getAll() {
        return { ...this.counters };
    }
    reset() {
        this.counters = {};
    }
}
exports.TelemetryService = new TelemetryServiceImpl();
