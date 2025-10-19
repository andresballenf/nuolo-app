"use strict";
/*
 * Lightweight performance tracing utility for the end-to-end audio pipeline.
 *
 * Features
 * - start/mark/end traces with arbitrary attributes and marks
 * - compute TTFP (time-to-first-playable/chunk) and TTC (time-to-complete)
 * - keep a ring buffer of recent traces for diagnostics overlay
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.PerfTracer = void 0;
class PerfTracerImpl {
    constructor() {
        this.traces = new Map();
        this.recent = [];
        this.maxRecent = 50;
        this.activeAudioTraceId = null;
    }
    start(name, attrs = {}) {
        const id = `${name}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
        const rec = {
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
    mark(idOrLabel, labelOrData, maybeData) {
        // Convenience: if the first param looks like a label, attach to active audio trace
        let id;
        let label;
        let data;
        if (this.traces.has(idOrLabel)) {
            id = idOrLabel;
            label = labelOrData || 'mark';
            data = maybeData;
        }
        else {
            id = this.activeAudioTraceId || undefined;
            label = idOrLabel;
            data = labelOrData || undefined;
        }
        if (!id)
            return; // No active trace to attach to
        const rec = this.traces.get(id);
        if (!rec)
            return;
        rec.marks.push({ label, at: Date.now(), data });
    }
    end(id, status = 'success', errorMessage) {
        const resolvedId = id || this.activeAudioTraceId || null;
        if (!resolvedId)
            return null;
        const rec = this.traces.get(resolvedId);
        if (!rec)
            return null;
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
    getActiveAudioTraceId() {
        return this.activeAudioTraceId;
    }
    getTrace(id) {
        return this.traces.get(id);
    }
    getRecentTraces(limit = 20) {
        return this.recent.slice(-limit);
    }
}
exports.PerfTracer = new PerfTracerImpl();
