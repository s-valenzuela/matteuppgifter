import type {
  GeometryGeneratorConfig,
  GeometryMeasure,
  GeometryMeasureMode,
  GeometryProblem,
  GeometryShape,
  GeometryShapeMode,
  Range,
} from '../types';
import { mulberry32, pick, randomInt, type Rng } from './rng';

/** Tak på omdragningsförsök innan generatorn ger upp och accepterar kandidaten den har. */
const MAX_ATTEMPTS = 500;

/**
 * Pi som ELEVEN räknar med, inte Math.PI. Facit måste stämma med det en elev
 * får när den räknar för hand med 3,14 — hade vi räknat med Math.PI skulle
 * facit avvika från elevens svar i sista decimalen och se ut som ett fel.
 *
 * Själva tecknet π (U+03C0) skrivs ALDRIG ut i PDF:en: jsPDF:s inbyggda
 * Helvetica stöder bara WinAnsi, där π saknas och renderas som rappakalja —
 * samma fälla som redan gällt − (U+2212) i pdf/format.ts och ≈ (U+2248) i
 * formatFractionPercent. Skriv "3,14" i stället.
 */
export const PI_APPROX = 3.14;

/**
 * Primitiva pythagoreiska tripplar (a² + b² = c²), sorterade med kortaste
 * katet först. Används för OMKRETS-trianglar, där alla tre sidorna måste vara
 * kända och gärna heltal — se GeometryProblem i types.ts. Multiplar av dessa
 * (2×, 3×, ...) ger fler storlekar utan att lämna heltalen.
 *
 * Att arean också alltid blir ett heltal är ingen slump: i varje pythagoreisk
 * trippel är minst en katet jämn, så a×b/2 går alltid jämnt ut.
 */
export const PYTHAGOREAN_TRIPLES: readonly (readonly [number, number, number])[] = [
  [3, 4, 5],
  [5, 12, 13],
  [8, 15, 17],
  [7, 24, 25],
  [20, 21, 29],
];

const GEOMETRY_SHAPES: readonly GeometryShape[] = ['rectangle', 'triangle', 'circle'];
const GEOMETRY_MEASURES: readonly GeometryMeasure[] = ['area', 'perimeter'];

export function generateGeometryProblems(config: GeometryGeneratorConfig): GeometryProblem[] {
  if (config.count <= 0) {
    return [];
  }

  const range = normalizeSideRange(config.sideRange);
  const rng = mulberry32(config.seed);
  const seen = config.avoidDuplicates ? new Set<string>() : undefined;

  const problems: GeometryProblem[] = [];
  for (let i = 0; i < config.count; i++) {
    let problem = createProblem(config, range, rng);

    if (seen) {
      let attempt = 0;
      // Samma "fyll på med upprepningar i stället för att hänga"-princip som
      // core/fractions.ts och core/clock.ts.
      while (seen.has(geometryKey(problem)) && attempt < MAX_ATTEMPTS) {
        problem = createProblem(config, range, rng);
        attempt++;
      }
      seen.add(geometryKey(problem));
    }

    problems.push(problem);
  }

  return problems;
}

function createProblem(config: GeometryGeneratorConfig, range: Range, rng: Rng): GeometryProblem {
  const shape = resolveShape(config.shape, rng);
  const measure = resolveMeasure(config.measure, rng);

  switch (shape) {
    case 'rectangle':
      return {
        shape,
        measure,
        widthCm: randomInt(rng, range.min, range.max),
        heightCm: randomInt(rng, range.min, range.max),
      };
    case 'circle':
      return { shape, measure, radiusCm: randomInt(rng, range.min, range.max) };
    case 'triangle':
      return measure === 'perimeter'
        ? { shape, measure, sidesCm: pickTriangleSides(range, rng) }
        : pickAreaTriangle(range, rng);
  }
}

/**
 * En pythagoreisk trippel skalad så att den största sidan får plats inom
 * talområdet — annars skulle ett litet område (t.ex. 2–10) bara kunna ge
 * 3-4-5 och alla omkretstrianglar bli identiska. Skalan klamras till minst 1
 * så att ett riktigt smalt område fortfarande ger en giltig triangel, även om
 * den då sticker utanför området.
 */
function pickTriangleSides(range: Range, rng: Rng): [number, number, number] {
  const triple = pick(rng, PYTHAGOREAN_TRIPLES);
  const maxScale = Math.max(1, Math.floor(range.max / triple[2]));
  const scale = randomInt(rng, 1, maxScale);
  return [triple[0] * scale, triple[1] * scale, triple[2] * scale];
}

/**
 * Bas och höjd med produkten JÄMN, så att bas×höjd/2 blir ett heltal —
 * annars skulle areasvaret bli ett halvtal (t.ex. 7×5/2 = 17,5) mitt bland
 * de andra figurernas heltalssvar. Om båda råkar bli udda justeras höjden ett
 * steg, inom området.
 */
function pickAreaTriangle(range: Range, rng: Rng): GeometryProblem {
  const baseCm = randomInt(rng, range.min, range.max);
  let heightCm = randomInt(rng, range.min, range.max);
  if ((baseCm * heightCm) % 2 !== 0) {
    heightCm = heightCm < range.max ? heightCm + 1 : heightCm - 1;
  }
  return { shape: 'triangle', measure: 'area', baseCm, heightCm: Math.max(1, heightCm) };
}

/** Måtten måste vara positiva heltal — en sida på 0 cm ger en figur utan
 * utsträckning. validateGeometryConfig varnar; här rätas det bara ut så att
 * generatorn aldrig kan producera något orimligt. */
function normalizeSideRange(range: Range): Range {
  const min = Math.max(1, Math.floor(Math.min(range.min, range.max)));
  const max = Math.max(min, Math.floor(Math.max(range.min, range.max)));
  return { min, max };
}

function resolveShape(mode: GeometryShapeMode, rng: Rng): GeometryShape {
  return mode === 'mixed' ? pick(rng, GEOMETRY_SHAPES) : mode;
}

function resolveMeasure(mode: GeometryMeasureMode, rng: Rng): GeometryMeasure {
  return mode === 'mixed' ? pick(rng, GEOMETRY_MEASURES) : mode;
}

function geometryKey(problem: GeometryProblem): string {
  switch (problem.shape) {
    case 'rectangle':
      return `rect:${problem.measure}:${problem.widthCm}x${problem.heightCm}`;
    case 'circle':
      return `circle:${problem.measure}:${problem.radiusCm}`;
    case 'triangle':
      return problem.measure === 'area'
        ? `tri:area:${problem.baseCm}x${problem.heightCm}`
        : `tri:perimeter:${problem.sidesCm.join('-')}`;
  }
}

/**
 * Grov uppskattning av hur många unika uppgifter de valda inställningarna
 * rymmer, för varningen i validateGeometryConfig — samma roll som
 * fractionPoolSize/clockPoolSize.
 */
export function geometryPoolSize(config: GeometryGeneratorConfig): number {
  const { min, max } = normalizeSideRange(config.sideRange);
  const size = max - min + 1;
  const shapes: readonly GeometryShape[] =
    config.shape === 'mixed' ? GEOMETRY_SHAPES : [config.shape];
  const measures: readonly GeometryMeasure[] =
    config.measure === 'mixed' ? GEOMETRY_MEASURES : [config.measure];

  let total = 0;
  for (const shape of shapes) {
    for (const measure of measures) {
      switch (shape) {
        case 'rectangle':
          // Bredd × höjd, men w×h och h×w räknas som samma figur vriden.
          total += Math.ceil((size * size) / 2);
          break;
        case 'circle':
          total += size;
          break;
        case 'triangle':
          total +=
            measure === 'perimeter'
              ? PYTHAGOREAN_TRIPLES.reduce(
                  (sum, triple) => sum + Math.max(1, Math.floor(max / triple[2])),
                  0,
                )
              : Math.ceil((size * size) / 2);
          break;
      }
    }
  }
  return total;
}

/** Det EXAKTA svaret (räknat med PI_APPROX för cirklar), oavrundat — se
 * formatGeometryValue för hur det skrivs ut. */
export function geometryAnswer(problem: GeometryProblem): number {
  switch (problem.shape) {
    case 'rectangle':
      return problem.measure === 'area'
        ? problem.widthCm * problem.heightCm
        : 2 * (problem.widthCm + problem.heightCm);
    case 'circle':
      return problem.measure === 'area'
        ? PI_APPROX * problem.radiusCm * problem.radiusCm
        : 2 * PI_APPROX * problem.radiusCm;
    case 'triangle':
      return problem.measure === 'area'
        ? (problem.baseCm * problem.heightCm) / 2
        : problem.sidesCm[0] + problem.sidesCm[1] + problem.sidesCm[2];
  }
}

/** Hur nära ett avrundat värde måste ligga det exakta för att räknas som
 * exakt. 3,14 × 9 blir 28.259999999999998 i flyttal, så en rak !== -jämförelse
 * skulle stämpla även exakta svar som avrundade. */
const EXACTNESS_EPSILON = 1e-9;

/**
 * T.ex. "24" (heltal), "28,3" (avrundat, med ~ eftersom avrundningen tappar
 * information) eller "314" (cirkel som råkar gå jämnt ut). Decimalkomma, inte
 * punkt — bladen är på svenska. "~" i stället för "≈" av samma skäl som i
 * formatFractionPercent: ≈ saknas i jsPDF:s WinAnsi-kodning.
 */
export function formatGeometryValue(value: number): string {
  const rounded = Math.round(value * 10) / 10;
  const isExact = Math.abs(rounded - value) < EXACTNESS_EPSILON;
  const text = Number.isInteger(rounded) ? String(rounded) : String(rounded).replace('.', ',');
  return isExact ? text : `~${text}`;
}

/** Enheten svaret ska ha: cm för omkrets (en längd), cm² för area (en yta). */
export function geometryUnit(measure: GeometryMeasure): string {
  return measure === 'area' ? 'cm²' : 'cm';
}

/** Etiketten framför svarsfältet, t.ex. "Area = " — behövs särskilt i
 * 'mixed'-läget, där uppgifterna växlar mellan area och omkrets. */
export function geometryMeasureLabel(measure: GeometryMeasure): string {
  return measure === 'area' ? 'Area' : 'Omkrets';
}
