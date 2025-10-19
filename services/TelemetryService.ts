type CounterMap = Record<string, number>;

/**
 * Simple in-memory telemetry counter service.
 * Persisting counters across launches is optional; currently we keep them in-memory
 * and expose a method to retrieve for logging/diagnostics.
 */
export class TelemetryService {
  private static counters: CounterMap = {};

  static increment(name: string, by: number = 1) {
    if (!name) return;
    this.counters[name] = (this.counters[name] || 0) + by;
  }

  static get(name: string): number {
    return this.counters[name] || 0;
  }

  static getAll(): CounterMap {
    return { ...this.counters };
  }

  static reset() {
    this.counters = {};
  }
}
