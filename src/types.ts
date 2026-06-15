/**
 * Backoff strategy for calculating delays between retry attempts.
 *
 * - `'fixed'` - Same delay every time.
 * - `'exponential'` - Delay doubles each attempt (base × 2^(attempt-1)).
 */
export type RetryStrategy = 'fixed' | 'exponential';

/**
 * Context passed to the logger on every retry event.
 * Provides full visibility into what happened and when.
 */
export interface RetryLogContext {
  /** Current attempt number (1-indexed). */
  readonly attempt: number;
  /** Total allowed attempts. */
  readonly maxAttempts: number;
  /** Computed delay before the next attempt (in ms). 0 on final failure. */
  readonly delay: number;
  /** The error that caused this retry. */
  readonly error: unknown;
}

/**
 * Logger interface for retry events.
 *
 * Implement this to plug in any logging library (pino, winston, console, etc.).
 * The built-in `createRetryLogger()` provides a ready-made `console`-based implementation.
 */
export interface RetryLogger {
  /** Called when an attempt fails but retries remain. */
  warn(message: string, context: RetryLogContext): void;
  /** Called when all attempts have been exhausted. */
  error(message: string, context: RetryLogContext): void;
}

/**
 * Configuration options for `retry()`.
 *
 * All fields are optional, sensible defaults are applied:
 * - `attempts`: 3
 * - `delay`: 1000 (ms)
 * - `strategy`: 'fixed'
 * - `jitter`: false
 *
 * @example
 * ```ts
 * await retry(fetchUser, {
 *   attempts: 5,
 *   delay: 500,
 *   strategy: 'exponential',
 *   jitter: true,
 *   shouldRetry: (err) => err instanceof NetworkError,
 *   onRetry: (err, attempt) => console.log(`Retry ${attempt}`),
 *   logger: createRetryLogger(),
 * });
 * ```
 */
export interface RetryOptions {
  /**
   * Total number of attempts (including the initial call).
   *
   * Must be a positive integer ≥ 1.
   * @default 3
   */
  readonly attempts?: number;

  /**
   * Base delay between retries in milliseconds.
   *
   * - With `strategy: 'fixed'`, this exact delay is used every time.
   * - With `strategy: 'exponential'`, this is the base that doubles each attempt.
   *
   * Must be ≥ 0.
   * @default 1000
   */
  readonly delay?: number;

  /**
   * Maximum delay in milliseconds.
   *
   * Caps the computed delay so exponential backoff doesn't grow unbounded.
   * Set to `Infinity` to disable.
   * @default 30000
   */
  readonly maxDelay?: number;

  /**
   * Backoff strategy.
   *
   * - `'fixed'` - constant delay between retries.
   * - `'exponential'` - delay doubles each attempt: `delay × 2^(attempt-1)`.
   *
   * @default 'fixed'
   */
  readonly strategy?: RetryStrategy;

  /**
   * Whether to add random jitter (±25%) to the computed delay.
   *
   * Helps prevent thundering herd problems when many clients retry simultaneously.
   * @default false
   */
  readonly jitter?: boolean;

  /**
   * Predicate that controls whether a failed attempt should be retried.
   *
   * Receives the thrown error. Return `true` to retry, `false` to abort immediately.
   * Can be async.
   *
   * @example
   * ```ts
   * shouldRetry: (error) => error.status >= 500
   * ```
   */
  readonly shouldRetry?: (error: unknown) => boolean | Promise<boolean>;

  /**
   * Validate a successful result. If this returns `false`, the result is
   * treated as a failure and the attempt is retried.
   *
   * Useful for retrying on HTTP responses that resolved but aren't "ok".
   *
   * @example
   * ```ts
   * // Retry fetch until we get an ok response
   * await retry(() => fetch(url), {
   *   validate: (res) => res.ok,
   * });
   * ```
   */
  readonly validate?: (result: unknown) => boolean | Promise<boolean>;

  /**
   * Callback invoked before each retry attempt.
   *
   * Useful for logging, metrics, or side effects.
   * Not called on the initial attempt or the final failure.
   *
   * @param error - The error from the previous attempt.
   * @param attempt - The attempt number that just failed (1-indexed).
   */
  readonly onRetry?: (error: unknown, attempt: number) => void;

  /**
   * Optional logger for DX.
   *
   * When provided, every retry-triggering error is logged with full context.
   * Use `createRetryLogger()` for a ready-made console logger, or provide
   * your own implementation of `RetryLogger`.
   */
  readonly logger?: RetryLogger;
}

/**
 * Internal resolved options with all defaults applied.
 * @internal
 */
export interface ResolvedRetryOptions {
  readonly attempts: number;
  readonly delay: number;
  readonly maxDelay: number;
  readonly strategy: RetryStrategy;
  readonly jitter: boolean;
  readonly shouldRetry?: (error: unknown) => boolean | Promise<boolean>;
  readonly validate?: (result: unknown) => boolean | Promise<boolean>;
  readonly onRetry?: (error: unknown, attempt: number) => void;
  readonly logger?: RetryLogger;
}

/**
 * The second argument to `retry()` is either a number (shorthand for attempts)
 * or a full options object.
 */
export type RetryConfig = number | RetryOptions;
