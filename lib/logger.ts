/**
 * Secure Logging Utility
 *
 * Centralized logging with automatic sensitive data redaction and
 * production error tracking adapters.
 */

const isDevelopment = __DEV__;
const isProduction = !__DEV__;

type ErrorTrackingLevel = 'error' | 'security';

interface ErrorTrackingEvent {
  level: ErrorTrackingLevel;
  message: string;
  error?: unknown;
  context?: Record<string, unknown>;
  timestamp: string;
}

type ErrorTrackingAdapter = (event: ErrorTrackingEvent) => void | Promise<void>;

let trackingAdapter: ErrorTrackingAdapter | null = null;

// Patterns that indicate sensitive data
const SENSITIVE_PATTERNS = [
  /token/i,
  /password/i,
  /secret/i,
  /key/i,
  /session/i,
  /authorization/i,
  /bearer/i,
  /auth/i,
  /credential/i,
  /api[-_]?key/i,
  /access[-_]?token/i,
  /refresh[-_]?token/i,
  /purchase[-_]?token/i,
];

// PII patterns to redact
const PII_PATTERNS = [
  /email/i,
  /phone/i,
  /address/i,
  /ssn/i,
  /passport/i,
  /license/i,
];

/**
 * Recursively redact sensitive data from objects.
 */
function redactSensitiveData(data: unknown, depth = 0): unknown {
  if (depth > 10) {
    return '[MAX_DEPTH_EXCEEDED]';
  }

  if (data === null || data === undefined) {
    return data;
  }

  if (typeof data === 'string') {
    if (data.length < 3) return data;
    return data;
  }

  if (Array.isArray(data)) {
    return data.map(item => redactSensitiveData(item, depth + 1));
  }

  if (typeof data === 'object') {
    const redacted: Record<string, unknown> = {};
    const objectData = data as Record<string, unknown>;

    for (const key of Object.keys(objectData)) {
      const isSensitiveKey = [...SENSITIVE_PATTERNS, ...PII_PATTERNS].some(
        pattern => pattern.test(key)
      );
      redacted[key] = isSensitiveKey
        ? '[REDACTED]'
        : redactSensitiveData(objectData[key], depth + 1);
    }

    return redacted;
  }

  return data;
}

/**
 * Format error for logging with stack trace in development.
 */
function formatError(error: unknown): unknown {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      stack: isDevelopment ? error.stack : undefined,
    };
  }

  return error;
}

export function setErrorTrackingAdapter(adapter: ErrorTrackingAdapter | null): void {
  trackingAdapter = adapter;
}

function sendToErrorTracking(
  level: ErrorTrackingLevel,
  message: string,
  error?: unknown,
  context?: Record<string, unknown>
): void {
  if (!isProduction) {
    return;
  }

  const payload: ErrorTrackingEvent = {
    level,
    message,
    error: redactSensitiveData(error),
    context: context ? (redactSensitiveData(context) as Record<string, unknown>) : undefined,
    timestamp: new Date().toISOString(),
  };

  if (trackingAdapter) {
    try {
      const result = trackingAdapter(payload);
      if (result && typeof (result as Promise<void>).catch === 'function') {
        (result as Promise<void>).catch(() => {
          console.error('[ERROR_TRACKING] adapter failed');
        });
      }
      return;
    } catch (adapterError) {
      console.error('[ERROR_TRACKING] adapter threw', redactSensitiveData(formatError(adapterError)));
    }
  }

  // Fallback until provider adapter is configured (Sentry, Datadog, etc.)
  console.error('[ERROR_TRACKING]', payload);
}

/**
 * Secure Logger
 *
 * Usage:
 * - logger.log('Message', data) - General logging (dev only)
 * - logger.error('Error occurred', error) - Error logging (all envs)
 * - logger.warn('Warning message', data) - Warning (dev only)
 * - logger.info('Info message', data) - Info (dev only)
 * - logger.security('Security event', data) - Security events (all envs)
 */
export const logger = {
  /**
   * General purpose logging - Development only.
   */
  log: (message: string, ...args: unknown[]): void => {
    if (!isDevelopment) return;
    const redactedArgs = args.map(redactSensitiveData);
    console.log(`[LOG] ${message}`, ...redactedArgs);
  },

  /**
   * Error logging - works in all environments.
   */
  error: (message: string, error?: unknown, context?: Record<string, unknown>): void => {
    const formattedError = error ? formatError(error) : undefined;
    const redactedError = redactSensitiveData(formattedError);

    if (isDevelopment) {
      console.error(`[ERROR] ${message}`, redactedError, context ? redactSensitiveData(context) : undefined);
      return;
    }

    sendToErrorTracking('error', message, redactedError, context);
  },

  /**
   * Warning logging - Development only.
   */
  warn: (message: string, ...args: unknown[]): void => {
    if (!isDevelopment) return;
    const redactedArgs = args.map(redactSensitiveData);
    console.warn(`[WARN] ${message}`, ...redactedArgs);
  },

  /**
   * Info logging - Development only.
   */
  info: (message: string, ...args: unknown[]): void => {
    if (!isDevelopment) return;
    const redactedArgs = args.map(redactSensitiveData);
    console.log(`[INFO] ${message}`, ...redactedArgs);
  },

  /**
   * Security event logging - works in all environments.
   */
  security: (message: string, ...args: unknown[]): void => {
    const redactedArgs = args.map(redactSensitiveData);
    console.warn(`[SECURITY] ${message}`, ...redactedArgs);

    if (isProduction) {
      sendToErrorTracking('security', message, { args: redactedArgs });
    }
  },

  /**
   * Debug logging - Development only, more verbose.
   */
  debug: (message: string, ...args: unknown[]): void => {
    if (!isDevelopment) return;
    const redactedArgs = args.map(redactSensitiveData);
    console.log(`[DEBUG] ${message}`, ...redactedArgs);
  },
};

/**
 * Legacy console methods - Deprecated, use logger instead.
 */
export const deprecatedConsole = {
  log: console.log,
  error: console.error,
  warn: console.warn,
  info: console.info,
  debug: console.debug,
};
