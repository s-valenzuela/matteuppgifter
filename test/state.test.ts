import { describe, expect, it } from 'vitest';
import { computeDefaultInstructions, createDefaultState } from '../src/ui/state';

describe('createDefaultState', () => {
  it('startar utan instruktionstext och med exampleFirst avstängt', () => {
    const state = createDefaultState();
    expect(state.document.header.instructions).toBe('');
    expect(state.document.exampleFirst).toBe(false);
  });
});

describe('computeDefaultInstructions', () => {
  it('räknesätt: tom sträng normalt, en instruktion när "Saknat tal" är påslaget', () => {
    const state = createDefaultState();
    expect(computeDefaultInstructions(state)).toBe('');

    state.generator.missingNumber = true;
    expect(computeDefaultInstructions(state)).not.toBe('');
  });

  it('klocka: en icke-tom instruktion per riktning, utom "mixed"', () => {
    const state = createDefaultState();
    state.sheetType = 'clock';

    for (const direction of ['read', 'draw', 'digital', 'digitalDraw'] as const) {
      state.clock.direction = direction;
      expect(computeDefaultInstructions(state)).not.toBe('');
    }

    state.clock.direction = 'mixed';
    expect(computeDefaultInstructions(state)).toBe('');
  });

  it('klocka: "draw" och "digitalDraw" ger samma instruktion ("Rita visarna.")', () => {
    const state = createDefaultState();
    state.sheetType = 'clock';

    state.clock.direction = 'draw';
    const drawInstruction = computeDefaultInstructions(state);
    state.clock.direction = 'digitalDraw';
    expect(computeDefaultInstructions(state)).toBe(drawInstruction);
  });

  it('bråk: en icke-tom instruktion per riktning, utom "mixed"', () => {
    const state = createDefaultState();
    state.sheetType = 'fraction';

    for (const direction of ['identify', 'shade', 'identifyPercent', 'toPercent'] as const) {
      state.fraction.direction = direction;
      expect(computeDefaultInstructions(state)).not.toBe('');
    }

    state.fraction.direction = 'mixed';
    expect(computeDefaultInstructions(state)).toBe('');
  });

  it('olika riktningar ger olika instruktioner (ingen råkar dela samma standardtext av misstag)', () => {
    const state = createDefaultState();
    state.sheetType = 'fraction';

    const byDirection = (['identify', 'shade', 'identifyPercent', 'toPercent'] as const).map(
      (direction) => {
        state.fraction.direction = direction;
        return computeDefaultInstructions(state);
      },
    );
    expect(new Set(byDirection).size).toBe(byDirection.length);
  });
});
