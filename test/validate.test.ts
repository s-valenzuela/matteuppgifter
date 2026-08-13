import { describe, expect, it } from 'vitest';
import { validateClockConfig, validateConfig } from '../src/core/validate';
import type { ClockGeneratorConfig } from '../src/types';
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
