import { describe, it, expect, vi } from 'vitest';
import { createRetryLogger } from '../src/logger';

describe('createRetryLogger', () => {
  it('creates a logger with warn and error methods', () => {
    const logger = createRetryLogger();
    expect(typeof logger.warn).toBe('function');
    expect(typeof logger.error).toBe('function');
  });

  it('logs warn messages with default prefix', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const logger = createRetryLogger();

    const context = {
      attempt: 1,
      maxAttempts: 3,
      delay: 1000,
      error: new Error('test error'),
    };

    logger.warn('Attempt failed', context);

    expect(warnSpy).toHaveBeenCalledOnce();
    expect(warnSpy).toHaveBeenCalledWith(
      '[retried] Attempt failed',
      {
        attempt: 1,
        maxAttempts: 3,
        delay: 1000,
        error: context.error,
      },
    );

    warnSpy.mockRestore();
  });

  it('logs error messages with default prefix', () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const logger = createRetryLogger();

    const context = {
      attempt: 3,
      maxAttempts: 3,
      delay: 0,
      error: new Error('final error'),
    };

    logger.error('All attempts exhausted', context);

    expect(errorSpy).toHaveBeenCalledOnce();
    expect(errorSpy).toHaveBeenCalledWith(
      '[retried] All attempts exhausted',
      {
        attempt: 3,
        maxAttempts: 3,
        error: context.error,
      },
    );

    errorSpy.mockRestore();
  });

  it('uses custom prefix', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const logger = createRetryLogger('[my-app]');

    logger.warn('test message', {
      attempt: 1,
      maxAttempts: 3,
      delay: 500,
      error: new Error('err'),
    });

    expect(warnSpy).toHaveBeenCalledWith(
      '[my-app] test message',
      expect.objectContaining({ attempt: 1 }),
    );

    warnSpy.mockRestore();
  });

  it('handles empty prefix', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const logger = createRetryLogger('');

    logger.warn('message', {
      attempt: 1,
      maxAttempts: 3,
      delay: 0,
      error: new Error('err'),
    });

    expect(warnSpy).toHaveBeenCalledWith(
      ' message',
      expect.anything(),
    );

    warnSpy.mockRestore();
  });
});
