import type { RetryStrategy } from './types';

/**
 * Calculate the delay for a given attempt based on the backoff strategy.
 *
 * @param base - Base delay in milliseconds.
 * @param attempt - The attempt number that just failed (1-indexed).
 * @param strategy - Backoff strategy: `'fixed'` or `'exponential'`.
 * @returns Computed delay in milliseconds (before jitter or max cap).
 *
 * @example
 * ```ts
 * calculateDelay(500, 1, 'exponential'); // 500
 * calculateDelay(500, 2, 'exponential'); // 1000
 * calculateDelay(500, 3, 'exponential'); // 2000
 * calculateDelay(1000, 3, 'fixed');      // 1000
 * ```
 */
export function calculateDelay(
  base: number,
  attempt: number,
  strategy: RetryStrategy,
): number {
  if (strategy === 'exponential') {
    return base * Math.pow(2, attempt - 1);
  }

  // 'fixed' strategy
  return base;
}

/**
 * Apply random jitter (±25%) to a delay value.
 *
 * Jitter helps distribute retries across time to prevent thundering herd
 * problems when many clients fail and retry simultaneously.
 *
 * @param delay - The base delay to jitter.
 * @returns The jittered delay, guaranteed to be ≥ 0.
 *
 * @example
 * ```ts
 * applyJitter(1000); // Random value between 750 and 1250
 * ```
 */
export function applyJitter(delay: number): number {
  // ±25% range
  const jitterFactor = 0.75 + Math.random() * 0.5;
  return Math.max(0, Math.floor(delay * jitterFactor));
}

/**
 * Clamp a delay value to a maximum.
 *
 * @param delay - Computed delay in ms.
 * @param maxDelay - Maximum allowed delay in ms.
 * @returns The clamped delay.
 */
export function clampDelay(delay: number, maxDelay: number): number {
  return Math.min(delay, maxDelay);
}

/**
 * Promise-based sleep using `setTimeout`.
 *
 * Uses only standard Web APIs - works in Node.js, Bun, Deno, browsers,
 * Cloudflare Workers, and all edge runtimes.
 *
 * @param ms - Duration to sleep in milliseconds.
 * @returns A promise that resolves after `ms` milliseconds.
 */
export function sleep(ms: number): Promise<void> {
  return new Promise<void>((resolve) => {
    setTimeout(resolve, ms);
  });
}
