# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.1] - 2026-06-15

### Changed

- Renamed npm package name to `retried-js` due to name conflict on the registry
- Added repository and build status badges to the README

## [0.1.0] - 2026-06-15

### Added

- Core `retry()` function with configurable attempts, delay, and backoff strategy
- **Fixed** and **exponential** backoff strategies
- **Jitter** support (±25% randomization) to prevent thundering herd
- `maxDelay` option to cap exponential backoff (default: 30s)
- `shouldRetry` predicate for conditional retries (sync and async)
- `validate` callback for retrying on resolved values (e.g., `fetch` responses)
- `onRetry` callback for logging, metrics, and side effects
- Built-in `createRetryLogger()` for console-based retry logging
- `RetryLogger` interface for plugging in custom loggers (pino, winston, etc.)
- Full TypeScript types with JSDoc documentation for IDE autocompletion
- Dual ESM/CJS build via tsup
- Zero runtime dependencies
- Comprehensive test suite via Vitest
