// Secure logging framework with privacy protection and structured output
// Prevents sensitive data logging while maintaining useful debugging information

interface LogEntry {
  timestamp: string;
  level: LogLevel;
  component: string;
  message: string;
  context?: Record<string, any>;
  requestId?: string;
  userId?: string;
  sessionId?: string;
  duration?: number;
  statusCode?: number;
  errorCode?: string;
  sanitized: boolean;
}

interface LogContext {
  requestId?: string;
  userId?: string;
  sessionId?: string;
  component?: string;
  operation?: string;
  startTime?: number;
}

type LogLevel = 'DEBUG' | 'INFO' | 'WARN' | 'ERROR' | 'FATAL';

interface SecurityLogEvent {
  type: 'authentication' | 'authorization' | 'rate_limit' | 'input_validation' | 'data_access' | 'error';
  action: string;
  result: 'success' | 'failure' | 'blocked';
  severity: 'low' | 'medium' | 'high' | 'critical';
  metadata?: Record<string, any>;
}

// Sensitive data patterns to redact
const SENSITIVE_PATTERNS = [
  // API Keys and tokens
  { pattern: /\b[A-Za-z0-9_-]{32,}\b/g, replacement: '[API_KEY_REDACTED]' },
  { pattern: /sk-[A-Za-z0-9]{20,}/g, replacement: '[OPENAI_KEY_REDACTED]' },
  { pattern: /Bearer\s+[A-Za-z0-9_.-]+/gi, replacement: 'Bearer [TOKEN_REDACTED]' },
  { pattern: /eyJ[A-Za-z0-9_.-]+/g, replacement: '[JWT_REDACTED]' },
  
  // Database credentials
  { pattern: /postgresql:\/\/[^:\s]+:[^@\s]+@[^\s]+/gi, replacement: 'postgresql://[CREDENTIALS_REDACTED]' },
  { pattern: /password[=:\s]["']?[^\s"']+/gi, replacement: 'password=[REDACTED]' },
  
  // Email addresses (partial redaction)
  { pattern: /\b([A-Za-z0-9._%+-]+)@([A-Za-z0-9.-]+\.[A-Z|a-z]{2,})\b/g, replacement: '$1@[EMAIL_DOMAIN_REDACTED]' },
  
  // IP addresses (internal networks only)
  { pattern: /\b192\.168\.\d{1,3}\.\d{1,3}\b/g, replacement: '192.168.XXX.XXX' },
  { pattern: /\b10\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/g, replacement: '10.XXX.XXX.XXX' },
  
  // File paths with user info
  { pattern: /\/home\/[^\/\s]+/g, replacement: '/home/[USER_REDACTED]' },
  { pattern: /\/Users\/[^\/\s]+/g, replacement: '/Users/[USER_REDACTED]' },
  { pattern: /C:\\Users\\[^\\]+/g, replacement: 'C:\\Users\\[USER_REDACTED]' },
  
  // Common secrets
  { pattern: /secret[=:\s]["']?[^\s"']+/gi, replacement: 'secret=[REDACTED]' },
  { pattern: /key[=:\s]["']?[^\s"']+/gi, replacement: 'key=[REDACTED]' },
];

// Log level hierarchy for filtering
const LOG_LEVELS = {
  DEBUG: 0,
  INFO: 1,
  WARN: 2,
  ERROR: 3,
  FATAL: 4
} as const;

export class SecureLogger {
  private static instance: SecureLogger;
  private context: LogContext = {};
  private minLogLevel: LogLevel;
  private enabledInProduction: boolean;
  private logBuffer: LogEntry[] = [];
  private maxBufferSize = 1000;
  
  constructor() {
    const isProduction = Deno.env.get('DENO_DEPLOYMENT_ID') !== undefined;
    this.minLogLevel = isProduction ? 'INFO' : 'DEBUG';
    this.enabledInProduction = true;
  }
  
  static getInstance(): SecureLogger {
    if (!SecureLogger.instance) {
      SecureLogger.instance = new SecureLogger();
    }
    return SecureLogger.instance;
  }
  
  // Set context for all subsequent logs
  setContext(context: Partial<LogContext>): void {
    this.context = { ...this.context, ...context };
  }
  
  // Clear context
  clearContext(): void {
    this.context = {};
  }
  
  // Update specific context field
  updateContext(key: keyof LogContext, value: any): void {
    this.context[key] = value;
  }
  
  // Sanitize sensitive data from log messages
  private sanitizeData(data: any): any {
    if (typeof data === 'string') {
      let sanitized = data;
      SENSITIVE_PATTERNS.forEach(({ pattern, replacement }) => {
        sanitized = sanitized.replace(pattern, replacement);
      });
      return sanitized;
    }
    
    if (typeof data === 'object' && data !== null) {
      if (Array.isArray(data)) {
        return data.map(item => this.sanitizeData(item));
      }
      
      const sanitized: Record<string, any> = {};
      for (const [key, value] of Object.entries(data)) {
        // Don't log certain sensitive fields at all
        if (['password', 'token', 'secret', 'key', 'authorization'].some(
          sensitive => key.toLowerCase().includes(sensitive)
        )) {
          sanitized[key] = '[REDACTED]';
        } else {
          sanitized[key] = this.sanitizeData(value);
        }
      }
      return sanitized;
    }
    
    return data;
  }
  
  // Check if log level should be output
  private shouldLog(level: LogLevel): boolean {
    const isProduction = Deno.env.get('DENO_DEPLOYMENT_ID') !== undefined;
    
    if (!this.enabledInProduction && isProduction) {
      return level === 'ERROR' || level === 'FATAL';
    }
    
    return LOG_LEVELS[level] >= LOG_LEVELS[this.minLogLevel];
  }
  
  // Core logging method
  private log(
    level: LogLevel, 
    component: string, 
    message: string, 
    context?: Record<string, any>,
    duration?: number
  ): void {
    if (!this.shouldLog(level)) return;
    
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      component,
      message: this.sanitizeData(message),
      context: context ? this.sanitizeData(context) : undefined,
      requestId: this.context.requestId,
      userId: this.context.userId,
      sessionId: this.context.sessionId,
      duration,
      sanitized: true
    };
    
    // Add to buffer
    this.logBuffer.push(entry);
    if (this.logBuffer.length > this.maxBufferSize) {
      this.logBuffer.shift(); // Remove oldest entry
    }
    
    // Output to console with appropriate formatting
    this.outputLog(entry);
  }
  
  // Output formatted log entry
  private outputLog(entry: LogEntry): void {
    const isProduction = Deno.env.get('DENO_DEPLOYMENT_ID') !== undefined;
    
    if (isProduction) {
      // Production: Structured JSON logging
      console.log(JSON.stringify({
        timestamp: entry.timestamp,
        level: entry.level,
        component: entry.component,
        message: entry.message,
        requestId: entry.requestId,
        userId: entry.userId ? `user_${entry.userId.substring(0, 8)}` : undefined, // Partial user ID
        duration: entry.duration,
        context: entry.context
      }));
    } else {
      // Development: Human-readable format
      const prefix = `[${entry.timestamp}] ${entry.level} ${entry.component}`;
      const suffix = entry.requestId ? ` (req: ${entry.requestId})` : '';
      const durationInfo = entry.duration ? ` (${entry.duration}ms)` : '';
      
      console.log(`${prefix}${suffix}${durationInfo}: ${entry.message}`);
      if (entry.context && Object.keys(entry.context).length > 0) {
        console.log('  Context:', entry.context);
      }
    }
  }
  
  // Public logging methods
  debug(component: string, message: string, context?: Record<string, any>): void {
    this.log('DEBUG', component, message, context);
  }
  
  info(component: string, message: string, context?: Record<string, any>): void {
    this.log('INFO', component, message, context);
  }
  
  warn(component: string, message: string, context?: Record<string, any>): void {
    this.log('WARN', component, message, context);
  }
  
  error(component: string, message: string, context?: Record<string, any>): void {
    this.log('ERROR', component, message, context);
  }
  
  fatal(component: string, message: string, context?: Record<string, any>): void {
    this.log('FATAL', component, message, context);
  }
  
  // Performance timing
  startTimer(operation: string): string {
    const timerId = `${operation}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    this.updateContext('startTime', Date.now());
    this.debug('timer', `Started ${operation}`, { timerId, operation });
    return timerId;
  }
  
  endTimer(timerId: string, operation: string, success: boolean = true): number {
    const startTime = this.context.startTime || Date.now();
    const duration = Date.now() - startTime;
    
    this.info('timer', `Completed ${operation}`, {
      timerId,
      operation,
      duration,
      success
    });
    
    return duration;
  }
  
  // Security event logging
  logSecurityEvent(event: SecurityLogEvent): void {
    const sanitizedEvent = this.sanitizeData(event);
    
    this.log(
      event.severity === 'critical' || event.severity === 'high' ? 'ERROR' : 'WARN',
      'security',
      `Security event: ${event.type} - ${event.action} (${event.result})`,
      {
        eventType: event.type,
        action: event.action,
        result: event.result,
        severity: event.severity,
        metadata: sanitizedEvent.metadata
      }
    );
  }
  
  // Request lifecycle logging
  logRequest(method: string, path: string, statusCode?: number): void {
    const startTime = this.context.startTime || Date.now();
    const duration = Date.now() - startTime;
    
    this.info('request', `${method} ${path}`, {
      method,
      path,
      statusCode,
      duration,
      requestId: this.context.requestId,
      userId: this.context.userId
    });
  }
  
  // API call logging
  logAPICall(
    service: string, 
    endpoint: string, 
    method: string, 
    statusCode: number, 
    duration: number,
    error?: string
  ): void {
    const level = statusCode >= 400 ? 'ERROR' : 'INFO';
    const message = `${service} API call: ${method} ${endpoint}`;
    
    this.log(level, 'api', message, {
      service,
      endpoint,
      method,
      statusCode,
      duration,
      error: error ? this.sanitizeData(error) : undefined
    });
  }
  
  // Get recent logs for debugging
  getRecentLogs(count: number = 50): LogEntry[] {
    return this.logBuffer.slice(-count);
  }
  
  // Get logs by level
  getLogsByLevel(level: LogLevel, count: number = 50): LogEntry[] {
    return this.logBuffer
      .filter(entry => entry.level === level)
      .slice(-count);
  }
  
  // Clear log buffer
  clearLogs(): void {
    this.logBuffer = [];
  }
  
  // Get logging statistics
  getLogStats(): {
    totalLogs: number;
    logsByLevel: Record<LogLevel, number>;
    recentErrors: number;
    avgDuration: number;
  } {
    const stats = {
      totalLogs: this.logBuffer.length,
      logsByLevel: {
        DEBUG: 0,
        INFO: 0,
        WARN: 0,
        ERROR: 0,
        FATAL: 0
      } as Record<LogLevel, number>,
      recentErrors: 0,
      avgDuration: 0
    };
    
    let totalDuration = 0;
    let durationsCount = 0;
    const oneHourAgo = Date.now() - (60 * 60 * 1000);
    
    this.logBuffer.forEach(entry => {
      stats.logsByLevel[entry.level]++;
      
      if (entry.duration) {
        totalDuration += entry.duration;
        durationsCount++;
      }
      
      if ((entry.level === 'ERROR' || entry.level === 'FATAL') && 
          new Date(entry.timestamp).getTime() > oneHourAgo) {
        stats.recentErrors++;
      }
    });
    
    stats.avgDuration = durationsCount > 0 ? totalDuration / durationsCount : 0;
    
    return stats;
  }
}

// Export singleton instance and convenience functions
export const logger = SecureLogger.getInstance();

// Convenience functions
export function setLogContext(context: Partial<LogContext>): void {
  logger.setContext(context);
}

export function clearLogContext(): void {
  logger.clearContext();
}

export function logInfo(component: string, message: string, context?: Record<string, any>): void {
  logger.info(component, message, context);
}

export function logError(component: string, message: string, context?: Record<string, any>): void {
  logger.error(component, message, context);
}

export function logWarn(component: string, message: string, context?: Record<string, any>): void {
  logger.warn(component, message, context);
}

export function logDebug(component: string, message: string, context?: Record<string, any>): void {
  logger.debug(component, message, context);
}

export function logSecurityEvent(event: SecurityLogEvent): void {
  logger.logSecurityEvent(event);
}

export function startTimer(operation: string): string {
  return logger.startTimer(operation);
}

export function endTimer(timerId: string, operation: string, success?: boolean): number {
  return logger.endTimer(timerId, operation, success);
}

export function getLogStats(): ReturnType<SecureLogger['getLogStats']> {
  return logger.getLogStats();
}