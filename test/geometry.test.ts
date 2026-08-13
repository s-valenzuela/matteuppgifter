import { describe, expect, it } from 'vitest';
import {
  formatGeometryValue,
  generateGeometryProblems,
  geometryAnswer,
  geometryMeasureLabel,
  geometryPoolSize,
  geometryUnit,
  PI_APPROX,
  PYTHAGOREAN_TRIPLES,
} from '../src/core/geometry';
import type { GeometryGeneratorConfig, GeometryProblem } from '../src/types';

function baseConfig(overrides: Partial<GeometryGeneratorConfig> = {}): GeometryGeneratorConfig {
  return {
    shape: 'mixed',
    measure: 'mixed',
    sideRange: { min: 2, max: 10 },
    showUnits: true,
    count: 12,
    avoidDuplicates: true,
    seed: 1,
    ...overrides,
  };
}

const SHAPES = ['rectangle', 'triangle', 'circle', 'mixed'] as const;
const MEASURES = ['area', 'perimeter', 'mixed'] as const;

describe('generateGeometryProblems', () => {
  it('genererar begärt antal uppgifter', () => {
    expect(generateGeometryProblems(baseConfig({ count: 7 }))).toHaveLength(7);
  });

  it('returnerar en tom lista för count 0 eller mindre', () => {
    expect(generateGeometryProblems(baseConfig({ count: 0 }))).toEqual([]);
    expect(generateGeometryProblems(baseConfig({ count: -3 }))).toEqual([]);
  });

  it('samma seed ger exakt samma uppgifter, en annan seed ger andra', () => {
    const a = generateGeometryProblems(baseConfig({ seed: 42 }));
    const b = generateGeometryProblems(baseConfig({ seed: 42 }));
    const c = generateGeometryProblems(baseConfig({ seed: 43 }));
    expect(a).toEqual(b);
    expect(a).not.toEqual(c);
  });

  it('respekterar vald figur och valt mått', () => {
    for (const shape of ['rectangle', 'triangle', 'circle'] as const) {
      for (const measure of ['area', 'perimeter'] as const) {
        const problems = generateGeometryProblems(baseConfig({ shape, measure, count: 15 }));
        expect(problems.every((p) => p.shape === shape)).toBe(true);
        expect(problems.every((p) => p.measure === measure)).toBe(true);
      }
    }
  });

  it('"mixed" ger så småningom alla figurer och båda måtten', () => {
    const problems = generateGeometryProblems(
      baseConfig({ count: 60, avoidDuplicates: false, seed: 7 }),
    );
    expect(new Set(problems.map((p) => p.shape))).toEqual(
      new Set(['rectangle', 'triangle', 'circle']),
    );
    expect(new Set(problems.map((p) => p.measure))).toEqual(new Set(['area', 'perimeter']));
  });

  it('håller måtten inom talområdet (utom triangelns skalade tripplar)', () => {
    const problems = generateGeometryProblems(
      baseConfig({ sideRange: { min: 3, max: 8 }, count: 40, avoidDuplicates: false }),
    );
    for (const p of problems) {
      if (p.shape === 'rectangle') {
        expect(p.widthCm).toBeGreaterThanOrEqual(3);
        expect(p.widthCm).toBeLessThanOrEqual(8);
        expect(p.heightCm).toBeGreaterThanOrEqual(3);
        expect(p.heightCm).toBeLessThanOrEqual(8);
      }
      if (p.shape === 'circle') {
        expect(p.radiusCm).toBeGreaterThanOrEqual(3);
        expect(p.radiusCm).toBeLessThanOrEqual(8);
      }
    }
  });

  it('alla mått är positiva heltal, även för ett orimligt talområde', () => {
    const problems = generateGeometryProblems(
      baseConfig({ sideRange: { min: -5, max: 0 }, count: 20, avoidDuplicates: false }),
    );
    for (const p of problems) {
      for (const value of dimensionsOf(p)) {
        expect(Number.isInteger(value)).toBe(true);
        expect(value).toBeGreaterThan(0);
      }
    }
  });

  it('undviker dubbletter så länge poolen räcker till', () => {
    const problems = generateGeometryProblems(
      baseConfig({ shape: 'circle', measure: 'area', sideRange: { min: 1, max: 20 }, count: 12 }),
    );
    const radii = problems.map((p) => (p.shape === 'circle' ? p.radiusCm : 0));
    expect(new Set(radii).size).toBe(radii.length);
  });

  it('hänger inte när fler uppgifter begärs än poolen rymmer', () => {
    const problems = generateGeometryProblems(
      baseConfig({ shape: 'circle', measure: 'area', sideRange: { min: 1, max: 3 }, count: 20 }),
    );
    expect(problems).toHaveLength(20);
  });
});

describe('triangelns mått', () => {
  it('omkretstrianglar är alltid rätvinkliga med heltalssidor (a² + b² = c²)', () => {
    const problems = generateGeometryProblems(
      baseConfig({ shape: 'triangle', measure: 'perimeter', count: 50, avoidDuplicates: false }),
    );
    expect(problems.length).toBeGreaterThan(0);
    for (const p of problems) {
      if (p.shape !== 'triangle' || p.measure !== 'perimeter') throw new Error('fel uppgiftstyp');
      const [a, b, c] = p.sidesCm;
      expect(a * a + b * b).toBe(c * c);
      expect([a, b, c].every(Number.isInteger)).toBe(true);
    }
  });

  it('areatrianglar har alltid jämn produkt, så bas×höjd/2 blir ett heltal', () => {
    const problems = generateGeometryProblems(
      baseConfig({ shape: 'triangle', measure: 'area', count: 60, avoidDuplicates: false }),
    );
    expect(problems.length).toBeGreaterThan(0);
    for (const p of problems) {
      if (p.shape !== 'triangle' || p.measure !== 'area') throw new Error('fel uppgiftstyp');
      expect((p.baseCm * p.heightCm) % 2).toBe(0);
      expect(Number.isInteger(geometryAnswer(p))).toBe(true);
    }
  });

  it('varje pythagoreisk trippel i listan är faktiskt en trippel', () => {
    for (const [a, b, c] of PYTHAGOREAN_TRIPLES) {
      expect(a * a + b * b).toBe(c * c);
    }
  });
});

describe('geometryAnswer', () => {
  it('räknar ut rektangelns area och omkrets', () => {
    expect(geometryAnswer({ shape: 'rectangle', measure: 'area', widthCm: 6, heightCm: 4 })).toBe(
      24,
    );
    expect(
      geometryAnswer({ shape: 'rectangle', measure: 'perimeter', widthCm: 6, heightCm: 4 }),
    ).toBe(20);
  });

  it('räknar ut triangelns area och omkrets', () => {
    expect(geometryAnswer({ shape: 'triangle', measure: 'area', baseCm: 6, heightCm: 4 })).toBe(12);
    expect(geometryAnswer({ shape: 'triangle', measure: 'perimeter', sidesCm: [3, 4, 5] })).toBe(
      12,
    );
  });

  it('räknar cirkeln med 3,14 — samma pi som eleven räknar med, inte Math.PI', () => {
    const area = geometryAnswer({ shape: 'circle', measure: 'area', radiusCm: 10 });
    expect(area).toBeCloseTo(PI_APPROX * 100, 10);
    // Math.PI hade gett 314.159... — facit måste stämma med elevens 3,14.
    expect(area).not.toBeCloseTo(Math.PI * 100, 3);

    expect(geometryAnswer({ shape: 'circle', measure: 'perimeter', radiusCm: 10 })).toBeCloseTo(
      62.8,
      10,
    );
  });
});

describe('formatGeometryValue', () => {
  it('skriver heltal utan decimaler och utan ~', () => {
    expect(formatGeometryValue(24)).toBe('24');
    expect(formatGeometryValue(314)).toBe('314');
  });

  it('använder decimalkomma, inte punkt', () => {
    expect(formatGeometryValue(62.8)).toBe('62,8');
  });

  it('markerar med ~ bara när avrundningen faktiskt tappar information', () => {
    // 3,14 × 3² = 28,26 → avrundas till 28,3, alltså inte exakt.
    expect(formatGeometryValue(28.26)).toBe('~28,3');
    // 3,14 × 10² = 314 exakt — ingen tilde.
    expect(formatGeometryValue(PI_APPROX * 100)).toBe('314');
    // Flyttalsbrus får inte stämpla ett exakt värde som avrundat.
    expect(formatGeometryValue(PI_APPROX * 9)).toBe('~28,3');
    expect(formatGeometryValue(2 * PI_APPROX * 10)).toBe('62,8');
  });

  it('innehåller aldrig tecken som saknas i jsPDF:s WinAnsi-kodning', () => {
    // π och ≈ renderas som rappakalja i jsPDF:s inbyggda Helvetica — samma
    // fälla som tidigare drabbat − och ≈, se kommentaren i core/geometry.ts.
    const values = [24, 28.26, 62.8, PI_APPROX * 100, PI_APPROX * 49];
    for (const value of values) {
      const text = formatGeometryValue(value);
      expect(text).not.toMatch(/[π≈−]/);
    }
  });
});

describe('geometryUnit / geometryMeasureLabel', () => {
  it('area får cm² och omkrets får cm', () => {
    expect(geometryUnit('area')).toBe('cm²');
    expect(geometryUnit('perimeter')).toBe('cm');
  });

  it('etiketten säger vad som efterfrågas', () => {
    expect(geometryMeasureLabel('area')).toBe('Area');
    expect(geometryMeasureLabel('perimeter')).toBe('Omkrets');
  });
});

describe('geometryPoolSize', () => {
  it('växer med talområdet', () => {
    const small = geometryPoolSize(baseConfig({ sideRange: { min: 1, max: 4 } }));
    const large = geometryPoolSize(baseConfig({ sideRange: { min: 1, max: 20 } }));
    expect(large).toBeGreaterThan(small);
  });

  it('är alltid positiv, även för ett urartat talområde', () => {
    for (const shape of SHAPES) {
      for (const measure of MEASURES) {
        const size = geometryPoolSize(
          baseConfig({ shape, measure, sideRange: { min: 0, max: 0 } }),
        );
        expect(size).toBeGreaterThan(0);
      }
    }
  });
});

/** Alla längdmått i en uppgift, oavsett figurvariant. */
function dimensionsOf(problem: GeometryProblem): number[] {
  switch (problem.shape) {
    case 'rectangle':
      return [problem.widthCm, problem.heightCm];
    case 'circle':
      return [problem.radiusCm];
    case 'triangle':
      return problem.measure === 'area' ? [problem.baseCm, problem.heightCm] : [...problem.sidesCm];
  }
}
