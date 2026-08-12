import type { GeneratorConfig, OperationConfig } from '../src/types';

export function opConfig(overrides: Partial<OperationConfig> = {}): OperationConfig {
  return {
    enabled: false,
    operandRange: { min: 0, max: 10 },
    ...overrides,
  };
}

export function baseConfig(overrides: Partial<GeneratorConfig> = {}): GeneratorConfig {
  return {
    operations: {
      add: opConfig(),
      sub: opConfig(),
      mul: opConfig(),
      div: opConfig(),
    },
    count: 20,
    avoidDuplicates: false,
    shuffle: false,
    missingNumber: false,
    seed: 1,
    ...overrides,
  };
}
