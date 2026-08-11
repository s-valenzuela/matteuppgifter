import { describe, expect, it } from 'vitest';
import { mulberry32, randomInt } from '../src/core/rng';

describe('mulberry32', () => {
  it('är deterministisk för samma seed', () => {
    const a = mulberry32(42);
    const b = mulberry32(42);
    const seqA = Array.from({ length: 20 }, () => a());
    const seqB = Array.from({ length: 20 }, () => b());
    expect(seqA).toEqual(seqB);
  });

  it('ger olika sekvenser för olika seed', () => {
    const a = mulberry32(1);
    const b = mulberry32(2);
    const seqA = Array.from({ length: 20 }, () => a());
    const seqB = Array.from({ length: 20 }, () => b());
    expect(seqA).not.toEqual(seqB);
  });

  it('returnerar värden i [0, 1)', () => {
    const rng = mulberry32(7);
    for (let i = 0; i < 2000; i++) {
      const value = rng();
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(1);
    }
  });
});

describe('randomInt', () => {
  it('håller sig inom det slutna intervallet', () => {
    const rng = mulberry32(3);
    for (let i = 0; i < 2000; i++) {
      const value = randomInt(rng, 5, 10);
      expect(value).toBeGreaterThanOrEqual(5);
      expect(value).toBeLessThanOrEqual(10);
    }
  });

  it('hanterar ett intervall med bara ett värde', () => {
    const rng = mulberry32(3);
    expect(randomInt(rng, 4, 4)).toBe(4);
  });
});
