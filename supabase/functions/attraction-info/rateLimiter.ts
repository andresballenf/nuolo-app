// Rate limiting service for edge functions
// Implements IP-based and user-based rate limiting with configurable policies

interface RateLimitConfig {
  windowMs: number; // Time window in milliseconds
  maxRequests: number; // Maximum requests per window
  skipSuccessfulRequests?: boolean;
  skipFailedRequests?: boolean;
  keyGenerator?: (req: Request, identifier: string) => string;
}

interface RateLimitRecord {
  count: number;
  resetTime: number;
  firstRequest: number;
}

export class RateLimiter {
  private store = new Map<string, RateLimitRecord>();
  private config: RateLimitConfig;
  
  constructor(config: RateLimitConfig) {
    this.config = {
      skipSuccessfulRequests: false,
      skipFailedRequests: false,
      keyGenerator: (req, identifier) => identifier,
      ...config
    };
    
    // Clean up expired entries every 5 minutes
    setInterval(() => {
      this.cleanup();
    }, 5 * 60 * 1000);
  }
  
  private cleanup(): void {
    const now = Date.now();
    for (const [key, record] of this.store.entries()) {
      if (record.resetTime <= now) {
        this.store.delete(key);
      }
    }
  }
  
  private getKey(req: Request, identifier: string): string {
    return this.config.keyGenerator!(req, identifier);
  }
  
  async checkLimit(req: Request, identifier: string): Promise<{
    allowed: boolean;
    limit: number;
    remaining: number;
    resetTime: number;
    retryAfter?: number;
  }> {
    const key = this.getKey(req, identifier);
    const now = Date.now();
    const resetTime = now + this.config.windowMs;
    
    let record = this.store.get(key);
    
    // Initialize or reset if window has expired
    if (!record || record.resetTime <= now) {
      record = {
        count: 0,
        resetTime,
        firstRequest: now
      };
      this.store.set(key, record);
    }
    
    const allowed = record.count < this.config.maxRequests;
    const remaining = Math.max(0, this.config.maxRequests - record.count - 1);
    
    if (allowed) {
      record.count++;
    }
    
    return {
      allowed,
      limit: this.config.maxRequests,
      remaining: allowed ? remaining : 0,
      resetTime: record.resetTime,
      retryAfter: allowed ? undefined : Math.ceil((record.resetTime - now) / 1000)
    };
  }
  
  recordRequest(req: Request, identifier: string, wasSuccessful: boolean): void {
    // Only record if we're not skipping this type of request
    if (wasSuccessful && this.config.skipSuccessfulRequests) return;
    if (!wasSuccessful && this.config.skipFailedRequests) return;
    
    // The count was already incremented in checkLimit if allowed
    // This method can be used for additional tracking if needed
  }
}

// Rate limiting policies
export const RATE_LIMIT_POLICIES = {
  // IP-based limiting (most restrictive)
  IP_BASED: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    maxRequests: 100, // 100 requests per 15 minutes per IP
    keyGenerator: (req: Request, identifier: string) => `ip:${identifier}`
  },
  
  // User-based limiting (more generous for authenticated users)
  USER_BASED: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    maxRequests: 200, // 200 requests per 15 minutes per user
    keyGenerator: (req: Request, identifier: string) => `user:${identifier}`
  },
  
  // Per-endpoint limiting (for expensive operations)
  EXPENSIVE_ENDPOINT: {
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 10, // 10 requests per minute
    keyGenerator: (req: Request, identifier: string) => `endpoint:${identifier}`
  },
  
  // Streaming endpoint (separate limits for real-time operations)
  STREAMING: {
    windowMs: 5 * 60 * 1000, // 5 minutes
    maxRequests: 20, // 20 streaming sessions per 5 minutes
    keyGenerator: (req: Request, identifier: string) => `stream:${identifier}`
  }
} as const;

// Rate limiter instances
export const rateLimiters = {
  ip: new RateLimiter(RATE_LIMIT_POLICIES.IP_BASED),
  user: new RateLimiter(RATE_LIMIT_POLICIES.USER_BASED),
  expensive: new RateLimiter(RATE_LIMIT_POLICIES.EXPENSIVE_ENDPOINT),
  streaming: new RateLimiter(RATE_LIMIT_POLICIES.STREAMING)
};

// Helper function to extract client IP
export function getClientIP(req: Request): string {
  // Check common headers for client IP
  const xForwardedFor = req.headers.get('x-forwarded-for');
  const xRealIP = req.headers.get('x-real-ip');
  const cfConnectingIP = req.headers.get('cf-connecting-ip');
  
  if (xForwardedFor) {
    // X-Forwarded-For can contain multiple IPs, take the first one
    return xForwardedFor.split(',')[0].trim();
  }
  
  if (xRealIP) {
    return xRealIP;
  }
  
  if (cfConnectingIP) {
    return cfConnectingIP;
  }
  
  // Fallback to a default identifier
  return 'unknown';
}

// Helper function to extract user ID from JWT token
export function getUserIdFromRequest(req: Request): string | null {
  try {
    const authHeader = req.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return null;
    }
    
    const token = authHeader.substring(7);
    // Simple JWT payload extraction (without verification - Supabase handles that)
    const parts = token.split('.');
    if (parts.length !== 3) {
      return null;
    }
    
    const payload = JSON.parse(atob(parts[1]));
    return payload.sub || payload.user_id || null;
  } catch (error) {
    console.warn('Failed to extract user ID from token:', error);
    return null;
  }
}

// Main rate limiting middleware
export async function applyRateLimit(req: Request): Promise<{
  allowed: boolean;
  headers: Record<string, string>;
  error?: string;
  retryAfter?: number;
}> {
  const clientIP = getClientIP(req);
  const userId = getUserIdFromRequest(req);
  const url = new URL(req.url);
  
  // Determine which limiters to apply
  const limits = [];
  
  // Always apply IP-based limiting
  limits.push({
    name: 'ip',
    limiter: rateLimiters.ip,
    identifier: clientIP
  });
  
  // Apply user-based limiting if authenticated
  if (userId) {
    limits.push({
      name: 'user',
      limiter: rateLimiters.user,
      identifier: userId
    });
  }
  
  // Apply special limits for expensive endpoints
  if (url.searchParams.get('generateAudio') === 'true') {
    limits.push({
      name: 'expensive',
      limiter: rateLimiters.expensive,
      identifier: `${clientIP}:audio`
    });
  }
  
  // Apply streaming limits
  if (url.searchParams.get('streamAudio') === 'true') {
    limits.push({
      name: 'streaming',
      limiter: rateLimiters.streaming,
      identifier: `${clientIP}:stream`
    });
  }
  
  // Check all applicable limits
  const results = await Promise.all(
    limits.map(async ({ name, limiter, identifier }) => {
      const result = await limiter.checkLimit(req, identifier);
      return { name, ...result };
    })
  );
  
  // Find the most restrictive limit that was exceeded
  const exceeded = results.find(result => !result.allowed);
  
  if (exceeded) {
    return {
      allowed: false,
      headers: {
        'X-RateLimit-Limit': exceeded.limit.toString(),
        'X-RateLimit-Remaining': '0',
        'X-RateLimit-Reset': new Date(exceeded.resetTime).toISOString(),
        'Retry-After': exceeded.retryAfter?.toString() || '60'
      },
      error: `Rate limit exceeded for ${exceeded.name}. Try again in ${exceeded.retryAfter} seconds.`,
      retryAfter: exceeded.retryAfter
    };
  }
  
  // Use the most restrictive remaining count for headers
  const mostRestrictive = results.reduce((min, current) => 
    current.remaining < min.remaining ? current : min
  );
  
  return {
    allowed: true,
    headers: {
      'X-RateLimit-Limit': mostRestrictive.limit.toString(),
      'X-RateLimit-Remaining': mostRestrictive.remaining.toString(),
      'X-RateLimit-Reset': new Date(mostRestrictive.resetTime).toISOString()
    }
  };
}

// Record request completion for tracking
export function recordRequestCompletion(
  req: Request, 
  wasSuccessful: boolean
): void {
  const clientIP = getClientIP(req);
  const userId = getUserIdFromRequest(req);
  
  rateLimiters.ip.recordRequest(req, clientIP, wasSuccessful);
  
  if (userId) {
    rateLimiters.user.recordRequest(req, userId, wasSuccessful);
  }
}