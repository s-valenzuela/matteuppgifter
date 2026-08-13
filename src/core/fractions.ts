import type {
  FractionDirection,
  FractionDirectionMode,
  FractionGeneratorConfig,
  FractionProblem,
  FractionShape,
  FractionShapeMode,
} from '../types';
import { mulberry32, pick, randomInt, type Rng } from './rng';

/** Tak på omdragningsförsök innan generatorn ger upp och accepterar kandidaten den har. */
const MAX_ATTEMPTS = 500;

/**
 * De nämnare eleven kan kryssa i, se ui/form.ts. Begränsad till ett
 * pedagogiskt vanligt urval (inte alla tal 2–12) — udda nämnare som 7, 9, 11
 * är svåra att både rita snyggt och räkna ut i huvudet för yngre elever.
 */
export const FRACTION_DENOMINATORS: readonly number[] = [2, 3, 4, 5, 6, 8, 10, 12];

/** Hur många unika (form, täljare, nämnare)-kombinationer de ikryssade
 * nämnarna och den valda formen rymmer. 'mixed' form räknas som två
 * (cirkel och stapel), precis som 'mixed' riktning i clock.ts inte påverkar
 * poolstorleken (riktning är bara en rendering av samma tal). */
export function fractionPoolSize(
  denominators: readonly number[],
  shape: FractionShapeMode,
): number {
  const shapeCount = shape === 'mixed' ? 2 : 1;
  const properFractionsPerDenominator = denominators.reduce((sum, d) => sum + (d - 1), 0);
  return shapeCount * properFractionsPerDenominator;
}

export function generateFractionProblems(config: FractionGeneratorConfig): FractionProblem[] {
  if (config.count <= 0 || config.denominators.length === 0) {
    return [];
  }

  const rng = mulberry32(config.seed);
  const seen = config.avoidDuplicates ? new Set<string>() : undefined;

  const problems: FractionProblem[] = [];
  for (let i = 0; i < config.count; i++) {
    let shape = resolveShape(config.shape, rng);
    let denominator = pick(rng, config.denominators);
    let numerator = randomInt(rng, 1, denominator - 1);

    if (seen) {
      let attempt = 0;
      // Samma "fyll på med upprepningar i stället för att hänga"-princip som
      // core/clock.ts och core/generate.ts.
      while (seen.has(fractionKey(shape, numerator, denominator)) && attempt < MAX_ATTEMPTS) {
        shape = resolveShape(config.shape, rng);
        denominator = pick(rng, config.denominators);
        numerator = randomInt(rng, 1, denominator - 1);
        attempt++;
      }
      seen.add(fractionKey(shape, numerator, denominator));
    }

    problems.push({
      numerator,
      denominator,
      shape,
      direction: resolveDirection(config.direction, rng),
    });
  }

  return problems;
}

function fractionKey(shape: FractionShape, numerator: number, denominator: number): string {
  return `${shape}:${numerator}/${denominator}`;
}

function resolveShape(mode: FractionShapeMode, rng: Rng): FractionShape {
  return mode === 'mixed' ? pick(rng, ['circle', 'bar']) : mode;
}

function resolveDirection(mode: FractionDirectionMode, rng: Rng): FractionDirection {
  return mode === 'mixed' ? pick(rng, ['identify', 'shade']) : mode;
}
