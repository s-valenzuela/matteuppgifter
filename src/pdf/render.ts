import { jsPDF } from 'jspdf';
import type { DocumentConfig, Problem } from '../types';
import { formatAnswer, formatProblemPrompt } from './format';
import { A4_METRICS, computeGridLayout, type CellPosition, type GridLayout } from './layout';

const BLANK_PLACEHOLDER = '_______';
const LINE_LENGTH_MM = 14;
const BOX_SIZE_MM = 7;
const GAP_AFTER_PROMPT_MM = 2;

export function renderProblemsToPdf(problems: Problem[], config: DocumentConfig): jsPDF {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const layout = computeGridLayout({
    problemCount: problems.length,
    fontSizePt: config.fontSizePt,
    columns: config.columns,
  });

  if (layout.pageCount === 0) {
    // Inga uppgifter att rita — lämna kvar en enda sida med bara rubriken.
    drawHeader(doc, config, null);
    drawFooter(doc, 0, 1, config.seed);
    return doc;
  }

  renderSection(doc, problems, layout, config, { showAnswers: false, sectionLabel: null });

  if (config.includeAnswerKey) {
    doc.addPage();
    renderSection(doc, problems, layout, config, { showAnswers: true, sectionLabel: 'Facit' });
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
  options: SectionOptions,
): void {
  for (let page = 0; page < layout.pageCount; page++) {
    if (page > 0) {
      doc.addPage();
    }
    drawHeader(doc, config, options.sectionLabel);
    for (const position of layout.positions) {
      if (position.page === page) {
        drawProblem(doc, problems[position.index], position, config, options.showAnswers);
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
): void {
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(config.fontSizePt);

  const prompt = `${position.index + 1}. ${formatProblemPrompt(problem)}`;
  doc.text(prompt, position.xMm, position.yMm);

  const answerX = position.xMm + doc.getTextWidth(prompt) + GAP_AFTER_PROMPT_MM;

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
