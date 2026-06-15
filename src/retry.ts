import type {
  RetryConfig,
  RetryOptions,
  ResolvedRetryOptions,
  RetryLogContext,
} from './types';
import { calculateDelay, applyJitter, clampDelay, sleep } from './delay';

/**
 * Default retry configuration.
 * @internal
 */
const DEFAULTS: Readonly<Pick<ResolvedRetryOptions, 'attempts' | 'delay' | 'maxDelay' | 'strategy' | 'jitter'>> = {
  attempts: 3,
  delay: 1000,
  maxDelay: 30_000,
  strategy: 'fixed',
  jitter: false,
} as const;

/**
 * Resolve user input into a fully populated options object.
 * @internal
 */
function resolveOptions(config?: RetryConfig): ResolvedRetryOptions {
  if (config === undefined || config === null) {
    return { ...DEFAULTS };
  }

  if (typeof config === 'number') {
    if (!Number.isInteger(config) || config < 1) {
      throw new TypeError(
        `[retried] "attempts" must be a positive integer, received: ${String(config)}`,
      );
    }
    return { ...DEFAULTS, attempts: config };
  }

  const opts = config as RetryOptions;

  // Validate attempts
  if (opts.attempts !== undefined) {
    if (!Number.isInteger(opts.attempts) || opts.attempts < 1) {
      throw new TypeError(
        `[retried] "attempts" must be a positive integer, received: ${String(opts.attempts)}`,
      );
    }
  }

  // Validate delay
  if (opts.delay !== undefined) {
    if (typeof opts.delay !== 'number' || opts.delay < 0 || !Number.isFinite(opts.delay)) {
      throw new TypeError(
        `[retried] "delay" must be a non-negative finite number, received: ${String(opts.delay)}`,
      );
    }
  }

  // Validate maxDelay
  if (opts.maxDelay !== undefined) {
    if (typeof opts.maxDelay !== 'number' || opts.maxDelay < 0) {
      throw new TypeError(
        `[retried] "maxDelay" must be a non-negative number, received: ${String(opts.maxDelay)}`,
      );
    }
  }

  // Validate strategy
  if (opts.strategy !== undefined && opts.strategy !== 'fixed' && opts.strategy !== 'exponential') {
    throw new TypeError(
      `[retried] "strategy" must be "fixed" or "exponential", received: ${String(opts.strategy)}`,
    );
  }

  return {
    attempts: opts.attempts ?? DEFAULTS.attempts,
    delay: opts.delay ?? DEFAULTS.delay,
    maxDelay: opts.maxDelay ?? DEFAULTS.maxDelay,
    strategy: opts.strategy ?? DEFAULTS.strategy,
    jitter: opts.jitter ?? DEFAULTS.jitter,
    shouldRetry: opts.shouldRetry,
    validate: opts.validate,
    onRetry: opts.onRetry,
    logger: opts.logger,
  };
}

/**
 * Compute the final delay for a given attempt, applying strategy, jitter, and max cap.
 * @internal
 */
function computeDelay(options: ResolvedRetryOptions, attempt: number): number {
  let delay = calculateDelay(options.delay, attempt, options.strategy);

  if (options.jitter) {
    delay = applyJitter(delay);
  }

  delay = clampDelay(delay, options.maxDelay);

  return delay;
}

/**
 * Retry an async function with configurable backoff, jitter, and error handling.
 *
 * @typeParam T - The return type of the function being retried.
 *
 * @param fn - The async (or sync) function to retry. Called with no arguments.
 * @param config - Optional. A number (shorthand for attempts) or a `RetryOptions` object.
 * @returns A promise that resolves with the function's return value on success.
 * @throws The last error encountered if all attempts are exhausted, or immediately
 *         if `shouldRetry` returns `false`.
 *
 * @example Simplest usage, 3 attempts, 1s delay
 * ```ts
 * const user = await retry(() => fetchUser());
 * ```
 *
 * @example Custom attempt count
 * ```ts
 * const user = await retry(() => fetchUser(), 5);
 * ```
 *
 * @example Full options
 * ```ts
 * const user = await retry(() => fetchUser(), {
 *   attempts: 5,
 *   delay: 500,
 *   strategy: 'exponential',
 *   jitter: true,
 *   maxDelay: 10000,
 *   shouldRetry: (err) => err instanceof NetworkError,
 *   onRetry: (err, attempt) => console.log(`Retry ${attempt}`),
 *   logger: createRetryLogger(),
 * });
 * ```
 *
 * @example Validate resolved values (e.g. fetch)
 * ```ts
 * const response = await retry(() => fetch(url), {
 *   validate: (res) => res.ok,
 * });
 * ```
 */
export async function retry<T>(
  fn: () => T | Promise<T>,
  config?: RetryConfig,
): Promise<T> {
  if (typeof fn !== 'function') {
    throw new TypeError(
      `[retried] First argument must be a function, received: ${typeof fn}`,
    );
  }

  const options = resolveOptions(config);
  let lastError: unknown;

  for (let attempt = 1; attempt <= options.attempts; attempt++) {
    try {
      const result = await fn();

      // If a validate function is provided, check the result
      if (options.validate) {
        const isValid = await options.validate(result);

        if (!isValid) {
          const validationError = new Error(
            `[retried] Validation failed on attempt ${attempt}/${options.attempts}`,
          );
          lastError = validationError;

          // Log the validation failure
          if (options.logger) {
            const delay = attempt < options.attempts ? computeDelay(options, attempt) : 0;
            const context: RetryLogContext = {
              attempt,
              maxAttempts: options.attempts,
              delay,
              error: validationError,
            };

            if (attempt < options.attempts) {
              options.logger.warn(
                `Attempt ${attempt}/${options.attempts} failed validation, retrying in ${delay}ms`,
                context,
              );
            } else {
              options.logger.error(
                `All ${options.attempts} attempts exhausted (validation failed)`,
                context,
              );
            }
          }

          // Call onRetry if not the last attempt
          if (attempt < options.attempts && options.onRetry) {
            options.onRetry(validationError, attempt);
          }

          // Wait before next attempt if not the last
          if (attempt < options.attempts) {
            const delay = computeDelay(options, attempt);
            await sleep(delay);
          }

          continue;
        }
      }

      return result;
    } catch (error: unknown) {
      lastError = error;

      // Check if we should retry this error
      if (options.shouldRetry) {
        const shouldContinue = await options.shouldRetry(error);

        if (!shouldContinue) {
          // Log abort
          if (options.logger) {
            const context: RetryLogContext = {
              attempt,
              maxAttempts: options.attempts,
              delay: 0,
              error,
            };
            options.logger.error(
              `Aborted on attempt ${attempt}/${options.attempts} (shouldRetry returned false)`,
              context,
            );
          }

          throw error;
        }
      }

      // If this was the last attempt, log and throw
      if (attempt === options.attempts) {
        if (options.logger) {
          const context: RetryLogContext = {
            attempt,
            maxAttempts: options.attempts,
            delay: 0,
            error,
          };
          options.logger.error(
            `All ${options.attempts} attempts exhausted`,
            context,
          );
        }

        throw error;
      }

      // Compute delay for this attempt
      const delay = computeDelay(options, attempt);

      // Log the retry
      if (options.logger) {
        const context: RetryLogContext = {
          attempt,
          maxAttempts: options.attempts,
          delay,
          error,
        };
        options.logger.warn(
          `Attempt ${attempt}/${options.attempts} failed, retrying in ${delay}ms`,
          context,
        );
      }

      // Call onRetry callback
      if (options.onRetry) {
        options.onRetry(error, attempt);
      }

      // Wait before next attempt
      await sleep(delay);
    }
  }

  // This should be unreachable, but TypeScript needs it.
  // If somehow the loop exits without returning or throwing, throw the last error.
  throw lastError;
}
