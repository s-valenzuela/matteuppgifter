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

  it('fyller på nyare document-fält för ett tillstånd sparat innan de fanns', () => {
    // Samma klass av problem som klock-testet ovan, men ETT STEG NER: fälten
    // saknas inuti `document`/`document.header`, inte på toppnivån. Ett
    // tillstånd sparat innan instructions/exampleFirst fanns gav annars
    // `instructions: undefined`, vilket skrev ut den bokstavliga texten
    // "undefined" i formuläret och i bladets sidhuvud.
    const legacyState = createDefaultState();
    // @ts-expect-error simulerar JSON sparat innan header.instructions fanns
    delete legacyState.document.header.instructions;
    // @ts-expect-error se ovan
    delete legacyState.document.exampleFirst;
    localStorage.setItem('matteuppgifter:state:v1', JSON.stringify(legacyState));

    const loaded = loadState();
    expect(loaded?.document.header.instructions).toBe('');
    expect(loaded?.document.exampleFirst).toBe(false);
    // Fälten som FANNS ska inte skrivas över av standardvärdena.
    expect(loaded?.document.header.title).toBe(legacyState.document.header.title);
  });

  it('fyller på pattern för ett tillstånd sparat innan mönsterbladet fanns', () => {
    // Samma klass av problem som klock-testet ovan, men för fältet som
    // tillkom med mönsterbladet.
    const legacyState = createDefaultState();
    // @ts-expect-error simulerar JSON sparat innan pattern fanns
    delete legacyState.pattern;
    localStorage.setItem('matteuppgifter:state:v1', JSON.stringify(legacyState));

    const loaded = loadState();
    expect(loaded?.pattern).toBeDefined();
    expect(loaded?.pattern.steps).toEqual(createDefaultState().pattern.steps);
  });

  it('behåller egna document-värden som skiljer sig från standardvärdena', () => {
    const state = createDefaultState();
    state.document.header.title = 'Läxa vecka 7';
    state.document.header.instructions = 'Rita visarna.';
    state.document.exampleFirst = true;
    state.document.fontSizePt = 20;
    saveState(state);

    expect(loadState()).toEqual(state);
  });
});
