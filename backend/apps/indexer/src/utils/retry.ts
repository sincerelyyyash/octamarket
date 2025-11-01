import { logger } from './logger.js';

/**
 * Retry configuration options
 */
export interface RetryOptions {
  maxAttempts: number;
  baseDelayMs: number;
  maxDelayMs: number;
  shouldRetry?: (error: any) => boolean;
  onRetry?: (attempt: number, error: any) => void;
}

/**
 * Default retry options
 */
const DEFAULT_RETRY_OPTIONS: RetryOptions = {
  maxAttempts: 3,
  baseDelayMs: 1000,
  maxDelayMs: 30000,
  shouldRetry: (error: any) => {
    // Retry on network errors and 5xx server errors
    if (error?.code === 'ECONNREFUSED' || error?.code === 'ETIMEDOUT') {
      return true;
    }
    if (error?.response?.status >= 500) {
      return true;
    }
    // Retry on rate limit errors (429)
    if (error?.response?.status === 429) {
      return true;
    }
    return false;
  },
};

/**
 * Calculate exponential backoff delay with jitter
 */
const calculateDelay = (attempt: number, baseDelayMs: number, maxDelayMs: number): number => {
  const exponentialDelay = baseDelayMs * Math.pow(2, attempt - 1);
  const jitter = Math.random() * baseDelayMs * 0.1; // 10% jitter
  return Math.min(exponentialDelay + jitter, maxDelayMs);
};

/**
 * Retry a function with exponential backoff
 */
export async function retry<T>(
  fn: () => Promise<T>,
  options: Partial<RetryOptions> = {},
  context?: string
): Promise<T> {
  const opts = { ...DEFAULT_RETRY_OPTIONS, ...options };
  let lastError: any;

  for (let attempt = 1; attempt <= opts.maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;

      // Check if we should retry
      const shouldRetry = opts.shouldRetry?.(error) ?? DEFAULT_RETRY_OPTIONS.shouldRetry!(error);

      if (!shouldRetry || attempt === opts.maxAttempts) {
        logger.error(`${context || 'Operation'} failed after ${attempt} attempt(s)`, {
          error,
          attempts: attempt,
        });
        throw error;
      }

      // Calculate delay with exponential backoff
      const delayMs = calculateDelay(attempt, opts.baseDelayMs, opts.maxDelayMs);

      logger.warn(`${context || 'Operation'} failed, retrying in ${delayMs}ms`, {
        attempt,
        maxAttempts: opts.maxAttempts,
        error: error?.message || String(error),
      });

      // Call retry callback if provided
      opts.onRetry?.(attempt, error);

      // Wait before retrying
      await new Promise(resolve => setTimeout(resolve, delayMs));
    }
  }

  throw lastError;
}

/**
 * Retry with custom error handler
 */
export async function retryWithHandler<T>(
  fn: () => Promise<T>,
  errorHandler: (error: any, attempt: number) => boolean | Promise<boolean>,
  maxAttempts: number = 3,
  context?: string
): Promise<T> {
  return retry(
    fn,
    {
      maxAttempts,
      shouldRetry: async (error) => {
        try {
          return await errorHandler(error, maxAttempts);
        } catch (e) {
          return false;
        }
      },
    },
    context
  );
}

