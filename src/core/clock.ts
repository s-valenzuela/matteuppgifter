import type {
  ClockDirection,
  ClockDirectionMode,
  ClockGeneratorConfig,
  ClockProblem,
  ClockStep,
  TwentyFortyPhrasing,
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

const STEP_MINUTES: Record<ClockStep, readonly number[]> = {
  hour: [0],
  half: [0, 30],
  quarter: [0, 15, 30, 45],
  five: [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55],
};

/** Hur många unika (timme, minut)-par ett steg rymmer — 12 timmar × antal minutsteg. */
export function clockPoolSize(step: ClockStep): number {
  return 12 * STEP_MINUTES[step].length;
}

/**
 * Bygger den svenska frasen för en klockslag, t.ex. "halv sju" (6:30),
 * "kvart i ett" (12:45) eller "fem i halv tre" (2:25). Allt från :25 syftar
 * på NÄSTA timme ("halv sju" är alltså 6:30, inte 7:30) — det är den
 * klassiska fällan i svensk klocka och exakt det den här tabellen är till för
 * att få rätt, se test/clock.test.ts för alla 144 femminuterstider.
 */
export function clockPhrase(hour: number, minute: number, phrasing: TwentyFortyPhrasing): string {
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
      return phrasing === 'halv' ? `tio i halv ${nextWord}` : `tjugo över ${hourWord}`;
    case 25:
      return `fem i halv ${nextWord}`;
    case 30:
      return `halv ${nextWord}`;
    case 35:
      return `fem över halv ${nextWord}`;
    case 40:
      return phrasing === 'halv' ? `tio över halv ${nextWord}` : `tjugo i ${nextWord}`;
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
  if (config.count <= 0) {
    return [];
  }

  const rng = mulberry32(config.seed);
  const minutes = STEP_MINUTES[config.step];
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
  return mode === 'mixed' ? pick(rng, ['read', 'draw']) : mode;
}
