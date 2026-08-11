import { describe, expect, it } from 'vitest';
import { generateProblems } from '../src/core/generate';
import { computeGridLayout } from '../src/pdf/layout';
import { renderProblemsToPdf } from '../src/pdf/render';
import type { DocumentConfig } from '../src/types';
import { baseConfig, opConfig } from './helpers';

function baseDocumentConfig(overrides: Partial<DocumentConfig> = {}): DocumentConfig {
  return {
    header: { title: 'Matteuppgifter', showName: true, showDate: true },
    fontSizePt: 14,
    columns: 'auto',
    layout: 'grid',
    answerStyle: 'blank',
    includeAnswerKey: false,
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
});
