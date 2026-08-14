import { describe, expect, it } from 'vitest';
import { FRACTION_DENOMINATORS } from '../src/core/fractions';
import {
  validateClockConfig,
  validateConfig,
  validateFractionConfig,
  validateGeometryConfig,
  validatePatternConfig,
} from '../src/core/validate';
import type {
  ClockGeneratorConfig,
  FractionGeneratorConfig,
  GeometryGeneratorConfig,
  PatternGeneratorConfig,
} from '../src/types';
import { baseConfig, opConfig } from './helpers';

function baseClockConfig(overrides: Partial<ClockGeneratorConfig> = {}): ClockGeneratorConfig {
  return {
    steps: ['hour', 'half', 'quarter', 'five'],
    direction: 'read',
    showNumerals: true,
    showMinuteTicks: false,
    count: 12,
    avoidDuplicates: true,
    seed: 1,
    ...overrides,
  };
}

function baseFractionConfig(
  overrides: Partial<FractionGeneratorConfig> = {},
): FractionGeneratorConfig {
  return {
    denominators: [...FRACTION_DENOMINATORS],
    shape: 'mixed',
    direction: 'identify',
    showPercent: false,
    count: 12,
    avoidDuplicates: true,
    seed: 1,
    ...overrides,
  };
}

describe('validateConfig', () => {
  it('varnar när inget räknesätt är valt', () => {
    const { warnings } = validateConfig(baseConfig());
    expect(warnings.some((w) => w.includes('Inget räknesätt'))).toBe(true);
  });

  it('rätar ut ett omvänt talområde', () => {
    const config = baseConfig({
      operations: {
        add: opConfig({ enabled: true, operandRange: { min: 10, max: 2 } }),
        sub: opConfig(),
        mul: opConfig(),
        div: opConfig(),
      },
    });

    const { config: normalized } = validateConfig(config);
    expect(normalized.operations.add.operandRange).toEqual({ min: 2, max: 10 });
  });

  it('rätar ut ett omvänt resultRange', () => {
    const config = baseConfig({
      operations: {
        add: opConfig({
          enabled: true,
          operandRange: { min: 0, max: 10 },
          resultRange: { min: 8, max: 3 },
        }),
        sub: opConfig(),
        mul: opConfig(),
        div: opConfig(),
      },
    });

    const { config: normalized } = validateConfig(config);
    expect(normalized.operations.add.resultRange).toEqual({ min: 3, max: 8 });
  });

  it('normaliserar ett negativt eller icke-heltaligt antal till 0 och varnar', () => {
    const config = baseConfig({ count: -5 });
    const { config: normalized, warnings } = validateConfig(config);
    expect(normalized.count).toBe(0);
    expect(warnings.some((w) => w.includes('Antalet uppgifter'))).toBe(true);
  });

  it('lämnar ett giltigt positivt heltalsantal orört utan varning', () => {
    const config = baseConfig({
      operations: {
        add: opConfig({ enabled: true }),
        sub: opConfig(),
        mul: opConfig(),
        div: opConfig(),
      },
      count: 30,
    });
    const { config: normalized, warnings } = validateConfig(config);
    expect(normalized.count).toBe(30);
    expect(warnings.some((w) => w.includes('Antalet uppgifter'))).toBe(false);
  });

  it('varnar när avoidDuplicates inte kan tillgodoses för det begärda antalet', () => {
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

    const { warnings } = validateConfig(config);
    expect(warnings.some((w) => w.includes('addition'))).toBe(true);
  });

  it('varnar inte när talområdet räcker till för avoidDuplicates', () => {
    const config = baseConfig({
      operations: {
        add: opConfig({ enabled: true, operandRange: { min: 0, max: 50 } }),
        sub: opConfig(),
        mul: opConfig(),
        div: opConfig(),
      },
      count: 30,
      avoidDuplicates: true,
    });

    const { warnings } = validateConfig(config);
    expect(warnings).toHaveLength(0);
  });
});

describe('validateClockConfig', () => {
  it('normaliserar ett negativt antal till 0 och varnar', () => {
    const { config, warnings } = validateClockConfig(baseClockConfig({ count: -3 }));
    expect(config.count).toBe(0);
    expect(warnings.some((w) => w.includes('Antalet uppgifter'))).toBe(true);
  });

  it('varnar när avoidDuplicates inte kan tillgodoses av de ikryssade grupperna', () => {
    const { warnings } = validateClockConfig(baseClockConfig({ steps: ['hour'], count: 30 }));
    expect(warnings.some((w) => w.includes('12 unika klockslag'))).toBe(true);
  });

  it('varnar inte när de ikryssade grupperna rymmer tillräckligt många unika klockslag', () => {
    const { warnings } = validateClockConfig(
      baseClockConfig({ steps: ['hour', 'half', 'quarter', 'five'], count: 30 }),
    );
    expect(warnings).toHaveLength(0);
  });

  it('varnar inte när avoidDuplicates är avstängt, oavsett antal', () => {
    const { warnings } = validateClockConfig(
      baseClockConfig({ steps: ['hour'], count: 100, avoidDuplicates: false }),
    );
    expect(warnings).toHaveLength(0);
  });

  it('faller tillbaka till "hour" och varnar när inga grupper är ikryssade', () => {
    const { config, warnings } = validateClockConfig(baseClockConfig({ steps: [] }));
    expect(config.steps).toEqual(['hour']);
    expect(warnings.some((w) => w.includes('tidsgrupp'))).toBe(true);
  });
});

describe('validateFractionConfig', () => {
  it('normaliserar ett negativt antal till 0 och varnar', () => {
    const { config, warnings } = validateFractionConfig(baseFractionConfig({ count: -3 }));
    expect(config.count).toBe(0);
    expect(warnings.some((w) => w.includes('Antalet uppgifter'))).toBe(true);
  });

  it('varnar när avoidDuplicates inte kan tillgodoses av de ikryssade nämnarna', () => {
    const { warnings } = validateFractionConfig(
      baseFractionConfig({ denominators: [2], shape: 'circle', count: 30 }),
    );
    expect(warnings.some((w) => w.includes('unika bråk'))).toBe(true);
  });

  it('varnar inte när de ikryssade nämnarna rymmer tillräckligt många unika bråk', () => {
    const { warnings } = validateFractionConfig(
      baseFractionConfig({ denominators: [...FRACTION_DENOMINATORS], shape: 'mixed', count: 30 }),
    );
    expect(warnings).toHaveLength(0);
  });

  it('varnar inte när avoidDuplicates är avstängt, oavsett antal', () => {
    const { warnings } = validateFractionConfig(
      baseFractionConfig({ denominators: [2], count: 100, avoidDuplicates: false }),
    );
    expect(warnings).toHaveLength(0);
  });

  it('faller tillbaka till alla nämnare och varnar när inga är ikryssade', () => {
    const { config, warnings } = validateFractionConfig(baseFractionConfig({ denominators: [] }));
    expect(config.denominators).toEqual([...FRACTION_DENOMINATORS]);
    expect(warnings.some((w) => w.includes('nämnare'))).toBe(true);
  });
});

describe('validateGeometryConfig', () => {
  function baseGeometryConfig(
    overrides: Partial<GeometryGeneratorConfig> = {},
  ): GeometryGeneratorConfig {
    return {
      shape: 'rectangle',
      measure: 'area',
      sideRange: { min: 2, max: 10 },
      showUnits: true,
      count: 12,
      avoidDuplicates: true,
      seed: 1,
      ...overrides,
    };
  }

  it('rätar ut ett negativt antal uppgifter och varnar', () => {
    const { config, warnings } = validateGeometryConfig(baseGeometryConfig({ count: -3 }));
    expect(config.count).toBe(0);
    expect(warnings.some((w) => w.includes('Antalet uppgifter'))).toBe(true);
  });

  it('höjer mått under 1 cm till 1 och varnar — en sida på 0 cm ger ingen figur', () => {
    const { config, warnings } = validateGeometryConfig(
      baseGeometryConfig({ sideRange: { min: -4, max: 0 } }),
    );
    expect(config.sideRange.min).toBeGreaterThanOrEqual(1);
    expect(config.sideRange.max).toBeGreaterThanOrEqual(1);
    expect(warnings.some((w) => w.includes('Måtten'))).toBe(true);
  });

  it('vänder ett omvänt intervall rätt', () => {
    const { config } = validateGeometryConfig(
      baseGeometryConfig({ sideRange: { min: 12, max: 3 } }),
    );
    expect(config.sideRange.min).toBeLessThanOrEqual(config.sideRange.max);
  });

  it('varnar när fler unika uppgifter begärs än inställningarna rymmer', () => {
    const { warnings } = validateGeometryConfig(
      baseGeometryConfig({
        shape: 'circle',
        measure: 'area',
        sideRange: { min: 1, max: 3 },
        count: 40,
      }),
    );
    expect(warnings.some((w) => w.includes('unika uppgifter'))).toBe(true);
  });

  it('varnar inte för en rimlig konfiguration', () => {
    const { warnings } = validateGeometryConfig(baseGeometryConfig());
    expect(warnings).toEqual([]);
  });
});

describe('validatePatternConfig', () => {
  function basePatternConfig(
    overrides: Partial<PatternGeneratorConfig> = {},
  ): PatternGeneratorConfig {
    return {
      startRange: { min: 0, max: 20 },
      steps: [1, 2],
      allowDescending: false,
      termCount: 6,
      hiddenCount: 2,
      count: 10,
      avoidDuplicates: true,
      seed: 1,
      ...overrides,
    };
  }

  it('rätar ut ett negativt antal uppgifter och varnar', () => {
    const { config, warnings } = validatePatternConfig(basePatternConfig({ count: -3 }));
    expect(config.count).toBe(0);
    expect(warnings.some((w) => w.includes('Antalet uppgifter'))).toBe(true);
  });

  it('faller tillbaka till steget [1] och varnar när ingen är ikryssad', () => {
    const { config, warnings } = validatePatternConfig(basePatternConfig({ steps: [] }));
    expect(config.steps).toEqual([1]);
    expect(warnings.some((w) => w.includes('steg'))).toBe(true);
  });

  it('höjer termCount till minst 4 och varnar', () => {
    const { config, warnings } = validatePatternConfig(basePatternConfig({ termCount: 2 }));
    expect(config.termCount).toBeGreaterThanOrEqual(4);
    expect(warnings.some((w) => w.includes('termer'))).toBe(true);
  });

  it('klämmer hiddenCount mellan 1 och termCount - 2, och varnar', () => {
    const { config, warnings } = validatePatternConfig(
      basePatternConfig({ termCount: 6, hiddenCount: 99 }),
    );
    expect(config.hiddenCount).toBeLessThanOrEqual(4);
    expect(config.hiddenCount).toBeGreaterThanOrEqual(1);
    expect(warnings.some((w) => w.includes('dolda termer'))).toBe(true);

    const zero = validatePatternConfig(basePatternConfig({ termCount: 6, hiddenCount: 0 }));
    expect(zero.config.hiddenCount).toBeGreaterThanOrEqual(1);
  });

  it('vänder ett omvänt startRange rätt', () => {
    const { config } = validatePatternConfig(
      basePatternConfig({ startRange: { min: 12, max: 3 } }),
    );
    expect(config.startRange.min).toBeLessThanOrEqual(config.startRange.max);
  });

  it('varnar när fler unika talföljder begärs än inställningarna rymmer', () => {
    const { warnings } = validatePatternConfig(
      basePatternConfig({ startRange: { min: 1, max: 3 }, steps: [1], count: 40 }),
    );
    expect(warnings.some((w) => w.includes('unika talföljder'))).toBe(true);
  });

  it('varnar inte för en rimlig konfiguration', () => {
    const { warnings } = validatePatternConfig(basePatternConfig());
    expect(warnings).toEqual([]);
  });
});
