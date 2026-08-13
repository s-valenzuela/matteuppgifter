import { describe, expect, it } from 'vitest';
import {
  FRACTION_DENOMINATORS,
  fractionPoolSize,
  generateFractionProblems,
} from '../src/core/fractions';
import type { FractionGeneratorConfig } from '../src/types';

function fractionConfig(overrides: Partial<FractionGeneratorConfig> = {}): FractionGeneratorConfig {
  return {
    denominators: [...FRACTION_DENOMINATORS],
    shape: 'mixed',
    direction: 'identify',
    showPercent: false,
    count: 20,
    avoidDuplicates: false,
    seed: 1,
    ...overrides,
  };
}

describe('fractionPoolSize', () => {
  it('räknar antal äkta bråk (nämnare − 1) för en enda nämnare', () => {
    expect(fractionPoolSize([2], 'circle')).toBe(1);
    expect(fractionPoolSize([4], 'circle')).toBe(3);
    expect(fractionPoolSize([12], 'circle')).toBe(11);
  });

  it('summerar över flera nämnare', () => {
    expect(fractionPoolSize([2, 3, 4], 'circle')).toBe(1 + 2 + 3);
  });

  it('dubblar poolen för "mixed" form (cirkel och stapel räknas var för sig)', () => {
    expect(fractionPoolSize([2, 3, 4], 'mixed')).toBe(2 * (1 + 2 + 3));
    expect(fractionPoolSize([2, 3, 4], 'circle')).toBe(fractionPoolSize([2, 3, 4], 'bar'));
  });
});

describe('generateFractionProblems', () => {
  it('returnerar en tom lista när count är 0', () => {
    expect(generateFractionProblems(fractionConfig({ count: 0 }))).toEqual([]);
  });

  it('returnerar en tom lista när inga nämnare är ikryssade', () => {
    expect(generateFractionProblems(fractionConfig({ denominators: [], count: 20 }))).toEqual([]);
  });

  it('genererar exakt count uppgifter', () => {
    expect(generateFractionProblems(fractionConfig({ count: 30 }))).toHaveLength(30);
  });

  it('håller nämnaren bland de ikryssade', () => {
    const problems = generateFractionProblems(fractionConfig({ denominators: [3, 5], count: 60 }));
    for (const p of problems) {
      expect([3, 5]).toContain(p.denominator);
    }
  });

  it('täljaren är alltid ett äkta bråk (1 till nämnare − 1)', () => {
    const problems = generateFractionProblems(fractionConfig({ count: 200 }));
    for (const p of problems) {
      expect(p.numerator).toBeGreaterThanOrEqual(1);
      expect(p.numerator).toBeLessThanOrEqual(p.denominator - 1);
    }
  });

  it('ger identiskt resultat för samma seed', () => {
    const config = fractionConfig({ seed: 12345, count: 40 });
    expect(generateFractionProblems(config)).toEqual(generateFractionProblems(config));
  });

  it('ger olika resultat för olika seed', () => {
    const a = generateFractionProblems(fractionConfig({ seed: 1, count: 40 }));
    const b = generateFractionProblems(fractionConfig({ seed: 2, count: 40 }));
    expect(a).not.toEqual(b);
  });

  it('undviker dubbletter så länge poolen räcker till', () => {
    const problems = generateFractionProblems(
      fractionConfig({
        denominators: [...FRACTION_DENOMINATORS],
        count: 30,
        avoidDuplicates: true,
      }),
    );
    const keys = problems.map((p) => `${p.shape}:${p.numerator}/${p.denominator}`);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('fyller på med upprepningar i stället för att hänga när poolen är för liten', () => {
    // Nämnare 2 med en enda form rymmer bara 1 unikt bråk.
    const problems = generateFractionProblems(
      fractionConfig({ denominators: [2], shape: 'circle', count: 50, avoidDuplicates: true }),
    );
    expect(problems).toHaveLength(50);
  });

  it('ger alltid form "circle" när shape är "circle"', () => {
    for (const p of generateFractionProblems(fractionConfig({ shape: 'circle', count: 40 }))) {
      expect(p.shape).toBe('circle');
    }
  });

  it('ger alltid form "bar" när shape är "bar"', () => {
    for (const p of generateFractionProblems(fractionConfig({ shape: 'bar', count: 40 }))) {
      expect(p.shape).toBe('bar');
    }
  });

  it('ger båda formerna när shape är "mixed"', () => {
    const shapes = new Set(
      generateFractionProblems(fractionConfig({ shape: 'mixed', count: 40, seed: 7 })).map(
        (p) => p.shape,
      ),
    );
    expect(shapes).toEqual(new Set(['circle', 'bar']));
  });

  it('ger alltid direction "identify" när direction är "identify"', () => {
    for (const p of generateFractionProblems(
      fractionConfig({ direction: 'identify', count: 40 }),
    )) {
      expect(p.direction).toBe('identify');
    }
  });

  it('ger alltid direction "shade" när direction är "shade"', () => {
    for (const p of generateFractionProblems(fractionConfig({ direction: 'shade', count: 40 }))) {
      expect(p.direction).toBe('shade');
    }
  });

  it('ger alltid direction "identifyPercent" när direction är "identifyPercent"', () => {
    for (const p of generateFractionProblems(
      fractionConfig({ direction: 'identifyPercent', count: 40 }),
    )) {
      expect(p.direction).toBe('identifyPercent');
    }
  });

  it('ger alltid direction "toPercent" när direction är "toPercent"', () => {
    for (const p of generateFractionProblems(
      fractionConfig({ direction: 'toPercent', count: 40 }),
    )) {
      expect(p.direction).toBe('toPercent');
    }
  });

  it('ger de tre figurbaserade riktningarna (inte "toPercent") när direction är "mixed"', () => {
    const directions = new Set(
      generateFractionProblems(fractionConfig({ direction: 'mixed', count: 40, seed: 7 })).map(
        (p) => p.direction,
      ),
    );
    expect(directions).toEqual(new Set(['identify', 'shade', 'identifyPercent']));
  });
});
