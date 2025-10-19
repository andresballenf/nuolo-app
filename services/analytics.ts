// Lightweight analytics wrapper used across the app. No-op by default, logs to console in development.
// Events are counted via TelemetryService counters for simple introspection.

import { TelemetryService } from './TelemetryService';

export type AnalyticsParams = Record<string, any> | undefined;

export function track(event: string, params?: AnalyticsParams): void {
  if (!event) return;
  try {
    // Simple counter for occurrences
    TelemetryService.increment(event);
    // Dev-friendly console log
    if (typeof console !== 'undefined') {
      // eslint-disable-next-line no-console
      console.debug('[analytics]', event, params ?? {});
    }
  } catch {
    // noop
  }
}

export const Analytics = { track };
