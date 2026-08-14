import type {
  MeasurementGeneratorConfig,
  MeasurementProblem,
  MeasurementQuantity,
  MeasurementQuantityMode,
  Range,
} from '../types';
import { formatDecimal1 } from './numberFormat';
import { mulberry32, pick, randomInt, type Rng } from './rng';

/** Tak på omdragningsförsök innan generatorn ger upp och accepterar kandidaten den har. */
const MAX_ATTEMPTS = 500;

interface UnitDef {
  symbol: string;
  /** Hur många av storhetens FINASTE enhet en av den här enheten motsvarar. */
  factor: number;
}

/**
 * Varje tabell är sorterad finaste enhet först. Bara GRANNAR i tabellen
 * (index i, i+1) paras ihop i en uppgift — "byt ett steg i taget" (cm↔dm,
 * inte mm↔km) — vilket håller talen rimliga och matchar hur enhetsbyten
 * faktiskt övas i skolan. Alla metriska tabeller är tiopotenser, så en
 * omräkning mellan grannar är alltid exakt; tidstabellen är ×60 mellan varje
 * steg och kan därför genuint behöva avrundas, se createProblem.
 */
const LENGTH_UNITS: readonly UnitDef[] = [
  { symbol: 'mm', factor: 1 },
  { symbol: 'cm', factor: 10 },
  { symbol: 'dm', factor: 100 },
  { symbol: 'm', factor: 1000 },
  { symbol: 'km', factor: 1_000_000 },
];
const MASS_UNITS: readonly UnitDef[] = [
  { symbol: 'g', factor: 1 },
  { symbol: 'hg', factor: 100 },
  { symbol: 'kg', factor: 1000 },
];
const VOLUME_UNITS: readonly UnitDef[] = [
  { symbol: 'ml', factor: 1 },
  { symbol: 'cl', factor: 10 },
  { symbol: 'dl', factor: 100 },
  { symbol: 'l', factor: 1000 },
];
const TIME_UNITS: readonly UnitDef[] = [
  { symbol: 's', factor: 1 },
  { symbol: 'min', factor: 60 },
  { symbol: 'h', factor: 3600 },
];

const QUANTITY_UNITS: Record<MeasurementQuantity, readonly UnitDef[]> = {
  length: LENGTH_UNITS,
  mass: MASS_UNITS,
  volume: VOLUME_UNITS,
  time: TIME_UNITS,
};

const ALL_QUANTITIES: readonly MeasurementQuantity[] = ['length', 'mass', 'volume', 'time'];

export function generateMeasurementProblems(
  config: MeasurementGeneratorConfig,
): MeasurementProblem[] {
  if (config.count <= 0) {
    return [];
  }

  const range = normalizeValueRange(config.valueRange);
  const rng = mulberry32(config.seed);
  const seen = config.avoidDuplicates ? new Set<string>() : undefined;

  const problems: MeasurementProblem[] = [];
  for (let i = 0; i < config.count; i++) {
    let problem = createProblem(config.quantity, range, rng);

    if (seen) {
      let attempt = 0;
      // Samma "fyll på med upprepningar i stället för att hänga"-princip som
      // core/geometry.ts och core/patterns.ts.
      while (seen.has(measurementKey(problem)) && attempt < MAX_ATTEMPTS) {
        problem = createProblem(config.quantity, range, rng);
        attempt++;
      }
      seen.add(measurementKey(problem));
    }

    problems.push(problem);
  }

  return problems;
}

/**
 * Slumpar VILKEN riktning uppgiften ställs i (fint→grovt eller grovt→fint),
 * inte bara vilka enheter — annars skulle den givna siffran alltid komma
 * från samma håll. `fromValue` dras alltid som ett heltal i det konfigurerade
 * talområdet, oavsett vilken av de två enheterna den råkar gälla — det är
 * det TALET som ska kännas rimligt för eleven, inte en specifik enhet.
 *
 * fint→grovt: svaret (i den grövre enheten) kan bli ett avrundat värde (för
 * tid: 100 s ≈ 1,7 min) — ärligt markerat med "~", se formatDecimal1.
 * grovt→fint: svaret är alltid EXAKT (en multiplikation, aldrig en division),
 * så det finns aldrig något att runda där.
 */
function createProblem(mode: MeasurementQuantityMode, range: Range, rng: Rng): MeasurementProblem {
  const quantity = resolveQuantity(mode, rng);
  const units = QUANTITY_UNITS[quantity];
  const pairIndex = randomInt(rng, 0, units.length - 2);
  const fineUnit = units[pairIndex];
  const coarseUnit = units[pairIndex + 1];
  const ratio = coarseUnit.factor / fineUnit.factor;

  const fromValue = randomInt(rng, range.min, range.max);

  if (rng() < 0.5) {
    const answerValue = fromValue / ratio;
    return {
      quantity,
      fromValue,
      fromUnit: fineUnit.symbol,
      toUnit: coarseUnit.symbol,
      answerText: formatDecimal1(answerValue),
    };
  }

  const answerValue = fromValue * ratio;
  return {
    quantity,
    fromValue,
    fromUnit: coarseUnit.symbol,
    toUnit: fineUnit.symbol,
    answerText: formatDecimal1(answerValue),
  };
}

function resolveQuantity(mode: MeasurementQuantityMode, rng: Rng): MeasurementQuantity {
  return mode === 'mixed' ? pick(rng, ALL_QUANTITIES) : mode;
}

function measurementKey(problem: MeasurementProblem): string {
  return `${problem.quantity}:${problem.fromUnit}:${problem.toUnit}:${problem.fromValue}`;
}

/** Talområdet måste vara positiva heltal — validateMeasurementConfig varnar;
 * här rätas det bara ut, samma princip som normalizeSideRange i
 * core/geometry.ts. */
function normalizeValueRange(range: Range): Range {
  const min = Math.max(1, Math.floor(Math.min(range.min, range.max)));
  const max = Math.max(min, Math.floor(Math.max(range.min, range.max)));
  return { min, max };
}

/**
 * Grov uppskattning av hur många unika uppgifter de valda inställningarna
 * rymmer, för varningen i validateMeasurementConfig — samma roll som
 * geometryPoolSize/patternPoolSize/equationPoolSize.
 */
export function measurementPoolSize(config: MeasurementGeneratorConfig): number {
  const { min, max } = normalizeValueRange(config.valueRange);
  const size = max - min + 1;
  const quantities = config.quantity === 'mixed' ? ALL_QUANTITIES : [config.quantity];

  let total = 0;
  for (const quantity of quantities) {
    const unitPairs = QUANTITY_UNITS[quantity].length - 1;
    // Två riktningar (fint→grovt, grovt→fint) per enhetspar.
    total += unitPairs * 2 * size;
  }
  return total;
}
