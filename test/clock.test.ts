import { describe, expect, it } from 'vitest';
import {
  clockPhrase,
  clockPoolSize,
  digitalTime,
  generateClockProblems,
  minutesForSteps,
} from '../src/core/clock';
import type { ClockGeneratorConfig } from '../src/types';

function clockConfig(overrides: Partial<ClockGeneratorConfig> = {}): ClockGeneratorConfig {
  return {
    steps: ['hour', 'half', 'quarter', 'five'],
    direction: 'read',
    showNumerals: true,
    showMinuteTicks: false,
    count: 20,
    avoidDuplicates: false,
    seed: 1,
    ...overrides,
  };
}

describe('clockPhrase', () => {
  it('ger de tre exemplen från uppdraget', () => {
    expect(clockPhrase(6, 30)).toBe('halv sju');
    expect(clockPhrase(12, 45)).toBe('kvart i ett');
    expect(clockPhrase(2, 25)).toBe('fem i halv tre');
  });

  it('hel timme säger bara timmens namn', () => {
    expect(clockPhrase(3, 0)).toBe('tre');
    expect(clockPhrase(12, 0)).toBe('tolv');
  });

  it('alla tolv timmarna över hela minuttabellen', () => {
    // Facit för var och en av de tolv timmarna, minut för minut — den mest
    // uttömmande kontrollen av att "efter :25 syftar allt på nästa timme"
    // faktiskt stämmer för hela urtavlan, inte bara enstaka exempel.
    const expected: Record<number, Record<number, string>> = {
      1: {
        0: 'ett',
        5: 'fem över ett',
        10: 'tio över ett',
        15: 'kvart över ett',
        20: 'tjugo över ett',
        25: 'fem i halv två',
        30: 'halv två',
        35: 'fem över halv två',
        40: 'tjugo i två',
        45: 'kvart i två',
        50: 'tio i två',
        55: 'fem i två',
      },
      12: {
        0: 'tolv',
        5: 'fem över tolv',
        10: 'tio över tolv',
        15: 'kvart över tolv',
        20: 'tjugo över tolv',
        25: 'fem i halv ett',
        30: 'halv ett',
        35: 'fem över halv ett',
        40: 'tjugo i ett',
        45: 'kvart i ett',
        50: 'tio i ett',
        55: 'fem i ett',
      },
    };

    for (const [hour, minutes] of Object.entries(expected)) {
      for (const [minute, phrase] of Object.entries(minutes)) {
        expect(clockPhrase(Number(hour), Number(minute))).toBe(phrase);
      }
    }
  });

  it('12 → 1-övergången: :25–:55 efter tolv syftar på ett, inte tolv eller noll', () => {
    expect(clockPhrase(12, 30)).toBe('halv ett');
    expect(clockPhrase(12, 45)).toBe('kvart i ett');
  });

  it(':20 och :40 använder alltid tjugo över/tjugo i', () => {
    expect(clockPhrase(3, 20)).toBe('tjugo över tre');
    expect(clockPhrase(3, 40)).toBe('tjugo i fyra');
  });

  it('kastar för en minut som inte är en multipel av 5', () => {
    expect(() => clockPhrase(3, 7)).toThrow();
  });

  it('normaliserar timmar utanför 1–12 (t.ex. 0 eller 13)', () => {
    expect(clockPhrase(0, 0)).toBe('tolv');
    expect(clockPhrase(13, 0)).toBe('ett');
  });
});

describe('minutesForSteps', () => {
  it('ger varje grupps egna minuter', () => {
    expect(minutesForSteps(['hour'])).toEqual([0]);
    expect(minutesForSteps(['half'])).toEqual([30]);
    expect(minutesForSteps(['quarter'])).toEqual([15, 45]);
    expect(minutesForSteps(['five'])).toEqual([5, 10, 20, 25, 35, 40, 50, 55]);
  });

  it('slår ihop flera grupper till en sorterad union utan dubbletter', () => {
    expect(minutesForSteps(['hour', 'half'])).toEqual([0, 30]);
    expect(minutesForSteps(['hour', 'half', 'quarter'])).toEqual([0, 15, 30, 45]);
    expect(minutesForSteps(['hour', 'half', 'quarter', 'five'])).toEqual([
      0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55,
    ]);
  });

  it('ger en tom lista när inga grupper är ikryssade', () => {
    expect(minutesForSteps([])).toEqual([]);
  });
});

describe('clockPoolSize', () => {
  it('räknar 12 timmar gånger antal minuter i unionen', () => {
    expect(clockPoolSize(['hour'])).toBe(12);
    expect(clockPoolSize(['hour', 'half'])).toBe(24);
    expect(clockPoolSize(['hour', 'half', 'quarter'])).toBe(48);
    expect(clockPoolSize(['hour', 'half', 'quarter', 'five'])).toBe(144);
  });
});

describe('generateClockProblems', () => {
  it('returnerar en tom lista när count är 0', () => {
    expect(generateClockProblems(clockConfig({ count: 0 }))).toEqual([]);
  });

  it('returnerar en tom lista när inga minutgrupper är ikryssade', () => {
    expect(generateClockProblems(clockConfig({ steps: [], count: 20 }))).toEqual([]);
  });

  it('genererar exakt count uppgifter', () => {
    expect(generateClockProblems(clockConfig({ count: 30 }))).toHaveLength(30);
  });

  it('håller minuten inom unionen av de ikryssade gruppernas minuter', () => {
    for (const steps of [['hour'], ['half'], ['quarter'], ['five'], ['hour', 'quarter']] as const) {
      const allowed = new Set(minutesForSteps(steps));
      const problems = generateClockProblems(clockConfig({ steps: [...steps], count: 60 }));
      for (const p of problems) {
        expect(allowed.has(p.minute)).toBe(true);
      }
    }
  });

  it('håller timmen inom 1–12', () => {
    for (const p of generateClockProblems(clockConfig({ count: 100 }))) {
      expect(p.hour).toBeGreaterThanOrEqual(1);
      expect(p.hour).toBeLessThanOrEqual(12);
    }
  });

  it('ger identiskt resultat för samma seed', () => {
    const config = clockConfig({ seed: 12345, count: 40 });
    expect(generateClockProblems(config)).toEqual(generateClockProblems(config));
  });

  it('ger olika resultat för olika seed', () => {
    const a = generateClockProblems(clockConfig({ seed: 1, count: 40 }));
    const b = generateClockProblems(clockConfig({ seed: 2, count: 40 }));
    expect(a).not.toEqual(b);
  });

  it('undviker dubbletter så länge poolen räcker till', () => {
    const problems = generateClockProblems(
      clockConfig({
        steps: ['hour', 'half', 'quarter', 'five'],
        count: 100,
        avoidDuplicates: true,
      }),
    );
    const keys = problems.map((p) => `${p.hour}:${p.minute}`);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('fyller på med upprepningar i stället för att hänga när poolen är för liten', () => {
    // 'hour' rymmer bara 12 unika tider — fler än så måste upprepas.
    const problems = generateClockProblems(
      clockConfig({ steps: ['hour'], count: 50, avoidDuplicates: true }),
    );
    expect(problems).toHaveLength(50);
  });

  it('ger alltid direction "read" när direction är "read"', () => {
    for (const p of generateClockProblems(clockConfig({ direction: 'read', count: 40 }))) {
      expect(p.direction).toBe('read');
    }
  });

  it('ger alltid direction "draw" när direction är "draw"', () => {
    for (const p of generateClockProblems(clockConfig({ direction: 'draw', count: 40 }))) {
      expect(p.direction).toBe('draw');
    }
  });

  it('ger alltid direction "digital" när direction är "digital"', () => {
    for (const p of generateClockProblems(clockConfig({ direction: 'digital', count: 40 }))) {
      expect(p.direction).toBe('digital');
    }
  });

  it('ger alltid direction "digitalDraw" när direction är "digitalDraw"', () => {
    for (const p of generateClockProblems(clockConfig({ direction: 'digitalDraw', count: 40 }))) {
      expect(p.direction).toBe('digitalDraw');
    }
  });

  it('ger alla fyra riktningarna när direction är "mixed"', () => {
    const directions = new Set(
      generateClockProblems(clockConfig({ direction: 'mixed', count: 40, seed: 7 })).map(
        (p) => p.direction,
      ),
    );
    expect(directions).toEqual(new Set(['read', 'draw', 'digital', 'digitalDraw']));
  });
});

describe('digitalTime', () => {
  it('nollutfyller timme och minut som en digitalklocka', () => {
    expect(digitalTime(6, 30)).toBe('06:30');
    expect(digitalTime(12, 5)).toBe('12:05');
    expect(digitalTime(9, 0)).toBe('09:00');
  });
});
