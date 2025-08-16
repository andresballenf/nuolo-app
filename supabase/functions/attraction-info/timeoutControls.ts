// Timeout controls for external API calls
// Prevents hanging requests and implements circuit breaker pattern

interface TimeoutConfig {
  timeout: number; // Timeout in milliseconds
  retries: number; // Number of retry attempts
  backoffMultiplier: number; // Exponential backoff multiplier
  maxBackoff: number; // Maximum backoff time
}

interface CircuitBreakerConfig {
  failureThreshold: number; // Number of failures before opening circuit
  successThreshold: number; // Number of successes to close circuit
  timeout: number; // Time to wait before trying again when circuit is open
}

class CircuitBreaker {
  private failures = 0;
  private successes = 0;
  private lastFailureTime = 0;
  private state: 'closed' | 'open' | 'half-open' = 'closed';
  
  constructor(private config: CircuitBreakerConfig) {}
  
  async execute<T>(operation: () => Promise<T>): Promise<T> {
    if (this.state === 'open') {
      if (Date.now() - this.lastFailureTime < this.config.timeout) {
        throw new Error('Circuit breaker is open - too many recent failures');
      }
      this.state = 'half-open';
    }
    
    try {
      const result = await operation();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }
  
  private onSuccess(): void {
    this.failures = 0;
    this.successes++;
    
    if (this.state === 'half-open' && this.successes >= this.config.successThreshold) {
      this.state = 'closed';
      this.successes = 0;
    }
  }
  
  private onFailure(): void {
    this.failures++;
    this.lastFailureTime = Date.now();
    
    if (this.failures >= this.config.failureThreshold) {
      this.state = 'open';
    }
  }
  
  getState(): { state: string; failures: number; lastFailureTime: number } {
    return {
      state: this.state,
      failures: this.failures,
      lastFailureTime: this.lastFailureTime
    };
  }
}

// Default timeout configurations
export const TIMEOUT_CONFIGS = {
  OPENAI_TEXT: {
    timeout: 30000, // 30 seconds for text generation
    retries: 2,
    backoffMultiplier: 2,
    maxBackoff: 10000
  },
  
  OPENAI_AUDIO: {
    timeout: 60000, // 60 seconds for audio generation
    retries: 1,
    backoffMultiplier: 2,
    maxBackoff: 5000
  },
  
  EXTERNAL_API: {
    timeout: 15000, // 15 seconds for other external APIs
    retries: 3,
    backoffMultiplier: 1.5,
    maxBackoff: 8000
  }
} as const;

// Circuit breaker configurations
export const CIRCUIT_BREAKER_CONFIGS = {
  OPENAI_TEXT: {
    failureThreshold: 5,
    successThreshold: 3,
    timeout: 60000 // 1 minute
  },
  
  OPENAI_AUDIO: {
    failureThreshold: 3,
    successThreshold: 2,
    timeout: 120000 // 2 minutes
  },
  
  EXTERNAL_API: {
    failureThreshold: 10,
    successThreshold: 5,
    timeout: 30000 // 30 seconds
  }
} as const;

// Circuit breaker instances
export const circuitBreakers = {
  openaiText: new CircuitBreaker(CIRCUIT_BREAKER_CONFIGS.OPENAI_TEXT),
  openaiAudio: new CircuitBreaker(CIRCUIT_BREAKER_CONFIGS.OPENAI_AUDIO),
  externalApi: new CircuitBreaker(CIRCUIT_BREAKER_CONFIGS.EXTERNAL_API)
};

// Enhanced timeout wrapper with retries and exponential backoff
export async function withTimeout<T>(
  operation: () => Promise<T>,
  config: TimeoutConfig,
  operationName: string = 'operation'
): Promise<T> {
  let lastError: Error;
  
  for (let attempt = 0; attempt <= config.retries; attempt++) {
    try {
      // Create timeout promise
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => {
          reject(new Error(`${operationName} timed out after ${config.timeout}ms (attempt ${attempt + 1})`));
        }, config.timeout);
      });
      
      // Race between operation and timeout
      const result = await Promise.race([
        operation(),
        timeoutPromise
      ]);
      
      return result;
    } catch (error) {
      lastError = error as Error;
      
      // If this is the last attempt, throw the error
      if (attempt === config.retries) {
        throw error;
      }
      
      // Calculate backoff delay
      const backoffDelay = Math.min(
        Math.pow(config.backoffMultiplier, attempt) * 1000,
        config.maxBackoff
      );
      
      console.warn(`${operationName} failed (attempt ${attempt + 1}), retrying in ${backoffDelay}ms:`, error.message);
      
      // Wait before retrying
      await new Promise(resolve => setTimeout(resolve, backoffDelay));
    }
  }
  
  throw lastError!;
}

// Wrapper for OpenAI text generation with circuit breaker and timeout
export async function timeoutOpenAITextGeneration<T>(
  operation: () => Promise<T>,
  customTimeout?: number
): Promise<T> {
  const config = {
    ...TIMEOUT_CONFIGS.OPENAI_TEXT,
    ...(customTimeout && { timeout: customTimeout })
  };
  
  return circuitBreakers.openaiText.execute(async () => {
    return withTimeout(operation, config, 'OpenAI text generation');
  });
}

// Wrapper for OpenAI audio generation with circuit breaker and timeout
export async function timeoutOpenAIAudioGeneration<T>(
  operation: () => Promise<T>,
  customTimeout?: number
): Promise<T> {
  const config = {
    ...TIMEOUT_CONFIGS.OPENAI_AUDIO,
    ...(customTimeout && { timeout: customTimeout })
  };
  
  return circuitBreakers.openaiAudio.execute(async () => {
    return withTimeout(operation, config, 'OpenAI audio generation');
  });
}

// Wrapper for external API calls with circuit breaker and timeout
export async function timeoutExternalAPI<T>(
  operation: () => Promise<T>,
  customTimeout?: number,
  apiName: string = 'External API'
): Promise<T> {
  const config = {
    ...TIMEOUT_CONFIGS.EXTERNAL_API,
    ...(customTimeout && { timeout: customTimeout })
  };
  
  return circuitBreakers.externalApi.execute(async () => {
    return withTimeout(operation, config, apiName);
  });
}

// Health check function to monitor circuit breaker states
export function getHealthStatus(): {
  circuitBreakers: Record<string, any>;
  timestamp: number;
} {
  return {
    circuitBreakers: {
      openaiText: circuitBreakers.openaiText.getState(),
      openaiAudio: circuitBreakers.openaiAudio.getState(),
      externalApi: circuitBreakers.externalApi.getState()
    },
    timestamp: Date.now()
  };
}

// Request timeout middleware for the entire request
export function withRequestTimeout<T>(
  handler: () => Promise<T>,
  timeoutMs: number = 120000 // 2 minutes default
): Promise<T> {
  return Promise.race([
    handler(),
    new Promise<never>((_, reject) => {
      setTimeout(() => {
        reject(new Error(`Request timed out after ${timeoutMs}ms`));
      }, timeoutMs);
    })
  ]);
}