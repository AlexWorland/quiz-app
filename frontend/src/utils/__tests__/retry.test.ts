import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { withRetry, isRetryableError } from '../retry';

describe('retry utility', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('isRetryableError', () => {
    it('should return true for retryable status codes', () => {
      const retryableStatuses = [408, 429, 500, 502, 503, 504];
      
      retryableStatuses.forEach((status) => {
        const error = {
          response: { status },
        };
        expect(isRetryableError(error)).toBe(true);
      });
    });

    it('should return false for non-retryable status codes', () => {
      const nonRetryableStatuses = [400, 401, 403, 404, 422];
      
      nonRetryableStatuses.forEach((status) => {
        const error = {
          response: { status },
        };
        expect(isRetryableError(error)).toBe(false);
      });
    });

    it('should return true for errors without response status', () => {
      const error = new Error('Network error');
      expect(isRetryableError(error)).toBe(true);
    });

    it('should return true for errors without response', () => {
      const error = { message: 'Some error' };
      expect(isRetryableError(error)).toBe(true);
    });
  });

  describe('withRetry', () => {
    it('should return result immediately on success', async () => {
      const fn = vi.fn().mockResolvedValue('success');

      const result = await withRetry(fn);

      expect(result).toBe('success');
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it('should retry on retryable errors and eventually succeed', async () => {
      let callCount = 0;
      const fn = vi.fn().mockImplementation(() => {
        callCount++;
        if (callCount < 3) {
          const error: any = new Error('Server error');
          error.response = { status: 500 };
          throw error;
        }
        return Promise.resolve('success');
      });

      const promise = withRetry(fn);

      // Fast-forward through delays
      await vi.advanceTimersByTimeAsync(3000);

      const result = await promise;

      expect(result).toBe('success');
      expect(fn).toHaveBeenCalledTimes(3);
    });

    it('should not retry on non-retryable errors', async () => {
      const error: any = new Error('Bad request');
      error.response = { status: 400 };
      const fn = vi.fn().mockRejectedValue(error);

      await expect(withRetry(fn)).rejects.toThrow('Bad request');
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it('should respect maxRetries', async () => {
      const error: any = new Error('Server error');
      error.response = { status: 500 };
      const fn = vi.fn().mockRejectedValue(error);

      const promise = withRetry(fn, { maxRetries: 2 });
      // Handle promise rejection to avoid unhandled rejection warnings
      promise.catch(() => {});

      // Fast-forward through delays (attempt 0, 1, 2 = 3 attempts total)
      await vi.advanceTimersByTimeAsync(3000);

      await expect(promise).rejects.toThrow('Server error');
      expect(fn).toHaveBeenCalledTimes(3); // initial + 2 retries
    });

    it('should use exponential backoff', async () => {
      const error: any = new Error('Server error');
      error.response = { status: 500 };
      const fn = vi.fn().mockRejectedValue(error);

      const promise = withRetry(fn, { baseDelay: 100, maxRetries: 2 });
      // Handle promise rejection to avoid unhandled rejection warnings
      promise.catch(() => {});

      // First retry should wait baseDelay (100ms)
      await vi.advanceTimersByTimeAsync(50);
      expect(fn).toHaveBeenCalledTimes(1);

      await vi.advanceTimersByTimeAsync(50);
      expect(fn).toHaveBeenCalledTimes(2);

      // Second retry should wait baseDelay * 2^1 (200ms)
      await vi.advanceTimersByTimeAsync(100);
      expect(fn).toHaveBeenCalledTimes(2);

      await vi.advanceTimersByTimeAsync(100);
      expect(fn).toHaveBeenCalledTimes(3);

      // Fast-forward to end
      await vi.advanceTimersByTimeAsync(1000);
      await expect(promise).rejects.toThrow();
    });

    it('should respect maxDelay', async () => {
      const error: any = new Error('Server error');
      error.response = { status: 500 };
      const fn = vi.fn().mockRejectedValue(error);

      const promise = withRetry(fn, {
        baseDelay: 1000,
        maxDelay: 2000,
        maxRetries: 5,
      });
      // Handle promise rejection to avoid unhandled rejection warnings
      promise.catch(() => {});

      // First retry: 1000ms
      await vi.advanceTimersByTimeAsync(1000);
      expect(fn).toHaveBeenCalledTimes(2);

      // Second retry: min(1000 * 2^1, 2000) = 2000ms
      await vi.advanceTimersByTimeAsync(2000);
      expect(fn).toHaveBeenCalledTimes(3);

      // Third retry: min(1000 * 2^2, 2000) = 2000ms (capped)
      await vi.advanceTimersByTimeAsync(2000);
      expect(fn).toHaveBeenCalledTimes(4);

      // Fast-forward to end
      await vi.advanceTimersByTimeAsync(10000);
      await expect(promise).rejects.toThrow();
    });

    it('should retry on errors without response status', async () => {
      let callCount = 0;
      const fn = vi.fn().mockImplementation(() => {
        callCount++;
        if (callCount < 2) {
          throw new Error('Network error');
        }
        return Promise.resolve('success');
      });

      const promise = withRetry(fn);

      await vi.advanceTimersByTimeAsync(2000);

      const result = await promise;

      expect(result).toBe('success');
      expect(fn).toHaveBeenCalledTimes(2);
    });

    it('should use custom retryable statuses', async () => {
      const error: any = new Error('Custom error');
      error.response = { status: 503 };
      const fn = vi.fn().mockRejectedValue(error);

      // Custom config that doesn't include 503
      const promise = withRetry(fn, {
        retryableStatuses: [500, 502],
      });

      await expect(promise).rejects.toThrow('Custom error');
      expect(fn).toHaveBeenCalledTimes(1); // Should not retry
    });

    it('should use custom retryable statuses and retry', async () => {
      let callCount = 0;
      const error: any = new Error('Custom error');
      error.response = { status: 503 };
      const fn = vi.fn().mockImplementation(() => {
        callCount++;
        if (callCount < 2) {
          throw error;
        }
        return Promise.resolve('success');
      });

      // Custom config that includes 503
      const promise = withRetry(fn, {
        retryableStatuses: [500, 502, 503],
      });

      await vi.advanceTimersByTimeAsync(2000);

      const result = await promise;

      expect(result).toBe('success');
      expect(fn).toHaveBeenCalledTimes(2);
    });

    it('should throw last error after max retries', async () => {
      const error1: any = new Error('Error 1');
      error1.response = { status: 500 };
      const error2: any = new Error('Error 2');
      error2.response = { status: 500 };
      const error3: any = new Error('Error 3');
      error3.response = { status: 500 };

      let callCount = 0;
      const fn = vi.fn().mockImplementation(() => {
        callCount++;
        if (callCount === 1) throw error1;
        if (callCount === 2) throw error2;
        throw error3;
      });

      const promise = withRetry(fn, { maxRetries: 2 });
      // Handle promise rejection to avoid unhandled rejection warnings
      promise.catch(() => {});

      await vi.advanceTimersByTimeAsync(5000);

      await expect(promise).rejects.toThrow('Error 3'); // Last error
      expect(fn).toHaveBeenCalledTimes(3);
    });
  });
});

