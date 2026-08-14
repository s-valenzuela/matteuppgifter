import { clockPoolSize } from './clock';
import { equationPoolSize } from './equations';
import { fractionPoolSize, FRACTION_DENOMINATORS } from './fractions';
import { geometryPoolSize } from './geometry';
import { measurementPoolSize } from './measurement';
import { patternPoolSize } from './patterns';
import type {
  ClockGeneratorConfig,
  ClockStep,
  EquationGeneratorConfig,
  FractionGeneratorConfig,
  GeneratorConfig,
  GeometryGeneratorConfig,
  MeasurementGeneratorConfig,
  Operation,
  OperationConfig,
  PatternGeneratorConfig,
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

export interface GeometryValidationResult {
  config: GeometryGeneratorConfig;
  warnings: string[];
}

export interface PatternValidationResult {
  config: PatternGeneratorConfig;
  warnings: string[];
}

export interface EquationValidationResult {
  config: EquationGeneratorConfig;
  warnings: string[];
}

export interface MeasurementValidationResult {
  config: MeasurementGeneratorConfig;
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

/** Motsvarigheten till validateFractionConfig för geometriblad — se
 * kommentaren där. Måtten måste vara positiva heltal: en sida på 0 cm ger en
 * figur utan utsträckning, och negativa mått är inte meningsfulla alls. */
export function validateGeometryConfig(input: GeometryGeneratorConfig): GeometryValidationResult {
  const warnings: string[] = [];
  const count = normalizeCount(input.count);
  if (count !== input.count) {
    warnings.push('Antalet uppgifter justerades till ett positivt heltal.');
  }

  const normalized = normalizeRange(input.sideRange);
  const sideRange: Range = { min: Math.max(1, normalized.min), max: Math.max(1, normalized.max) };
  if (sideRange.min !== input.sideRange.min || sideRange.max !== input.sideRange.max) {
    warnings.push('Måtten justerades till positiva heltal (minst 1 cm).');
  }

  const config: GeometryGeneratorConfig = { ...input, sideRange, count };

  if (input.avoidDuplicates && count > 0) {
    const poolSize = geometryPoolSize(config);
    if (poolSize < count) {
      warnings.push(
        `De valda inställningarna rymmer bara ca ${poolSize} unika uppgifter, men ${count} ` +
          'efterfrågas — uppgifter kommer att upprepas.',
      );
    }
  }

  return { config, warnings };
}

/** Motsvarigheten till validateGeometryConfig för mönsterblad — se
 * kommentaren där. Termerna 0 och 1 är alltid synliga (se
 * core/patterns.ts), så termCount måste rymma minst 2 dolda platser utöver
 * dem och hiddenCount får aldrig överstiga det. */
export function validatePatternConfig(input: PatternGeneratorConfig): PatternValidationResult {
  const warnings: string[] = [];
  const count = normalizeCount(input.count);
  if (count !== input.count) {
    warnings.push('Antalet uppgifter justerades till ett positivt heltal.');
  }

  const startRange = normalizeRange(input.startRange);

  const steps = input.steps.length > 0 ? input.steps : [1];
  if (steps !== input.steps) {
    warnings.push('Minst ett steg måste vara ikryssat — steget 1 valdes automatiskt.');
  }

  const termCount = Math.max(4, Math.floor(input.termCount));
  if (termCount !== input.termCount) {
    warnings.push('Antalet termer justerades till minst 4.');
  }

  const maxHidden = Math.max(1, termCount - 2);
  const hiddenCount = Math.min(Math.max(1, Math.floor(input.hiddenCount)), maxHidden);
  if (hiddenCount !== input.hiddenCount) {
    warnings.push(`Antalet dolda termer justerades till mellan 1 och ${maxHidden}.`);
  }

  const config: PatternGeneratorConfig = {
    ...input,
    startRange,
    steps,
    termCount,
    hiddenCount,
    count,
  };

  if (input.avoidDuplicates && count > 0) {
    const poolSize = patternPoolSize(config);
    if (poolSize < count) {
      warnings.push(
        `De valda inställningarna rymmer bara ca ${poolSize} unika talföljder, men ${count} ` +
          'efterfrågas — uppgifter kommer att upprepas.',
      );
    }
  }

  return { config, warnings };
}

/** Motsvarigheten till validateGeometryConfig för ekvationsblad — se
 * kommentaren där. operandRange klampas till ≥ 1 (inte ≥ 0) eftersom
 * division alltid behöver en divisor skild från 0, se core/equations.ts. */
export function validateEquationConfig(input: EquationGeneratorConfig): EquationValidationResult {
  const warnings: string[] = [];
  const count = normalizeCount(input.count);
  if (count !== input.count) {
    warnings.push('Antalet uppgifter justerades till ett positivt heltal.');
  }

  const enabledOps = (Object.keys(input.operations) as Operation[]).filter(
    (op) => input.operations[op],
  );
  const operations =
    enabledOps.length > 0 ? input.operations : { add: true, sub: false, mul: false, div: false };
  if (enabledOps.length === 0) {
    warnings.push('Inget räknesätt är valt — addition valdes automatiskt.');
  }

  const normalized = normalizeRange(input.operandRange);
  const operandRange: Range = {
    min: Math.max(1, normalized.min),
    max: Math.max(1, normalized.max),
  };
  if (operandRange.min !== input.operandRange.min || operandRange.max !== input.operandRange.max) {
    warnings.push('Talområdet justerades till positiva heltal (minst 1).');
  }

  const config: EquationGeneratorConfig = { ...input, operations, operandRange, count };

  if (input.avoidDuplicates && count > 0) {
    const poolSize = equationPoolSize(config);
    if (poolSize < count) {
      warnings.push(
        `De valda inställningarna rymmer bara ca ${poolSize} unika ekvationer, men ${count} ` +
          'efterfrågas — uppgifter kommer att upprepas.',
      );
    }
  }

  return { config, warnings };
}

/** Motsvarigheten till validateGeometryConfig för enhetsbytesblad — se
 * kommentaren där. valueRange klampas till ≥ 1 (inte ≥ 0) av samma skäl som
 * geometrins sideRange: en given siffra på 0 är inte en meningsfull
 * mätning. */
export function validateMeasurementConfig(
  input: MeasurementGeneratorConfig,
): MeasurementValidationResult {
  const warnings: string[] = [];
  const count = normalizeCount(input.count);
  if (count !== input.count) {
    warnings.push('Antalet uppgifter justerades till ett positivt heltal.');
  }

  const normalized = normalizeRange(input.valueRange);
  const valueRange: Range = { min: Math.max(1, normalized.min), max: Math.max(1, normalized.max) };
  if (valueRange.min !== input.valueRange.min || valueRange.max !== input.valueRange.max) {
    warnings.push('Talområdet justerades till positiva heltal (minst 1).');
  }

  const config: MeasurementGeneratorConfig = { ...input, valueRange, count };

  if (input.avoidDuplicates && count > 0) {
    const poolSize = measurementPoolSize(config);
    if (poolSize < count) {
      warnings.push(
        `De valda inställningarna rymmer bara ca ${poolSize} unika uppgifter, men ${count} ` +
          'efterfrågas — uppgifter kommer att upprepas.',
      );
    }
  }

  return { config, warnings };
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
