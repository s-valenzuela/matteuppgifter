import type {
  ClockDirection,
  ClockDirectionMode,
  ClockGeneratorConfig,
  ClockProblem,
  ClockStep,
} from '../types';
import { mulberry32, pick, randomInt, type Rng } from './rng';

/** Tak på omdragningsförsök innan generatorn ger upp och accepterar kandidaten den har. */
const MAX_ATTEMPTS = 500;

/** Index 1–12 motsvarar timmen (index 0 oanvänt), som på urtavlan. */
const HOUR_WORDS = [
  '',
  'ett',
  'två',
  'tre',
  'fyra',
  'fem',
  'sex',
  'sju',
  'åtta',
  'nio',
  'tio',
  'elva',
  'tolv',
];

/** Disjunkta minutgrupper — varje minut hör hemma i exakt en grupp, så att
 * ingen kombination av ikryssade grupper kan ge en dubblett i unionen. */
const STEP_MINUTES: Record<ClockStep, readonly number[]> = {
  hour: [0],
  half: [30],
  quarter: [15, 45],
  five: [5, 10, 20, 25, 35, 40, 50, 55],
};

/** Unionen av minuterna för alla ikryssade grupper, sorterad. */
export function minutesForSteps(steps: readonly ClockStep[]): number[] {
  const minutes = new Set<number>();
  for (const step of steps) {
    for (const minute of STEP_MINUTES[step]) {
      minutes.add(minute);
    }
  }
  return [...minutes].sort((a, b) => a - b);
}

/** Hur många unika (timme, minut)-par de ikryssade grupperna rymmer — 12 timmar × antal minuter. */
export function clockPoolSize(steps: readonly ClockStep[]): number {
  return 12 * minutesForSteps(steps).length;
}

/**
 * Bygger den svenska frasen för en klockslag, t.ex. "halv sju" (6:30),
 * "kvart i ett" (12:45) eller "fem i halv tre" (2:25). Allt från :25 syftar
 * på NÄSTA timme ("halv sju" är alltså 6:30, inte 7:30) — det är den
 * klassiska fällan i svensk klocka och exakt det den här tabellen är till för
 * att få rätt, se test/clock.test.ts för alla 144 femminuterstider.
 */
export function clockPhrase(hour: number, minute: number): string {
  const h = ((((hour - 1) % 12) + 12) % 12) + 1; // normalisera till 1–12
  const next = (h % 12) + 1;
  const hourWord = HOUR_WORDS[h];
  const nextWord = HOUR_WORDS[next];

  switch (minute) {
    case 0:
      return hourWord;
    case 5:
      return `fem över ${hourWord}`;
    case 10:
      return `tio över ${hourWord}`;
    case 15:
      return `kvart över ${hourWord}`;
    case 20:
      return `tjugo över ${hourWord}`;
    case 25:
      return `fem i halv ${nextWord}`;
    case 30:
      return `halv ${nextWord}`;
    case 35:
      return `fem över halv ${nextWord}`;
    case 40:
      return `tjugo i ${nextWord}`;
    case 45:
      return `kvart i ${nextWord}`;
    case 50:
      return `tio i ${nextWord}`;
    case 55:
      return `fem i ${nextWord}`;
    default:
      throw new Error(`Ogiltig minut för klockfras (måste vara en multipel av 5): ${minute}`);
  }
}

export function generateClockProblems(config: ClockGeneratorConfig): ClockProblem[] {
  const minutes = minutesForSteps(config.steps);
  if (config.count <= 0 || minutes.length === 0) {
    return [];
  }

  const rng = mulberry32(config.seed);
  const seen = config.avoidDuplicates ? new Set<string>() : undefined;

  const problems: ClockProblem[] = [];
  for (let i = 0; i < config.count; i++) {
    let hour = randomInt(rng, 1, 12);
    let minute = pick(rng, minutes);

    if (seen) {
      let attempt = 0;
      // Om poolen (12 × antal minutsteg) är mindre än antalet begärda fylls
      // resten på med upprepningar i stället för att låsa sig i en oändlig
      // loop, se samma mönster i core/generate.ts.
      while (seen.has(clockKey(hour, minute)) && attempt < MAX_ATTEMPTS) {
        hour = randomInt(rng, 1, 12);
        minute = pick(rng, minutes);
        attempt++;
      }
      seen.add(clockKey(hour, minute));
    }

    problems.push({ hour, minute, direction: resolveDirection(config.direction, rng) });
  }

  return problems;
}

function clockKey(hour: number, minute: number): string {
  return `${hour}:${minute}`;
}

function resolveDirection(mode: ClockDirectionMode, rng: Rng): ClockDirection {
  return mode === 'mixed' ? pick(rng, ['read', 'draw', 'digital']) : mode;
}

/** T.ex. "06:30" — samma tvåsiffriga urtavla (1–12) som problem.hour redan
 * använder, bara nollutfylld, som på en digital väckarklocka. */
export function digitalTime(hour: number, minute: number): string {
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}
