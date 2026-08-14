import type { PatternGeneratorConfig, PatternProblem, Range } from '../types';
import { mulberry32, pick, randomInt, type Rng } from './rng';

/** Tak på omdragningsförsök innan generatorn ger upp och accepterar kandidaten den har. */
const MAX_ATTEMPTS = 500;

/** Termerna med lägst index (0 och 1) är alltid synliga — se PatternProblem. */
const ANCHOR_TERM_COUNT = 2;

export function generatePatternProblems(config: PatternGeneratorConfig): PatternProblem[] {
  if (config.count <= 0) {
    return [];
  }

  const startRange = normalizeStartRange(config.startRange);
  const steps = config.steps.length > 0 ? config.steps : [1];
  const termCount = Math.max(4, Math.floor(config.termCount));
  const hiddenCount = clampHiddenCount(config.hiddenCount, termCount);
  const rng = mulberry32(config.seed);
  const seen = config.avoidDuplicates ? new Set<string>() : undefined;

  const problems: PatternProblem[] = [];
  for (let i = 0; i < config.count; i++) {
    let problem = createProblem(
      startRange,
      steps,
      config.allowDescending,
      termCount,
      hiddenCount,
      rng,
    );

    if (seen) {
      let attempt = 0;
      // Samma "fyll på med upprepningar i stället för att hänga"-princip som
      // core/geometry.ts och core/fractions.ts.
      while (seen.has(patternKey(problem)) && attempt < MAX_ATTEMPTS) {
        problem = createProblem(
          startRange,
          steps,
          config.allowDescending,
          termCount,
          hiddenCount,
          rng,
        );
        attempt++;
      }
      seen.add(patternKey(problem));
    }

    problems.push(problem);
  }

  return problems;
}

function createProblem(
  startRange: Range,
  steps: number[],
  allowDescending: boolean,
  termCount: number,
  hiddenCount: number,
  rng: Rng,
): PatternProblem {
  const start = randomInt(rng, startRange.min, startRange.max);
  const magnitude = pick(rng, steps);
  const step = allowDescending && rng() < 0.5 ? -magnitude : magnitude;

  const terms: number[] = [];
  for (let i = 0; i < termCount; i++) {
    terms.push(start + step * i);
  }

  const hiddenIndices = pickHiddenIndices(termCount, hiddenCount, rng);

  return { terms, hiddenIndices, step };
}

/**
 * Väljer hiddenCount unika index från [ANCHOR_TERM_COUNT, termCount) — index 0
 * och 1 är alltid synliga så att steget går att läsa av direkt från de två
 * första termerna, se PatternProblem.
 */
function pickHiddenIndices(termCount: number, hiddenCount: number, rng: Rng): number[] {
  const candidates: number[] = [];
  for (let i = ANCHOR_TERM_COUNT; i < termCount; i++) {
    candidates.push(i);
  }
  const chosen: number[] = [];
  for (let i = 0; i < hiddenCount && candidates.length > 0; i++) {
    const index = randomInt(rng, 0, candidates.length - 1);
    chosen.push(candidates[index]);
    candidates.splice(index, 1);
  }
  return chosen.sort((a, b) => a - b);
}

/** hiddenCount måste rymma minst 1 och som mest termCount - ANCHOR_TERM_COUNT
 * dolda termer — validatePatternConfig varnar; här rätas det bara ut. */
function clampHiddenCount(hiddenCount: number, termCount: number): number {
  const max = Math.max(1, termCount - ANCHOR_TERM_COUNT);
  return Math.min(Math.max(1, Math.floor(hiddenCount)), max);
}

/** Startvärdet måste vara ett heltal — validatePatternConfig varnar; här
 * rätas det bara ut, samma princip som normalizeSideRange i core/geometry.ts. */
function normalizeStartRange(range: Range): Range {
  const min = Math.floor(Math.min(range.min, range.max));
  const max = Math.max(min, Math.floor(Math.max(range.min, range.max)));
  return { min, max };
}

function patternKey(problem: PatternProblem): string {
  return `${problem.terms[0]}:${problem.step}:${problem.hiddenIndices.join(',')}`;
}

/**
 * Grov uppskattning av hur många unika talföljder de valda inställningarna
 * rymmer, för varningen i validatePatternConfig — samma roll som
 * geometryPoolSize.
 */
export function patternPoolSize(config: PatternGeneratorConfig): number {
  const { min, max } = normalizeStartRange(config.startRange);
  const startSize = max - min + 1;
  const stepCount = Math.max(1, config.steps.length);
  return startSize * stepCount * (config.allowDescending ? 2 : 1);
}
