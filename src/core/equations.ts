import type { EquationGeneratorConfig, EquationProblem, Operation, Range } from '../types';
import { mulberry32, pick, randomInt, type Rng } from './rng';

/** Tak på omdragningsförsök innan generatorn ger upp och accepterar kandidaten den har. */
const MAX_ATTEMPTS = 500;

const ALL_OPERATIONS: readonly Operation[] = ['add', 'sub', 'mul', 'div'];

export function generateEquationProblems(config: EquationGeneratorConfig): EquationProblem[] {
  const enabledOps = ALL_OPERATIONS.filter((op) => config.operations[op]);
  if (enabledOps.length === 0 || config.count <= 0) {
    return [];
  }

  const range = normalizeOperandRange(config.operandRange);
  const rng = mulberry32(config.seed);
  const seen = config.avoidDuplicates ? new Set<string>() : undefined;

  const problems: EquationProblem[] = [];
  for (let i = 0; i < config.count; i++) {
    let problem = createProblem(enabledOps, range, config.allowNegative, rng);

    if (seen) {
      let attempt = 0;
      // Samma "fyll på med upprepningar i stället för att hänga"-princip som
      // core/geometry.ts och core/patterns.ts.
      while (seen.has(equationKey(problem)) && attempt < MAX_ATTEMPTS) {
        problem = createProblem(enabledOps, range, config.allowNegative, rng);
        attempt++;
      }
      seen.add(equationKey(problem));
    }

    problems.push(problem);
  }

  return problems;
}

function createProblem(
  enabledOps: readonly Operation[],
  range: Range,
  allowNegative: boolean,
  rng: Rng,
): EquationProblem {
  const op = pick(rng, enabledOps);

  if (op === 'div') {
    // Divisorn får aldrig bli 0. Ingen rest någonsin — en ekvation ska alltid
    // gå att lösa exakt. Det obekanta talet är alltid dividenden (a): att i
    // stället gömma divisorn har samma "inte alltid entydigt lösbart"-problem
    // som chooseMissingSlot undviker för räknesättsbladets "Saknat tal", se
    // core/generate.ts.
    const divisor = randomInt(rng, Math.max(1, range.min), Math.max(1, range.max));
    const quotient = randomInt(rng, range.min, range.max);
    const a = divisor * quotient;
    return { op, a, b: divisor, result: quotient, unknownSlot: 'a' };
  }

  if (op === 'mul') {
    let a = randomInt(rng, range.min, range.max);
    let b = randomInt(rng, range.min, range.max);
    // a=0 OCH b=0 samtidigt gör BÅDA platserna olösliga (se guard nedan) —
    // dras om ett begränsat antal gånger, samma "fyll på med upprepningar i
    // stället för att hänga"-princip som resten av filen.
    for (let attempt = 0; attempt < MAX_ATTEMPTS && a === 0 && b === 0; attempt++) {
      a = randomInt(rng, range.min, range.max);
      b = randomInt(rng, range.min, range.max);
    }
    // Ett obekant tal vars motpart är 0 gör "0 × x = 0" olösligt (vilket tal
    // som helst stämmer) — samma guard som chooseMissingSlot i core/generate.ts.
    const candidates: ('a' | 'b')[] = [];
    if (b !== 0) candidates.push('a');
    if (a !== 0) candidates.push('b');
    const unknownSlot = candidates.length > 0 ? pick(rng, candidates) : 'a';
    return { op, a, b, result: a * b, unknownSlot };
  }

  let a = randomInt(rng, range.min, range.max);
  let b = randomInt(rng, range.min, range.max);
  if (op === 'sub' && !allowNegative && b > a) {
    [a, b] = [b, a];
  }
  const result = op === 'add' ? a + b : a - b;
  const unknownSlot = pick(rng, ['a', 'b'] as const);
  return { op, a, b, result, unknownSlot };
}

/** Det tal eleven ska räkna ut, dvs. värdet på x. */
export function equationAnswer(problem: EquationProblem): number {
  return problem.unknownSlot === 'a' ? problem.a : problem.b;
}

function equationKey(problem: EquationProblem): string {
  return `${problem.op}:${problem.a}:${problem.b}:${problem.unknownSlot}`;
}

/** Talområdet får aldrig sträcka sig under 0 utan allowNegative — men
 * normaliseringen här rätar bara ut ett omvänt intervall, se
 * validateEquationConfig för den faktiska klampningen mot ≥ 1 (division). */
function normalizeOperandRange(range: Range): Range {
  const min = Math.floor(Math.min(range.min, range.max));
  const max = Math.max(min, Math.floor(Math.max(range.min, range.max)));
  return { min, max };
}

/**
 * Grov uppskattning av hur många unika ekvationer de valda inställningarna
 * rymmer, för varningen i validateEquationConfig — samma roll som
 * geometryPoolSize/patternPoolSize.
 */
export function equationPoolSize(config: EquationGeneratorConfig): number {
  const { min, max } = normalizeOperandRange(config.operandRange);
  const size = Math.max(max - min + 1, 1);
  const enabledOps = ALL_OPERATIONS.filter((op) => config.operations[op]);
  // Varje räknesätt: ca size × size kombinationer av a/b, gånger två (vilken
  // operand som är obekant) — en grov men rimlig uppskattning för samtliga
  // fyra räknesätt.
  return Math.max(1, enabledOps.length) * size * size * 2;
}
