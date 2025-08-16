// Secure error handling with sensitive data sanitization
// Prevents information leakage while maintaining useful error reporting

interface ErrorResponse {
  error: string;
  errorType: string;
  errorCode?: string;
  timestamp: number;
  requestId?: string;
}

interface ErrorDetails {
  originalError: Error;
  context: string;
  userId?: string;
  requestId?: string;
  sanitized: boolean;
}

// Patterns that should be redacted from error messages
const SENSITIVE_PATTERNS = [
  // API Keys and tokens
  /\b[A-Za-z0-9_-]{32,}\b/g, // Generic API key pattern
  /sk-[A-Za-z0-9]{20,}/g, // OpenAI API key pattern
  /Bearer\s+[A-Za-z0-9_.-]+/gi, // Bearer tokens
  /eyJ[A-Za-z0-9_.-]+/g, // JWT tokens
  
  // Database connection strings
  /postgresql:\/\/[^:\s]+:[^@\s]+@[^\s]+/gi,
  /mysql:\/\/[^:\s]+:[^@\s]+@[^\s]+/gi,
  /mongodb:\/\/[^:\s]+:[^@\s]+@[^\s]+/gi,
  
  // Email addresses and user data
  /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g,
  
  // IP addresses (internal)
  /\b192\.168\.\d{1,3}\.\d{1,3}\b/g,
  /\b10\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/g,
  /\b172\.(1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3}\b/g,
  
  // File paths that might contain sensitive info
  /\/home\/[^\/\s]+/g,
  /\/Users\/[^\/\s]+/g,
  /C:\\Users\\[^\\]+/g,
  
  // Common secrets
  /password[=:\s]["']?[^\s"']+/gi,
  /secret[=:\s]["']?[^\s"']+/gi,
  /key[=:\s]["']?[^\s"']+/gi,
];

// Common error types and their user-friendly messages
const ERROR_TYPE_MAPPINGS = {
  // OpenAI errors
  'insufficient_quota': {
    userMessage: 'Service temporarily unavailable due to high demand',
    errorCode: 'SERVICE_QUOTA_EXCEEDED',
    retryable: true
  },
  'model_overloaded': {
    userMessage: 'Service is experiencing high load, please try again',
    errorCode: 'SERVICE_OVERLOADED',
    retryable: true
  },
  'invalid_request_error': {
    userMessage: 'Invalid request parameters',
    errorCode: 'INVALID_REQUEST',
    retryable: false
  },
  'rate_limit_exceeded': {
    userMessage: 'Too many requests, please slow down',
    errorCode: 'RATE_LIMIT_EXCEEDED',
    retryable: true
  },
  
  // Network errors
  'fetch_error': {
    userMessage: 'Network connection error',
    errorCode: 'NETWORK_ERROR',
    retryable: true
  },
  'timeout': {
    userMessage: 'Request timed out, please try again',
    errorCode: 'TIMEOUT_ERROR',
    retryable: true
  },
  
  // Validation errors
  'validation_error': {
    userMessage: 'Invalid input provided',
    errorCode: 'VALIDATION_ERROR',
    retryable: false
  },
  
  // Authentication errors
  'authentication_error': {
    userMessage: 'Authentication required',
    errorCode: 'AUTH_ERROR',
    retryable: false
  },
  'authorization_error': {
    userMessage: 'Access denied',
    errorCode: 'ACCESS_DENIED',
    retryable: false
  },
  
  // Server errors
  'internal_server_error': {
    userMessage: 'Internal server error, please try again later',
    errorCode: 'INTERNAL_ERROR',
    retryable: true
  },
  'service_unavailable': {
    userMessage: 'Service temporarily unavailable',
    errorCode: 'SERVICE_UNAVAILABLE',
    retryable: true
  }
};

export class SecureErrorHandler {
  private static instance: SecureErrorHandler;
  private errorCount = new Map<string, number>();
  private lastErrorTime = new Map<string, number>();
  
  static getInstance(): SecureErrorHandler {
    if (!SecureErrorHandler.instance) {
      SecureErrorHandler.instance = new SecureErrorHandler();
    }
    return SecureErrorHandler.instance;
  }
  
  // Sanitize error message by removing sensitive information
  private sanitizeErrorMessage(message: string): string {
    let sanitized = message;
    
    SENSITIVE_PATTERNS.forEach(pattern => {
      sanitized = sanitized.replace(pattern, '[REDACTED]');
    });
    
    // Remove stack traces from user-facing errors
    const stackTraceIndex = sanitized.indexOf('\n    at ');
    if (stackTraceIndex !== -1) {
      sanitized = sanitized.substring(0, stackTraceIndex);
    }
    
    return sanitized;
  }
  
  // Classify error type based on error properties
  private classifyError(error: Error): string {
    const message = error.message.toLowerCase();
    
    // OpenAI specific errors
    if (message.includes('insufficient_quota') || message.includes('quota')) {
      return 'insufficient_quota';
    }
    if (message.includes('overloaded') || message.includes('engine overloaded')) {
      return 'model_overloaded';
    }
    if (message.includes('invalid') && message.includes('request')) {
      return 'invalid_request_error';
    }
    if (message.includes('rate limit')) {
      return 'rate_limit_exceeded';
    }
    
    // Network errors
    if (message.includes('fetch') || message.includes('network')) {
      return 'fetch_error';
    }
    if (message.includes('timeout') || message.includes('timed out')) {
      return 'timeout';
    }
    
    // Authentication/Authorization
    if (message.includes('unauthorized') || message.includes('authentication')) {
      return 'authentication_error';
    }
    if (message.includes('forbidden') || message.includes('access denied')) {
      return 'authorization_error';
    }
    
    // Validation errors
    if (message.includes('validation') || message.includes('invalid')) {
      return 'validation_error';
    }
    
    // Default classification
    if (error.name === 'TypeError' || error.name === 'ReferenceError') {
      return 'internal_server_error';
    }
    
    return 'internal_server_error';
  }
  
  // Generate unique request ID
  private generateRequestId(): string {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
  
  // Track error frequency for monitoring
  private trackError(errorType: string): void {
    const count = this.errorCount.get(errorType) || 0;
    this.errorCount.set(errorType, count + 1);
    this.lastErrorTime.set(errorType, Date.now());
  }
  
  // Create secure error response
  createErrorResponse(
    error: Error,
    context: string,
    userId?: string,
    includeStack: boolean = false
  ): ErrorResponse {
    const requestId = this.generateRequestId();
    const errorType = this.classifyError(error);
    
    this.trackError(errorType);
    
    // Get mapped error info
    const errorMapping = ERROR_TYPE_MAPPINGS[errorType as keyof typeof ERROR_TYPE_MAPPINGS];
    
    // Log full error details securely (for monitoring)
    this.logErrorSecurely({
      originalError: error,
      context,
      userId,
      requestId,
      sanitized: false
    });
    
    // Create sanitized response for client
    const sanitizedMessage = errorMapping 
      ? errorMapping.userMessage 
      : this.sanitizeErrorMessage(error.message);
    
    const response: ErrorResponse = {
      error: sanitizedMessage,
      errorType: errorType,
      errorCode: errorMapping?.errorCode,
      timestamp: Date.now(),
      requestId
    };
    
    // Include stack trace only in development and for internal errors
    if (includeStack && (Deno.env.get('DENO_DEPLOYMENT_ID') === undefined)) {
      (response as any).stack = this.sanitizeErrorMessage(error.stack || '');
    }
    
    return response;
  }
  
  // Secure error logging (logs full details for monitoring)
  private logErrorSecurely(details: ErrorDetails): void {
    const logEntry = {
      timestamp: new Date().toISOString(),
      level: 'ERROR',
      context: details.context,
      requestId: details.requestId,
      userId: details.userId,
      errorType: this.classifyError(details.originalError),
      message: details.originalError.message,
      stack: details.originalError.stack,
      // Don't log the full error object to avoid circular references
      errorName: details.originalError.name,
      sanitized: details.sanitized
    };
    
    // In production, this would go to a secure logging service
    if (Deno.env.get('DENO_DEPLOYMENT_ID')) {
      // Production: Log only essential info to console
      console.error('Error:', {
        requestId: details.requestId,
        context: details.context,
        errorType: this.classifyError(details.originalError),
        timestamp: logEntry.timestamp
      });
    } else {
      // Development: Log full details
      console.error('Detailed Error Log:', logEntry);
    }
  }
  
  // Get error statistics for monitoring
  getErrorStats(): { 
    errorCounts: Record<string, number>;
    lastErrors: Record<string, number>;
    totalErrors: number;
  } {
    const errorCounts: Record<string, number> = {};
    const lastErrors: Record<string, number> = {};
    let totalErrors = 0;
    
    for (const [type, count] of this.errorCount.entries()) {
      errorCounts[type] = count;
      totalErrors += count;
    }
    
    for (const [type, time] of this.lastErrorTime.entries()) {
      lastErrors[type] = time;
    }
    
    return { errorCounts, lastErrors, totalErrors };
  }
  
  // Check if error is retryable
  isRetryable(errorType: string): boolean {
    const mapping = ERROR_TYPE_MAPPINGS[errorType as keyof typeof ERROR_TYPE_MAPPINGS];
    return mapping?.retryable || false;
  }
  
  // Clear error statistics (for testing or reset)
  clearStats(): void {
    this.errorCount.clear();
    this.lastErrorTime.clear();
  }
}

// Convenience functions
export const errorHandler = SecureErrorHandler.getInstance();

export function createSecureError(
  error: Error,
  context: string,
  userId?: string,
  includeStack: boolean = false
): ErrorResponse {
  return errorHandler.createErrorResponse(error, context, userId, includeStack);
}

export function isRetryableError(errorType: string): boolean {
  return errorHandler.isRetryable(errorType);
}

export function getErrorStatistics(): ReturnType<SecureErrorHandler['getErrorStats']> {
  return errorHandler.getErrorStats();
}

// Helper function to wrap async operations with error handling
export async function withSecureErrorHandling<T>(
  operation: () => Promise<T>,
  context: string,
  userId?: string
): Promise<{ result?: T; error?: ErrorResponse }> {
  try {
    const result = await operation();
    return { result };
  } catch (error) {
    const secureError = createSecureError(error as Error, context, userId);
    return { error: secureError };
  }
}