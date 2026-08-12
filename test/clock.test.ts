import { describe, expect, it } from 'vitest';
import { clockPhrase, clockPoolSize, generateClockProblems } from '../src/core/clock';
import type { ClockGeneratorConfig } from '../src/types';

function clockConfig(overrides: Partial<ClockGeneratorConfig> = {}): ClockGeneratorConfig {
  return {
    step: 'five',
    twentyFortyPhrasing: 'halv',
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
    expect(clockPhrase(6, 30, 'halv')).toBe('halv sju');
    expect(clockPhrase(12, 45, 'halv')).toBe('kvart i ett');
    expect(clockPhrase(2, 25, 'halv')).toBe('fem i halv tre');
  });

  it('hel timme säger bara timmens namn', () => {
    expect(clockPhrase(3, 0, 'halv')).toBe('tre');
    expect(clockPhrase(12, 0, 'halv')).toBe('tolv');
  });

  it('alla tolv timmarna över hela minuttabellen, "halv"-frasering', () => {
    // Facit för var och en av de tolv timmarna, minut för minut — den mest
    // uttömmande kontrollen av att "efter :25 syftar allt på nästa timme"
    // faktiskt stämmer för hela urtavlan, inte bara enstaka exempel.
    const expected: Record<number, Record<number, string>> = {
      1: {
        0: 'ett',
        5: 'fem över ett',
        10: 'tio över ett',
        15: 'kvart över ett',
        20: 'tio i halv två',
        25: 'fem i halv två',
        30: 'halv två',
        35: 'fem över halv två',
        40: 'tio över halv två',
        45: 'kvart i två',
        50: 'tio i två',
        55: 'fem i två',
      },
      12: {
        0: 'tolv',
        5: 'fem över tolv',
        10: 'tio över tolv',
        15: 'kvart över tolv',
        20: 'tio i halv ett',
        25: 'fem i halv ett',
        30: 'halv ett',
        35: 'fem över halv ett',
        40: 'tio över halv ett',
        45: 'kvart i ett',
        50: 'tio i ett',
        55: 'fem i ett',
      },
    };

    for (const [hour, minutes] of Object.entries(expected)) {
      for (const [minute, phrase] of Object.entries(minutes)) {
        expect(clockPhrase(Number(hour), Number(minute), 'halv')).toBe(phrase);
      }
    }
  });

  it('12 → 1-övergången: :25–:55 efter tolv syftar på ett, inte tolv eller noll', () => {
    expect(clockPhrase(12, 30, 'halv')).toBe('halv ett');
    expect(clockPhrase(12, 45, 'halv')).toBe('kvart i ett');
  });

  it(':20 och :40 med "over-i"-frasering', () => {
    expect(clockPhrase(3, 20, 'over-i')).toBe('tjugo över tre');
    expect(clockPhrase(3, 40, 'over-i')).toBe('tjugo i fyra');
  });

  it(':20 och :40 med "halv"-frasering (standard)', () => {
    expect(clockPhrase(3, 20, 'halv')).toBe('tio i halv fyra');
    expect(clockPhrase(3, 40, 'halv')).toBe('tio över halv fyra');
  });

  it('bara fraseringen för :20/:40 skiljer sig mellan de två lägena — övriga minuter är identiska', () => {
    for (let hour = 1; hour <= 12; hour++) {
      for (const minute of [0, 5, 10, 15, 25, 30, 35, 45, 50, 55]) {
        expect(clockPhrase(hour, minute, 'halv')).toBe(clockPhrase(hour, minute, 'over-i'));
      }
    }
  });

  it('kastar för en minut som inte är en multipel av 5', () => {
    expect(() => clockPhrase(3, 7, 'halv')).toThrow();
  });

  it('normaliserar timmar utanför 1–12 (t.ex. 0 eller 13)', () => {
    expect(clockPhrase(0, 0, 'halv')).toBe('tolv');
    expect(clockPhrase(13, 0, 'halv')).toBe('ett');
  });
});

describe('clockPoolSize', () => {
  it('räknar 12 timmar gånger antal minutsteg', () => {
    expect(clockPoolSize('hour')).toBe(12);
    expect(clockPoolSize('half')).toBe(24);
    expect(clockPoolSize('quarter')).toBe(48);
    expect(clockPoolSize('five')).toBe(144);
  });
});

describe('generateClockProblems', () => {
  it('returnerar en tom lista när count är 0', () => {
    expect(generateClockProblems(clockConfig({ count: 0 }))).toEqual([]);
  });

  it('genererar exakt count uppgifter', () => {
    expect(generateClockProblems(clockConfig({ count: 30 }))).toHaveLength(30);
  });

  it('håller minuten inom det valda stegets minuttabell', () => {
    for (const step of ['hour', 'half', 'quarter', 'five'] as const) {
      const problems = generateClockProblems(clockConfig({ step, count: 60 }));
      for (const p of problems) {
        expect(
          p.minute % (step === 'hour' ? 60 : step === 'half' ? 30 : step === 'quarter' ? 15 : 5),
        ).toBe(0);
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
      clockConfig({ step: 'five', count: 100, avoidDuplicates: true }),
    );
    const keys = problems.map((p) => `${p.hour}:${p.minute}`);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('fyller på med upprepningar i stället för att hänga när poolen är för liten', () => {
    // 'hour' rymmer bara 12 unika tider — fler än så måste upprepas.
    const problems = generateClockProblems(
      clockConfig({ step: 'hour', count: 50, avoidDuplicates: true }),
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

  it('ger båda riktningarna när direction är "mixed"', () => {
    const directions = new Set(
      generateClockProblems(clockConfig({ direction: 'mixed', count: 40, seed: 7 })).map(
        (p) => p.direction,
      ),
    );
    expect(directions.size).toBe(2);
  });
});
