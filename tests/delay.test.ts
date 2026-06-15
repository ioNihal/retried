import { describe, it, expect } from 'vitest';
import { calculateDelay, applyJitter, clampDelay, sleep } from '../src/delay';

describe('calculateDelay', () => {
  it('returns the base delay for fixed strategy', () => {
    expect(calculateDelay(1000, 1, 'fixed')).toBe(1000);
    expect(calculateDelay(1000, 2, 'fixed')).toBe(1000);
    expect(calculateDelay(1000, 5, 'fixed')).toBe(1000);
  });

  it('returns exponential delay for exponential strategy', () => {
    expect(calculateDelay(500, 1, 'exponential')).toBe(500);
    expect(calculateDelay(500, 2, 'exponential')).toBe(1000);
    expect(calculateDelay(500, 3, 'exponential')).toBe(2000);
    expect(calculateDelay(500, 4, 'exponential')).toBe(4000);
    expect(calculateDelay(500, 5, 'exponential')).toBe(8000);
  });

  it('handles base delay of 0', () => {
    expect(calculateDelay(0, 1, 'fixed')).toBe(0);
    expect(calculateDelay(0, 3, 'exponential')).toBe(0);
  });

  it('handles first attempt correctly', () => {
    expect(calculateDelay(100, 1, 'exponential')).toBe(100);
    expect(calculateDelay(100, 1, 'fixed')).toBe(100);
  });
});

describe('applyJitter', () => {
  it('returns a value within ±25% of the input', () => {
    const base = 1000;
    // Run many times to verify the range
    for (let i = 0; i < 100; i++) {
      const result = applyJitter(base);
      expect(result).toBeGreaterThanOrEqual(750);
      expect(result).toBeLessThanOrEqual(1250);
    }
  });

  it('never returns a negative value', () => {
    for (let i = 0; i < 100; i++) {
      const result = applyJitter(0);
      expect(result).toBeGreaterThanOrEqual(0);
    }
  });

  it('returns an integer', () => {
    for (let i = 0; i < 50; i++) {
      const result = applyJitter(1000);
      expect(Number.isInteger(result)).toBe(true);
    }
  });
});

describe('clampDelay', () => {
  it('returns the delay when below max', () => {
    expect(clampDelay(500, 30000)).toBe(500);
  });

  it('returns maxDelay when delay exceeds it', () => {
    expect(clampDelay(60000, 30000)).toBe(30000);
  });

  it('returns delay when equal to max', () => {
    expect(clampDelay(30000, 30000)).toBe(30000);
  });

  it('handles Infinity maxDelay', () => {
    expect(clampDelay(999999, Infinity)).toBe(999999);
  });
});

describe('sleep', () => {
  it('resolves after the specified duration', async () => {
    const start = Date.now();
    await sleep(50);
    const elapsed = Date.now() - start;
    // Allow some tolerance for timer inaccuracy
    expect(elapsed).toBeGreaterThanOrEqual(40);
    expect(elapsed).toBeLessThan(200);
  });

  it('resolves immediately for 0ms', async () => {
    const start = Date.now();
    await sleep(0);
    const elapsed = Date.now() - start;
    expect(elapsed).toBeLessThan(50);
  });
});
