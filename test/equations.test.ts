import { describe, expect, it } from 'vitest';
import { equationAnswer, equationPoolSize, generateEquationProblems } from '../src/core/equations';
import type { EquationGeneratorConfig } from '../src/types';

function baseConfig(overrides: Partial<EquationGeneratorConfig> = {}): EquationGeneratorConfig {
  return {
    operations: { add: true, sub: true, mul: true, div: true },
    operandRange: { min: 1, max: 20 },
    allowNegative: false,
    count: 12,
    avoidDuplicates: true,
    seed: 1,
    ...overrides,
  };
}

describe('generateEquationProblems', () => {
  it('genererar begärt antal uppgifter', () => {
    expect(generateEquationProblems(baseConfig({ count: 7 }))).toHaveLength(7);
  });

  it('returnerar en tom lista för count 0 eller mindre', () => {
    expect(generateEquationProblems(baseConfig({ count: 0 }))).toEqual([]);
    expect(generateEquationProblems(baseConfig({ count: -3 }))).toEqual([]);
  });

  it('returnerar en tom lista när inget räknesätt är valt', () => {
    const problems = generateEquationProblems(
      baseConfig({ operations: { add: false, sub: false, mul: false, div: false } }),
    );
    expect(problems).toEqual([]);
  });

  it('samma seed ger exakt samma uppgifter, en annan seed ger andra', () => {
    const a = generateEquationProblems(baseConfig({ seed: 42 }));
    const b = generateEquationProblems(baseConfig({ seed: 42 }));
    const c = generateEquationProblems(baseConfig({ seed: 43 }));
    expect(a).toEqual(b);
    expect(a).not.toEqual(c);
  });

  it('respekterar vilka räknesätt som är valda', () => {
    for (const op of ['add', 'sub', 'mul', 'div'] as const) {
      const operations = { add: false, sub: false, mul: false, div: false };
      operations[op] = true;
      const problems = generateEquationProblems(baseConfig({ operations, count: 15 }));
      expect(problems.every((p) => p.op === op)).toBe(true);
    }
  });

  it('varje uppgift löser sig korrekt: op(a, b) === result', () => {
    const problems = generateEquationProblems(baseConfig({ count: 80, avoidDuplicates: false }));
    for (const p of problems) {
      const expected =
        p.op === 'add'
          ? p.a + p.b
          : p.op === 'sub'
            ? p.a - p.b
            : p.op === 'mul'
              ? p.a * p.b
              : p.a / p.b;
      expect(p.result).toBe(expected);
    }
  });

  it('equationAnswer motsvarar rätt operand beroende på unknownSlot', () => {
    const problems = generateEquationProblems(baseConfig({ count: 40, avoidDuplicates: false }));
    for (const p of problems) {
      const expected = p.unknownSlot === 'a' ? p.a : p.b;
      expect(equationAnswer(p)).toBe(expected);
    }
  });

  it('division döljer alltid dividenden (a), aldrig divisorn (b)', () => {
    const problems = generateEquationProblems(
      baseConfig({
        operations: { add: false, sub: false, mul: false, div: true },
        count: 40,
        avoidDuplicates: false,
      }),
    );
    expect(problems.length).toBeGreaterThan(0);
    for (const p of problems) {
      expect(p.unknownSlot).toBe('a');
      expect(p.b).toBeGreaterThan(0);
    }
  });

  it('division ger aldrig en rest — a är alltid delbart med b', () => {
    const problems = generateEquationProblems(
      baseConfig({
        operations: { add: false, sub: false, mul: false, div: true },
        count: 40,
        avoidDuplicates: false,
      }),
    );
    for (const p of problems) {
      expect(p.a % p.b).toBe(0);
    }
  });

  it('multiplikation döljer aldrig en operand vars motpart är 0', () => {
    const problems = generateEquationProblems(
      baseConfig({
        operations: { add: false, sub: false, mul: true, div: false },
        operandRange: { min: 0, max: 5 },
        count: 60,
        avoidDuplicates: false,
      }),
    );
    for (const p of problems) {
      if (p.unknownSlot === 'a') expect(p.b).not.toBe(0);
      if (p.unknownSlot === 'b') expect(p.a).not.toBe(0);
    }
  });

  it('utan allowNegative blir subtraktionens a/b aldrig negativa', () => {
    const problems = generateEquationProblems(
      baseConfig({
        operations: { add: false, sub: true, mul: false, div: false },
        allowNegative: false,
        count: 40,
        avoidDuplicates: false,
      }),
    );
    for (const p of problems) {
      expect(p.a).toBeGreaterThanOrEqual(0);
      expect(p.b).toBeGreaterThanOrEqual(0);
      expect(p.result).toBeGreaterThanOrEqual(0);
    }
  });

  it('undviker dubbletter så länge poolen räcker till', () => {
    const problems = generateEquationProblems(
      baseConfig({
        operations: { add: true, sub: false, mul: false, div: false },
        operandRange: { min: 1, max: 20 },
        count: 15,
      }),
    );
    const keys = problems.map((p) => `${p.op}:${p.a}:${p.b}:${p.unknownSlot}`);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('hänger inte när fler uppgifter begärs än poolen rymmer', () => {
    const problems = generateEquationProblems(
      baseConfig({
        operations: { add: true, sub: false, mul: false, div: false },
        operandRange: { min: 1, max: 2 },
        count: 30,
      }),
    );
    expect(problems).toHaveLength(30);
  });
});

describe('equationPoolSize', () => {
  it('växer med talområdet och antalet räknesätt', () => {
    const small = equationPoolSize(
      baseConfig({
        operandRange: { min: 1, max: 4 },
        operations: { add: true, sub: false, mul: false, div: false },
      }),
    );
    const large = equationPoolSize(baseConfig({ operandRange: { min: 1, max: 20 } }));
    expect(large).toBeGreaterThan(small);
  });

  it('är alltid minst 1, även för ett urartat talområde', () => {
    const size = equationPoolSize(baseConfig({ operandRange: { min: 0, max: 0 } }));
    expect(size).toBeGreaterThanOrEqual(1);
  });
});
