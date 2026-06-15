# retried

A lightweight, framework-agnostic retry utility for JavaScript runtimes.

Works in Node.js, Bun, Deno, Cloudflare Workers, Vercel Edge Functions, browsers, and any modern JavaScript environment.

- Zero dependencies
- Tiny bundle size
- TypeScript-first with full type inference
- IDE autocompletion out of the box
- Sensible defaults
- Platform agnostic
- Promise-based

## Installation

```bash
npm install retried
```

```bash
pnpm add retried
```

```bash
bun add retried
```

## Quick Start

```ts
import { retry } from "retried";

const user = await retry(() => fetchUser());
```

Default behavior:

- 3 attempts
- 1 second delay
- Fixed backoff strategy
- Stops immediately on success
- Throws the final error if all attempts fail

---

## Simple Retry Count

```ts
await retry(() => fetchUser(), 5);
```

Retries up to 5 times.

---

## Advanced Options

```ts
await retry(fetchUser, {
  attempts: 5,
  delay: 1000,
});
```

---

## Exponential Backoff

```ts
await retry(fetchUser, {
  attempts: 5,
  delay: 500,
  strategy: "exponential",
});
```

Delays:

```
500ms → 1000ms → 2000ms → 4000ms → 8000ms
```

---

## Fixed Delay

```ts
await retry(fetchUser, {
  attempts: 5,
  delay: 1000,
  strategy: "fixed",
});
```

Always waits 1 second between attempts.

---

## Max Delay Cap

Prevent exponential backoff from growing unbounded:

```ts
await retry(fetchUser, {
  attempts: 10,
  delay: 500,
  strategy: "exponential",
  maxDelay: 10000, // Never wait more than 10 seconds
});
```

Default max delay is `30000` (30 seconds).

---

## Custom Retry Condition

```ts
await retry(fetchUser, {
  shouldRetry(error) {
    return error.status >= 500;
  },
});
```

Useful for:

- Network failures
- API rate limits
- Temporary outages

---

## Abort Early

```ts
await retry(fetchUser, {
  shouldRetry(error) {
    return error.code !== "INVALID_TOKEN";
  },
});
```

Authentication errors should not retry.

---

## Validate Resolved Values

Retry based on the result, not just errors. Useful for `fetch` responses:

```ts
const response = await retry(() => fetch(url), {
  validate: (res) => res.ok,
});
```

The `validate` function receives the resolved value. Return `false` to treat it as a failed attempt.

---

## Jitter Support

```ts
await retry(fetchUser, {
  strategy: "exponential",
  jitter: true,
});
```

Adds ±25% random jitter to delays. Helps prevent thundering herd problems when many clients retry simultaneously.

---

## Retry Callback

```ts
await retry(fetchUser, {
  onRetry(error, attempt) {
    console.log(`Retry ${attempt}`, error);
  },
});
```

Called before each retry (not on the initial attempt or final failure). Useful for logging, metrics, or side effects.

---

## Logger (DX Feature)

Built-in logging for debugging retry behavior. Every error that triggers a retry is logged with full context.

### Using the built-in logger

```ts
import { retry, createRetryLogger } from "retried";

await retry(fetchUser, {
  attempts: 3,
  logger: createRetryLogger(),
});
```

Console output:

```
[retried] Attempt 1/3 failed, retrying in 1000ms  { attempt: 1, maxAttempts: 3, delay: 1000, error: Error: ... }
[retried] Attempt 2/3 failed, retrying in 1000ms  { attempt: 2, maxAttempts: 3, delay: 1000, error: Error: ... }
[retried] All 3 attempts exhausted                 { attempt: 3, maxAttempts: 3, error: Error: ... }
```

### Custom prefix

```ts
const logger = createRetryLogger("[my-api]");
// [my-api] Attempt 1/3 failed, retrying in 500ms
```

### Bring your own logger

Any object with `warn` and `error` methods works:

```ts
import pino from "pino";

const pinoLogger = pino();

await retry(fetchUser, {
  logger: {
    warn(message, context) {
      pinoLogger.warn(context, message);
    },
    error(message, context) {
      pinoLogger.error(context, message);
    },
  },
});
```

---

## Supported Environments

- Node.js (≥16)
- Bun
- Deno
- Cloudflare Workers
- Vercel Edge
- Netlify Edge
- Browsers (any modern browser)

No Node-specific APIs. Uses only standard Web APIs (`setTimeout`, `Promise`).

---

## API Reference

### `retry<T>(fn, config?)`

```ts
retry<T>(
  fn: () => T | Promise<T>,
  config?: number | RetryOptions
): Promise<T>
```

| Parameter | Type | Description |
|---|---|---|
| `fn` | `() => T \| Promise<T>` | The function to retry. Can be sync or async. |
| `config` | `number \| RetryOptions` | Optional. A number (shorthand for attempts) or an options object. |

**Returns:** `Promise<T>` - resolves with the function's return value on success.

**Throws:** The last error if all attempts are exhausted, or immediately if `shouldRetry` returns `false`.

---

### `RetryOptions`

```ts
interface RetryOptions {
  attempts?: number;        // default: 3
  delay?: number;           // default: 1000 (ms)
  maxDelay?: number;        // default: 30000 (ms)
  strategy?: RetryStrategy; // default: 'fixed'
  jitter?: boolean;         // default: false
  shouldRetry?: (error: unknown) => boolean | Promise<boolean>;
  validate?: (result: unknown) => boolean | Promise<boolean>;
  onRetry?: (error: unknown, attempt: number) => void;
  logger?: RetryLogger;
}
```

---

### `RetryStrategy`

```ts
type RetryStrategy = 'fixed' | 'exponential';
```

---

### `RetryLogger`

```ts
interface RetryLogger {
  warn(message: string, context: RetryLogContext): void;
  error(message: string, context: RetryLogContext): void;
}
```

---

### `RetryLogContext`

```ts
interface RetryLogContext {
  readonly attempt: number;
  readonly maxAttempts: number;
  readonly delay: number;
  readonly error: unknown;
}
```

---

### `createRetryLogger(prefix?)`

```ts
createRetryLogger(prefix?: string): RetryLogger
```

Creates a console-based logger. Default prefix: `'[retried]'`.

---

### `RetryConfig`

```ts
type RetryConfig = number | RetryOptions;
```

The second argument to `retry()`. Pass a number as shorthand for `{ attempts: n }`, or a full options object.

---

## Philosophy

Most retry libraries expose dozens of options before the first successful retry.

`retried` aims for:

```ts
await retry(fn);
```

being enough for most applications.

Advanced features exist, but never get in the way of the simplest use case.

---

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md) for development setup, guidelines, and how to submit pull requests.

---

## Changelog

See [CHANGELOG.md](./CHANGELOG.md) for release history.

---

## License

[MIT](./LICENSE)
