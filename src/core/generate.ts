import type {
  GeneratorConfig,
  MissingSlot,
  Operation,
  OperationConfig,
  Problem,
  Range,
} from '../types';
import { mulberry32, pick, randomInt, type Rng } from './rng';

/** Tak på omdragningsförsök innan generatorn ger upp och accepterar kandidaten den har. */
const MAX_ATTEMPTS = 500;

export function generateProblems(config: GeneratorConfig): Problem[] {
  const enabledOps = (Object.keys(config.operations) as Operation[]).filter(
    (op) => config.operations[op].enabled,
  );

  if (enabledOps.length === 0 || config.count <= 0) {
    return [];
  }

  const rng = mulberry32(config.seed);
  const assignments = distributeCount(config.count, enabledOps);
  const seen: Partial<Record<Operation, Set<string>>> = {};

  const problems = assignments.map((op) => {
    const opConfig = config.operations[op];
    if (config.avoidDuplicates && !seen[op]) {
      seen[op] = new Set();
    }
    const problem = generateOne(op, opConfig, rng, seen[op]);
    return config.missingNumber
      ? { ...problem, missingSlot: chooseMissingSlot(op, problem, rng) }
      : problem;
  });

  if (config.shuffle) {
    shuffleInPlace(problems, rng);
  }

  return problems;
}

/**
 * Väljer vilken del av uppgiften som ska vara tom i "Saknat tal"-läget
 * (t.ex. "3 + __ = 10" i stället för "3 + 7 = __"). Begränsad per
 * räknesätt så att svaret alltid går att räkna ut entydigt:
 * - division blankar aldrig nämnaren (b) — går kvoten jämnt upp till 0
 *   (eller finns en rest inblandad) blir "a ÷ __ = kvot" inte entydigt
 *   lösbart, till skillnad från att blanka täljaren (alltid a = b*kvot+rest).
 * - multiplikation blankar aldrig en faktor vars motpart är 0 — annars blir
 *   "__ × 0 = 0" olösligt (vilket tal som helst stämmer).
 */
function chooseMissingSlot(op: Operation, problem: Problem, rng: Rng): MissingSlot {
  if (op === 'div') {
    return pick(rng, ['a', 'answer']);
  }
  const candidates: MissingSlot[] = ['a', 'b', 'answer'];
  if (op === 'mul') {
    return pick(
      rng,
      candidates.filter((slot) => {
        if (slot === 'a') return problem.b !== 0;
        if (slot === 'b') return problem.a !== 0;
        return true;
      }),
    );
  }
  return pick(rng, candidates);
}

/** Fördelar `count` uppgifter så jämnt som möjligt över de valda räknesätten. */
function distributeCount(count: number, ops: readonly Operation[]): Operation[] {
  const base = Math.floor(count / ops.length);
  const remainder = count % ops.length;
  const result: Operation[] = [];
  ops.forEach((op, index) => {
    const share = base + (index < remainder ? 1 : 0);
    for (let i = 0; i < share; i++) {
      result.push(op);
    }
  });
  return result;
}

function generateOne(
  op: Operation,
  config: OperationConfig,
  rng: Rng,
  seen: Set<string> | undefined,
): Problem {
  let candidate = generateCandidate(op, config, rng);
  if (!seen) {
    return candidate;
  }

  for (let attempt = 0; attempt < MAX_ATTEMPTS && seen.has(problemKey(candidate)); attempt++) {
    candidate = generateCandidate(op, config, rng);
  }
  // Om mängden möjliga uppgifter är mindre än antalet begärda fylls resten
  // på med upprepningar i stället för att låsa sig i en oändlig loop.
  seen.add(problemKey(candidate));
  return candidate;
}

function problemKey(problem: Problem): string {
  return `${problem.a}:${problem.b}`;
}

/**
 * Drar en kandidat för räknesättet, och drar om (upp till MAX_ATTEMPTS
 * gånger) tills svaret hamnar inom resultRange om en sådan är satt. Gemensam
 * för alla fyra räknesätt i stället för att varje generateX-funktion har sin
 * egen omdragningsloop — resultRange betyder samma sak ("gräns på svaret")
 * oavsett räknesätt.
 */
function generateCandidate(op: Operation, config: OperationConfig, rng: Rng): Problem {
  const resultRange = config.resultRange;
  if (!resultRange) {
    return generateRaw(op, config, rng);
  }

  let candidate = generateRaw(op, config, rng);
  for (
    let attempt = 0;
    attempt < MAX_ATTEMPTS && !withinRange(candidate.answer, resultRange);
    attempt++
  ) {
    candidate = generateRaw(op, config, rng);
  }
  return candidate;
}

function generateRaw(op: Operation, config: OperationConfig, rng: Rng): Problem {
  switch (op) {
    case 'add':
      return generateAddition(config, rng);
    case 'sub':
      return generateSubtraction(config, rng);
    case 'mul':
      return generateMultiplication(config, rng);
    case 'div':
      return generateDivision(config, rng);
  }
}

function generateAddition(config: OperationConfig, rng: Rng): Problem {
  const { min, max } = config.operandRange;
  const a = randomInt(rng, min, max);
  const b = randomInt(rng, min, max);
  return { op: 'add', a, b, answer: a + b, missingSlot: 'answer' };
}

function generateSubtraction(config: OperationConfig, rng: Rng): Problem {
  const { min, max } = config.operandRange;
  let a = randomInt(rng, min, max);
  let b = randomInt(rng, min, max);
  if (config.noNegative && b > a) {
    [a, b] = [b, a];
  }
  return { op: 'sub', a, b, answer: a - b, missingSlot: 'answer' };
}

function generateMultiplication(config: OperationConfig, rng: Rng): Problem {
  const { min, max } = config.operandRange;
  const a =
    config.tables && config.tables.length > 0 ? pick(rng, config.tables) : randomInt(rng, min, max);
  const b = randomInt(rng, min, max);
  return { op: 'mul', a, b, answer: a * b, missingSlot: 'answer' };
}

function generateDivision(config: OperationConfig, rng: Rng): Problem {
  const { min, max } = config.operandRange;
  // Divisorn får aldrig bli 0, oavsett vad talområdet säger.
  const divisorMin = Math.max(min, 1);
  const divisorMax = Math.max(divisorMin, max);
  const divisor = randomInt(rng, divisorMin, divisorMax);
  const quotient = randomInt(rng, min, max);

  let dividend = divisor * quotient;
  let remainder: number | undefined;
  if (config.allowRemainder) {
    remainder = randomInt(rng, 0, divisor - 1);
    dividend += remainder;
  }

  return { op: 'div', a: dividend, b: divisor, answer: quotient, remainder, missingSlot: 'answer' };
}

function withinRange(value: number, range: Range): boolean {
  return value >= range.min && value <= range.max;
}

function shuffleInPlace<T>(values: T[], rng: Rng): void {
  for (let i = values.length - 1; i > 0; i--) {
    const j = randomInt(rng, 0, i);
    [values[i], values[j]] = [values[j], values[i]];
  }
}
