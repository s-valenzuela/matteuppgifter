import { describe, expect, it } from 'vitest';
import { validateConfig } from '../src/core/validate';
import { baseConfig, opConfig } from './helpers';

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
