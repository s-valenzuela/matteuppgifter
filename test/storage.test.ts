import { beforeEach, describe, expect, it, vi } from 'vitest';
import { clearState, loadState, saveState } from '../src/state/storage';
import { createDefaultState } from '../src/ui/state';

describe('saveState / loadState', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('sparar och läser tillbaka exakt samma tillstånd', () => {
    const state = createDefaultState();
    saveState(state);
    expect(loadState()).toEqual(state);
  });

  it('returnerar null när inget är sparat', () => {
    expect(loadState()).toBeNull();
  });

  it('returnerar null och kraschar inte för skräp i localStorage', () => {
    localStorage.setItem('matteuppgifter:state:v1', '{ det här är inte json');
    expect(loadState()).toBeNull();
  });

  it('returnerar null för JSON som saknar förväntad form (t.ex. äldre schema)', () => {
    localStorage.setItem('matteuppgifter:state:v1', JSON.stringify({ foo: 'bar' }));
    expect(loadState()).toBeNull();
  });

  it('clearState tar bort sparat tillstånd', () => {
    saveState(createDefaultState());
    clearState();
    expect(loadState()).toBeNull();
  });

  it('saveState kraschar inte om localStorage.setItem kastar (t.ex. full kvot)', () => {
    const spy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('QuotaExceededError');
    });
    expect(() => saveState(createDefaultState())).not.toThrow();
    spy.mockRestore();
  });

  it('fyller på sheetType och clock för ett tillstånd sparat innan klockfunktionen fanns', () => {
    // isAppState() är en medvetet ytlig kontroll som inte känner av
    // sheetType/clock — ett äldre sparat tillstånd (utan de fälten) ska ändå
    // laddas, med sheetType/clock påfyllda till sina standardvärden, i
    // stället för att komma tillbaka med dem som undefined.
    const legacyState = createDefaultState();
    // @ts-expect-error simulerar JSON sparat innan sheetType/clock fanns
    delete legacyState.sheetType;
    // @ts-expect-error se ovan
    delete legacyState.clock;
    localStorage.setItem('matteuppgifter:state:v1', JSON.stringify(legacyState));

    const loaded = loadState();
    expect(loaded?.sheetType).toBe('arithmetic');
    expect(loaded?.clock).toBeDefined();
    expect(loaded?.clock.steps).toEqual(createDefaultState().clock.steps);
  });
});
