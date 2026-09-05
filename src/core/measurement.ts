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

export const MEASUREMENT_QUANTITIES: readonly MeasurementQuantity[] = [
  'length',
  'mass',
  'volume',
  'time',
];

/** Enhetssymbolerna per storhet, i samma ordning (finaste enhet först) som
 * QUANTITY_UNITS — exporteras för att bygga kryssrutorna i ui/form.ts och
 * standardvalet (alla enheter ikryssade) i ui/state.ts. */
export const MEASUREMENT_UNITS: Record<MeasurementQuantity, readonly string[]> = {
  length: LENGTH_UNITS.map((u) => u.symbol),
  mass: MASS_UNITS.map((u) => u.symbol),
  volume: VOLUME_UNITS.map((u) => u.symbol),
  time: TIME_UNITS.map((u) => u.symbol),
};

export function generateMeasurementProblems(
  config: MeasurementGeneratorConfig,
): MeasurementProblem[] {
  if (config.count <= 0) {
    return [];
  }

  const range = normalizeValueRange(config.valueRange);
  const usable = resolveUsableQuantities(config);
  if (Object.keys(usable).length === 0) {
    return [];
  }

  const rng = mulberry32(config.seed);
  const seen = config.avoidDuplicates ? new Set<string>() : undefined;

  const problems: MeasurementProblem[] = [];
  for (let i = 0; i < config.count; i++) {
    let problem = createProblem(config.quantity, usable, range, rng);

    if (seen) {
      let attempt = 0;
      // Samma "fyll på med upprepningar i stället för att hänga"-princip som
      // core/geometry.ts och core/patterns.ts.
      while (seen.has(measurementKey(problem)) && attempt < MAX_ATTEMPTS) {
        problem = createProblem(config.quantity, usable, range, rng);
        attempt++;
      }
      seen.add(measurementKey(problem));
    }

    problems.push(problem);
  }

  return problems;
}

/**
 * De storheter som faktiskt går att generera uppgifter för, utifrån
 * config.units filtrerat mot MEASUREMENT_UNITS — en storhet med färre än två
 * kvarvarande enheter kan inte bilda något par och hoppas därför över här.
 * Robust även om validateMeasurementConfig av någon anledning inte redan
 * rättat till det (se generateClockProblems för samma "hoppa över tomma
 * pooler i stället för att krascha"-princip).
 */
function resolveUsableQuantities(
  config: MeasurementGeneratorConfig,
): Partial<Record<MeasurementQuantity, readonly UnitDef[]>> {
  const wanted = config.quantity === 'mixed' ? MEASUREMENT_QUANTITIES : [config.quantity];
  const result: Partial<Record<MeasurementQuantity, readonly UnitDef[]>> = {};
  for (const quantity of wanted) {
    const allowed = new Set(config.units[quantity]);
    const filtered = QUANTITY_UNITS[quantity].filter((u) => allowed.has(u.symbol));
    if (filtered.length >= 2) {
      result[quantity] = filtered;
    }
  }
  return result;
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
function createProblem(
  mode: MeasurementQuantityMode,
  usable: Partial<Record<MeasurementQuantity, readonly UnitDef[]>>,
  range: Range,
  rng: Rng,
): MeasurementProblem {
  const quantity = resolveQuantity(mode, usable, rng);
  const units = usable[quantity]!;
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

function resolveQuantity(
  mode: MeasurementQuantityMode,
  usable: Partial<Record<MeasurementQuantity, readonly UnitDef[]>>,
  rng: Rng,
): MeasurementQuantity {
  return mode === 'mixed'
    ? pick(rng, Object.keys(usable) as MeasurementQuantity[])
    : (mode as MeasurementQuantity);
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
  const usable = resolveUsableQuantities(config);

  let total = 0;
  for (const units of Object.values(usable)) {
    const unitPairs = units.length - 1;
    // Två riktningar (fint→grovt, grovt→fint) per enhetspar.
    total += unitPairs * 2 * size;
  }
  return total;
}
