import type { GeneratorConfig, Operation, OperationConfig, Problem, Range } from '../types';
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
    return generateOne(op, opConfig, rng, seen[op]);
  });

  if (config.shuffle) {
    shuffleInPlace(problems, rng);
  }

  return problems;
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

function generateCandidate(op: Operation, config: OperationConfig, rng: Rng): Problem {
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
  const resultRange = config.resultRange;

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const a = randomInt(rng, min, max);
    const b = randomInt(rng, min, max);
    const answer = a + b;
    if (!resultRange || withinRange(answer, resultRange)) {
      return { op: 'add', a, b, answer };
    }
  }

  const a = randomInt(rng, min, max);
  const b = randomInt(rng, min, max);
  return { op: 'add', a, b, answer: a + b };
}

function generateSubtraction(config: OperationConfig, rng: Rng): Problem {
  const { min, max } = config.operandRange;
  let a = randomInt(rng, min, max);
  let b = randomInt(rng, min, max);
  if (config.noNegative && b > a) {
    [a, b] = [b, a];
  }
  return { op: 'sub', a, b, answer: a - b };
}

function generateMultiplication(config: OperationConfig, rng: Rng): Problem {
  const { min, max } = config.operandRange;
  const a =
    config.tables && config.tables.length > 0 ? pick(rng, config.tables) : randomInt(rng, min, max);
  const b = randomInt(rng, min, max);
  return { op: 'mul', a, b, answer: a * b };
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

  return { op: 'div', a: dividend, b: divisor, answer: quotient, remainder };
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
