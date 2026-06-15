/**
 * retried - A lightweight, framework-agnostic retry utility.
 *
 * @packageDocumentation
 *
 * @example Simplest usage
 * ```ts
 * import { retry } from 'retried';
 *
 * const user = await retry(() => fetchUser());
 * ```
 *
 * @example With options
 * ```ts
 * import { retry, createRetryLogger } from 'retried';
 *
 * const user = await retry(fetchUser, {
 *   attempts: 5,
 *   delay: 500,
 *   strategy: 'exponential',
 *   jitter: true,
 *   logger: createRetryLogger(),
 * });
 * ```
 */

export { retry } from './retry';
export { createRetryLogger } from './logger';

export type {
  RetryOptions,
  RetryConfig,
  RetryStrategy,
  RetryLogger,
  RetryLogContext,
} from './types';
