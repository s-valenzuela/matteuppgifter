import { describe, expect, it } from 'vitest';
import { generateProblems } from '../src/core/generate';
import { baseConfig, opConfig } from './helpers';

describe('generateProblems', () => {
  it('returnerar en tom lista när inget räknesätt är valt', () => {
    expect(generateProblems(baseConfig({ count: 10 }))).toEqual([]);
  });

  it('returnerar en tom lista när count är 0', () => {
    const config = baseConfig({
      operations: {
        add: opConfig({ enabled: true }),
        sub: opConfig(),
        mul: opConfig(),
        div: opConfig(),
      },
      count: 0,
    });
    expect(generateProblems(config)).toEqual([]);
  });

  it('fördelar uppgifter jämnt över flera valda räknesätt', () => {
    const config = baseConfig({
      operations: {
        add: opConfig({ enabled: true }),
        sub: opConfig({ enabled: true }),
        mul: opConfig(),
        div: opConfig(),
      },
      count: 20,
    });
    const problems = generateProblems(config);
    expect(problems.filter((p) => p.op === 'add')).toHaveLength(10);
    expect(problems.filter((p) => p.op === 'sub')).toHaveLength(10);
  });

  it('håller alla uppgifter inom valt talområde', () => {
    const range = { min: 3, max: 8 };
    const config = baseConfig({
      operations: {
        add: opConfig({ enabled: true, operandRange: range }),
        sub: opConfig({ enabled: true, operandRange: range }),
        mul: opConfig({ enabled: true, operandRange: range }),
        div: opConfig({ enabled: true, operandRange: range }),
      },
      count: 80,
    });

    const problems = generateProblems(config);
    expect(problems).toHaveLength(80);

    for (const p of problems) {
      if (p.op === 'div') {
        // För division styr talområdet divisorn (b) och kvoten (svaret),
        // inte täljaren (a) som är deras produkt.
        expect(p.b).toBeGreaterThanOrEqual(Math.max(range.min, 1));
        expect(p.b).toBeLessThanOrEqual(range.max);
        expect(p.answer).toBeGreaterThanOrEqual(range.min);
        expect(p.answer).toBeLessThanOrEqual(range.max);
        expect(p.a).toBe(p.b * p.answer);
      } else {
        expect(p.a).toBeGreaterThanOrEqual(range.min);
        expect(p.a).toBeLessThanOrEqual(range.max);
        expect(p.b).toBeGreaterThanOrEqual(range.min);
        expect(p.b).toBeLessThanOrEqual(range.max);
      }
    }
  });

  it('respekterar en valfri gräns på svaret för addition', () => {
    const config = baseConfig({
      operations: {
        add: opConfig({
          enabled: true,
          operandRange: { min: 0, max: 20 },
          resultRange: { min: 0, max: 10 },
        }),
        sub: opConfig(),
        mul: opConfig(),
        div: opConfig(),
      },
      count: 40,
    });

    for (const p of generateProblems(config)) {
      expect(p.answer).toBeGreaterThanOrEqual(0);
      expect(p.answer).toBeLessThanOrEqual(10);
    }
  });

  it('ger aldrig ett negativt svar för subtraktion när noNegative är satt', () => {
    const config = baseConfig({
      operations: {
        add: opConfig(),
        sub: opConfig({ enabled: true, operandRange: { min: 0, max: 20 }, noNegative: true }),
        mul: opConfig(),
        div: opConfig(),
      },
      count: 60,
    });

    for (const p of generateProblems(config)) {
      expect(p.answer).toBeGreaterThanOrEqual(0);
    }
  });

  it('kan ge ett negativt svar för subtraktion när noNegative inte är satt', () => {
    // Med ett seed där b > a inträffar ofta är sannolikheten för minst en
    // negativ uppgift bland 60 försök i praktiken 1 — testet är deterministiskt.
    const config = baseConfig({
      operations: {
        add: opConfig(),
        sub: opConfig({ enabled: true, operandRange: { min: 0, max: 20 } }),
        mul: opConfig(),
        div: opConfig(),
      },
      count: 60,
      seed: 99,
    });

    const problems = generateProblems(config);
    expect(problems.some((p) => p.answer < 0)).toBe(true);
  });

  it('begränsar en faktor till valda multiplikationstabeller', () => {
    const config = baseConfig({
      operations: {
        add: opConfig(),
        sub: opConfig(),
        mul: opConfig({ enabled: true, operandRange: { min: 0, max: 10 }, tables: [2, 5] }),
        div: opConfig(),
      },
      count: 40,
    });

    for (const p of generateProblems(config)) {
      expect([2, 5]).toContain(p.a);
    }
  });

  it('går alltid jämnt upp vid division utan allowRemainder', () => {
    const config = baseConfig({
      operations: {
        add: opConfig(),
        sub: opConfig(),
        mul: opConfig(),
        div: opConfig({ enabled: true, operandRange: { min: 1, max: 9 } }),
      },
      count: 40,
    });

    for (const p of generateProblems(config)) {
      expect(p.b).not.toBe(0);
      expect(p.a % p.b).toBe(0);
      expect(p.remainder).toBeUndefined();
    }
  });

  it('utesluter alltid 0 som divisor, även när talområdet börjar på 0', () => {
    const config = baseConfig({
      operations: {
        add: opConfig(),
        sub: opConfig(),
        mul: opConfig(),
        div: opConfig({ enabled: true, operandRange: { min: 0, max: 5 } }),
      },
      count: 40,
    });

    for (const p of generateProblems(config)) {
      expect(p.b).not.toBe(0);
    }
  });

  it('lägger till en rest mindre än divisorn när allowRemainder är satt', () => {
    const config = baseConfig({
      operations: {
        add: opConfig(),
        sub: opConfig(),
        mul: opConfig(),
        div: opConfig({ enabled: true, operandRange: { min: 2, max: 9 }, allowRemainder: true }),
      },
      count: 40,
    });

    for (const p of generateProblems(config)) {
      expect(p.remainder).toBeDefined();
      expect(p.remainder!).toBeGreaterThanOrEqual(0);
      expect(p.remainder!).toBeLessThan(p.b);
      expect(p.a).toBe(p.b * p.answer + p.remainder!);
    }
  });

  it('undviker dubbletter så länge talområdet räcker till', () => {
    const config = baseConfig({
      operations: {
        add: opConfig({ enabled: true, operandRange: { min: 0, max: 20 } }),
        sub: opConfig(),
        mul: opConfig(),
        div: opConfig(),
      },
      count: 60,
      avoidDuplicates: true,
    });

    const keys = generateProblems(config).map((p) => `${p.a}:${p.b}`);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('fyller på med upprepningar i stället för att hänga när talområdet är för litet', () => {
    const config = baseConfig({
      operations: {
        add: opConfig({ enabled: true, operandRange: { min: 0, max: 1 } }),
        sub: opConfig(),
        mul: opConfig(),
        div: opConfig(),
      },
      count: 50,
      avoidDuplicates: true,
    });

    const problems = generateProblems(config);
    expect(problems).toHaveLength(50);
  });

  it('ger identiskt resultat för samma seed', () => {
    const config = baseConfig({
      operations: {
        add: opConfig({ enabled: true, operandRange: { min: 0, max: 20 } }),
        sub: opConfig({ enabled: true, operandRange: { min: 0, max: 20 } }),
        mul: opConfig({ enabled: true, operandRange: { min: 0, max: 10 } }),
        div: opConfig({ enabled: true, operandRange: { min: 1, max: 10 } }),
      },
      count: 40,
      shuffle: true,
      seed: 12345,
    });

    expect(generateProblems(config)).toEqual(generateProblems(config));
  });

  it('ger olika resultat för olika seed', () => {
    const config = baseConfig({
      operations: {
        add: opConfig({ enabled: true, operandRange: { min: 0, max: 20 } }),
        sub: opConfig(),
        mul: opConfig(),
        div: opConfig(),
      },
      count: 40,
    });

    const a = generateProblems({ ...config, seed: 1 });
    const b = generateProblems({ ...config, seed: 2 });
    expect(a).not.toEqual(b);
  });

  describe('resultRange', () => {
    it('respekterar en gräns på svaret för subtraktion', () => {
      const config = baseConfig({
        operations: {
          add: opConfig(),
          sub: opConfig({
            enabled: true,
            operandRange: { min: 0, max: 20 },
            resultRange: { min: -5, max: 5 },
          }),
          mul: opConfig(),
          div: opConfig(),
        },
        count: 40,
      });

      for (const p of generateProblems(config)) {
        expect(p.answer).toBeGreaterThanOrEqual(-5);
        expect(p.answer).toBeLessThanOrEqual(5);
      }
    });

    it('respekterar en gräns på svaret (produkten) för multiplikation', () => {
      const config = baseConfig({
        operations: {
          add: opConfig(),
          sub: opConfig(),
          mul: opConfig({
            enabled: true,
            operandRange: { min: 0, max: 10 },
            resultRange: { min: 0, max: 12 },
          }),
          div: opConfig(),
        },
        count: 40,
      });

      for (const p of generateProblems(config)) {
        expect(p.answer).toBeGreaterThanOrEqual(0);
        expect(p.answer).toBeLessThanOrEqual(12);
      }
    });

    it('respekterar en gräns på svaret (kvoten) för division', () => {
      const config = baseConfig({
        operations: {
          add: opConfig(),
          sub: opConfig(),
          mul: opConfig(),
          div: opConfig({
            enabled: true,
            operandRange: { min: 1, max: 12 },
            resultRange: { min: 1, max: 3 },
          }),
        },
        count: 40,
      });

      for (const p of generateProblems(config)) {
        expect(p.answer).toBeGreaterThanOrEqual(1);
        expect(p.answer).toBeLessThanOrEqual(3);
        // resultRange styr kvoten, inte divisorn — täljaren måste ändå stämma.
        expect(p.a).toBe(p.b * p.answer);
      }
    });
  });

  describe('missingNumber ("Saknat tal")', () => {
    it('ger alltid missingSlot "answer" när saknat tal är avstängt', () => {
      const config = baseConfig({
        operations: {
          add: opConfig({ enabled: true, operandRange: { min: 0, max: 20 } }),
          sub: opConfig(),
          mul: opConfig(),
          div: opConfig(),
        },
        count: 20,
        missingNumber: false,
      });

      for (const p of generateProblems(config)) {
        expect(p.missingSlot).toBe('answer');
      }
    });

    it('väljer olika platser (a, b, svar) när saknat tal är påslaget', () => {
      const config = baseConfig({
        operations: {
          add: opConfig({ enabled: true, operandRange: { min: 0, max: 20 } }),
          sub: opConfig(),
          mul: opConfig(),
          div: opConfig(),
        },
        count: 60,
        missingNumber: true,
        seed: 7,
      });

      const slots = new Set(generateProblems(config).map((p) => p.missingSlot));
      expect(slots.size).toBeGreaterThan(1);
    });

    it('blankar aldrig divisorn (b) för division, bara täljare eller svar', () => {
      const config = baseConfig({
        operations: {
          add: opConfig(),
          sub: opConfig(),
          mul: opConfig(),
          div: opConfig({ enabled: true, operandRange: { min: 1, max: 10 } }),
        },
        count: 60,
        missingNumber: true,
        seed: 3,
      });

      for (const p of generateProblems(config)) {
        expect(p.missingSlot).not.toBe('b');
      }
    });

    it('varje uppgift förblir korrekt lösbar oavsett vilken plats som saknas', () => {
      const config = baseConfig({
        operations: {
          add: opConfig({ enabled: true, operandRange: { min: 0, max: 20 } }),
          sub: opConfig({ enabled: true, operandRange: { min: 0, max: 20 }, noNegative: true }),
          mul: opConfig({ enabled: true, operandRange: { min: 1, max: 10 } }),
          div: opConfig({ enabled: true, operandRange: { min: 1, max: 10 } }),
        },
        count: 200,
        missingNumber: true,
        seed: 42,
      });

      for (const p of generateProblems(config)) {
        // a, b och answer är oförändrade oavsett missingSlot — det är bara
        // render.ts som väljer vilken av dem som visas tom. Facit ska alltid
        // stämma matematiskt.
        switch (p.op) {
          case 'add':
            expect(p.a + p.b).toBe(p.answer);
            break;
          case 'sub':
            expect(p.a - p.b).toBe(p.answer);
            break;
          case 'mul':
            expect(p.a * p.b).toBe(p.answer);
            break;
          case 'div':
            expect(p.b * p.answer + (p.remainder ?? 0)).toBe(p.a);
            break;
        }
      }
    });
  });
});
