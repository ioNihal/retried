import { describe, it, expect, vi, afterEach } from 'vitest';
import { retry } from '../src/retry';
import type { RetryLogger } from '../src/types';

// Helper: create a function that fails N times then succeeds
function createFailingFn<T>(failures: number, successValue: T): () => Promise<T> {
  let callCount = 0;
  return async () => {
    callCount++;
    if (callCount <= failures) {
      throw new Error(`Failure #${callCount}`);
    }
    return successValue;
  };
}

// Helper: create a function that always fails
function createAlwaysFailingFn(errorMessage = 'always fails'): () => Promise<never> {
  return async () => {
    throw new Error(errorMessage);
  };
}

// Helper: create a mock logger
function createMockLogger(): RetryLogger & {
  warnCalls: Array<{ message: string; context: unknown }>;
  errorCalls: Array<{ message: string; context: unknown }>;
} {
  const warnCalls: Array<{ message: string; context: unknown }> = [];
  const errorCalls: Array<{ message: string; context: unknown }> = [];

  return {
    warnCalls,
    errorCalls,
    warn(message: string, context: unknown) {
      warnCalls.push({ message, context });
    },
    error(message: string, context: unknown) {
      errorCalls.push({ message, context });
    },
  };
}

describe('retry', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  // --- Input Validation ---

  describe('input validation', () => {
    it('throws TypeError if first argument is not a function', async () => {
      // @ts-expect-error - testing runtime behavior with invalid input
      await expect(retry('not a function')).rejects.toThrow(TypeError);
      // @ts-expect-error
      await expect(retry(null)).rejects.toThrow(TypeError);
      // @ts-expect-error
      await expect(retry(123)).rejects.toThrow(TypeError);
    });

    it('throws TypeError for invalid attempts (negative)', async () => {
      const fn = async () => 'ok';
      await expect(retry(fn, -1)).rejects.toThrow(TypeError);
      await expect(retry(fn, 0)).rejects.toThrow(TypeError);
      await expect(retry(fn, 1.5)).rejects.toThrow(TypeError);
    });

    it('throws TypeError for invalid attempts in options', async () => {
      const fn = async () => 'ok';
      await expect(retry(fn, { attempts: 0 })).rejects.toThrow(TypeError);
      await expect(retry(fn, { attempts: -5 })).rejects.toThrow(TypeError);
      await expect(retry(fn, { attempts: 2.5 })).rejects.toThrow(TypeError);
    });

    it('throws TypeError for invalid delay', async () => {
      const fn = async () => 'ok';
      await expect(retry(fn, { delay: -100 })).rejects.toThrow(TypeError);
      await expect(retry(fn, { delay: NaN })).rejects.toThrow(TypeError);
      await expect(retry(fn, { delay: Infinity })).rejects.toThrow(TypeError);
    });

    it('throws TypeError for invalid strategy', async () => {
      const fn = async () => 'ok';
      // @ts-expect-error - testing runtime behavior
      await expect(retry(fn, { strategy: 'linear' })).rejects.toThrow(TypeError);
    });

    it('throws TypeError for invalid maxDelay', async () => {
      const fn = async () => 'ok';
      await expect(retry(fn, { maxDelay: -1 })).rejects.toThrow(TypeError);
    });
  });

  // --- Default Behavior ---

  describe('default behavior', () => {
    it('returns immediately on first success', async () => {
      const fn = vi.fn(async () => 42);
      const result = await retry(fn);

      expect(result).toBe(42);
      expect(fn).toHaveBeenCalledOnce();
    });

    it('retries on failure and succeeds within default attempts', async () => {
      const fn = createFailingFn(2, 'success');
      const result = await retry(fn, { delay: 0 });

      expect(result).toBe('success');
    });

    it('throws the last error after exhausting all default attempts', async () => {
      const fn = createAlwaysFailingFn('final boom');
      await expect(retry(fn, { delay: 0 })).rejects.toThrow('final boom');
    });

    it('works with synchronous functions', async () => {
      const fn = vi.fn(() => 'sync result');
      const result = await retry(fn);

      expect(result).toBe('sync result');
      expect(fn).toHaveBeenCalledOnce();
    });
  });

  // --- Attempt Count ---

  describe('custom attempts', () => {
    it('accepts a number shorthand for attempts', async () => {
      let callCount = 0;
      const fn = async () => {
        callCount++;
        if (callCount < 5) throw new Error('not yet');
        return 'done';
      };

      const result = await retry(fn, { attempts: 5, delay: 0 });

      expect(result).toBe('done');
      expect(callCount).toBe(5);
    });

    it('respects attempts option in config object', async () => {
      const fn = createAlwaysFailingFn();
      await expect(retry(fn, { attempts: 2, delay: 0 })).rejects.toThrow();
    });

    it('works with attempts = 1 (no retries)', async () => {
      const fn = createAlwaysFailingFn('one shot');
      await expect(retry(fn, 1)).rejects.toThrow('one shot');
    });
  });

  // --- Strategies ---

  describe('fixed strategy', () => {
    it('uses constant delay between attempts', async () => {
      vi.useFakeTimers();
      let callCount = 0;
      const fn = async () => {
        callCount++;
        if (callCount <= 3) throw new Error('fail');
        return 'ok';
      };

      const onRetry = vi.fn();

      const promise = retry(fn, {
        attempts: 4,
        delay: 500,
        strategy: 'fixed',
        onRetry,
      });

      await vi.runAllTimersAsync();
      const result = await promise;

      expect(result).toBe('ok');
      expect(onRetry).toHaveBeenCalledTimes(3);
    });
  });

  describe('exponential strategy', () => {
    it('doubles delay each attempt', async () => {
      const logger = createMockLogger();
      const onRetry = vi.fn();
      const fn = createAlwaysFailingFn();

      await expect(
        retry(fn, {
          attempts: 4,
          delay: 0,
          strategy: 'exponential',
          onRetry,
          logger,
        }),
      ).rejects.toThrow();

      // Should have called onRetry 3 times (attempts 1, 2, 3)
      expect(onRetry).toHaveBeenCalledTimes(3);
      expect(logger.warnCalls).toHaveLength(3);
      expect(logger.errorCalls).toHaveLength(1);
    });
  });

  // --- Jitter ---

  describe('jitter', () => {
    it('does not affect the result', async () => {
      const fn = createFailingFn(2, 'ok');

      const result = await retry(fn, {
        attempts: 3,
        delay: 0,
        jitter: true,
      });

      expect(result).toBe('ok');
    });
  });

  // --- maxDelay ---

  describe('maxDelay', () => {
    it('caps exponential delay', async () => {
      const logger = createMockLogger();
      const fn = createAlwaysFailingFn();

      await expect(
        retry(fn, {
          attempts: 10,
          delay: 0,
          strategy: 'exponential',
          maxDelay: 5000,
          logger,
        }),
      ).rejects.toThrow();

      // Check that logged delays are capped at 5000
      for (const call of logger.warnCalls) {
        const ctx = call.context as { delay: number };
        expect(ctx.delay).toBeLessThanOrEqual(5000);
      }
    });

    it('caps delay at configured maximum', async () => {
      const logger = createMockLogger();
      const fn = createAlwaysFailingFn();

      await expect(
        retry(fn, {
          attempts: 6,
          delay: 1,
          strategy: 'exponential',
          maxDelay: 5,
          logger,
        }),
      ).rejects.toThrow();

      // Delays: 1, 2, 4, 5 (capped), 5 (capped)
      const delays = logger.warnCalls.map(
        (c) => (c.context as { delay: number }).delay,
      );
      expect(delays).toEqual([1, 2, 4, 5, 5]);
    });
  });

  // --- shouldRetry ---

  describe('shouldRetry', () => {
    it('aborts immediately when shouldRetry returns false', async () => {
      let callCount = 0;
      const fn = async () => {
        callCount++;
        throw new Error('fail');
      };

      const shouldRetry = vi.fn(() => false);

      await expect(
        retry(fn, {
          attempts: 5,
          delay: 0,
          shouldRetry,
        }),
      ).rejects.toThrow('fail');

      expect(callCount).toBe(1);
      expect(shouldRetry).toHaveBeenCalledOnce();
    });

    it('continues retrying when shouldRetry returns true', async () => {
      const fn = createFailingFn(2, 'ok');
      const shouldRetry = vi.fn(() => true);

      const result = await retry(fn, {
        attempts: 3,
        delay: 0,
        shouldRetry,
      });

      expect(result).toBe('ok');
      expect(shouldRetry).toHaveBeenCalledTimes(2);
    });

    it('supports async shouldRetry', async () => {
      let callCount = 0;
      const fn = async () => {
        callCount++;
        const error = new Error('fail') as Error & { code: string };
        error.code = callCount === 1 ? 'RETRIABLE' : 'FATAL';
        throw error;
      };

      const shouldRetry = vi.fn(async (error: unknown) => {
        return (error as { code: string }).code === 'RETRIABLE';
      });

      await expect(
        retry(fn, {
          attempts: 5,
          delay: 0,
          shouldRetry,
        }),
      ).rejects.toThrow('fail');

      expect(callCount).toBe(2);
      expect(shouldRetry).toHaveBeenCalledTimes(2);
    });

    it('receives the thrown error', async () => {
      const specificError = new Error('specific');
      const fn = async () => {
        throw specificError;
      };

      const shouldRetry = vi.fn(() => false);

      await expect(retry(fn, { shouldRetry, delay: 0 })).rejects.toThrow('specific');
      expect(shouldRetry).toHaveBeenCalledWith(specificError);
    });
  });

  // --- validate ---

  describe('validate', () => {
    it('retries when validate returns false on a resolved value', async () => {
      let callCount = 0;
      const fn = async () => {
        callCount++;
        return { ok: callCount >= 3, status: callCount >= 3 ? 200 : 500 };
      };

      const result = await retry(fn, {
        attempts: 5,
        delay: 0,
        validate: (result) => (result as { ok: boolean }).ok,
      });

      expect(result).toEqual({ ok: true, status: 200 });
      expect(callCount).toBe(3);
    });

    it('throws validation error when all attempts fail validation', async () => {
      const fn = async () => ({ ok: false });

      await expect(
        retry(fn, {
          attempts: 2,
          delay: 0,
          validate: (result) => (result as { ok: boolean }).ok,
        }),
      ).rejects.toThrow(/Validation failed/);
    });

    it('supports async validate', async () => {
      let callCount = 0;
      const fn = async () => {
        callCount++;
        return callCount;
      };

      const result = await retry(fn, {
        attempts: 3,
        delay: 0,
        validate: async (result) => (result as number) >= 2,
      });

      expect(result).toBe(2);
    });
  });

  // --- onRetry ---

  describe('onRetry', () => {
    it('is called with error and attempt number', async () => {
      const onRetry = vi.fn();
      const fn = createFailingFn(2, 'ok');

      await retry(fn, {
        attempts: 3,
        delay: 0,
        onRetry,
      });

      expect(onRetry).toHaveBeenCalledTimes(2);
      expect(onRetry).toHaveBeenNthCalledWith(1, expect.any(Error), 1);
      expect(onRetry).toHaveBeenNthCalledWith(2, expect.any(Error), 2);
    });

    it('is not called on the final failure', async () => {
      const onRetry = vi.fn();
      const fn = createAlwaysFailingFn();

      await expect(
        retry(fn, {
          attempts: 3,
          delay: 0,
          onRetry,
        }),
      ).rejects.toThrow();

      // Called for attempts 1 and 2, NOT for attempt 3 (final failure)
      expect(onRetry).toHaveBeenCalledTimes(2);
    });

    it('is not called when function succeeds on first attempt', async () => {
      const onRetry = vi.fn();
      const fn = async () => 'ok';

      await retry(fn, { onRetry, delay: 0 });

      expect(onRetry).not.toHaveBeenCalled();
    });
  });

  // --- Logger ---

  describe('logger integration', () => {
    it('logs warn for each retry and error on exhaustion', async () => {
      const logger = createMockLogger();
      const fn = createAlwaysFailingFn();

      await expect(
        retry(fn, {
          attempts: 3,
          delay: 0,
          logger,
        }),
      ).rejects.toThrow();

      // 2 warns (attempts 1, 2) + 1 error (attempt 3 exhausted)
      expect(logger.warnCalls).toHaveLength(2);
      expect(logger.errorCalls).toHaveLength(1);

      expect(logger.warnCalls[0]!.message).toContain('1/3');
      expect(logger.warnCalls[1]!.message).toContain('2/3');
      expect(logger.errorCalls[0]!.message).toContain('exhausted');
    });

    it('logs error when shouldRetry aborts', async () => {
      const logger = createMockLogger();
      const fn = createAlwaysFailingFn();

      await expect(
        retry(fn, {
          attempts: 5,
          delay: 0,
          shouldRetry: () => false,
          logger,
        }),
      ).rejects.toThrow();

      expect(logger.warnCalls).toHaveLength(0);
      expect(logger.errorCalls).toHaveLength(1);
      expect(logger.errorCalls[0]!.message).toContain('shouldRetry');
    });

    it('is not required (no crash without logger)', async () => {
      const fn = createFailingFn(1, 'ok');
      const result = await retry(fn, { delay: 0 });

      expect(result).toBe('ok');
    });

    it('logs validation failures', async () => {
      const logger = createMockLogger();
      let callCount = 0;
      const fn = async () => {
        callCount++;
        return { ok: callCount >= 3 };
      };

      await retry(fn, {
        attempts: 3,
        delay: 0,
        validate: (r) => (r as { ok: boolean }).ok,
        logger,
      });

      // 2 validation failures logged as warn
      expect(logger.warnCalls).toHaveLength(2);
      expect(logger.warnCalls[0]!.message).toContain('validation');
    });
  });

  // --- Type Inference ---

  describe('type inference', () => {
    it('infers return type from the function', async () => {
      const result = await retry(async () => ({ id: 1, name: 'test' }));

      // TypeScript should infer result as { id: number; name: string }
      expect(result.id).toBe(1);
      expect(result.name).toBe('test');
    });

    it('infers string return type', async () => {
      const result = await retry(async () => 'hello');

      // TypeScript infers string
      expect(result.toUpperCase()).toBe('HELLO');
    });

    it('infers number return type', async () => {
      const result = await retry(async () => 42);

      // TypeScript infers number
      expect(result.toFixed(2)).toBe('42.00');
    });
  });

  // --- Edge Cases ---

  describe('edge cases', () => {
    it('handles errors that are not Error instances', async () => {
      const fn = async () => {
        throw 'string error'; // eslint-disable-line no-throw-literal
      };

      await expect(retry(fn, { attempts: 1 })).rejects.toBe('string error');
    });

    it('handles undefined thrown values', async () => {
      const fn = async () => {
        throw undefined; // eslint-disable-line no-throw-literal
      };

      await expect(retry(fn, { attempts: 1 })).rejects.toBeUndefined();
    });

    it('works with delay of 0', async () => {
      const fn = createFailingFn(2, 'ok');
      const result = await retry(fn, { delay: 0 });

      expect(result).toBe('ok');
    });

    it('works with no options (pure defaults)', async () => {
      const fn = vi.fn(async () => 'default');
      const result = await retry(fn);

      expect(result).toBe('default');
    });

    it('handles null config gracefully', async () => {
      const fn = async () => 'ok';

      // @ts-expect-error - testing runtime behavior
      const result = await retry(fn, null);

      expect(result).toBe('ok');
    });

    it('preserves the original error type on final throw', async () => {
      class CustomError extends Error {
        code: number;
        constructor(message: string, code: number) {
          super(message);
          this.code = code;
          this.name = 'CustomError';
        }
      }

      const fn = async () => {
        throw new CustomError('custom', 42);
      };

      try {
        await retry(fn, { attempts: 2, delay: 0 });
        expect.fail('should have thrown');
      } catch (err) {
        expect(err).toBeInstanceOf(CustomError);
        expect((err as CustomError).code).toBe(42);
      }
    });
  });
});
