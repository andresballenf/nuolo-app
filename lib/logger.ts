/**
 * Secure Logging Utility
 *
 * Provides centralized logging with automatic sensitive data redaction
 * and environment-aware behavior (development vs production).
 *
 * Security Features:
 * - Automatic redaction of sensitive fields (tokens, passwords, keys, etc.)
 * - Development-only detailed logging
 * - Production error reporting ready (integrate with Sentry/equivalent)
 * - Pattern-based sensitive data detection
 */

const isDevelopment = __DEV__;
const isProduction = !__DEV__;

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
 * Recursively redact sensitive data from objects
 */
function redactSensitiveData(data: any, depth = 0): any {
  // Prevent infinite recursion
  if (depth > 10) {
    return '[MAX_DEPTH_EXCEEDED]';
  }

  // Handle null/undefined
  if (data === null || data === undefined) {
    return data;
  }

  // Handle strings - check if they contain sensitive patterns
  if (typeof data === 'string') {
    // Don't redact short strings or obvious non-sensitive data
    if (data.length < 3) return data;

    // Check for sensitive patterns in key names (handled at parent level)
    return data;
  }

  // Handle arrays
  if (Array.isArray(data)) {
    return data.map(item => redactSensitiveData(item, depth + 1));
  }

  // Handle objects
  if (typeof data === 'object') {
    const redacted: any = {};

    for (const key of Object.keys(data)) {
      // Check if key matches sensitive patterns
      const isSensitiveKey = [...SENSITIVE_PATTERNS, ...PII_PATTERNS].some(
        pattern => pattern.test(key)
      );

      if (isSensitiveKey) {
        redacted[key] = '[REDACTED]';
      } else {
        redacted[key] = redactSensitiveData(data[key], depth + 1);
      }
    }

    return redacted;
  }

  // Return primitives as-is
  return data;
}

/**
 * Format error for logging with stack trace in development
 */
function formatError(error: any): any {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      stack: isDevelopment ? error.stack : undefined,
    };
  }

  return error;
}

/**
 * Send error to production error tracking service
 * TODO: Integrate with Sentry or equivalent service
 */
function sendToErrorTracking(message: string, error?: any): void {
  if (isProduction) {
    // TODO: Implement Sentry.captureException or equivalent
    // For now, use console.error as fallback
    console.error('[ERROR_TRACKING]', message, error);
  }
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
   * General purpose logging - Development only
   */
  log: (message: string, ...args: any[]): void => {
    if (isDevelopment) {
      const redactedArgs = args.map(redactSensitiveData);
      console.log(`[LOG] ${message}`, ...redactedArgs);
    }
  },

  /**
   * Error logging - Works in all environments
   * In production, sends to error tracking service
   */
  error: (message: string, error?: any): void => {
    const formattedError = error ? formatError(error) : undefined;
    const redactedError = redactSensitiveData(formattedError);

    if (isDevelopment) {
      console.error(`[ERROR] ${message}`, redactedError);
    } else {
      // Production: send to error tracking service
      sendToErrorTracking(message, redactedError);
    }
  },

  /**
   * Warning logging - Development only
   */
  warn: (message: string, ...args: any[]): void => {
    if (isDevelopment) {
      const redactedArgs = args.map(redactSensitiveData);
      console.warn(`[WARN] ${message}`, ...redactedArgs);
    }
  },

  /**
   * Info logging - Development only
   */
  info: (message: string, ...args: any[]): void => {
    if (isDevelopment) {
      const redactedArgs = args.map(redactSensitiveData);
      console.log(`[INFO] ${message}`, ...redactedArgs);
    }
  },

  /**
   * Security event logging - Works in all environments
   * Important security events should always be logged
   */
  security: (message: string, ...args: any[]): void => {
    const redactedArgs = args.map(redactSensitiveData);
    console.warn(`[SECURITY] ${message}`, ...redactedArgs);

    // In production, also send to monitoring service
    if (isProduction) {
      sendToErrorTracking(`[SECURITY] ${message}`, redactedArgs);
    }
  },

  /**
   * Debug logging - Development only, more verbose
   */
  debug: (message: string, ...args: any[]): void => {
    if (isDevelopment) {
      const redactedArgs = args.map(redactSensitiveData);
      console.log(`[DEBUG] ${message}`, ...redactedArgs);
    }
  },
};

/**
 * Legacy console methods - Deprecated, use logger instead
 * These can be used during migration period
 */
export const deprecatedConsole = {
  log: console.log,
  error: console.error,
  warn: console.warn,
  info: console.info,
  debug: console.debug,
};
