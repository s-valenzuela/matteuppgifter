import type { DocumentConfig, GeneratorConfig, OperationConfig } from '../types';

/**
 * Formulärets tillstånd. `document` saknar `seed` — det speglas alltid från
 * `generator.seed` via {@link toDocumentConfig} i stället för att lagras (och
 * riskera att bli osynkat) på två ställen.
 */
export interface AppState {
  generator: GeneratorConfig;
  document: Omit<DocumentConfig, 'seed'>;
}

export function toDocumentConfig(state: AppState): DocumentConfig {
  return { ...state.document, seed: state.generator.seed };
}

function op(overrides: Partial<OperationConfig> = {}): OperationConfig {
  return {
    enabled: false,
    operandRange: { min: 0, max: 10 },
    ...overrides,
  };
}

export function createDefaultState(): AppState {
  return {
    generator: {
      operations: {
        add: op({ enabled: true, operandRange: { min: 0, max: 20 } }),
        sub: op({ enabled: true, operandRange: { min: 0, max: 20 }, noNegative: true }),
        mul: op({ enabled: false, operandRange: { min: 0, max: 10 } }),
        div: op({ enabled: false, operandRange: { min: 1, max: 10 } }),
      },
      count: 30,
      avoidDuplicates: true,
      shuffle: true,
      seed: randomSeed(),
    },
    document: {
      header: { title: 'Matteuppgifter', showName: true, showDate: true },
      fontSizePt: 14,
      columns: 3,
      layout: 'grid',
      answerStyle: 'blank',
      includeAnswerKey: true,
    },
  };
}

export function randomSeed(): number {
  return Math.floor(Math.random() * 1_000_000);
}
