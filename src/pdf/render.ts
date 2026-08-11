import { jsPDF } from 'jspdf';
import type { DocumentConfig, Problem } from '../types';
import { computeOperandDigitCounts, formatAnswer, OPERATION_SYMBOLS } from './format';
import {
  A4_METRICS,
  computeGridLayout,
  MM_PER_PT,
  VERTICAL_BOX_GAP_FACTOR,
  VERTICAL_BOX_HEIGHT_FACTOR,
  VERTICAL_LINE_STEP_FACTOR,
  VERTICAL_RULE_GAP_FACTOR,
  type CellPosition,
  type GridLayout,
} from './layout';

const BLANK_PLACEHOLDER = '_______';
const LINE_LENGTH_MM = 14;
const BOX_SIZE_MM = 7;
const GAP_AFTER_PROMPT_MM = 2;
/** Luft runt operatorn och likhetstecknet, i mm. */
const SYMBOL_GAP_MM = 1.5;

/**
 * Mått som är gemensamma för alla uppgifter i dokumentet, så att operand A,
 * operatorn, operand B och likhetstecknet hamnar på samma x-position rad
 * efter rad oavsett hur många siffror den enskilda uppgiften har — se
 * drawProblem(). Beror på jsPDF:s faktiska doc.getTextWidth() (siffror är
 * lika breda i Helvetica, "tabular figures", men +/-/×/÷ är det INTE), så
 * det här kan inte vara ren mm-matematik som layout.ts.
 */
interface ProblemMetrics {
  slotAWidthMm: number;
  slotBWidthMm: number;
  operatorSlotWidthMm: number;
}

function computeProblemMetrics(
  doc: jsPDF,
  problems: Problem[],
  fontSizePt: number,
): ProblemMetrics {
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(fontSizePt);

  const digitWidthMm = doc.getTextWidth('0');
  const digitCounts = computeOperandDigitCounts(problems);
  const operatorSlotWidthMm = Math.max(
    ...Object.values(OPERATION_SYMBOLS).map((symbol) => doc.getTextWidth(symbol)),
  );

  return {
    slotAWidthMm: digitCounts.a * digitWidthMm,
    slotBWidthMm: digitCounts.b * digitWidthMm,
    operatorSlotWidthMm,
  };
}

export function renderProblemsToPdf(problems: Problem[], config: DocumentConfig): jsPDF {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const layout = computeGridLayout({
    problemCount: problems.length,
    fontSizePt: config.fontSizePt,
    columns: config.columns,
    layout: config.layout,
  });

  if (layout.pageCount === 0) {
    // Inga uppgifter att rita — lämna kvar en enda sida med bara rubriken.
    drawHeader(doc, config, null);
    drawFooter(doc, 0, 1, config.seed);
    return doc;
  }

  const metrics = computeProblemMetrics(doc, problems, config.fontSizePt);

  renderSection(doc, problems, layout, config, metrics, { showAnswers: false, sectionLabel: null });

  if (config.includeAnswerKey) {
    doc.addPage();
    renderSection(doc, problems, layout, config, metrics, {
      showAnswers: true,
      sectionLabel: 'Facit',
    });
  }

  return doc;
}

interface SectionOptions {
  showAnswers: boolean;
  sectionLabel: string | null;
}

function renderSection(
  doc: jsPDF,
  problems: Problem[],
  layout: GridLayout,
  config: DocumentConfig,
  metrics: ProblemMetrics,
  options: SectionOptions,
): void {
  for (let page = 0; page < layout.pageCount; page++) {
    if (page > 0) {
      doc.addPage();
    }
    drawHeader(doc, config, options.sectionLabel);
    for (const position of layout.positions) {
      if (position.page === page) {
        drawProblem(doc, problems[position.index], position, config, options.showAnswers, metrics);
      }
    }
    drawFooter(doc, page, layout.pageCount, config.seed);
  }
}

function drawHeader(doc: jsPDF, config: DocumentConfig, sectionLabel: string | null): void {
  const { marginMm } = A4_METRICS;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  const titleText = sectionLabel ? `${config.header.title} — ${sectionLabel}` : config.header.title;
  if (titleText) {
    doc.text(titleText, marginMm, marginMm + 5);
  }

  if (!sectionLabel) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    const fields: string[] = [];
    if (config.header.showName) {
      fields.push('Namn: _______________________');
    }
    if (config.header.showDate) {
      fields.push('Datum: ______________');
    }
    if (fields.length > 0) {
      doc.text(fields.join('        '), marginMm, marginMm + 12);
    }
  }
}

function drawFooter(doc: jsPDF, page: number, totalPages: number, seed: number): void {
  const { pageWidthMm, pageHeightMm, marginMm } = A4_METRICS;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.text(
    `Sida ${page + 1} av ${totalPages} · seed ${seed}`,
    pageWidthMm - marginMm,
    pageHeightMm - marginMm / 2,
    {
      align: 'right',
    },
  );
}

function drawProblem(
  doc: jsPDF,
  problem: Problem,
  position: CellPosition,
  config: DocumentConfig,
  showAnswers: boolean,
  metrics: ProblemMetrics,
): void {
  if (config.layout === 'vertical') {
    drawVerticalProblem(doc, problem, position, config, showAnswers, metrics);
  } else {
    drawGridProblem(doc, problem, position, config, showAnswers, metrics);
  }
}

/** Vågrätt: "12 + 7 = ____". */
function drawGridProblem(
  doc: jsPDF,
  problem: Problem,
  position: CellPosition,
  config: DocumentConfig,
  showAnswers: boolean,
  metrics: ProblemMetrics,
): void {
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(config.fontSizePt);

  // Operand A högerjusteras mot slutet av sin kolumn ...
  const aX = position.xMm + metrics.slotAWidthMm;
  doc.text(String(problem.a), aX, position.yMm, { align: 'right' });

  // ... operatorn centreras i en egen fast bred kolumn (+/-/×/÷ är inte lika
  // breda i Helvetica, så utan det här skulle likhetstecknet hoppa i sidled
  // beroende på vilket räknesätt just den raden råkar vara) ...
  const symbol = OPERATION_SYMBOLS[problem.op];
  const symbolSlotStartX = aX + SYMBOL_GAP_MM;
  const symbolWidth = doc.getTextWidth(symbol);
  doc.text(
    symbol,
    symbolSlotStartX + (metrics.operatorSlotWidthMm - symbolWidth) / 2,
    position.yMm,
  );

  // ... och operand B högerjusteras på samma sätt som A, så att både + och =
  // hamnar på samma x-position rad efter rad genom hela dokumentet.
  const bX = symbolSlotStartX + metrics.operatorSlotWidthMm + SYMBOL_GAP_MM + metrics.slotBWidthMm;
  doc.text(String(problem.b), bX, position.yMm, { align: 'right' });

  const equalsX = bX + SYMBOL_GAP_MM;
  doc.text('=', equalsX, position.yMm);

  const answerX = equalsX + doc.getTextWidth('=') + GAP_AFTER_PROMPT_MM;

  if (showAnswers) {
    doc.text(formatAnswer(problem), answerX, position.yMm);
    return;
  }

  switch (config.answerStyle) {
    case 'blank':
      doc.text(BLANK_PLACEHOLDER, answerX, position.yMm);
      break;
    case 'line':
      doc.line(answerX, position.yMm + 1, answerX + LINE_LENGTH_MM, position.yMm + 1);
      break;
    case 'box':
      doc.rect(answerX, position.yMm - BOX_SIZE_MM + 2, BOX_SIZE_MM, BOX_SIZE_MM);
      break;
  }
}

/**
 * Uppställning: talen staplade och högerjusterade mot samma kant, med
 * operatorn i en egen fast kolumn till vänster (samma operatorSlotWidthMm
 * som i drawGridProblem — annars skulle strecket hamna olika brett för +/-
 * jämfört med ×/÷) och ett streck ovanför svaret:
 *
 *      12
 *   +   7
 *   ----
 *      19
 *
 * position.yMm är, liksom i drawGridProblem, den sista radens baslinje (här:
 * svaret) — layout.ts har reserverat exakt VERTICAL_LINE_STEP_FACTOR-höjd
 * radavstånd ovanför den för operand 1 och operand 2, se computeGridLayout.
 */
function drawVerticalProblem(
  doc: jsPDF,
  problem: Problem,
  position: CellPosition,
  config: DocumentConfig,
  showAnswers: boolean,
  metrics: ProblemMetrics,
): void {
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(config.fontSizePt);

  const fontSizeMm = config.fontSizePt * MM_PER_PT;
  const lineStepMm = fontSizeMm * VERTICAL_LINE_STEP_FACTOR;
  const operandColumnWidthMm = Math.max(metrics.slotAWidthMm, metrics.slotBWidthMm);
  const rightEdgeX =
    position.xMm + metrics.operatorSlotWidthMm + SYMBOL_GAP_MM + operandColumnWidthMm;

  const answerY = position.yMm;
  const operand2Y = answerY - lineStepMm;
  const operand1Y = operand2Y - lineStepMm;
  const ruleY = operand2Y + fontSizeMm * VERTICAL_RULE_GAP_FACTOR;

  doc.text(String(problem.a), rightEdgeX, operand1Y, { align: 'right' });

  const symbol = OPERATION_SYMBOLS[problem.op];
  const symbolWidth = doc.getTextWidth(symbol);
  doc.text(symbol, position.xMm + (metrics.operatorSlotWidthMm - symbolWidth) / 2, operand2Y);
  doc.text(String(problem.b), rightEdgeX, operand2Y, { align: 'right' });

  doc.line(position.xMm, ruleY, rightEdgeX, ruleY);

  if (showAnswers) {
    doc.text(formatAnswer(problem), rightEdgeX, answerY, { align: 'right' });
    return;
  }

  // 'blank' och 'line' ritar inget extra — strecket ovanför är redan den
  // sedvanliga platsen att skriva svaret för hand i en uppställning, precis
  // som i en fysisk räknehäfte. 'box' ritar en ruta för svaret ändå, för den
  // som vill ha en tydligare avgränsad yta. Rutans höjd (och luften runt den)
  // skalar med teckenstorleken — layout.ts har reserverat radhöjd utifrån
  // exakt samma faktorer (VERTICAL_BOX_GAP_FACTOR/VERTICAL_BOX_HEIGHT_FACTOR),
  // så en fast mm-höjd hade kunnat glida isär och krocka med nästa uppgift.
  if (config.answerStyle === 'box') {
    doc.rect(
      position.xMm,
      ruleY + fontSizeMm * VERTICAL_BOX_GAP_FACTOR,
      rightEdgeX - position.xMm,
      fontSizeMm * VERTICAL_BOX_HEIGHT_FACTOR,
    );
  }
}
