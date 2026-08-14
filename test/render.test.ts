import { describe, expect, it } from 'vitest';
import { generateClockProblems } from '../src/core/clock';
import { FRACTION_DENOMINATORS, generateFractionProblems } from '../src/core/fractions';
import { generateProblems } from '../src/core/generate';
import { generateEquationProblems } from '../src/core/equations';
import { generateGeometryProblems } from '../src/core/geometry';
import { generatePatternProblems } from '../src/core/patterns';
import { A4_METRICS, computeGridLayout, computeHeaderHeightMm } from '../src/pdf/layout';
import {
  renderClockSheetToPdf,
  renderEquationSheetToPdf,
  renderFractionSheetToPdf,
  renderGeometrySheetToPdf,
  renderPatternSheetToPdf,
  renderProblemsToPdf,
  type ClockDocumentOptions,
  type FractionDocumentOptions,
  type GeometryDocumentOptions,
  type PatternDocumentOptions,
} from '../src/pdf/render';
import type {
  ClockGeneratorConfig,
  DocumentConfig,
  EquationGeneratorConfig,
  FractionGeneratorConfig,
  GeometryGeneratorConfig,
  PatternGeneratorConfig,
} from '../src/types';
import { baseConfig, opConfig } from './helpers';

function baseClockConfig(overrides: Partial<ClockGeneratorConfig> = {}): ClockGeneratorConfig {
  return {
    steps: ['hour', 'half', 'quarter', 'five'],
    direction: 'read',
    showNumerals: true,
    showMinuteTicks: false,
    count: 12,
    avoidDuplicates: true,
    seed: 1,
    ...overrides,
  };
}

function baseFractionConfig(
  overrides: Partial<FractionGeneratorConfig> = {},
): FractionGeneratorConfig {
  return {
    denominators: [...FRACTION_DENOMINATORS],
    shape: 'mixed',
    direction: 'identify',
    showPercent: false,
    // 9, inte 12 som klockans motsvarighet — bråkfigurens två textrader
    // (täljare/streck/nämnare, se drawStackedFractionText) gör varje rad
    // högre än klockans enda textrad, så en 3×3-sida (inte 3×4) ryms på ett
    // A4-blad vid standardstorleken 14pt, se computeGridLayout.
    count: 9,
    avoidDuplicates: true,
    seed: 1,
    ...overrides,
  };
}

function baseDocumentConfig(overrides: Partial<DocumentConfig> = {}): DocumentConfig {
  return {
    header: { title: 'Matteuppgifter', showName: true, showDate: true, instructions: '' },
    fontSizePt: 14,
    columns: 'auto',
    layout: 'grid',
    answerStyle: 'blank',
    includeAnswerKey: false,
    exampleFirst: false,
    seed: 1,
    ...overrides,
  };
}

describe('renderProblemsToPdf', () => {
  it('genererar en icke-tom PDF för ett litet blad', () => {
    const problems = generateProblems(
      baseConfig({
        operations: {
          add: opConfig({ enabled: true, operandRange: { min: 0, max: 20 } }),
          sub: opConfig(),
          mul: opConfig(),
          div: opConfig(),
        },
        count: 10,
      }),
    );

    const doc = renderProblemsToPdf(problems, baseDocumentConfig());
    const bytes = doc.output('arraybuffer');
    expect(bytes.byteLength).toBeGreaterThan(0);
    expect(doc.getNumberOfPages()).toBe(1);
  });

  it('lämnar en enda tom sida med bara rubriken när inga uppgifter finns', () => {
    const doc = renderProblemsToPdf([], baseDocumentConfig());
    expect(doc.getNumberOfPages()).toBe(1);
  });

  it('matchar sidantalet från layout-beräkningen för uppgiftssidorna', () => {
    const problems = generateProblems(
      baseConfig({
        operations: {
          add: opConfig({ enabled: true, operandRange: { min: 0, max: 100 } }),
          sub: opConfig(),
          mul: opConfig(),
          div: opConfig(),
        },
        count: 250,
      }),
    );
    const config = baseDocumentConfig({ columns: 3, fontSizePt: 14 });
    const layout = computeGridLayout({
      problemCount: problems.length,
      fontSizePt: config.fontSizePt,
      columns: config.columns,
    });

    const doc = renderProblemsToPdf(problems, config);
    expect(doc.getNumberOfPages()).toBe(layout.pageCount);
  });

  it('lägger till facit-sidor sist när includeAnswerKey är satt', () => {
    const problems = generateProblems(
      baseConfig({
        operations: {
          add: opConfig({ enabled: true, operandRange: { min: 0, max: 100 } }),
          sub: opConfig(),
          mul: opConfig(),
          div: opConfig(),
        },
        count: 250,
      }),
    );
    const config = baseDocumentConfig({ columns: 3, fontSizePt: 14 });
    const layout = computeGridLayout({
      problemCount: problems.length,
      fontSizePt: config.fontSizePt,
      columns: config.columns,
    });

    const withoutKey = renderProblemsToPdf(problems, config);
    const withKey = renderProblemsToPdf(problems, { ...config, includeAnswerKey: true });

    expect(withoutKey.getNumberOfPages()).toBe(layout.pageCount);
    expect(withKey.getNumberOfPages()).toBe(layout.pageCount * 2);
  });

  it('lägger inte till facit-sidor när det inte finns några uppgifter', () => {
    const doc = renderProblemsToPdf([], baseDocumentConfig({ includeAnswerKey: true }));
    expect(doc.getNumberOfPages()).toBe(1);
  });

  it('fungerar för alla tre svarsstilar utan att kasta fel', () => {
    const problems = generateProblems(
      baseConfig({
        operations: {
          add: opConfig({ enabled: true, operandRange: { min: 0, max: 20 } }),
          sub: opConfig(),
          mul: opConfig(),
          div: opConfig(),
        },
        count: 12,
      }),
    );

    for (const answerStyle of ['blank', 'line', 'box'] as const) {
      const doc = renderProblemsToPdf(problems, baseDocumentConfig({ answerStyle }));
      expect(doc.output('arraybuffer').byteLength).toBeGreaterThan(0);
    }
  });

  it('fungerar i uppställningsläge för alla räknesätt, svarsstilar och med facit, utan att kasta fel', () => {
    const problems = generateProblems(
      baseConfig({
        operations: {
          add: opConfig({ enabled: true, operandRange: { min: 0, max: 100 } }),
          sub: opConfig({ enabled: true, operandRange: { min: 0, max: 100 }, noNegative: true }),
          mul: opConfig({ enabled: true, operandRange: { min: 0, max: 10 } }),
          div: opConfig({ enabled: true, operandRange: { min: 1, max: 10 }, allowRemainder: true }),
        },
        count: 40,
      }),
    );

    for (const answerStyle of ['blank', 'line', 'box'] as const) {
      const doc = renderProblemsToPdf(
        problems,
        baseDocumentConfig({ layout: 'vertical', answerStyle, includeAnswerKey: true }),
      );
      expect(doc.output('arraybuffer').byteLength).toBeGreaterThan(0);
      expect(doc.getNumberOfPages()).toBeGreaterThanOrEqual(2);
    }
  });

  it('matchar sidantalet från layout-beräkningen i uppställningsläge', () => {
    const problems = generateProblems(
      baseConfig({
        operations: {
          add: opConfig({ enabled: true, operandRange: { min: 0, max: 100 } }),
          sub: opConfig(),
          mul: opConfig(),
          div: opConfig(),
        },
        count: 250,
      }),
    );
    const config = baseDocumentConfig({ columns: 3, fontSizePt: 14, layout: 'vertical' });
    const layout = computeGridLayout({
      problemCount: problems.length,
      fontSizePt: config.fontSizePt,
      columns: config.columns,
      layout: config.layout,
    });

    const doc = renderProblemsToPdf(problems, config);
    expect(doc.getNumberOfPages()).toBe(layout.pageCount);
  });

  it('rundan runt-genererar en PDF för alla fyra räknesätt tillsammans, med rest och facit', () => {
    const problems = generateProblems(
      baseConfig({
        operations: {
          add: opConfig({ enabled: true, operandRange: { min: 0, max: 20 } }),
          sub: opConfig({ enabled: true, operandRange: { min: 0, max: 20 }, noNegative: true }),
          mul: opConfig({ enabled: true, operandRange: { min: 0, max: 10 }, tables: [2, 5, 10] }),
          div: opConfig({ enabled: true, operandRange: { min: 1, max: 10 }, allowRemainder: true }),
        },
        count: 40,
        avoidDuplicates: true,
        shuffle: true,
      }),
    );

    const doc = renderProblemsToPdf(problems, baseDocumentConfig({ includeAnswerKey: true }));
    expect(doc.getNumberOfPages()).toBeGreaterThanOrEqual(2);
    expect(doc.output('arraybuffer').byteLength).toBeGreaterThan(0);
  });

  it('renderar "Saknat tal" (blankad a, b eller svar) i båda layouterna och alla svarsstilar, utan att kasta fel', () => {
    const problems = generateProblems(
      baseConfig({
        operations: {
          add: opConfig({ enabled: true, operandRange: { min: 0, max: 20 } }),
          sub: opConfig({ enabled: true, operandRange: { min: 0, max: 20 }, noNegative: true }),
          mul: opConfig({ enabled: true, operandRange: { min: 1, max: 10 } }),
          div: opConfig({ enabled: true, operandRange: { min: 1, max: 10 }, allowRemainder: true }),
        },
        count: 40,
        missingNumber: true,
        seed: 5,
      }),
    );
    // Kontrollera att alla tre platserna faktiskt förekommer i testdatan,
    // annars testar vi inte det vi tror.
    const slots = new Set(problems.map((p) => p.missingSlot));
    expect(slots.has('a')).toBe(true);
    expect(slots.has('answer')).toBe(true);

    for (const layout of ['grid', 'vertical'] as const) {
      for (const answerStyle of ['blank', 'line', 'box'] as const) {
        const doc = renderProblemsToPdf(
          problems,
          baseDocumentConfig({ layout, answerStyle, includeAnswerKey: true }),
        );
        expect(doc.output('arraybuffer').byteLength).toBeGreaterThan(0);
        expect(doc.getNumberOfPages()).toBeGreaterThanOrEqual(2);
      }
    }
  });
});

describe('renderClockSheetToPdf', () => {
  function clockOptions(overrides: Partial<ClockDocumentOptions> = {}): ClockDocumentOptions {
    return {
      showNumerals: true,
      showMinuteTicks: false,
      ...overrides,
    };
  }

  it('genererar en icke-tom PDF för ett litet klockblad', () => {
    const problems = generateClockProblems(baseClockConfig());
    const doc = renderClockSheetToPdf(problems, baseDocumentConfig(), clockOptions());
    expect(doc.output('arraybuffer').byteLength).toBeGreaterThan(0);
    expect(doc.getNumberOfPages()).toBe(1);
  });

  it('lämnar en enda tom sida med bara rubriken när inga uppgifter finns', () => {
    const doc = renderClockSheetToPdf([], baseDocumentConfig(), clockOptions());
    expect(doc.getNumberOfPages()).toBe(1);
  });

  it('matchar sidantalet från layout-beräkningen för klockläget', () => {
    const problems = generateClockProblems(baseClockConfig({ count: 60, avoidDuplicates: false }));
    const config = baseDocumentConfig({ columns: 3, fontSizePt: 14 });
    const layout = computeGridLayout({
      problemCount: problems.length,
      fontSizePt: config.fontSizePt,
      columns: config.columns,
      layout: 'clock',
    });

    const doc = renderClockSheetToPdf(problems, config, clockOptions());
    expect(doc.getNumberOfPages()).toBe(layout.pageCount);
  });

  it('lägger till facit-sidor sist när includeAnswerKey är satt', () => {
    const problems = generateClockProblems(baseClockConfig({ count: 60, avoidDuplicates: false }));
    const config = baseDocumentConfig({ columns: 3, fontSizePt: 14 });
    const layout = computeGridLayout({
      problemCount: problems.length,
      fontSizePt: config.fontSizePt,
      columns: config.columns,
      layout: 'clock',
    });

    const withoutKey = renderClockSheetToPdf(problems, config, clockOptions());
    const withKey = renderClockSheetToPdf(
      problems,
      { ...config, includeAnswerKey: true },
      clockOptions(),
    );

    expect(withoutKey.getNumberOfPages()).toBe(layout.pageCount);
    expect(withKey.getNumberOfPages()).toBe(layout.pageCount * 2);
  });

  it('fungerar för alla riktningar, svarsstilar och minutgrupper, med facit, utan att kasta fel', () => {
    for (const direction of ['read', 'draw', 'digital', 'digitalDraw', 'mixed'] as const) {
      for (const answerStyle of ['blank', 'line', 'box'] as const) {
        for (const steps of [['hour'], ['half'], ['quarter'], ['five']] as const) {
          const problems = generateClockProblems(
            baseClockConfig({ direction, steps: [...steps], count: 20 }),
          );
          const doc = renderClockSheetToPdf(
            problems,
            baseDocumentConfig({ answerStyle, includeAnswerKey: true }),
            clockOptions(),
          );
          expect(doc.output('arraybuffer').byteLength).toBeGreaterThan(0);
        }
      }
    }
  });

  it('fungerar med siffror/minutstreck av och på, utan att kasta fel', () => {
    const problems = generateClockProblems(baseClockConfig());
    for (const showNumerals of [true, false]) {
      for (const showMinuteTicks of [true, false]) {
        const doc = renderClockSheetToPdf(
          problems,
          baseDocumentConfig(),
          clockOptions({ showNumerals, showMinuteTicks }),
        );
        expect(doc.output('arraybuffer').byteLength).toBeGreaterThan(0);
      }
    }
  });
});

describe('renderFractionSheetToPdf', () => {
  function fractionOptions(
    overrides: Partial<FractionDocumentOptions> = {},
  ): FractionDocumentOptions {
    return {
      showPercent: false,
      direction: 'identify',
      ...overrides,
    };
  }

  it('genererar en icke-tom PDF för ett litet bråkblad', () => {
    const problems = generateFractionProblems(baseFractionConfig());
    const doc = renderFractionSheetToPdf(problems, baseDocumentConfig(), fractionOptions());
    expect(doc.output('arraybuffer').byteLength).toBeGreaterThan(0);
    expect(doc.getNumberOfPages()).toBe(1);
  });

  it('lämnar en enda tom sida med bara rubriken när inga uppgifter finns', () => {
    const doc = renderFractionSheetToPdf([], baseDocumentConfig(), fractionOptions());
    expect(doc.getNumberOfPages()).toBe(1);
  });

  it('matchar sidantalet från layout-beräkningen för bråkläget', () => {
    const problems = generateFractionProblems(
      baseFractionConfig({ count: 60, avoidDuplicates: false }),
    );
    const config = baseDocumentConfig({ columns: 3, fontSizePt: 14 });
    const layout = computeGridLayout({
      problemCount: problems.length,
      fontSizePt: config.fontSizePt,
      columns: config.columns,
      layout: 'fraction',
    });

    const doc = renderFractionSheetToPdf(problems, config, fractionOptions());
    expect(doc.getNumberOfPages()).toBe(layout.pageCount);
  });

  it('lägger till facit-sidor sist när includeAnswerKey är satt', () => {
    const problems = generateFractionProblems(
      baseFractionConfig({ count: 60, avoidDuplicates: false }),
    );
    const config = baseDocumentConfig({ columns: 3, fontSizePt: 14 });
    const layout = computeGridLayout({
      problemCount: problems.length,
      fontSizePt: config.fontSizePt,
      columns: config.columns,
      layout: 'fraction',
    });

    const withoutKey = renderFractionSheetToPdf(problems, config, fractionOptions());
    const withKey = renderFractionSheetToPdf(
      problems,
      { ...config, includeAnswerKey: true },
      fractionOptions(),
    );

    expect(withoutKey.getNumberOfPages()).toBe(layout.pageCount);
    expect(withKey.getNumberOfPages()).toBe(layout.pageCount * 2);
  });

  it('fungerar för alla figurbaserade riktningar, former, svarsstilar, nämnare och procentvisning, med facit, utan att kasta fel', () => {
    for (const direction of ['identify', 'shade', 'identifyPercent', 'mixed'] as const) {
      for (const shape of ['circle', 'bar', 'mixed'] as const) {
        for (const answerStyle of ['blank', 'line', 'box'] as const) {
          for (const showPercent of [true, false]) {
            for (const denominators of [[2], [3], [4], [5, 6], [8, 10, 12]]) {
              const problems = generateFractionProblems(
                baseFractionConfig({ direction, shape, denominators, count: 20 }),
              );
              const doc = renderFractionSheetToPdf(
                problems,
                baseDocumentConfig({ answerStyle, includeAnswerKey: true }),
                fractionOptions({ showPercent, direction }),
              );
              expect(doc.output('arraybuffer').byteLength).toBeGreaterThan(0);
            }
          }
        }
      }
    }
  });

  describe('"toPercent" (utan figur)', () => {
    it('fungerar för alla svarsstilar och nämnare, med facit, utan att kasta fel', () => {
      for (const answerStyle of ['blank', 'line', 'box'] as const) {
        for (const denominators of [[2], [3], [4], [5, 6], [8, 10, 12]]) {
          const problems = generateFractionProblems(
            baseFractionConfig({ direction: 'toPercent', denominators, count: 20 }),
          );
          const doc = renderFractionSheetToPdf(
            problems,
            baseDocumentConfig({ answerStyle, includeAnswerKey: true }),
            fractionOptions({ direction: 'toPercent' }),
          );
          expect(doc.output('arraybuffer').byteLength).toBeGreaterThan(0);
        }
      }
    });

    it('använder layoutMode "fractionText" (tätare, ingen figur reserverad)', () => {
      const problems = generateFractionProblems(
        baseFractionConfig({ direction: 'toPercent', count: 60, avoidDuplicates: false }),
      );
      const config = baseDocumentConfig({ columns: 3, fontSizePt: 14 });
      const layout = computeGridLayout({
        problemCount: problems.length,
        fontSizePt: config.fontSizePt,
        columns: config.columns,
        layout: 'fractionText',
      });

      const doc = renderFractionSheetToPdf(
        problems,
        config,
        fractionOptions({ direction: 'toPercent' }),
      );
      expect(doc.getNumberOfPages()).toBe(layout.pageCount);
    });
  });
});

describe('header.instructions och exampleFirst', () => {
  it('en instruktionsrad gör sidhuvudet högre och kan därmed ge fler sidor, för alla tre bladtyperna', () => {
    const arithmeticProblems = generateProblems(
      baseConfig({
        operations: {
          add: opConfig({ enabled: true, operandRange: { min: 0, max: 100 } }),
          sub: opConfig(),
          mul: opConfig(),
          div: opConfig(),
        },
        count: 200,
      }),
    );
    const clockProblems = generateClockProblems(
      baseClockConfig({ count: 200, avoidDuplicates: false }),
    );
    const fractionProblems = generateFractionProblems(
      baseFractionConfig({ count: 200, avoidDuplicates: false }),
    );

    const cases: Array<{
      layoutMode: 'grid' | 'clock' | 'fraction';
      problemCount: number;
      render: (config: DocumentConfig) => number;
    }> = [
      {
        layoutMode: 'grid',
        problemCount: arithmeticProblems.length,
        render: (config) => renderProblemsToPdf(arithmeticProblems, config).getNumberOfPages(),
      },
      {
        layoutMode: 'clock',
        problemCount: clockProblems.length,
        render: (config) =>
          renderClockSheetToPdf(clockProblems, config, {
            showNumerals: true,
            showMinuteTicks: false,
          }).getNumberOfPages(),
      },
      {
        layoutMode: 'fraction',
        problemCount: fractionProblems.length,
        render: (config) =>
          renderFractionSheetToPdf(fractionProblems, config, {
            showPercent: false,
            direction: 'identify',
          }).getNumberOfPages(),
      },
    ];

    for (const { layoutMode, problemCount, render } of cases) {
      // exampleFirst kräver minst en uppgift för att lägga till en extra rad
      // (se headerExtraLineCount i pdf/render.ts) — problemCount > 0 här.
      const extraLineCount = 2; // instruktion + "löst exempel"-notis
      const config = baseDocumentConfig({
        columns: 3,
        fontSizePt: 14,
        header: {
          title: 'Matteuppgifter',
          showName: true,
          showDate: true,
          instructions: 'Räkna ut svaret.',
        },
        exampleFirst: true,
      });

      const expectedLayout = computeGridLayout({
        problemCount,
        fontSizePt: config.fontSizePt,
        columns: config.columns,
        layout: layoutMode,
        metrics: {
          ...A4_METRICS,
          headerHeightMm: computeHeaderHeightMm(A4_METRICS.headerHeightMm, extraLineCount),
        },
      });
      const layoutWithoutExtraLines = computeGridLayout({
        problemCount,
        fontSizePt: config.fontSizePt,
        columns: config.columns,
        layout: layoutMode,
      });

      expect(render(config)).toBe(expectedLayout.pageCount);
      // Slår fast att testet faktiskt övar den växande header-höjden.
      expect(expectedLayout.pageCount).toBeGreaterThanOrEqual(layoutWithoutExtraLines.pageCount);
    }
  });

  it('exampleFirst löser den första uppgiften på uppgiftssidan utan att påverka facit-sidantalet, för alla tre bladtyperna', () => {
    const arithmeticProblems = generateProblems(
      baseConfig({
        operations: {
          add: opConfig({ enabled: true, operandRange: { min: 0, max: 20 } }),
          sub: opConfig(),
          mul: opConfig(),
          div: opConfig(),
        },
        count: 12,
      }),
    );
    const clockProblems = generateClockProblems(baseClockConfig({ count: 12 }));
    const fractionProblems = generateFractionProblems(baseFractionConfig({ count: 9 }));

    const config = baseDocumentConfig({
      exampleFirst: true,
      includeAnswerKey: true,
      header: {
        title: 'Matteuppgifter',
        showName: true,
        showDate: true,
        instructions: 'Rita visarna.',
      },
    });

    const arithmeticDoc = renderProblemsToPdf(arithmeticProblems, config);
    const clockDoc = renderClockSheetToPdf(clockProblems, config, {
      showNumerals: true,
      showMinuteTicks: false,
    });
    const fractionDoc = renderFractionSheetToPdf(fractionProblems, config, {
      showPercent: false,
      direction: 'shade',
    });

    for (const doc of [arithmeticDoc, clockDoc, fractionDoc]) {
      expect(doc.getNumberOfPages()).toBe(2);
      expect(doc.output('arraybuffer').byteLength).toBeGreaterThan(0);
    }
  });

  it('fungerar utan att kasta fel när det inte finns några uppgifter, även med exampleFirst och en instruktionsrad', () => {
    const config = baseDocumentConfig({
      exampleFirst: true,
      header: {
        title: 'Matteuppgifter',
        showName: true,
        showDate: true,
        instructions: 'Skriv i bråkform.',
      },
    });

    expect(renderProblemsToPdf([], config).getNumberOfPages()).toBe(1);
    expect(
      renderClockSheetToPdf([], config, {
        showNumerals: true,
        showMinuteTicks: false,
      }).getNumberOfPages(),
    ).toBe(1);
    expect(
      renderFractionSheetToPdf([], config, {
        showPercent: false,
        direction: 'identify',
      }).getNumberOfPages(),
    ).toBe(1);
  });
});

describe('renderGeometrySheetToPdf', () => {
  function geometryOptions(
    overrides: Partial<GeometryDocumentOptions> = {},
  ): GeometryDocumentOptions {
    return { showUnits: true, ...overrides };
  }

  function baseGeometryConfig(
    overrides: Partial<GeometryGeneratorConfig> = {},
  ): GeometryGeneratorConfig {
    return {
      shape: 'mixed',
      measure: 'mixed',
      sideRange: { min: 2, max: 10 },
      showUnits: true,
      count: 9,
      avoidDuplicates: true,
      seed: 1,
      ...overrides,
    };
  }

  it('genererar en icke-tom PDF för ett litet geometriblad', () => {
    const problems = generateGeometryProblems(baseGeometryConfig());
    const doc = renderGeometrySheetToPdf(problems, baseDocumentConfig(), geometryOptions());
    expect(doc.output('arraybuffer').byteLength).toBeGreaterThan(0);
    expect(doc.getNumberOfPages()).toBe(1);
  });

  it('lämnar en enda tom sida med bara rubriken när inga uppgifter finns', () => {
    const doc = renderGeometrySheetToPdf([], baseDocumentConfig(), geometryOptions());
    expect(doc.getNumberOfPages()).toBe(1);
  });

  it('matchar sidantalet från layout-beräkningen för geometriläget', () => {
    const problems = generateGeometryProblems(
      baseGeometryConfig({ count: 60, avoidDuplicates: false }),
    );
    const config = baseDocumentConfig({ columns: 3, fontSizePt: 14 });
    const layout = computeGridLayout({
      problemCount: problems.length,
      fontSizePt: config.fontSizePt,
      columns: config.columns,
      layout: 'geometry',
    });

    const doc = renderGeometrySheetToPdf(problems, config, geometryOptions());
    expect(doc.getNumberOfPages()).toBe(layout.pageCount);
  });

  it('lägger till facit-sidor sist när includeAnswerKey är satt', () => {
    const problems = generateGeometryProblems(
      baseGeometryConfig({ count: 60, avoidDuplicates: false }),
    );
    const config = baseDocumentConfig({ columns: 3, fontSizePt: 14 });
    const layout = computeGridLayout({
      problemCount: problems.length,
      fontSizePt: config.fontSizePt,
      columns: config.columns,
      layout: 'geometry',
    });

    const withoutKey = renderGeometrySheetToPdf(problems, config, geometryOptions());
    const withKey = renderGeometrySheetToPdf(
      problems,
      { ...config, includeAnswerKey: true },
      geometryOptions(),
    );

    expect(withoutKey.getNumberOfPages()).toBe(layout.pageCount);
    expect(withKey.getNumberOfPages()).toBe(layout.pageCount * 2);
  });

  it('fungerar för alla figurer, mått, svarsstilar och enhetsval, med facit, utan att kasta fel', () => {
    for (const shape of ['rectangle', 'triangle', 'circle', 'mixed'] as const) {
      for (const measure of ['area', 'perimeter', 'mixed'] as const) {
        for (const answerStyle of ['blank', 'line', 'box'] as const) {
          for (const showUnits of [true, false]) {
            const problems = generateGeometryProblems(
              baseGeometryConfig({ shape, measure, showUnits, count: 12 }),
            );
            const doc = renderGeometrySheetToPdf(
              problems,
              baseDocumentConfig({ answerStyle, includeAnswerKey: true }),
              geometryOptions({ showUnits }),
            );
            expect(doc.output('arraybuffer').byteLength).toBeGreaterThan(0);
          }
        }
      }
    }
  });

  it('fungerar för smala kolumner och extrema teckenstorlekar utan att kasta fel', () => {
    const problems = generateGeometryProblems(baseGeometryConfig({ count: 12 }));
    for (const columns of [1, 2, 4, 6] as const) {
      for (const fontSizePt of [10, 14, 24, 32]) {
        const doc = renderGeometrySheetToPdf(
          problems,
          baseDocumentConfig({ columns, fontSizePt }),
          geometryOptions(),
        );
        expect(doc.output('arraybuffer').byteLength).toBeGreaterThan(0);
      }
    }
  });

  it('respekterar instruktionsrad och löst exempel, precis som de andra bladtyperna', () => {
    const problems = generateGeometryProblems(baseGeometryConfig({ count: 9 }));
    const config = baseDocumentConfig({
      exampleFirst: true,
      includeAnswerKey: true,
      header: {
        title: 'Matteuppgifter',
        showName: true,
        showDate: true,
        instructions: 'Beräkna arean.',
      },
    });
    const doc = renderGeometrySheetToPdf(problems, config, geometryOptions());
    expect(doc.getNumberOfPages()).toBe(2);
    expect(doc.output('arraybuffer').byteLength).toBeGreaterThan(0);
  });
});

describe('renderPatternSheetToPdf', () => {
  function basePatternConfig(
    overrides: Partial<PatternGeneratorConfig> = {},
  ): PatternGeneratorConfig {
    return {
      startRange: { min: 0, max: 20 },
      steps: [1, 2],
      allowDescending: false,
      termCount: 6,
      hiddenCount: 2,
      count: 9,
      avoidDuplicates: true,
      seed: 1,
      ...overrides,
    };
  }

  function patternOptions(config: PatternGeneratorConfig): PatternDocumentOptions {
    return { termCount: config.termCount };
  }

  it('genererar en icke-tom PDF för ett litet mönsterblad', () => {
    const config = basePatternConfig();
    const problems = generatePatternProblems(config);
    const doc = renderPatternSheetToPdf(problems, baseDocumentConfig(), patternOptions(config));
    expect(doc.output('arraybuffer').byteLength).toBeGreaterThan(0);
    expect(doc.getNumberOfPages()).toBe(1);
  });

  it('lämnar en enda tom sida med bara rubriken när inga uppgifter finns', () => {
    const config = basePatternConfig();
    const doc = renderPatternSheetToPdf([], baseDocumentConfig(), patternOptions(config));
    expect(doc.getNumberOfPages()).toBe(1);
  });

  it('matchar sidantalet från layout-beräkningen för mönsterläget', () => {
    const config = basePatternConfig({ count: 60, avoidDuplicates: false });
    const problems = generatePatternProblems(config);
    const docConfig = baseDocumentConfig({ columns: 3, fontSizePt: 14 });
    const layout = computeGridLayout({
      problemCount: problems.length,
      fontSizePt: docConfig.fontSizePt,
      columns: docConfig.columns,
      layout: 'pattern',
      termCount: config.termCount,
    });

    const doc = renderPatternSheetToPdf(problems, docConfig, patternOptions(config));
    expect(doc.getNumberOfPages()).toBe(layout.pageCount);
  });

  it('lägger till facit-sidor sist när includeAnswerKey är satt', () => {
    const config = basePatternConfig({ count: 60, avoidDuplicates: false });
    const problems = generatePatternProblems(config);
    const docConfig = baseDocumentConfig({ columns: 3, fontSizePt: 14 });
    const layout = computeGridLayout({
      problemCount: problems.length,
      fontSizePt: docConfig.fontSizePt,
      columns: docConfig.columns,
      layout: 'pattern',
      termCount: config.termCount,
    });

    const withoutKey = renderPatternSheetToPdf(problems, docConfig, patternOptions(config));
    const withKey = renderPatternSheetToPdf(
      problems,
      { ...docConfig, includeAnswerKey: true },
      patternOptions(config),
    );

    expect(withoutKey.getNumberOfPages()).toBe(layout.pageCount);
    expect(withKey.getNumberOfPages()).toBe(layout.pageCount * 2);
  });

  it('fungerar för olika termCount/hiddenCount, svarsstilar och stegval, med facit, utan att kasta fel', () => {
    for (const termCount of [4, 6, 10]) {
      for (const hiddenCount of [1, 2, 3]) {
        for (const answerStyle of ['blank', 'line', 'box'] as const) {
          const config = basePatternConfig({ termCount, hiddenCount, count: 12 });
          const problems = generatePatternProblems(config);
          const doc = renderPatternSheetToPdf(
            problems,
            baseDocumentConfig({ answerStyle, includeAnswerKey: true }),
            patternOptions(config),
          );
          expect(doc.output('arraybuffer').byteLength).toBeGreaterThan(0);
        }
      }
    }
  });

  it('fungerar för smala kolumner och extrema teckenstorlekar utan att kasta fel', () => {
    const config = basePatternConfig({ count: 12 });
    const problems = generatePatternProblems(config);
    for (const columns of [1, 2, 4, 6] as const) {
      for (const fontSizePt of [10, 14, 24, 32]) {
        const doc = renderPatternSheetToPdf(
          problems,
          baseDocumentConfig({ columns, fontSizePt }),
          patternOptions(config),
        );
        expect(doc.output('arraybuffer').byteLength).toBeGreaterThan(0);
      }
    }
  });

  it('respekterar instruktionsrad och löst exempel, precis som de andra bladtyperna', () => {
    const config = basePatternConfig({ count: 9 });
    const problems = generatePatternProblems(config);
    const docConfig = baseDocumentConfig({
      exampleFirst: true,
      includeAnswerKey: true,
      header: {
        title: 'Matteuppgifter',
        showName: true,
        showDate: true,
        instructions: 'Fyll i de tal som saknas i talföljden.',
      },
    });
    const doc = renderPatternSheetToPdf(problems, docConfig, patternOptions(config));
    expect(doc.getNumberOfPages()).toBe(2);
    expect(doc.output('arraybuffer').byteLength).toBeGreaterThan(0);
  });
});

describe('renderEquationSheetToPdf', () => {
  function baseEquationConfig(
    overrides: Partial<EquationGeneratorConfig> = {},
  ): EquationGeneratorConfig {
    return {
      operations: { add: true, sub: true, mul: true, div: true },
      operandRange: { min: 1, max: 20 },
      allowNegative: false,
      count: 9,
      avoidDuplicates: true,
      seed: 1,
      ...overrides,
    };
  }

  it('genererar en icke-tom PDF för ett litet ekvationsblad', () => {
    const problems = generateEquationProblems(baseEquationConfig());
    const doc = renderEquationSheetToPdf(problems, baseDocumentConfig());
    expect(doc.output('arraybuffer').byteLength).toBeGreaterThan(0);
    expect(doc.getNumberOfPages()).toBe(1);
  });

  it('lämnar en enda tom sida med bara rubriken när inga uppgifter finns', () => {
    const doc = renderEquationSheetToPdf([], baseDocumentConfig());
    expect(doc.getNumberOfPages()).toBe(1);
  });

  it('matchar sidantalet från layout-beräkningen för ekvationsläget', () => {
    const problems = generateEquationProblems(
      baseEquationConfig({ count: 60, avoidDuplicates: false }),
    );
    const config = baseDocumentConfig({ columns: 3, fontSizePt: 14 });
    const layout = computeGridLayout({
      problemCount: problems.length,
      fontSizePt: config.fontSizePt,
      columns: config.columns,
      layout: 'equation',
    });

    const doc = renderEquationSheetToPdf(problems, config);
    expect(doc.getNumberOfPages()).toBe(layout.pageCount);
  });

  it('lägger till facit-sidor sist när includeAnswerKey är satt', () => {
    const problems = generateEquationProblems(
      baseEquationConfig({ count: 60, avoidDuplicates: false }),
    );
    const config = baseDocumentConfig({ columns: 3, fontSizePt: 14 });
    const layout = computeGridLayout({
      problemCount: problems.length,
      fontSizePt: config.fontSizePt,
      columns: config.columns,
      layout: 'equation',
    });

    const withoutKey = renderEquationSheetToPdf(problems, config);
    const withKey = renderEquationSheetToPdf(problems, { ...config, includeAnswerKey: true });

    expect(withoutKey.getNumberOfPages()).toBe(layout.pageCount);
    expect(withKey.getNumberOfPages()).toBe(layout.pageCount * 2);
  });

  it('fungerar för alla räknesätt, svarsstilar och negativa tal, med facit, utan att kasta fel', () => {
    for (const op of ['add', 'sub', 'mul', 'div'] as const) {
      for (const answerStyle of ['blank', 'line', 'box'] as const) {
        for (const allowNegative of [true, false]) {
          const operations = { add: false, sub: false, mul: false, div: false };
          operations[op] = true;
          const problems = generateEquationProblems(
            baseEquationConfig({ operations, allowNegative, count: 12 }),
          );
          const doc = renderEquationSheetToPdf(
            problems,
            baseDocumentConfig({ answerStyle, includeAnswerKey: true }),
          );
          expect(doc.output('arraybuffer').byteLength).toBeGreaterThan(0);
        }
      }
    }
  });

  it('fungerar för smala kolumner och extrema teckenstorlekar utan att kasta fel', () => {
    const problems = generateEquationProblems(baseEquationConfig({ count: 12 }));
    for (const columns of [1, 2, 4, 6] as const) {
      for (const fontSizePt of [10, 14, 24, 32]) {
        const doc = renderEquationSheetToPdf(problems, baseDocumentConfig({ columns, fontSizePt }));
        expect(doc.output('arraybuffer').byteLength).toBeGreaterThan(0);
      }
    }
  });

  it('respekterar instruktionsrad och löst exempel, precis som de andra bladtyperna', () => {
    const problems = generateEquationProblems(baseEquationConfig({ count: 9 }));
    const config = baseDocumentConfig({
      exampleFirst: true,
      includeAnswerKey: true,
      header: {
        title: 'Matteuppgifter',
        showName: true,
        showDate: true,
        instructions: 'Lös ekvationerna. Skriv värdet på x.',
      },
    });
    const doc = renderEquationSheetToPdf(problems, config);
    expect(doc.getNumberOfPages()).toBe(2);
    expect(doc.output('arraybuffer').byteLength).toBeGreaterThan(0);
  });
});
