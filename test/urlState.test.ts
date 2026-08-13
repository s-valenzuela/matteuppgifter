import { describe, expect, it } from 'vitest';
import { generateProblems } from '../src/core/generate';
import { validateConfig } from '../src/core/validate';
import { decodeState, encodeState } from '../src/state/urlState';
import { createDefaultState, toDocumentConfig, type AppState } from '../src/ui/state';

describe('encodeState / decodeState', () => {
  it('en avkodad standardkonfiguration återskapar exakt samma AppState', () => {
    const state = createDefaultState();
    const params = encodeState(state);
    const decoded = decodeState(`?${params.toString()}`);
    expect(decoded).toEqual(state);
  });

  it('kodar påslagna räknesätt, talområden och räknesättsspecifika val', () => {
    // Ett inaktiverat räknesätts talområde påverkar aldrig bladet, så det kodas
    // inte i URL:en (håller länken kort) — därför sätts add:s område här till
    // samma som standardkonfigurationens, så att hela AppState ändå kan
    // jämföras exakt efter en tur-och-retur.
    const state: AppState = {
      sheetType: 'arithmetic',
      generator: {
        operations: {
          add: { enabled: false, operandRange: { min: 0, max: 20 } },
          sub: { enabled: true, operandRange: { min: 5, max: 25 }, noNegative: true },
          mul: { enabled: true, operandRange: { min: 1, max: 10 }, tables: [2, 5, 10] },
          div: { enabled: true, operandRange: { min: 1, max: 12 }, allowRemainder: true },
        },
        count: 42,
        avoidDuplicates: false,
        shuffle: false,
        missingNumber: false,
        seed: 987654,
      },
      clock: createDefaultState().clock,
      fraction: createDefaultState().fraction,
      document: {
        header: { title: 'Läxa vecka 3', showName: false, showDate: true },
        fontSizePt: 20,
        columns: 2,
        layout: 'vertical',
        answerStyle: 'box',
        includeAnswerKey: false,
      },
    };

    const params = encodeState(state);
    const decoded = decodeState(`?${params.toString()}`);
    expect(decoded).toEqual(state);
  });

  it('en delad länk återskapar exakt samma genererade uppgifter, oavsett inaktiverade räknesätts kvarvarande UI-tillstånd', () => {
    // Det här är den faktiska M4-kontraktet: länken ska återskapa "exakt samma
    // blad", dvs samma Problem[] — inte nödvändigtvis varenda dolt UI-fält för
    // ett räknesätt som ändå är avstängt och därmed inte påverkar bladet.
    const state: AppState = {
      sheetType: 'arithmetic',
      generator: {
        operations: {
          add: { enabled: false, operandRange: { min: 3, max: 999 } },
          sub: { enabled: true, operandRange: { min: 5, max: 25 }, noNegative: true },
          mul: { enabled: true, operandRange: { min: 1, max: 10 }, tables: [2, 5, 10] },
          div: { enabled: true, operandRange: { min: 1, max: 12 }, allowRemainder: true },
        },
        count: 42,
        avoidDuplicates: true,
        shuffle: true,
        missingNumber: true,
        seed: 987654,
      },
      clock: createDefaultState().clock,
      fraction: createDefaultState().fraction,
      document: {
        header: { title: 'Läxa vecka 3', showName: false, showDate: true },
        fontSizePt: 20,
        columns: 2,
        layout: 'vertical',
        answerStyle: 'box',
        includeAnswerKey: false,
      },
    };

    const decoded = decodeState(`?${encodeState(state).toString()}`);
    expect(decoded).not.toBeNull();

    const original = generateProblems(validateConfig(state.generator).config);
    const fromLink = generateProblems(validateConfig(decoded!.generator).config);
    expect(fromLink).toEqual(original);
    expect(toDocumentConfig(decoded!)).toEqual(toDocumentConfig(state));
  });

  it('kodar "auto" antal kolumner', () => {
    const state = createDefaultState();
    state.document.columns = 'auto';
    const decoded = decodeState(`?${encodeState(state).toString()}`);
    expect(decoded?.document.columns).toBe('auto');
  });

  it('returnerar null för en tom query-sträng (ingen delad länk)', () => {
    expect(decodeState('')).toBeNull();
    expect(decodeState('?')).toBeNull();
  });

  it('inaktiverar ett räknesätt som saknas i URL:en helt', () => {
    const decoded = decodeState('?add=0:10&n=5&seed=1');
    expect(decoded?.generator.operations.sub.enabled).toBe(false);
    expect(decoded?.generator.operations.mul.enabled).toBe(false);
    expect(decoded?.generator.operations.div.enabled).toBe(false);
    expect(decoded?.generator.operations.add.enabled).toBe(true);
    expect(decoded?.generator.operations.add.operandRange).toEqual({ min: 0, max: 10 });
  });

  it('faller tillbaka till standardvärden för trasiga eller skräpvärden, utan att kasta fel', () => {
    const decoded = decodeState(
      '?add=inte-ett-tal:20&n=NaN&seed=abc&cols=noll&fs=stor&ans=okänd&facit=kanske',
    );
    const fallback = createDefaultState();
    expect(decoded).not.toBeNull();
    expect(decoded?.generator.count).toBe(fallback.generator.count);
    // seed slumpas i standardkonfigurationen, så en ny createDefaultState() ger
    // inte samma värde — kontrollera bara att en trasig seed inte blev NaN.
    expect(Number.isFinite(decoded?.generator.seed)).toBe(true);
    expect(decoded?.document.columns).toBe(fallback.document.columns);
    expect(decoded?.document.fontSizePt).toBe(fallback.document.fontSizePt);
    expect(decoded?.document.answerStyle).toBe(fallback.document.answerStyle);
    expect(decoded?.document.includeAnswerKey).toBe(fallback.document.includeAnswerKey);
  });

  it('behåller multiplikationens tabeller genom en tur-och-retur', () => {
    const state = createDefaultState();
    state.generator.operations.mul = {
      enabled: true,
      operandRange: { min: 1, max: 10 },
      tables: [3, 7],
    };
    const decoded = decodeState(`?${encodeState(state).toString()}`);
    expect(decoded?.generator.operations.mul.tables).toEqual([3, 7]);
  });

  it('behåller en gräns på svaret (resultRange), inklusive negativa tal, genom en tur-och-retur', () => {
    const state = createDefaultState();
    state.generator.operations.sub = {
      enabled: true,
      operandRange: { min: 0, max: 20 },
      resultRange: { min: -8, max: 8 },
    };
    const decoded = decodeState(`?${encodeState(state).toString()}`);
    expect(decoded?.generator.operations.sub.resultRange).toEqual({ min: -8, max: 8 });
  });

  it('utelämnad resultRange förblir odefinierad genom en tur-och-retur', () => {
    const state = createDefaultState();
    state.generator.operations.add.resultRange = undefined;
    const decoded = decodeState(`?${encodeState(state).toString()}`);
    expect(decoded?.generator.operations.add.resultRange).toBeUndefined();
  });

  it('kodar och avkodar "Saknat tal"-läget', () => {
    const state = createDefaultState();
    state.generator.missingNumber = true;
    const decoded = decodeState(`?${encodeState(state).toString()}`);
    expect(decoded?.generator.missingNumber).toBe(true);
  });

  describe('klockblad', () => {
    it('en länk utan "type" betyder alltid "arithmetic" (bakåtkompatibelt med länkar från innan klockan fanns)', () => {
      const decoded = decodeState('?add=0:10&n=5&seed=1');
      expect(decoded?.sheetType).toBe('arithmetic');
    });

    it('en avkodad standardkonfiguration för klockblad återskapar exakt samma AppState', () => {
      const state = createDefaultState();
      state.sheetType = 'clock';
      const decoded = decodeState(`?${encodeState(state).toString()}`);
      expect(decoded).toEqual(state);
    });

    it('kodar och avkodar alla klockinställningar genom en tur-och-retur', () => {
      const state = createDefaultState();
      state.sheetType = 'clock';
      state.clock = {
        steps: ['half', 'five'],
        direction: 'mixed',
        showNumerals: false,
        showMinuteTicks: true,
        count: 24,
        avoidDuplicates: false,
        seed: 555,
      };

      const decoded = decodeState(`?${encodeState(state).toString()}`);
      expect(decoded?.clock).toEqual(state.clock);
      expect(decoded?.sheetType).toBe('clock');
    });

    it('sätter footer-seeden från clock.seed, inte generator.seed, när sheetType är "clock"', () => {
      const state = createDefaultState();
      state.sheetType = 'clock';
      state.clock.seed = 111;
      state.generator.seed = 222;
      expect(toDocumentConfig(state).seed).toBe(111);
    });
  });

  describe('bråkblad', () => {
    it('en avkodad standardkonfiguration för bråkblad återskapar exakt samma AppState', () => {
      const state = createDefaultState();
      state.sheetType = 'fraction';
      const decoded = decodeState(`?${encodeState(state).toString()}`);
      expect(decoded).toEqual(state);
    });

    it('kodar och avkodar alla bråkinställningar genom en tur-och-retur', () => {
      const state = createDefaultState();
      state.sheetType = 'fraction';
      state.fraction = {
        denominators: [5, 8],
        shape: 'mixed',
        direction: 'shade',
        count: 24,
        avoidDuplicates: false,
        seed: 555,
      };

      const decoded = decodeState(`?${encodeState(state).toString()}`);
      expect(decoded?.fraction).toEqual(state.fraction);
      expect(decoded?.sheetType).toBe('fraction');
    });

    it('sätter footer-seeden från fraction.seed, inte generator.seed, när sheetType är "fraction"', () => {
      const state = createDefaultState();
      state.sheetType = 'fraction';
      state.fraction.seed = 111;
      state.generator.seed = 222;
      expect(toDocumentConfig(state).seed).toBe(111);
    });
  });
});
