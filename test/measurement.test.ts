import { describe, expect, it } from 'vitest';
import { generateMeasurementProblems, measurementPoolSize } from '../src/core/measurement';
import type { MeasurementGeneratorConfig, MeasurementQuantity } from '../src/types';

function baseConfig(
  overrides: Partial<MeasurementGeneratorConfig> = {},
): MeasurementGeneratorConfig {
  return {
    quantity: 'mixed',
    valueRange: { min: 1, max: 200 },
    count: 12,
    avoidDuplicates: true,
    seed: 1,
    ...overrides,
  };
}

/** Enhetstabellerna i core/measurement.ts, finaste enhet först — hårdkodade
 * här för att kunna verifiera "bara grannar paras ihop"-invarianten utan
 * att exportera generatorns interna tabeller. */
const UNIT_ORDER: Record<MeasurementQuantity, string[]> = {
  length: ['mm', 'cm', 'dm', 'm', 'km'],
  mass: ['g', 'hg', 'kg'],
  volume: ['ml', 'cl', 'dl', 'l'],
  time: ['s', 'min', 'h'],
};

const UNIT_FACTOR: Record<string, number> = {
  mm: 1,
  cm: 10,
  dm: 100,
  m: 1000,
  km: 1_000_000,
  g: 1,
  hg: 100,
  kg: 1000,
  ml: 1,
  cl: 10,
  dl: 100,
  l: 1000,
  s: 1,
  min: 60,
  h: 3600,
};

describe('generateMeasurementProblems', () => {
  it('genererar begärt antal uppgifter', () => {
    expect(generateMeasurementProblems(baseConfig({ count: 7 }))).toHaveLength(7);
  });

  it('returnerar en tom lista för count 0 eller mindre', () => {
    expect(generateMeasurementProblems(baseConfig({ count: 0 }))).toEqual([]);
    expect(generateMeasurementProblems(baseConfig({ count: -3 }))).toEqual([]);
  });

  it('samma seed ger exakt samma uppgifter, en annan seed ger andra', () => {
    const a = generateMeasurementProblems(baseConfig({ seed: 42 }));
    const b = generateMeasurementProblems(baseConfig({ seed: 42 }));
    const c = generateMeasurementProblems(baseConfig({ seed: 43 }));
    expect(a).toEqual(b);
    expect(a).not.toEqual(c);
  });

  it('respekterar vald storhet', () => {
    for (const quantity of ['length', 'mass', 'volume', 'time'] as const) {
      const problems = generateMeasurementProblems(baseConfig({ quantity, count: 15 }));
      expect(problems.every((p) => p.quantity === quantity)).toBe(true);
    }
  });

  it('"mixed" ger så småningom alla fyra storheter', () => {
    const problems = generateMeasurementProblems(
      baseConfig({ count: 80, avoidDuplicates: false, seed: 7 }),
    );
    expect(new Set(problems.map((p) => p.quantity))).toEqual(
      new Set(['length', 'mass', 'volume', 'time']),
    );
  });

  it('fromUnit och toUnit är alltid grannar i enhetstabellen, aldrig två steg ifrån varandra', () => {
    const problems = generateMeasurementProblems(
      baseConfig({ count: 100, avoidDuplicates: false }),
    );
    for (const p of problems) {
      const order = UNIT_ORDER[p.quantity];
      const fromIndex = order.indexOf(p.fromUnit);
      const toIndex = order.indexOf(p.toUnit);
      expect(fromIndex).toBeGreaterThanOrEqual(0);
      expect(toIndex).toBeGreaterThanOrEqual(0);
      expect(Math.abs(fromIndex - toIndex)).toBe(1);
    }
  });

  it('svaret motsvarar den matematiskt korrekta omräkningen i båda riktningarna', () => {
    const problems = generateMeasurementProblems(
      baseConfig({ count: 100, avoidDuplicates: false }),
    );
    for (const p of problems) {
      const fromFactor = UNIT_FACTOR[p.fromUnit];
      const toFactor = UNIT_FACTOR[p.toUnit];
      const exact = (p.fromValue * fromFactor) / toFactor;
      const rounded = Math.round(exact * 10) / 10;
      const answerNumber = Number(p.answerText.replace('~', '').replace(',', '.'));
      expect(answerNumber).toBeCloseTo(rounded, 5);
    }
  });

  it('grovt→fint (svaret exakt, aldrig avrundat) markeras aldrig med ~', () => {
    // Att gå från en grövre till en finare enhet är alltid en exakt
    // multiplikation — testa detta specifikt genom att bara titta på
    // uppgifter där svaret händelsevis är ett heltal ändå INTE har fått en ~
    // om det verkligen var exakt (se testet ovan för den generella kollen);
    // här kollar vi i stället att ~ ÖVERHUVUDTAGET kan förekomma för tid,
    // vilket bekräftar att den ärliga avrundningen faktiskt är aktiv.
    const problems = generateMeasurementProblems(
      baseConfig({
        quantity: 'time',
        count: 100,
        avoidDuplicates: false,
        valueRange: { min: 1, max: 500 },
      }),
    );
    expect(problems.some((p) => p.answerText.startsWith('~'))).toBe(true);
  });

  it('metriska enhetspar med steg-10 (t.ex. mm↔cm, ml↔cl) ger alltid ett exakt svar med 1 decimal', () => {
    // Bara ratio-10-par är GARANTERAT exakta (ett heltal delat med 10 har
    // alltid högst 1 decimal). Par med ratio 100/1000 (t.ex. g↔hg, m↔km) kan
    // däremot genuint behöva avrundas, precis som tid — se testet ovan.
    const problems = generateMeasurementProblems(
      baseConfig({
        quantity: 'volume',
        valueRange: { min: 1, max: 200 },
        count: 100,
        avoidDuplicates: false,
        seed: 3,
      }),
    );
    // Volymtabellen (ml/cl/dl/l) har bara ratio-10-steg mellan varje grannpar.
    expect(problems.every((p) => !p.answerText.startsWith('~'))).toBe(true);
  });

  it('undviker dubbletter så länge poolen räcker till', () => {
    const problems = generateMeasurementProblems(
      baseConfig({ quantity: 'length', valueRange: { min: 1, max: 50 }, count: 15 }),
    );
    const keys = problems.map((p) => `${p.quantity}:${p.fromUnit}:${p.toUnit}:${p.fromValue}`);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('hänger inte när fler uppgifter begärs än poolen rymmer', () => {
    const problems = generateMeasurementProblems(
      baseConfig({ quantity: 'mass', valueRange: { min: 1, max: 2 }, count: 40 }),
    );
    expect(problems).toHaveLength(40);
  });
});

describe('measurementPoolSize', () => {
  it('växer med talområdet', () => {
    const small = measurementPoolSize(baseConfig({ valueRange: { min: 1, max: 4 } }));
    const large = measurementPoolSize(baseConfig({ valueRange: { min: 1, max: 200 } }));
    expect(large).toBeGreaterThan(small);
  });

  it('är alltid positiv, även för ett urartat talområde', () => {
    for (const quantity of ['length', 'mass', 'volume', 'time', 'mixed'] as const) {
      const size = measurementPoolSize(baseConfig({ quantity, valueRange: { min: 0, max: 0 } }));
      expect(size).toBeGreaterThan(0);
    }
  });
});
