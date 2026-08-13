import { clockPoolSize } from './clock';
import { fractionPoolSize, FRACTION_DENOMINATORS } from './fractions';
import type {
  ClockGeneratorConfig,
  ClockStep,
  FractionGeneratorConfig,
  GeneratorConfig,
  Operation,
  OperationConfig,
  Range,
} from '../types';

export interface ValidationResult {
  config: GeneratorConfig;
  warnings: string[];
}

export interface ClockValidationResult {
  config: ClockGeneratorConfig;
  warnings: string[];
}

export interface FractionValidationResult {
  config: FractionGeneratorConfig;
  warnings: string[];
}

/**
 * Normaliserar en GeneratorConfig (rätar ut omvända intervall, rundar av till
 * heltal) och samlar varningar om orimliga val, t.ex. fler unika uppgifter
 * begärda än talområdet rymmer. Generatorn i generate.ts är robust även utan
 * denna normalisering — den kan aldrig hänga — så varningarna är rådgivande.
 */
export function validateConfig(input: GeneratorConfig): ValidationResult {
  const warnings: string[] = [];
  const operations = {} as Record<Operation, OperationConfig>;

  for (const op of Object.keys(input.operations) as Operation[]) {
    operations[op] = normalizeOperationConfig(input.operations[op]);
  }

  const enabledOps = (Object.keys(operations) as Operation[]).filter(
    (op) => operations[op].enabled,
  );
  if (enabledOps.length === 0) {
    warnings.push('Inget räknesätt är valt — inga uppgifter kan genereras.');
  }

  const count = normalizeCount(input.count);
  if (count !== input.count) {
    warnings.push('Antalet uppgifter justerades till ett positivt heltal.');
  }

  if (input.avoidDuplicates && enabledOps.length > 0 && count > 0) {
    const sharePerOperation = Math.ceil(count / enabledOps.length);
    for (const op of enabledOps) {
      const poolSize = estimatePoolSize(op, operations[op]);
      if (poolSize < sharePerOperation) {
        warnings.push(
          `Talområdet för ${operationLabel(op)} rymmer bara ca ${poolSize} unika uppgifter, ` +
            `men ${sharePerOperation} efterfrågas — uppgifter kommer att upprepas.`,
        );
      }
    }
  }

  return {
    config: { ...input, operations, count },
    warnings,
  };
}

/**
 * Motsvarigheten till validateConfig för klockblad — samma idé (räta ut,
 * varna), men mycket enklare eftersom det bara finns en "operation" (steget)
 * att kontrollera poolstorlek för, se core/clock.ts.
 */
export function validateClockConfig(input: ClockGeneratorConfig): ClockValidationResult {
  const warnings: string[] = [];
  const count = normalizeCount(input.count);
  if (count !== input.count) {
    warnings.push('Antalet uppgifter justerades till ett positivt heltal.');
  }

  // Ingen ikryssad grupp går inte att generera uppgifter ifrån — faller
  // tillbaka till "Hel timme" i stället för en tom uppgiftslista.
  const steps: ClockStep[] = input.steps.length > 0 ? input.steps : ['hour'];
  if (steps !== input.steps) {
    warnings.push('Minst en tidsgrupp måste vara ikryssad — "Hel timme" valdes automatiskt.');
  }

  if (input.avoidDuplicates && count > 0) {
    const poolSize = clockPoolSize(steps);
    if (poolSize < count) {
      warnings.push(
        `De ikryssade grupperna rymmer bara ${poolSize} unika klockslag, men ${count} efterfrågas — ` +
          'uppgifter kommer att upprepas.',
      );
    }
  }

  return { config: { ...input, steps, count }, warnings };
}

/** Motsvarigheten till validateClockConfig för bråkblad — samma idé, se
 * kommentaren där. Faller tillbaka till hela FRACTION_DENOMINATORS-listan
 * (i stället för en enda som klockans ['hour']) eftersom det ger en rimlig
 * pool direkt utan att behöva gissa vilken enskild nämnare som är "standard". */
export function validateFractionConfig(input: FractionGeneratorConfig): FractionValidationResult {
  const warnings: string[] = [];
  const count = normalizeCount(input.count);
  if (count !== input.count) {
    warnings.push('Antalet uppgifter justerades till ett positivt heltal.');
  }

  const denominators =
    input.denominators.length > 0 ? input.denominators : [...FRACTION_DENOMINATORS];
  if (denominators !== input.denominators) {
    warnings.push(
      'Minst en nämnare måste vara ikryssad — alla vanliga nämnare valdes automatiskt.',
    );
  }

  if (input.avoidDuplicates && count > 0) {
    const poolSize = fractionPoolSize(denominators, input.shape);
    if (poolSize < count) {
      warnings.push(
        `De ikryssade nämnarna rymmer bara ${poolSize} unika bråk, men ${count} efterfrågas — ` +
          'uppgifter kommer att upprepas.',
      );
    }
  }

  return { config: { ...input, denominators, count }, warnings };
}

function normalizeOperationConfig(config: OperationConfig): OperationConfig {
  return {
    ...config,
    operandRange: normalizeRange(config.operandRange),
    resultRange: config.resultRange ? normalizeRange(config.resultRange) : undefined,
  };
}

function normalizeRange(range: Range): Range {
  return {
    min: Math.floor(Math.min(range.min, range.max)),
    max: Math.ceil(Math.max(range.min, range.max)),
  };
}

function normalizeCount(count: number): number {
  if (!Number.isFinite(count) || count <= 0) {
    return 0;
  }
  return Math.floor(count);
}

/** Grov uppskattning av hur många unika a/b-kombinationer räknesättet kan ge. */
function estimatePoolSize(op: Operation, config: OperationConfig): number {
  const { min, max } = config.operandRange;
  const size = Math.max(max - min + 1, 0);

  switch (op) {
    case 'add':
    case 'sub':
      return size * size;
    case 'mul':
      return config.tables && config.tables.length > 0 ? config.tables.length * size : size * size;
    case 'div': {
      const divisorMin = Math.max(min, 1);
      const divisorSize = Math.max(max - divisorMin + 1, 0);
      return divisorSize * size;
    }
  }
}

function operationLabel(op: Operation): string {
  switch (op) {
    case 'add':
      return 'addition';
    case 'sub':
      return 'subtraktion';
    case 'mul':
      return 'multiplikation';
    case 'div':
      return 'division';
  }
}
