import type { RetryLogger, RetryLogContext } from './types';

/**
 * Create a console-based retry logger.
 *
 * Returns a `RetryLogger` that uses `console.warn` for retry events
 * and `console.error` when all attempts are exhausted.
 *
 * @param prefix - Prefix for log messages. Defaults to `'[retried]'`.
 * @returns A `RetryLogger` instance.
 *
 * @example
 * ```ts
 * import { retry, createRetryLogger } from 'retried-js';
 *
 * await retry(fetchUser, {
 *   logger: createRetryLogger(),
 * });
 * // [retried] Attempt 1/3 failed, retrying in 1000ms
 * // [retried] Attempt 2/3 failed, retrying in 1000ms
 * // [retried] All 3 attempts exhausted
 * ```
 *
 * @example Custom prefix
 * ```ts
 * const logger = createRetryLogger('[api]');
 * // [api] Attempt 1/3 failed, retrying in 500ms
 * ```
 */
export function createRetryLogger(prefix: string = '[retried]'): RetryLogger {
  return {
    warn(message: string, context: RetryLogContext): void {
      console.warn(`${prefix} ${message}`, {
        attempt: context.attempt,
        maxAttempts: context.maxAttempts,
        delay: context.delay,
        error: context.error,
      });
    },
    error(message: string, context: RetryLogContext): void {
      console.error(`${prefix} ${message}`, {
        attempt: context.attempt,
        maxAttempts: context.maxAttempts,
        error: context.error,
      });
    },
  };
}
