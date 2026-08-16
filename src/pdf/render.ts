import { jsPDF } from 'jspdf';
import { clockPhrase, digitalTime } from '../core/clock';
import { equationAnswer } from '../core/equations';
import type {
  ClockGeneratorConfig,
  ClockProblem,
  DocumentConfig,
  EquationProblem,
  FractionGeneratorConfig,
  FractionProblem,
  GeometryGeneratorConfig,
  GeometryProblem,
  MeasurementProblem,
  PatternGeneratorConfig,
  PatternProblem,
  Problem,
} from '../types';
import {
  formatGeometryValue,
  geometryAnswer,
  geometryMeasureLabel,
  geometryUnit,
} from '../core/geometry';
import { computeOperandDigitCounts, formatAnswer, OPERATION_SYMBOLS } from './format';
import { drawClockFace } from './clockFace';
import { drawFractionShape } from './fractionShape';
import { drawGeometryFigure } from './geometryFigure';
import {
  A4_METRICS,
  CLOCK_FACE_LABEL_GAP_MM,
  computeGridLayout,
  computeHeaderHeightMm,
  FRACTION_BLANK_STACK_GAP_MM,
  fractionStackReachAboveMm,
  FRACTION_SHAPE_LABEL_GAP_MM,
  GEOMETRY_FIGURE_LABEL_GAP_MM,
  HEADER_EXTRA_LINE_MM,
  MM_PER_PT,
  VERTICAL_BOX_GAP_FACTOR,
  VERTICAL_BOX_HEIGHT_FACTOR,
  VERTICAL_LINE_STEP_FACTOR,
  VERTICAL_RULE_GAP_FACTOR,
  type CellPosition,
  type GridLayout,
  type PageMetrics,
} from './layout';

const BLANK_PLACEHOLDER = '_______';
const LINE_LENGTH_MM = 14;
const BOX_SIZE_MM = 7;
const GAP_AFTER_PROMPT_MM = 2;
/** Luft runt operatorn och likhetstecknet, i mm. */
const SYMBOL_GAP_MM = 1.5;
/**
 * Extra avstånd (utöver VERTICAL_RULE_GAP_FACTOR) mellan operand 2 och
 * strecket när operand 2 själv är den tomma platsen i "Saknat tal"-läget —
 * annars hamnar tomrummets egen linje nästan ovanpå strecket och de flyter
 * ihop visuellt till en enda linje. Ryms inom den luft (+0.5) som
 * VERTICAL_ROW_EXTRA_GAP_FACTOR i layout.ts redan reserverar utöver
 * streck+ruta, så radhöjden behöver inte räknas om.
 */
const VERTICAL_RULE_GAP_EXTRA_FOR_B_FACTOR = 0.3;

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
    metrics: layoutMetricsFor(config, problems.length),
  });

  if (layout.pageCount === 0) {
    // Inga uppgifter att rita — lämna kvar en enda sida med bara rubriken.
    drawHeader(doc, config, null, false);
    drawFooter(doc, 0, 1, config);
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
    const showExampleNote = !options.showAnswers && config.exampleFirst && page === 0;
    drawHeader(doc, config, options.sectionLabel, showExampleNote);
    for (const position of layout.positions) {
      if (position.page === page) {
        const showAnswers = options.showAnswers || (config.exampleFirst && position.index === 0);
        drawProblem(doc, problems[position.index], position, config, showAnswers, metrics);
      }
    }
    drawFooter(doc, page, layout.pageCount, config);
  }
}

/** Hur många extra rader (utöver titel + namn/datum) som sidhuvudet behöver
 * rymma — instruktionstexten och/eller "löst exempel"-notisen, se
 * drawHeader. Delad av alla tre renderXToPdf-funktionerna så att
 * layout.ts:s radhöjdsreservation och render.ts:s faktiska utskrift alltid
 * använder exakt samma tal (samma princip som fractionStackReachAboveMm). */
function headerExtraLineCount(config: DocumentConfig, problemCount: number): number {
  return (
    (config.header.instructions.trim() ? 1 : 0) + (config.exampleFirst && problemCount > 0 ? 1 : 0)
  );
}

/** `metrics` att skicka till computeGridLayout — A4_METRICS med en högre
 * headerHeightMm om sidhuvudet behöver extra rader (se headerExtraLineCount),
 * annars odefinierad så computeGridLayout faller tillbaka till sitt eget
 * standardvärde. */
function layoutMetricsFor(config: DocumentConfig, problemCount: number): PageMetrics | undefined {
  const extraLineCount = headerExtraLineCount(config, problemCount);
  if (extraLineCount === 0) return undefined;
  return {
    ...A4_METRICS,
    headerHeightMm: computeHeaderHeightMm(A4_METRICS.headerHeightMm, extraLineCount),
  };
}

/**
 * `showExampleNote` skrivs bara ut på UPPGIFTSSIDAN (facit behöver den
 * inte — där är alla uppgifter redan lösta) och bara när det faktiskt
 * finns en uppgift 1 att exemplifiera, se headerExtraLineCount och de tre
 * renderXSection-funktionerna.
 */
function drawHeader(
  doc: jsPDF,
  config: DocumentConfig,
  sectionLabel: string | null,
  showExampleNote: boolean,
): void {
  const { marginMm } = A4_METRICS;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  const titleText = sectionLabel ? `${config.header.title} — ${sectionLabel}` : config.header.title;
  if (titleText) {
    doc.text(titleText, marginMm, marginMm + 5);
  }

  if (sectionLabel) return;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  let y = marginMm + 12;

  const fields: string[] = [];
  if (config.header.showName) {
    fields.push('Namn: _______________________');
  }
  if (config.header.showDate) {
    fields.push('Datum: ______________');
  }
  if (fields.length > 0) {
    doc.text(fields.join('        '), marginMm, y);
    y += HEADER_EXTRA_LINE_MM;
  }

  const instructions = config.header.instructions.trim();
  if (instructions) {
    doc.setFont('helvetica', 'italic');
    doc.text(instructions, marginMm, y);
    doc.setFont('helvetica', 'normal');
    y += HEADER_EXTRA_LINE_MM;
  }

  if (showExampleNote) {
    doc.setFont('helvetica', 'italic');
    doc.text('Uppgift 1 är ett löst exempel.', marginMm, y);
    doc.setFont('helvetica', 'normal');
  }
}

/** Webbadressen som skrivs ut (och länkas) i sidfoten, se drawFooter — så att
 * ett utskrivet eller vidarebefordrat blad alltid går att spåra tillbaka till
 * generatorn, även utan den delbara länken (som dessutom är seed-specifik
 * och därför mycket längre än den här). */
const SITE_URL = 'https://www.matteuppgifter.se';

function drawFooter(doc: jsPDF, page: number, totalPages: number, config: DocumentConfig): void {
  const { pageWidthMm, pageHeightMm, marginMm } = A4_METRICS;
  const y = pageHeightMm - marginMm / 2;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  const pageText = `Sida ${page + 1} av ${totalPages}`;
  const footerText = config.showSeed ? `${pageText} · seed ${config.seed}` : pageText;
  doc.text(footerText, pageWidthMm - marginMm, y, {
    align: 'right',
  });
  // textWithLink (till skillnad från text()) lägger även till en klickbar
  // länkannotation ovanpå texten — synlig som vanlig text i utskrift, men
  // klickbar i alla PDF-läsare.
  doc.textWithLink(SITE_URL.replace('https://', ''), marginMm, y, { url: SITE_URL });
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

/**
 * Vågrätt: "12 + 7 = ____" — eller, i "Saknat tal"-läget, tomrummet på en
 * annan plats: "__ + 7 = 19" / "12 + __ = 19". Vilken plats som är tom styrs
 * av problem.missingSlot (alltid 'answer' i det vanliga läget). I facit
 * (showAnswers) visas alltid alla tre delarna, oavsett missingSlot.
 */
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

  const blankSlot = showAnswers ? null : problem.missingSlot;

  // Operand A högerjusteras mot slutet av sin kolumn ...
  const aX = position.xMm + metrics.slotAWidthMm;
  if (blankSlot === 'a') {
    drawOperandBlank(doc, aX, position.yMm, metrics.slotAWidthMm, config.answerStyle);
  } else {
    doc.text(String(problem.a), aX, position.yMm, { align: 'right' });
  }

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
  if (blankSlot === 'b') {
    drawOperandBlank(doc, bX, position.yMm, metrics.slotBWidthMm, config.answerStyle);
  } else {
    doc.text(String(problem.b), bX, position.yMm, { align: 'right' });
  }

  const equalsX = bX + SYMBOL_GAP_MM;
  doc.text('=', equalsX, position.yMm);

  const answerX = equalsX + doc.getTextWidth('=') + GAP_AFTER_PROMPT_MM;

  if (blankSlot !== 'answer') {
    // Facit, eller "Saknat tal" med tomrum på a/b — svaret är känt/givet.
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
 * Ritar en tom plats i stället för en operand, högerjusterad mot rightEdgeX
 * med exakt bredden widthMm — samma bredd som kolumnen redan reserverat åt
 * den siffran (metrics.slotAWidthMm/slotBWidthMm), så att markeringen aldrig
 * kan sticka ut i föregående kolumn. Det vanliga understreck-teckenutdraget
 * (BLANK_PLACEHOLDER) är kalibrerat för svarsfältets fria yta och skulle
 * kunna bli bredare än den smala, exakt reserverade sifferkolumnen — därför
 * ritas 'blank' här som samma korta linje som 'line', bara 'box' skiljer sig.
 */
function drawOperandBlank(
  doc: jsPDF,
  rightEdgeX: number,
  yMm: number,
  widthMm: number,
  answerStyle: DocumentConfig['answerStyle'],
): void {
  const leftEdgeX = rightEdgeX - widthMm;
  if (answerStyle === 'box') {
    doc.rect(leftEdgeX, yMm - BOX_SIZE_MM + 2, widthMm, BOX_SIZE_MM);
  } else {
    doc.line(leftEdgeX, yMm + 1, rightEdgeX, yMm + 1);
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

  const blankSlot = showAnswers ? null : problem.missingSlot;

  // Om operand 2 (precis ovanför strecket) är den tomma platsen, flyttas
  // strecket ner ett extra litet stycke — annars hamnar tomrummets egen
  // linje (drawOperandBlank) nästan ovanpå strecket och de två flyter ihop
  // till en enda linje, se VERTICAL_RULE_GAP_EXTRA_FOR_B_FACTOR-kommentaren.
  const ruleGapFactor =
    VERTICAL_RULE_GAP_FACTOR + (blankSlot === 'b' ? VERTICAL_RULE_GAP_EXTRA_FOR_B_FACTOR : 0);
  const ruleY = operand2Y + fontSizeMm * ruleGapFactor;

  if (blankSlot === 'a') {
    drawOperandBlank(doc, rightEdgeX, operand1Y, operandColumnWidthMm, config.answerStyle);
  } else {
    doc.text(String(problem.a), rightEdgeX, operand1Y, { align: 'right' });
  }

  const symbol = OPERATION_SYMBOLS[problem.op];
  const symbolWidth = doc.getTextWidth(symbol);
  doc.text(symbol, position.xMm + (metrics.operatorSlotWidthMm - symbolWidth) / 2, operand2Y);

  if (blankSlot === 'b') {
    drawOperandBlank(doc, rightEdgeX, operand2Y, operandColumnWidthMm, config.answerStyle);
  } else {
    doc.text(String(problem.b), rightEdgeX, operand2Y, { align: 'right' });
  }

  doc.line(position.xMm, ruleY, rightEdgeX, ruleY);

  if (blankSlot !== 'answer') {
    // Facit, eller "Saknat tal" med tomrum på a/b — svaret är känt/givet.
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

/** Den del av ClockGeneratorConfig som faktiskt behövs för att RITA ett
 * klockblad — count/avoidDuplicates/seed styr bara genereringen, se core/clock.ts. */
export type ClockDocumentOptions = Pick<ClockGeneratorConfig, 'showNumerals' | 'showMinuteTicks'>;

/**
 * Klockblad delar sidhuvud/sidfot och sidbrytningslogik med
 * renderProblemsToPdf, men har ett eget uppgiftsformat (urtavla + text i
 * stället för en rad med siffror) — se drawClockProblem. Arrayerna hålls
 * medvetet isär (Problem[] kontra ClockProblem[]) i stället för att slås ihop
 * till en gemensam union, så att hela den befintliga uppgiftsrenderingen
 * ovan förblir orörd.
 */
export function renderClockSheetToPdf(
  problems: ClockProblem[],
  config: DocumentConfig,
  clockOptions: ClockDocumentOptions,
): jsPDF {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const layout = computeGridLayout({
    problemCount: problems.length,
    fontSizePt: config.fontSizePt,
    columns: config.columns,
    layout: 'clock',
    metrics: layoutMetricsFor(config, problems.length),
  });

  if (layout.pageCount === 0) {
    drawHeader(doc, config, null, false);
    drawFooter(doc, 0, 1, config);
    return doc;
  }

  renderClockSection(doc, problems, layout, config, clockOptions, {
    showAnswers: false,
    sectionLabel: null,
  });

  if (config.includeAnswerKey) {
    doc.addPage();
    renderClockSection(doc, problems, layout, config, clockOptions, {
      showAnswers: true,
      sectionLabel: 'Facit',
    });
  }

  return doc;
}

function renderClockSection(
  doc: jsPDF,
  problems: ClockProblem[],
  layout: GridLayout,
  config: DocumentConfig,
  clockOptions: ClockDocumentOptions,
  options: SectionOptions,
): void {
  for (let page = 0; page < layout.pageCount; page++) {
    if (page > 0) {
      doc.addPage();
    }
    const showExampleNote = !options.showAnswers && config.exampleFirst && page === 0;
    drawHeader(doc, config, options.sectionLabel, showExampleNote);
    for (const position of layout.positions) {
      if (position.page === page) {
        const showAnswers = options.showAnswers || (config.exampleFirst && position.index === 0);
        drawClockProblem(
          doc,
          problems[position.index],
          position,
          layout,
          config,
          clockOptions,
          showAnswers,
        );
      }
    }
    drawFooter(doc, page, layout.pageCount, config);
  }
}

/**
 * position.yMm är (liksom i de andra layouterna) baslinjen för radens sista
 * textrad — här: textraden under urtavlan. Urtavlans centrum räknas uppåt
 * därifrån med exakt samma tal (clockDiameterMm, CLOCK_FACE_LABEL_GAP_MM) som
 * layout.ts reserverade radhöjd utifrån, se computeGridLayout.
 */
/** Textstorleken krymper aldrig under det här, oavsett hur trång kolumnen är. */
const MIN_CLOCK_LABEL_FONT_PT = 7;
/** Liten säkerhetsmarginal i sidled mot nästa kolumn. */
const CLOCK_LABEL_MAX_WIDTH_MARGIN_MM = 2;
/** Motsvarande marginal för geometribladets svarsrad, se drawGeometryProblem. */
const GEOMETRY_LABEL_MAX_WIDTH_MARGIN_MM = 2;

function drawClockProblem(
  doc: jsPDF,
  problem: ClockProblem,
  position: CellPosition,
  layout: GridLayout,
  config: DocumentConfig,
  clockOptions: ClockDocumentOptions,
  showAnswers: boolean,
): void {
  const diameter = layout.clockDiameterMm!;
  const radius = diameter / 2;
  const faceCenterX = position.xMm + layout.columnWidthMm / 2;
  const faceCenterY = position.yMm - CLOCK_FACE_LABEL_GAP_MM - radius;
  const maxLabelWidthMm = layout.columnWidthMm - CLOCK_LABEL_MAX_WIDTH_MARGIN_MM;

  // Facit visar alltid visarna på urtavlan, oavsett riktning — annars går
  // "Rita visarna"-uppgifterna inte att kontrollera mot ett facit. I den
  // vanliga (icke-facit) sidan saknas visarna bara för 'draw'/'digitalDraw',
  // där det är själva poängen att eleven ritar dem för hand — 'read' och
  // 'digital' utgår båda från en synlig urtavla, bara svarsformatet skiljer
  // dem åt.
  const isDrawDirection = problem.direction === 'draw' || problem.direction === 'digitalDraw';
  const showHands = showAnswers || !isDrawDirection;
  drawClockFace(doc, faceCenterX, faceCenterY, radius, {
    hour: showHands ? problem.hour : undefined,
    minute: showHands ? problem.minute : undefined,
    showNumerals: clockOptions.showNumerals,
    showMinuteTicks: clockOptions.showMinuteTicks,
  });

  if (isDrawDirection) {
    // Prompten (frasen eller den digitala tiden) ÄR uppgiften här (urtavlan
    // saknar visare) — samma text i både uppgift och facit, bara urtavlans
    // visare skiljer dem åt.
    const label =
      problem.direction === 'digitalDraw'
        ? digitalTime(problem.hour, problem.minute)
        : clockPhrase(problem.hour, problem.minute);
    drawFittedCenteredClockLabel(
      doc,
      label,
      faceCenterX,
      position.yMm,
      maxLabelWidthMm,
      config.fontSizePt,
    );
    return;
  }

  if (problem.direction === 'digital') {
    if (showAnswers) {
      drawFittedCenteredClockLabel(
        doc,
        digitalTime(problem.hour, problem.minute),
        faceCenterX,
        position.yMm,
        maxLabelWidthMm,
        config.fontSizePt,
      );
      return;
    }
    drawClockDigitalPrompt(doc, faceCenterX, position.yMm, config.answerStyle, config.fontSizePt);
    return;
  }

  // direction === 'read'
  if (showAnswers) {
    const phrase = clockPhrase(problem.hour, problem.minute);
    drawFittedCenteredClockLabel(
      doc,
      `Klockan är ${phrase}.`,
      faceCenterX,
      position.yMm,
      maxLabelWidthMm,
      config.fontSizePt,
    );
    return;
  }

  drawClockReadPrompt(
    doc,
    faceCenterX,
    position.yMm,
    config.answerStyle,
    maxLabelWidthMm,
    config.fontSizePt,
  );
}

/**
 * Skriver en centrerad textrad och krymper teckenstorleken (aldrig under
 * MIN_CLOCK_LABEL_FONT_PT) om den annars skulle bli bredare än kolumnen.
 * Klockfraserna varierar mycket i längd ("tre" mot "tio över halv sju"), till
 * skillnad från räknesättens siffror/operatorer där hela kolumnbredden mäts
 * upp i förväg (se computeProblemMetrics) — en fast teckenstorlek hade annars
 * kunnat få en lång fras att krocka med nästa kolumns urtavla.
 */
function drawFittedCenteredClockLabel(
  doc: jsPDF,
  text: string,
  centerX: number,
  baselineY: number,
  maxWidthMm: number,
  basePt: number,
): void {
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(basePt);
  const width = doc.getTextWidth(text);
  if (width > maxWidthMm) {
    doc.setFontSize(Math.max(basePt * (maxWidthMm / width), MIN_CLOCK_LABEL_FONT_PT));
  }
  doc.text(text, centerX, baselineY, { align: 'center' });
}

/**
 * "Klockan är ____" (eller en linje/ruta i stället för understrecket,
 * beroende på config.answerStyle) — centrerad som en helhet under urtavlan.
 * jsPDF:s `align: 'center'` centrerar bara en enskild text()-anrop, så hela
 * bredden (prompt + tomrum) räknas ut först och promptens vänsterkant
 * placeras därefter för hand, samma teknik som drawOperandBlank använder för
 * att hålla en tom plats inom en exakt reserverad bredd. Krymps precis som
 * drawFittedCenteredClockLabel om den ändå blir för bred för kolumnen.
 */
function drawClockReadPrompt(
  doc: jsPDF,
  centerX: number,
  baselineY: number,
  answerStyle: DocumentConfig['answerStyle'],
  maxWidthMm: number,
  basePt: number,
): void {
  drawCenteredPromptWithBlank(doc, {
    centerX,
    baselineY,
    prompt: 'Klockan är ',
    answerStyle,
    maxWidthMm,
    basePt,
  });
}

interface CenteredPromptOptions {
  centerX: number;
  baselineY: number;
  /** Texten före tomrummet, t.ex. "Klockan är " eller "Area = ". */
  prompt: string;
  /** Valfri text efter tomrummet, t.ex. " cm²". Räknas in i centreringen. */
  suffix?: string;
  answerStyle: DocumentConfig['answerStyle'];
  maxWidthMm: number;
  basePt: number;
}

/**
 * "prompt ____ suffix", centrerat som EN enhet kring centerX och krympt om
 * det inte ryms i kolumnen. jsPDF:s `align: 'center'` centrerar bara ett
 * enskilt text()-anrop, så hela bredden räknas ut först och delarna placeras
 * därefter för hand — samma teknik som drawOperandBlank använder för att
 * hålla en tom plats inom en exakt reserverad bredd.
 *
 * Delad av klockans "Klockan är ____" och geometrins "Area = ____ cm²".
 */
function drawCenteredPromptWithBlank(doc: jsPDF, options: CenteredPromptOptions): void {
  const { centerX, baselineY, prompt, suffix = '', answerStyle, maxWidthMm, basePt } = options;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(basePt);

  const measure = (): { promptWidth: number; blankWidth: number; suffixWidth: number } => ({
    promptWidth: doc.getTextWidth(prompt),
    blankWidth:
      answerStyle === 'blank'
        ? doc.getTextWidth(BLANK_PLACEHOLDER)
        : answerStyle === 'line'
          ? LINE_LENGTH_MM
          : BOX_SIZE_MM,
    suffixWidth: suffix ? doc.getTextWidth(suffix) : 0,
  });

  let { promptWidth, blankWidth, suffixWidth } = measure();
  let totalWidth = promptWidth + blankWidth + suffixWidth;
  if (totalWidth > maxWidthMm) {
    doc.setFontSize(Math.max(basePt * (maxWidthMm / totalWidth), MIN_CLOCK_LABEL_FONT_PT));
    ({ promptWidth, blankWidth, suffixWidth } = measure());
    totalWidth = promptWidth + blankWidth + suffixWidth;
  }

  const startX = centerX - totalWidth / 2;
  doc.text(prompt, startX, baselineY);
  const blankStartX = startX + promptWidth;

  switch (answerStyle) {
    case 'blank':
      doc.text(BLANK_PLACEHOLDER, blankStartX, baselineY);
      break;
    case 'line':
      doc.line(blankStartX, baselineY + 1, blankStartX + blankWidth, baselineY + 1);
      break;
    case 'box':
      doc.rect(blankStartX, baselineY - BOX_SIZE_MM + 2, BOX_SIZE_MM, BOX_SIZE_MM);
      break;
  }

  if (suffix) {
    doc.text(suffix, blankStartX + blankWidth, baselineY);
  }
}

/** "__:__" — inget prefix behövs (till skillnad från "Klockan är"-prompten)
 * eftersom en digital tomruta läses av sig själv, precis som på en riktig
 * digitalklocka. Bredden är i praktiken alltid liten nog att den aldrig
 * behöver krympas, men går genom samma fit-funktion för konsekvensens skull. */
const DIGITAL_BLANK_PLACEHOLDER = '__:__';

function drawClockDigitalPrompt(
  doc: jsPDF,
  centerX: number,
  baselineY: number,
  answerStyle: DocumentConfig['answerStyle'],
  basePt: number,
): void {
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(basePt);

  if (answerStyle === 'blank') {
    doc.text(DIGITAL_BLANK_PLACEHOLDER, centerX, baselineY, { align: 'center' });
    return;
  }

  const widthMm = answerStyle === 'line' ? LINE_LENGTH_MM : BOX_SIZE_MM;
  const startX = centerX - widthMm / 2;
  if (answerStyle === 'line') {
    doc.line(startX, baselineY + 1, startX + widthMm, baselineY + 1);
  } else {
    doc.rect(startX, baselineY - BOX_SIZE_MM + 2, BOX_SIZE_MM, BOX_SIZE_MM);
  }
}

/**
 * Bråkblad delar sidhuvud/sidfot och sidbrytningslogik med de andra
 * renderXToPdf-funktionerna, men har ett eget uppgiftsformat (figur + ett
 * riktigt uppställt bråk i stället för en textrad), se drawFractionProblem.
 */
/** Den del av FractionGeneratorConfig som faktiskt behövs för att RITA ett
 * bråkblad — count/avoidDuplicates/seed styr bara genereringen, se
 * core/fractions.ts. `direction` behövs (utöver per-uppgift på
 * FractionProblem) för att avgöra vilken layoutMode hela sidan ska använda
 * INNAN uppgifterna finns, se renderFractionSheetToPdf — 'toPercent' saknar
 * figur och använder 'fractionText' i stället för 'fraction'. Samma mönster
 * som ClockDocumentOptions i övrigt. */
export type FractionDocumentOptions = Pick<FractionGeneratorConfig, 'showPercent' | 'direction'>;

export function renderFractionSheetToPdf(
  problems: FractionProblem[],
  config: DocumentConfig,
  fractionOptions: FractionDocumentOptions,
): jsPDF {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  // 'toPercent' slumpas aldrig fram av 'mixed' (se resolveDirection i
  // core/fractions.ts), så om den valts är den den ENDA riktningen på hela
  // sidan — annars är 'fraction' alltid rätt, oavsett om enskilda uppgifter
  // råkar bli 'identify'/'shade'/'identifyPercent' via 'mixed'.
  const layoutMode = fractionOptions.direction === 'toPercent' ? 'fractionText' : 'fraction';
  const layout = computeGridLayout({
    problemCount: problems.length,
    fontSizePt: config.fontSizePt,
    columns: config.columns,
    layout: layoutMode,
    metrics: layoutMetricsFor(config, problems.length),
  });

  if (layout.pageCount === 0) {
    drawHeader(doc, config, null, false);
    drawFooter(doc, 0, 1, config);
    return doc;
  }

  renderFractionSection(doc, problems, layout, config, fractionOptions, {
    showAnswers: false,
    sectionLabel: null,
  });

  if (config.includeAnswerKey) {
    doc.addPage();
    renderFractionSection(doc, problems, layout, config, fractionOptions, {
      showAnswers: true,
      sectionLabel: 'Facit',
    });
  }

  return doc;
}

function renderFractionSection(
  doc: jsPDF,
  problems: FractionProblem[],
  layout: GridLayout,
  config: DocumentConfig,
  fractionOptions: FractionDocumentOptions,
  options: SectionOptions,
): void {
  for (let page = 0; page < layout.pageCount; page++) {
    if (page > 0) {
      doc.addPage();
    }
    const showExampleNote = !options.showAnswers && config.exampleFirst && page === 0;
    drawHeader(doc, config, options.sectionLabel, showExampleNote);
    for (const position of layout.positions) {
      if (position.page === page) {
        const showAnswers = options.showAnswers || (config.exampleFirst && position.index === 0);
        drawFractionProblem(
          doc,
          problems[position.index],
          position,
          layout,
          config,
          fractionOptions,
          showAnswers,
        );
      }
    }
    drawFooter(doc, page, layout.pageCount, config);
  }
}

/**
 * 'identify' — figuren visas alltid färglagd (annars finns inget att läsa
 * av) och eleven skriver bråket; uppgiftssidan visar tomma, uppställda
 * platser i stället för siffrorna. 'shade' — figuren är tom (outline) på
 * uppgiftssidan och det givna bråket står under; facit färglägger figuren.
 * Se motsvarande resonemang för 'read'/'draw' i drawClockProblem.
 */
function drawFractionProblem(
  doc: jsPDF,
  problem: FractionProblem,
  position: CellPosition,
  layout: GridLayout,
  config: DocumentConfig,
  fractionOptions: FractionDocumentOptions,
  showAnswers: boolean,
): void {
  if (problem.direction === 'toPercent') {
    drawFractionToPercentProblem(doc, problem, position, layout, config, showAnswers);
    return;
  }

  const size = layout.fractionSizeMm!;
  const centerX = position.xMm + layout.columnWidthMm / 2;

  const isShadeDirection = problem.direction === 'shade';
  const shaded = showAnswers || !isShadeDirection;
  // Samma tal som layout.ts reserverat radhöjd utifrån (se
  // computeGridLayout) — annars kan figuren hamna högre eller lägre än den
  // plats som faktiskt är avsatt åt den.
  const topY =
    position.yMm -
    FRACTION_SHAPE_LABEL_GAP_MM -
    fractionStackReachAboveMm(config.fontSizePt * MM_PER_PT) -
    size;

  drawFractionShape(
    doc,
    problem.shape,
    centerX,
    topY,
    size,
    problem.numerator,
    problem.denominator,
    shaded,
  );

  if (problem.direction === 'identifyPercent') {
    // Som 'identify', men svaret är bråkets andel i procent i stället för
    // bråket självt — se drawFractionIdentifyPercentAnswer. Till skillnad
    // från den tvåradiga täljare/nämnare-stapeln är det här bara EN textrad,
    // så den centreras i den plats som fractionStackReachAboveMm reserverat
    // åt hela stapeln (i stället för att stå kvar nere vid position.yMm, där
    // nämnaren annars hade suttit) — annars blir gapet upp mot figuren
    // onödigt stort och gapet ner mot nästa uppgift onödigt litet.
    const singleLineY = position.yMm - fractionStackReachAboveMm(config.fontSizePt * MM_PER_PT) / 2;
    drawFractionIdentifyPercentAnswer(
      doc,
      problem,
      centerX,
      singleLineY,
      config.answerStyle,
      config.fontSizePt,
      showAnswers,
    );
    return;
  }

  if (isShadeDirection || showAnswers) {
    // 'shade': det givna bråket står kvar oförändrat i både uppgift och
    // facit — bara figurens färgläggning skiljer dem åt. 'identify' i facit:
    // samma plats visar nu det korrekta svaret i stället för tomma platser.
    drawStackedFractionText(
      doc,
      centerX,
      position.yMm,
      String(problem.numerator),
      String(problem.denominator),
      config.fontSizePt,
      fractionOptions.showPercent
        ? { text: formatFractionPercent(problem.numerator, problem.denominator) }
        : undefined,
      layout.columnWidthMm,
    );
    return;
  }

  // 'identify', innan facit — figuren är svaret, eleven fyller i täljare/nämnare.
  drawStackedFractionBlank(doc, centerX, position.yMm, config.answerStyle, config.fontSizePt);
}

/**
 * 'toPercent' — helt utan figur (se resolveDirection i core/fractions.ts):
 * bråket ritas uppställt precis som facit/"shade" alltid gör, och eleven
 * skriver om det till procent till höger om strecket i stället för att
 * läsa av en färglagd figur. Radhöjden är layoutMode 'fractionText' i
 * layout.ts — samma stapelhöjd som 'fraction' men utan figurens utrymme.
 */
function drawFractionToPercentProblem(
  doc: jsPDF,
  problem: FractionProblem,
  position: CellPosition,
  layout: GridLayout,
  config: DocumentConfig,
  showAnswers: boolean,
): void {
  const centerX = position.xMm + layout.columnWidthMm / 2;
  drawStackedFractionText(
    doc,
    centerX,
    position.yMm,
    String(problem.numerator),
    String(problem.denominator),
    config.fontSizePt,
    showAnswers
      ? { text: formatFractionPercent(problem.numerator, problem.denominator) }
      : { answerStyle: config.answerStyle },
    layout.columnWidthMm,
  );
}

/**
 * 'identifyPercent' — samma centrerade plats under figuren som
 * drawStackedFractionBlank/-Text använder för bråket, men EN rad (procent)
 * i stället för två staplade (täljare/nämnare). "%"-tecknet skrivs alltid
 * ut bredvid tomrummet (även innan facit) så att eleven vet vilken enhet
 * som förväntas, samma princip som klockans "__:__"-platshållare.
 */
function drawFractionIdentifyPercentAnswer(
  doc: jsPDF,
  problem: FractionProblem,
  centerX: number,
  baselineY: number,
  answerStyle: DocumentConfig['answerStyle'],
  fontSizePt: number,
  showAnswers: boolean,
): void {
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(fontSizePt);

  if (showAnswers) {
    doc.text(formatFractionPercent(problem.numerator, problem.denominator), centerX, baselineY, {
      align: 'center',
    });
    return;
  }

  const suffix = ' %';
  const blankWidth =
    answerStyle === 'box'
      ? BOX_SIZE_MM
      : answerStyle === 'line'
        ? LINE_LENGTH_MM
        : doc.getTextWidth(FRACTION_BLANK_PLACEHOLDER);
  const suffixWidth = doc.getTextWidth(suffix);
  const blankCenterX = centerX - suffixWidth / 2;

  drawCenteredBlank(doc, blankCenterX, baselineY, answerStyle);
  doc.text(suffix, blankCenterX + blankWidth / 2, baselineY);
}

/**
 * T.ex. "75 %" om det går jämnt upp, annars "~33 %" — avrundat till
 * närmaste heltal så att en obekant elev alltid möts av ett rent tal, med
 * "~" som ärlig markering när avrundningen faktiskt tappar information.
 * Tilde i stället för det matematiska tecknet "≈": jsPDF:s inbyggda
 * Helvetica-typsnitt stöder bara WinAnsiEncoding (ungefär Windows-1252) —
 * "≈" (U+2248) saknas där och renderades som rappakalja ("H 3 3" i stället
 * för "33") tills detta upptäcktes genom visuell verifiering av en
 * rasteriserad PDF-sida.
 */
function formatFractionPercent(numerator: number, denominator: number): string {
  const exact = (numerator / denominator) * 100;
  const rounded = Math.round(exact);
  const prefix = Number.isInteger(exact) ? '' : '~';
  return `${prefix}${rounded} %`;
}

/** Kortare än den vanliga BLANK_PLACEHOLDER — en täljare/nämnare är alltid
 * en kort siffra, aldrig ett flercifrigt tal som behöver ett långt streck. */
const FRACTION_BLANK_PLACEHOLDER = '__';
/** BråkstrecKets bredd när det inte finns någon text att mäta upp mot
 * (drawStackedFractionBlank) — samma bredd som en 'line'-tomruta. */
const FRACTION_RULE_MIN_WIDTH_MM = LINE_LENGTH_MM;
/** Luft mellan siffrornas bredd och bråkstreckets kant, per sida. */
const FRACTION_RULE_PADDING_MM = 1.5;

interface FractionStackYs {
  numeratorY: number;
  ruleY: number;
  denominatorY: number;
}

/**
 * Täljare/streck/nämnare staplas med exakt samma avstånd som en operand/rad i
 * uppställningsläget (VERTICAL_LINE_STEP_FACTOR/VERTICAL_RULE_GAP_FACTOR) —
 * samma geometri som layout.ts:s textskalade term reserverat radhöjd
 * utifrån för layoutMode 'fraction' (se computeGridLayout). Används bara för
 * KÄNDA siffror (facit/"shade"-uppgiften) — se computeFractionBlankStackYs
 * för den obesvarade platshållarvarianten, som har en annan (fast) geometri.
 */
function computeFractionStackYs(baselineY: number, fontSizePt: number): FractionStackYs {
  const fontSizeMm = fontSizePt * MM_PER_PT;
  const denominatorY = baselineY;
  const numeratorY = denominatorY - fontSizeMm * VERTICAL_LINE_STEP_FACTOR;
  const ruleY = numeratorY + fontSizeMm * VERTICAL_RULE_GAP_FACTOR;
  return { numeratorY, ruleY, denominatorY };
}

/** Rutans utsträckning ovanför sin baslinje, se drawCenteredBlank — samma
 * "-2"-konvention som layout.ts:s FRACTION_BLANK_BOX_REACH_ABOVE_MM
 * (hårdkodad separat där för att undvika ett cirkulärt beroende; håll de
 * två i synk om BOX_SIZE_MM ändras). */
const FRACTION_BLANK_BOX_REACH_ABOVE_MM = BOX_SIZE_MM - 2;
/**
 * Var strecket sitter, mm ovanför täljarens plats — mitt emellan täljarens
 * ruta (som sträcker sig FRACTION_BLANK_BOX_REACH_ABOVE_MM − 2 mm NEDANFÖR
 * täljarens plats, se drawCenteredBlanks 'box'-fall) och nämnarens ruta (som
 * på motsvarande sätt sträcker sig FRACTION_BLANK_BOX_REACH_ABOVE_MM mm
 * OVANFÖR nämnarens plats), med samma 1,5 mm marginal på båda sidor om
 * strecket. Räkna själv: täljarens rutas nederkant ligger på
 * täljarplatsen+2, nämnarens rutas överkant ligger på
 * täljarplatsen+FRACTION_BLANK_STACK_GAP_MM−FRACTION_BLANK_BOX_REACH_ABOVE_MM
 * — strecket läggs mitt emellan de två.
 */
const FRACTION_BLANK_RULE_OFFSET_MM =
  (2 + (FRACTION_BLANK_STACK_GAP_MM - FRACTION_BLANK_BOX_REACH_ABOVE_MM)) / 2;

/**
 * Geometrin för en OBESVARAD bråkuppgift (täljare/nämnare är tomma platser,
 * inte siffror) — ett FAST avstånd (FRACTION_BLANK_STACK_GAP_MM, se
 * layout.ts) oavsett teckenstorlek, till skillnad från computeFractionStackYs
 * ovan. Svarsstilen 'box' är alltid BOX_SIZE_MM hög oavsett textstorlek, så
 * en textskalad lucka skulle vid en liten teckenstorlek bli mindre än rutan
 * själv och rutorna/strecket krocka — upptäckt genom visuell verifiering
 * (rasteriserade PDF-sidor, se PLAN.md). Samma fasta avstånd används för
 * alla tre svarsstilarna, för ett enhetligt utseende oavsett vilken som är
 * vald (och eftersom layout.ts ändå måste reservera för värsta fallet).
 */
function computeFractionBlankStackYs(baselineY: number): FractionStackYs {
  const denominatorY = baselineY;
  const numeratorY = denominatorY - FRACTION_BLANK_STACK_GAP_MM;
  const ruleY = numeratorY + FRACTION_BLANK_RULE_OFFSET_MM;
  return { numeratorY, ruleY, denominatorY };
}

/** Luft mellan bråkstrecket/procenttexten och nästa kolumn, i mm — samma
 * princip som CLOCK_LABEL_MAX_WIDTH_MARGIN_MM. */
const FRACTION_PERCENT_MARGIN_MM = 2;

/** Vad som (om något) ska stå till höger om bråkstrecket — kända siffror
 * (facit, eller "shade"-uppgiftens givna procent) eller en tomruta att
 * fylla i (obesvarad "toPercent"). undefined = inget alls (t.ex. "Visa
 * procent" avstängt för identify/shade), se drawFractionProblem. */
type FractionPercentSuffix = { text: string } | { answerStyle: DocumentConfig['answerStyle'] };

function drawStackedFractionText(
  doc: jsPDF,
  centerX: number,
  baselineY: number,
  numeratorText: string,
  denominatorText: string,
  fontSizePt: number,
  percentSuffix?: FractionPercentSuffix,
  columnWidthMm?: number,
): void {
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(fontSizePt);
  const { numeratorY, ruleY, denominatorY } = computeFractionStackYs(baselineY, fontSizePt);

  doc.text(numeratorText, centerX, numeratorY, { align: 'center' });
  doc.text(denominatorText, centerX, denominatorY, { align: 'center' });

  const ruleHalfWidth =
    Math.max(doc.getTextWidth(numeratorText), doc.getTextWidth(denominatorText)) / 2 +
    FRACTION_RULE_PADDING_MM;
  doc.line(centerX - ruleHalfWidth, ruleY, centerX + ruleHalfWidth, ruleY);

  if (percentSuffix === undefined) return;

  if ('text' in percentSuffix) {
    drawFractionPercentSuffix(
      doc,
      centerX,
      ruleHalfWidth,
      ruleY,
      percentSuffix.text,
      fontSizePt,
      columnWidthMm,
    );
  } else {
    drawFractionPercentBlankSuffix(
      doc,
      centerX,
      ruleHalfWidth,
      ruleY,
      percentSuffix.answerStyle,
      fontSizePt,
    );
  }
}

/**
 * Skriver "= 75 %" till höger om bråkstrecket, i höjd med strecket (i
 * stället för under nämnaren, som annars hade krävt extra radhöjd —
 * kolumnbredden har oftare ledigt utrymme i sidled, se drawFractionShape).
 * Krymper teckenstorleken (aldrig under MIN_CLOCK_LABEL_FONT_PT, samma
 * princip som drawFittedCenteredClockLabel) om den annars skulle sticka in i
 * nästa kolumn.
 */
function drawFractionPercentSuffix(
  doc: jsPDF,
  centerX: number,
  ruleHalfWidth: number,
  ruleY: number,
  percentText: string,
  basePt: number,
  columnWidthMm: number | undefined,
): void {
  const suffix = ` = ${percentText}`;
  const startX = centerX + ruleHalfWidth;
  const maxWidthMm =
    columnWidthMm !== undefined
      ? columnWidthMm / 2 - ruleHalfWidth - FRACTION_PERCENT_MARGIN_MM
      : undefined;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(basePt);
  const width = doc.getTextWidth(suffix);
  if (maxWidthMm !== undefined && maxWidthMm > 0 && width > maxWidthMm) {
    doc.setFontSize(Math.max(basePt * (maxWidthMm / width), MIN_CLOCK_LABEL_FONT_PT));
  }
  // Baslinjen sänks en bit under strecket så texten optiskt centreras kring
  // det, i stället för att sitta ovanpå det.
  doc.text(suffix, startX, ruleY + basePt * MM_PER_PT * 0.32);
}

/**
 * Tomrum i stället för procentsiffrorna (drawFractionPercentSuffix), i
 * väntan på facit — "toPercent" innan facit. Samma tre svarsstilar som
 * resten av dokumentet, positionerat på samma plats till höger om
 * bråkstrecket, med " %" skrivet ut direkt efter tomrummet så att eleven vet
 * vilken enhet som förväntas (samma princip som klockans "__:__").
 */
function drawFractionPercentBlankSuffix(
  doc: jsPDF,
  centerX: number,
  ruleHalfWidth: number,
  ruleY: number,
  answerStyle: DocumentConfig['answerStyle'],
  fontSizePt: number,
): void {
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(fontSizePt);
  const baselineY = ruleY + fontSizePt * MM_PER_PT * 0.32;

  const prefix = ' = ';
  const startX = centerX + ruleHalfWidth;
  doc.text(prefix, startX, baselineY);
  const prefixWidth = doc.getTextWidth(prefix);

  const blankWidth =
    answerStyle === 'box'
      ? BOX_SIZE_MM
      : answerStyle === 'line'
        ? LINE_LENGTH_MM
        : doc.getTextWidth(FRACTION_BLANK_PLACEHOLDER);
  const blankCenterX = startX + prefixWidth + blankWidth / 2;
  drawCenteredBlank(doc, blankCenterX, baselineY, answerStyle);

  doc.text(' %', blankCenterX + blankWidth / 2, baselineY);
}

function drawStackedFractionBlank(
  doc: jsPDF,
  centerX: number,
  baselineY: number,
  answerStyle: DocumentConfig['answerStyle'],
  fontSizePt: number,
): void {
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(fontSizePt);
  const { numeratorY, ruleY, denominatorY } = computeFractionBlankStackYs(baselineY);

  drawCenteredBlank(doc, centerX, numeratorY, answerStyle);
  drawCenteredBlank(doc, centerX, denominatorY, answerStyle);
  doc.line(
    centerX - FRACTION_RULE_MIN_WIDTH_MM / 2,
    ruleY,
    centerX + FRACTION_RULE_MIN_WIDTH_MM / 2,
    ruleY,
  );
}

/** Samma tre svarsstilar som resten av dokumentet, men centrerade kring
 * centerX i stället för högerjusterade — se drawOperandBlank för motsvarande
 * högerjusterade variant. */
function drawCenteredBlank(
  doc: jsPDF,
  centerX: number,
  baselineY: number,
  answerStyle: DocumentConfig['answerStyle'],
): void {
  switch (answerStyle) {
    case 'blank':
      doc.text(FRACTION_BLANK_PLACEHOLDER, centerX, baselineY, { align: 'center' });
      break;
    case 'line':
      doc.line(
        centerX - LINE_LENGTH_MM / 2,
        baselineY + 1,
        centerX + LINE_LENGTH_MM / 2,
        baselineY + 1,
      );
      break;
    case 'box':
      doc.rect(centerX - BOX_SIZE_MM / 2, baselineY - BOX_SIZE_MM + 2, BOX_SIZE_MM, BOX_SIZE_MM);
      break;
  }
}

/**
 * Geometriblad delar sidhuvud/sidfot och sidbrytningslogik med de andra
 * renderXToPdf-funktionerna, men har ett eget uppgiftsformat: en måttsatt
 * figur med en svarsrad under, se drawGeometryProblem.
 */
/** Den del av GeometryGeneratorConfig som faktiskt behövs för att RITA ett
 * geometriblad — resten styr bara genereringen, se core/geometry.ts. Samma
 * mönster som ClockDocumentOptions. */
export type GeometryDocumentOptions = Pick<GeometryGeneratorConfig, 'showUnits'>;

export function renderGeometrySheetToPdf(
  problems: GeometryProblem[],
  config: DocumentConfig,
  geometryOptions: GeometryDocumentOptions,
): jsPDF {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const layout = computeGridLayout({
    problemCount: problems.length,
    fontSizePt: config.fontSizePt,
    columns: config.columns,
    layout: 'geometry',
    metrics: layoutMetricsFor(config, problems.length),
  });

  if (layout.pageCount === 0) {
    drawHeader(doc, config, null, false);
    drawFooter(doc, 0, 1, config);
    return doc;
  }

  renderGeometrySection(doc, problems, layout, config, geometryOptions, {
    showAnswers: false,
    sectionLabel: null,
  });

  if (config.includeAnswerKey) {
    doc.addPage();
    renderGeometrySection(doc, problems, layout, config, geometryOptions, {
      showAnswers: true,
      sectionLabel: 'Facit',
    });
  }

  return doc;
}

function renderGeometrySection(
  doc: jsPDF,
  problems: GeometryProblem[],
  layout: GridLayout,
  config: DocumentConfig,
  geometryOptions: GeometryDocumentOptions,
  options: SectionOptions,
): void {
  for (let page = 0; page < layout.pageCount; page++) {
    if (page > 0) {
      doc.addPage();
    }
    const showExampleNote = !options.showAnswers && config.exampleFirst && page === 0;
    drawHeader(doc, config, options.sectionLabel, showExampleNote);
    for (const position of layout.positions) {
      if (position.page === page) {
        const showAnswers = options.showAnswers || (config.exampleFirst && position.index === 0);
        drawGeometryProblem(
          doc,
          problems[position.index],
          position,
          layout,
          config,
          geometryOptions,
          showAnswers,
        );
      }
    }
    drawFooter(doc, page, layout.pageCount, config);
  }
}

/**
 * Figuren (med sina mått) överst, svarsraden under: "Area = ____ cm²", eller
 * med svaret ifyllt i facit. Etiketten skrivs ut även när bara ett mått är
 * valt — i 'mixed'-läget växlar uppgifterna mellan area och omkrets, och då
 * måste varje uppgift säga vilket den frågar efter.
 *
 * position.yMm är (liksom i de andra layouterna) baslinjen för radens sista
 * textrad. Figurrutans topp räknas uppåt därifrån med exakt samma tal
 * (geometryFigureSizeMm, GEOMETRY_FIGURE_LABEL_GAP_MM) som layout.ts
 * reserverade radhöjd utifrån.
 */
function drawGeometryProblem(
  doc: jsPDF,
  problem: GeometryProblem,
  position: CellPosition,
  layout: GridLayout,
  config: DocumentConfig,
  geometryOptions: GeometryDocumentOptions,
  showAnswers: boolean,
): void {
  const size = layout.geometryFigureSizeMm!;
  const centerX = position.xMm + layout.columnWidthMm / 2;
  const topY = position.yMm - GEOMETRY_FIGURE_LABEL_GAP_MM - size;

  drawGeometryFigure(
    doc,
    problem,
    centerX,
    topY,
    size,
    geometryOptions.showUnits,
    config.fontSizePt,
  );

  const maxWidthMm = layout.columnWidthMm - GEOMETRY_LABEL_MAX_WIDTH_MARGIN_MM;
  const label = geometryMeasureLabel(problem.measure);
  const unit = geometryOptions.showUnits ? ` ${geometryUnit(problem.measure)}` : '';

  if (showAnswers) {
    drawFittedCenteredClockLabel(
      doc,
      `${label} = ${formatGeometryValue(geometryAnswer(problem))}${unit}`,
      centerX,
      position.yMm,
      maxWidthMm,
      config.fontSizePt,
    );
    return;
  }

  drawCenteredPromptWithBlank(doc, {
    centerX,
    baselineY: position.yMm,
    prompt: `${label} = `,
    suffix: unit,
    answerStyle: config.answerStyle,
    maxWidthMm,
    basePt: config.fontSizePt,
  });
}

/**
 * Mönsterblad delar sidhuvud/sidfot och sidbrytningslogik med de andra
 * renderXToPdf-funktionerna, men har ett eget uppgiftsformat: en rad med
 * termCount termer i följd, där hiddenIndices pekar ut vilka som är tomma,
 * se drawPatternProblem.
 */
/** Den del av PatternGeneratorConfig som faktiskt behövs för att RITA ett
 * mönsterblad — termCount styr radens bredd (se computeGridLayout/
 * resolveColumns i layout.ts), resten styr bara genereringen. Samma mönster
 * som ClockDocumentOptions. */
export type PatternDocumentOptions = Pick<PatternGeneratorConfig, 'termCount'>;

/**
 * Hur brett varje termkolumn behöver vara — max antal siffertecken för just
 * det indexet över ALLA uppgifter i dokumentet, så att termerna (och
 * kommatecknen mellan dem) hamnar på samma x-position rad efter rad, samma
 * princip som computeOperandDigitCounts/ProblemMetrics för räknesättsbladet.
 *
 * `fontSizePt` kan vara MINDRE än dokumentets valda teckenstorlek: till
 * skillnad från klockans/bråkets/geometrins figur (som alltid klämmer till
 * sin faktiska kolumnbredd, se computeGridLayout) skalas INTE en talföljds
 * radbredd automatiskt av layout.ts — den beror på termCount, ett fritt
 * användarval som kan göra raden bredare än en manuellt satt (icke-"auto")
 * kolumnbredd. Hela raden krymps därför gemensamt, precis som
 * drawCenteredPromptWithBlank krymper en enskild etikett, annars skulle
 * termerna sticka ut i nästa kolumn.
 */
interface PatternMetrics {
  fontSizePt: number;
  termWidthsMm: number[];
  separatorWidthMm: number;
}

function computePatternMetrics(
  doc: jsPDF,
  problems: PatternProblem[],
  fontSizePt: number,
  termCount: number,
  maxWidthMm: number,
): PatternMetrics {
  const measure = (pt: number): { termWidthsMm: number[]; separatorWidthMm: number } => {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(pt);
    const digitWidthMm = doc.getTextWidth('0');
    const digitCounts = new Array<number>(termCount).fill(1);
    for (const problem of problems) {
      problem.terms.forEach((term, i) => {
        digitCounts[i] = Math.max(digitCounts[i], String(term).length);
      });
    }
    return {
      termWidthsMm: digitCounts.map((count) => count * digitWidthMm),
      separatorWidthMm: doc.getTextWidth(PATTERN_SEPARATOR),
    };
  };

  let { termWidthsMm, separatorWidthMm } = measure(fontSizePt);
  const naturalWidthMm = (widths: number[], sepWidth: number): number =>
    widths.reduce((sum, w) => sum + w, 0) + (termCount - 1) * sepWidth;

  let effectiveFontSizePt = fontSizePt;
  const totalWidthMm = naturalWidthMm(termWidthsMm, separatorWidthMm);
  if (totalWidthMm > maxWidthMm) {
    effectiveFontSizePt = Math.max(
      fontSizePt * (maxWidthMm / totalWidthMm),
      MIN_CLOCK_LABEL_FONT_PT,
    );
    ({ termWidthsMm, separatorWidthMm } = measure(effectiveFontSizePt));
  }

  return { fontSizePt: effectiveFontSizePt, termWidthsMm, separatorWidthMm };
}

/** Luft mellan varje term i en talföljd, t.ex. "2, 4, 6, __, 10". */
const PATTERN_SEPARATOR = ', ';

export function renderPatternSheetToPdf(
  problems: PatternProblem[],
  config: DocumentConfig,
  patternOptions: PatternDocumentOptions,
): jsPDF {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const layout = computeGridLayout({
    problemCount: problems.length,
    fontSizePt: config.fontSizePt,
    columns: config.columns,
    layout: 'pattern',
    metrics: layoutMetricsFor(config, problems.length),
  });

  if (layout.pageCount === 0) {
    drawHeader(doc, config, null, false);
    drawFooter(doc, 0, 1, config);
    return doc;
  }

  const metrics = computePatternMetrics(
    doc,
    problems,
    config.fontSizePt,
    patternOptions.termCount,
    layout.columnWidthMm - GEOMETRY_LABEL_MAX_WIDTH_MARGIN_MM,
  );

  renderPatternSection(doc, problems, layout, config, metrics, {
    showAnswers: false,
    sectionLabel: null,
  });

  if (config.includeAnswerKey) {
    doc.addPage();
    renderPatternSection(doc, problems, layout, config, metrics, {
      showAnswers: true,
      sectionLabel: 'Facit',
    });
  }

  return doc;
}

function renderPatternSection(
  doc: jsPDF,
  problems: PatternProblem[],
  layout: GridLayout,
  config: DocumentConfig,
  metrics: PatternMetrics,
  options: SectionOptions,
): void {
  for (let page = 0; page < layout.pageCount; page++) {
    if (page > 0) {
      doc.addPage();
    }
    const showExampleNote = !options.showAnswers && config.exampleFirst && page === 0;
    drawHeader(doc, config, options.sectionLabel, showExampleNote);
    for (const position of layout.positions) {
      if (position.page === page) {
        const showAnswers = options.showAnswers || (config.exampleFirst && position.index === 0);
        drawPatternProblem(doc, problems[position.index], position, config, showAnswers, metrics);
      }
    }
    drawFooter(doc, page, layout.pageCount, config);
  }
}

/**
 * Ritar termCount termer i följd, högerjusterade var och en inom sin egen
 * fasta kolumnbredd (metrics.termWidthsMm[i]) — samma teknik som
 * drawGridProblem använder för operand A/B, så att kommatecknen hamnar på
 * samma x-position rad efter rad oavsett hur många siffror en enskild term
 * råkar ha. Dolda termer (problem.hiddenIndices) ritas som en tom plats med
 * drawOperandBlank, precis som "Saknat tal"-läget i drawGridProblem.
 */
function drawPatternProblem(
  doc: jsPDF,
  problem: PatternProblem,
  position: CellPosition,
  config: DocumentConfig,
  showAnswers: boolean,
  metrics: PatternMetrics,
): void {
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(metrics.fontSizePt);

  const separatorWidth = metrics.separatorWidthMm;
  let x = position.xMm;

  problem.terms.forEach((term, index) => {
    const slotWidthMm = metrics.termWidthsMm[index];
    const rightEdgeX = x + slotWidthMm;
    const isHidden = !showAnswers && problem.hiddenIndices.includes(index);

    if (isHidden) {
      drawOperandBlank(doc, rightEdgeX, position.yMm, slotWidthMm, config.answerStyle);
    } else {
      doc.text(String(term), rightEdgeX, position.yMm, { align: 'right' });
    }

    x = rightEdgeX;
    if (index < problem.terms.length - 1) {
      doc.text(PATTERN_SEPARATOR, x, position.yMm);
      x += separatorWidth;
    }
  });
}

/** Luft mellan figurrutan/kolumnkanten och en centrerad textrad — samma
 * marginal som geometrins svarsrad använder, delad här av samma skäl. */
const EQUATION_LABEL_MAX_WIDTH_MARGIN_MM = GEOMETRY_LABEL_MAX_WIDTH_MARGIN_MM;

/**
 * "x + 5" eller "12 - x" — den obekanta operanden skrivs som bokstaven x,
 * den kända skrivs ut som siffra. Reser inte in räknesättets ² eller andra
 * WinAnsi-känsliga tecken, bara +/−/×/÷ som redan används i OPERATION_SYMBOLS.
 */
function formatEquationLeftSide(problem: EquationProblem): string {
  const symbol = OPERATION_SYMBOLS[problem.op];
  const left = problem.unknownSlot === 'a' ? 'x' : String(problem.a);
  const right = problem.unknownSlot === 'b' ? 'x' : String(problem.b);
  return `${left} ${symbol} ${right}`;
}

/**
 * Ekvationsblad delar sidhuvud/sidfot och sidbrytningslogik med de andra
 * renderXToPdf-funktionerna, men har ett eget uppgiftsformat: en centrerad
 * rad "x + 5 = 12   x = ____", se drawEquationProblem. Till skillnad från
 * klockan/bråket/geometrin behöver INGEN del av EquationGeneratorConfig
 * finnas kvar vid ritningen (bara vid genereringen), så det finns ingen
 * EquationDocumentOptions-typ — signaturen tar bara problems och config.
 */
export function renderEquationSheetToPdf(
  problems: EquationProblem[],
  config: DocumentConfig,
): jsPDF {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const layout = computeGridLayout({
    problemCount: problems.length,
    fontSizePt: config.fontSizePt,
    columns: config.columns,
    layout: 'equation',
    metrics: layoutMetricsFor(config, problems.length),
  });

  if (layout.pageCount === 0) {
    drawHeader(doc, config, null, false);
    drawFooter(doc, 0, 1, config);
    return doc;
  }

  renderEquationSection(doc, problems, layout, config, {
    showAnswers: false,
    sectionLabel: null,
  });

  if (config.includeAnswerKey) {
    doc.addPage();
    renderEquationSection(doc, problems, layout, config, {
      showAnswers: true,
      sectionLabel: 'Facit',
    });
  }

  return doc;
}

function renderEquationSection(
  doc: jsPDF,
  problems: EquationProblem[],
  layout: GridLayout,
  config: DocumentConfig,
  options: SectionOptions,
): void {
  for (let page = 0; page < layout.pageCount; page++) {
    if (page > 0) {
      doc.addPage();
    }
    const showExampleNote = !options.showAnswers && config.exampleFirst && page === 0;
    drawHeader(doc, config, options.sectionLabel, showExampleNote);
    for (const position of layout.positions) {
      if (position.page === page) {
        const showAnswers = options.showAnswers || (config.exampleFirst && position.index === 0);
        drawEquationProblem(doc, problems[position.index], position, layout, config, showAnswers);
      }
    }
    drawFooter(doc, page, layout.pageCount, config);
  }
}

/**
 * "x + 5 = 12   x = ____" (eller med svaret ifyllt i facit) — centrerad som
 * en helhet i kolumnen, precis som geometrins "Area = ____ cm²". Facit
 * skriver ut hela raden med x:s värde inifogat i stället för att gå via
 * drawCenteredPromptWithBlank, samma teknik som drawGeometryProblem.
 */
function drawEquationProblem(
  doc: jsPDF,
  problem: EquationProblem,
  position: CellPosition,
  layout: GridLayout,
  config: DocumentConfig,
  showAnswers: boolean,
): void {
  const centerX = position.xMm + layout.columnWidthMm / 2;
  const maxWidthMm = layout.columnWidthMm - EQUATION_LABEL_MAX_WIDTH_MARGIN_MM;
  const leftSide = formatEquationLeftSide(problem);

  if (showAnswers) {
    drawFittedCenteredClockLabel(
      doc,
      `${leftSide} = ${problem.result}   x = ${equationAnswer(problem)}`,
      centerX,
      position.yMm,
      maxWidthMm,
      config.fontSizePt,
    );
    return;
  }

  drawCenteredPromptWithBlank(doc, {
    centerX,
    baselineY: position.yMm,
    prompt: `${leftSide} = ${problem.result}   x = `,
    answerStyle: config.answerStyle,
    maxWidthMm,
    basePt: config.fontSizePt,
  });
}

/** Luft mellan kolumnkanten och en centrerad textrad — samma marginal som
 * geometrins/ekvationens svarsrad använder, delad här av samma skäl. */
const MEASUREMENT_LABEL_MAX_WIDTH_MARGIN_MM = GEOMETRY_LABEL_MAX_WIDTH_MARGIN_MM;

/**
 * Enhetsbytesblad delar sidhuvud/sidfot och sidbrytningslogik med de andra
 * renderXToPdf-funktionerna, men har ett eget uppgiftsformat: en centrerad
 * rad "3,5 m = ____ cm", se drawMeasurementProblem. Precis som
 * EquationGeneratorConfig behövs ingen del av MeasurementGeneratorConfig
 * kvar vid ritningen (bara vid genereringen), så det finns ingen
 * MeasurementDocumentOptions-typ.
 */
export function renderMeasurementSheetToPdf(
  problems: MeasurementProblem[],
  config: DocumentConfig,
): jsPDF {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const layout = computeGridLayout({
    problemCount: problems.length,
    fontSizePt: config.fontSizePt,
    columns: config.columns,
    layout: 'measurement',
    metrics: layoutMetricsFor(config, problems.length),
  });

  if (layout.pageCount === 0) {
    drawHeader(doc, config, null, false);
    drawFooter(doc, 0, 1, config);
    return doc;
  }

  renderMeasurementSection(doc, problems, layout, config, {
    showAnswers: false,
    sectionLabel: null,
  });

  if (config.includeAnswerKey) {
    doc.addPage();
    renderMeasurementSection(doc, problems, layout, config, {
      showAnswers: true,
      sectionLabel: 'Facit',
    });
  }

  return doc;
}

function renderMeasurementSection(
  doc: jsPDF,
  problems: MeasurementProblem[],
  layout: GridLayout,
  config: DocumentConfig,
  options: SectionOptions,
): void {
  for (let page = 0; page < layout.pageCount; page++) {
    if (page > 0) {
      doc.addPage();
    }
    const showExampleNote = !options.showAnswers && config.exampleFirst && page === 0;
    drawHeader(doc, config, options.sectionLabel, showExampleNote);
    for (const position of layout.positions) {
      if (position.page === page) {
        const showAnswers = options.showAnswers || (config.exampleFirst && position.index === 0);
        drawMeasurementProblem(
          doc,
          problems[position.index],
          position,
          layout,
          config,
          showAnswers,
        );
      }
    }
    drawFooter(doc, page, layout.pageCount, config);
  }
}

/**
 * "3,5 m = ____ cm" (eller med svaret ifyllt i facit) — centrerad som en
 * helhet i kolumnen, precis som ekvationens "x + 5 = 12   x = ____". Facit
 * skriver ut hela raden med svaret inifogat, samma teknik som
 * drawEquationProblem.
 */
function drawMeasurementProblem(
  doc: jsPDF,
  problem: MeasurementProblem,
  position: CellPosition,
  layout: GridLayout,
  config: DocumentConfig,
  showAnswers: boolean,
): void {
  const centerX = position.xMm + layout.columnWidthMm / 2;
  const maxWidthMm = layout.columnWidthMm - MEASUREMENT_LABEL_MAX_WIDTH_MARGIN_MM;
  const prompt = `${problem.fromValue} ${problem.fromUnit} = `;

  if (showAnswers) {
    drawFittedCenteredClockLabel(
      doc,
      `${prompt}${problem.answerText} ${problem.toUnit}`,
      centerX,
      position.yMm,
      maxWidthMm,
      config.fontSizePt,
    );
    return;
  }

  drawCenteredPromptWithBlank(doc, {
    centerX,
    baselineY: position.yMm,
    prompt,
    suffix: ` ${problem.toUnit}`,
    answerStyle: config.answerStyle,
    maxWidthMm,
    basePt: config.fontSizePt,
  });
}
