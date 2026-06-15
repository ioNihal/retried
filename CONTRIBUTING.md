# Contributing to retried

Thank you for your interest in contributing! Here's how to get started.

## Development Setup

### Prerequisites

- Node.js ≥ 16
- npm, pnpm, or bun

### Getting Started

```bash
# Clone the repository
git clone https://github.com/your-username/retried.git
cd retried

# Install dependencies
npm install

# Run tests
npm test

# Run tests in watch mode
npm run test:watch

# Type check
npm run lint

# Build
npm run build
```

## Project Structure

```
retried/
├── src/
│   ├── index.ts      # Barrel exports
│   ├── retry.ts      # Core retry logic
│   ├── delay.ts      # Delay calculation utilities
│   ├── logger.ts     # Built-in console logger
│   └── types.ts      # All TypeScript types and interfaces
├── tests/
│   ├── retry.test.ts  # Core retry tests
│   ├── delay.test.ts  # Delay utility tests
│   └── logger.test.ts # Logger tests
├── package.json
├── tsconfig.json
├── tsup.config.ts
├── README.md
├── CHANGELOG.md
├── CONTRIBUTING.md
└── LICENSE
```

## Guidelines

### Code Style

- **TypeScript only** - all source code must be in TypeScript with strict mode
- **JSDoc everything** - every exported function, type, and interface must have JSDoc comments
- **No runtime dependencies** - this is a zero-dependency package
- **Platform agnostic** - no Node-specific APIs (no `process`, `Buffer`, `fs`, etc.)
- **Use only standard Web APIs** - `setTimeout`, `Promise`, `Math`, etc.

### Testing

- Write tests for every new feature and bug fix
- Use **Vitest** for all tests
- Use `vi.useFakeTimers()` for tests involving delays
- Test edge cases: invalid input, non-Error throws, boundary values
- Run the full test suite before submitting: `npm test`

### Commits

Use clear, descriptive commit messages:

```
feat: add maxDelay option to cap exponential backoff
fix: handle non-Error thrown values correctly
docs: add jitter section to README
test: add edge case tests for delay calculation
```

### Pull Requests

1. Fork the repository
2. Create a feature branch: `git checkout -b feat/your-feature`
3. Make your changes
4. Add/update tests
5. Update documentation (README, CHANGELOG, JSDoc)
6. Run `npm test` and `npm run lint`
7. Submit a pull request

### What to Contribute

- Bug fixes
- Performance improvements
- New backoff strategies (e.g., linear, polynomial)
- Better error messages
- Documentation improvements
- Test coverage improvements

### What NOT to Add

- Runtime dependencies (this is a zero-dep package)
- Node-specific APIs
- Breaking changes without discussion
- Features that complicate the simple `retry(fn)` use case

## Releasing

Releases are handled by maintainers:

1. Update version in `package.json`
2. Update `CHANGELOG.md`
3. `npm run build`
4. `npm publish`

## License

By contributing, you agree that your contributions will be licensed under the [MIT License](./LICENSE).
