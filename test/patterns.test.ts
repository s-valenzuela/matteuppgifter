import { describe, expect, it } from 'vitest';
import { generatePatternProblems, patternPoolSize } from '../src/core/patterns';
import type { PatternGeneratorConfig, PatternProblem } from '../src/types';

function baseConfig(overrides: Partial<PatternGeneratorConfig> = {}): PatternGeneratorConfig {
  return {
    startRange: { min: 0, max: 20 },
    steps: [1, 2],
    allowDescending: false,
    termCount: 6,
    hiddenCount: 2,
    count: 12,
    avoidDuplicates: true,
    seed: 1,
    ...overrides,
  };
}

describe('generatePatternProblems', () => {
  it('genererar begärt antal uppgifter', () => {
    expect(generatePatternProblems(baseConfig({ count: 7 }))).toHaveLength(7);
  });

  it('returnerar en tom lista för count 0 eller mindre', () => {
    expect(generatePatternProblems(baseConfig({ count: 0 }))).toEqual([]);
    expect(generatePatternProblems(baseConfig({ count: -3 }))).toEqual([]);
  });

  it('samma seed ger exakt samma uppgifter, en annan seed ger andra', () => {
    const a = generatePatternProblems(baseConfig({ seed: 42 }));
    const b = generatePatternProblems(baseConfig({ seed: 42 }));
    const c = generatePatternProblems(baseConfig({ seed: 43 }));
    expect(a).toEqual(b);
    expect(a).not.toEqual(c);
  });

  it('varje talföljd har exakt termCount termer, med jämnt mellanrum (step)', () => {
    const problems = generatePatternProblems(
      baseConfig({ termCount: 8, count: 30, avoidDuplicates: false }),
    );
    for (const p of problems) {
      expect(p.terms).toHaveLength(8);
      for (let i = 1; i < p.terms.length; i++) {
        expect(p.terms[i] - p.terms[i - 1]).toBe(p.step);
      }
    }
  });

  it('index 0 och 1 är aldrig dolda — de två ankartermerna är alltid synliga', () => {
    const problems = generatePatternProblems(baseConfig({ count: 40, avoidDuplicates: false }));
    for (const p of problems) {
      expect(p.hiddenIndices).not.toContain(0);
      expect(p.hiddenIndices).not.toContain(1);
    }
  });

  it('antalet dolda index matchar hiddenCount', () => {
    const problems = generatePatternProblems(
      baseConfig({ termCount: 8, hiddenCount: 3, count: 20, avoidDuplicates: false }),
    );
    for (const p of problems) {
      expect(p.hiddenIndices).toHaveLength(3);
      expect(new Set(p.hiddenIndices).size).toBe(3);
    }
  });

  it('respekterar valda steg (magnituden)', () => {
    const problems = generatePatternProblems(
      baseConfig({ steps: [5], allowDescending: false, count: 20, avoidDuplicates: false }),
    );
    expect(problems.every((p) => p.step === 5)).toBe(true);
  });

  it('allowDescending ger både positiva och negativa steg förr eller senare', () => {
    const problems = generatePatternProblems(
      baseConfig({ steps: [3], allowDescending: true, count: 40, avoidDuplicates: false, seed: 7 }),
    );
    expect(problems.some((p) => p.step === 3)).toBe(true);
    expect(problems.some((p) => p.step === -3)).toBe(true);
  });

  it('utan allowDescending är steget alltid positivt', () => {
    const problems = generatePatternProblems(
      baseConfig({ steps: [2, 5], allowDescending: false, count: 40, avoidDuplicates: false }),
    );
    expect(problems.every((p) => p.step > 0)).toBe(true);
  });

  it('startvärdet håller sig inom startRange', () => {
    const problems = generatePatternProblems(
      baseConfig({ startRange: { min: 3, max: 8 }, count: 40, avoidDuplicates: false }),
    );
    for (const p of problems) {
      expect(p.terms[0]).toBeGreaterThanOrEqual(3);
      expect(p.terms[0]).toBeLessThanOrEqual(8);
    }
  });

  it('undviker dubbletter så länge poolen räcker till', () => {
    const problems = generatePatternProblems(
      baseConfig({ startRange: { min: 1, max: 20 }, steps: [1, 2, 3], count: 15 }),
    );
    const keys = problems.map((p) => `${p.terms[0]}:${p.step}:${p.hiddenIndices.join(',')}`);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('hänger inte när fler uppgifter begärs än poolen rymmer', () => {
    const problems = generatePatternProblems(
      baseConfig({ startRange: { min: 1, max: 2 }, steps: [1], count: 30 }),
    );
    expect(problems).toHaveLength(30);
  });

  it('en tom stegslista faller tillbaka till [1] i stället för att krascha', () => {
    const problems = generatePatternProblems(baseConfig({ steps: [], count: 5 }));
    expect(problems).toHaveLength(5);
    expect(problems.every((p) => Math.abs(p.step) === 1)).toBe(true);
  });

  it('termCount och hiddenCount rätas ut mot rimliga minimivärden', () => {
    const problems = generatePatternProblems(
      baseConfig({ termCount: 1, hiddenCount: 10, count: 5 }),
    );
    for (const p of problems) {
      expect(p.terms.length).toBeGreaterThanOrEqual(4);
      expect(p.hiddenIndices.length).toBeLessThanOrEqual(p.terms.length - 2);
    }
  });
});

describe('patternPoolSize', () => {
  it('växer med talområdet och antalet steg', () => {
    const small = patternPoolSize(baseConfig({ startRange: { min: 1, max: 4 }, steps: [1] }));
    const large = patternPoolSize(
      baseConfig({ startRange: { min: 1, max: 20 }, steps: [1, 2, 5] }),
    );
    expect(large).toBeGreaterThan(small);
  });

  it('dubblas av allowDescending', () => {
    const without = patternPoolSize(baseConfig({ allowDescending: false }));
    const withDescending = patternPoolSize(baseConfig({ allowDescending: true }));
    expect(withDescending).toBe(without * 2);
  });
});

/** Hjälpfunktion för att verifiera terms/hiddenIndices konsekvent i tester ovan. */
function isSorted(values: readonly number[]): boolean {
  return values.every((v, i) => i === 0 || values[i - 1] <= v);
}

describe('problemens hiddenIndices är sorterade', () => {
  it('hiddenIndices ligger i stigande ordning', () => {
    const problems = generatePatternProblems(
      baseConfig({ termCount: 10, hiddenCount: 4, count: 20, avoidDuplicates: false }),
    );
    for (const p of problems as PatternProblem[]) {
      expect(isSorted(p.hiddenIndices)).toBe(true);
    }
  });
});
