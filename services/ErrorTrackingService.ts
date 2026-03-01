import { logger, setErrorTrackingAdapter } from '../lib/logger';
import { TelemetryService } from './TelemetryService';

type GlobalErrorHandler = (error: unknown, isFatal?: boolean) => void;

let initialized = false;
let previousGlobalErrorHandler: GlobalErrorHandler | null = null;

interface ErrorUtilsLike {
  getGlobalHandler?: () => GlobalErrorHandler;
  setGlobalHandler?: (handler: GlobalErrorHandler) => void;
}

const getErrorUtils = (): ErrorUtilsLike | null => {
  const globalValue = globalThis as unknown as { ErrorUtils?: ErrorUtilsLike };
  if (!globalValue.ErrorUtils) {
    return null;
  }
  return globalValue.ErrorUtils;
};

/**
 * Wires the secure logger to production error tracking hooks and uncaught handler breadcrumbs.
 */
export function initializeErrorTracking(): void {
  if (initialized) {
    return;
  }

  setErrorTrackingAdapter(event => {
    TelemetryService.increment('error_tracking_event_total');
    TelemetryService.increment(`error_tracking_event_${event.level}`);
  });

  const errorUtils = getErrorUtils();
  if (errorUtils?.setGlobalHandler) {
    previousGlobalErrorHandler = errorUtils.getGlobalHandler ? errorUtils.getGlobalHandler() : null;

    errorUtils.setGlobalHandler((error, isFatal) => {
      TelemetryService.increment('session_crash_uncaught');
      if (isFatal) {
        TelemetryService.increment('session_crash_uncaught_fatal');
      }

      logger.error('Unhandled global runtime error', error, { isFatal: Boolean(isFatal) });

      if (previousGlobalErrorHandler) {
        previousGlobalErrorHandler(error, isFatal);
      }
    });
  }

  initialized = true;
}

export function shutdownErrorTracking(): void {
  if (!initialized) {
    return;
  }

  const errorUtils = getErrorUtils();
  if (errorUtils?.setGlobalHandler && previousGlobalErrorHandler) {
    errorUtils.setGlobalHandler(previousGlobalErrorHandler);
  }

  setErrorTrackingAdapter(null);
  previousGlobalErrorHandler = null;
  initialized = false;
}
