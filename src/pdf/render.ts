import { jsPDF } from 'jspdf';
import { clockPhrase, digitalTime } from '../core/clock';
import type {
  ClockGeneratorConfig,
  ClockProblem,
  DocumentConfig,
  FractionGeneratorConfig,
  FractionProblem,
  Problem,
} from '../types';
import { computeOperandDigitCounts, formatAnswer, OPERATION_SYMBOLS } from './format';
import { drawClockFace } from './clockFace';
import { drawFractionShape } from './fractionShape';
import {
  A4_METRICS,
  CLOCK_FACE_LABEL_GAP_MM,
  computeGridLayout,
  FRACTION_BLANK_STACK_GAP_MM,
  fractionStackReachAboveMm,
  FRACTION_SHAPE_LABEL_GAP_MM,
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
  });

  if (layout.pageCount === 0) {
    drawHeader(doc, config, null);
    drawFooter(doc, 0, 1, config.seed);
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
    drawHeader(doc, config, options.sectionLabel);
    for (const position of layout.positions) {
      if (position.page === page) {
        drawClockProblem(
          doc,
          problems[position.index],
          position,
          layout,
          config,
          clockOptions,
          options.showAnswers,
        );
      }
    }
    drawFooter(doc, page, layout.pageCount, config.seed);
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
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(basePt);
  const prompt = 'Klockan är ';

  const measure = (): { promptWidth: number; blankWidth: number } => ({
    promptWidth: doc.getTextWidth(prompt),
    blankWidth:
      answerStyle === 'blank'
        ? doc.getTextWidth(BLANK_PLACEHOLDER)
        : answerStyle === 'line'
          ? LINE_LENGTH_MM
          : BOX_SIZE_MM,
  });

  let { promptWidth, blankWidth } = measure();
  if (promptWidth + blankWidth > maxWidthMm) {
    doc.setFontSize(
      Math.max(basePt * (maxWidthMm / (promptWidth + blankWidth)), MIN_CLOCK_LABEL_FONT_PT),
    );
    ({ promptWidth, blankWidth } = measure());
  }

  const startX = centerX - (promptWidth + blankWidth) / 2;
  doc.text(prompt, startX, baselineY);
  const blankStartX = startX + promptWidth;

  switch (answerStyle) {
    case 'blank':
      doc.text(BLANK_PLACEHOLDER, blankStartX, baselineY);
      break;
    case 'line':
      doc.line(blankStartX, baselineY + 1, blankStartX + LINE_LENGTH_MM, baselineY + 1);
      break;
    case 'box':
      doc.rect(blankStartX, baselineY - BOX_SIZE_MM + 2, BOX_SIZE_MM, BOX_SIZE_MM);
      break;
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
  });

  if (layout.pageCount === 0) {
    drawHeader(doc, config, null);
    drawFooter(doc, 0, 1, config.seed);
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
    drawHeader(doc, config, options.sectionLabel);
    for (const position of layout.positions) {
      if (position.page === page) {
        drawFractionProblem(
          doc,
          problems[position.index],
          position,
          layout,
          config,
          fractionOptions,
          options.showAnswers,
        );
      }
    }
    drawFooter(doc, page, layout.pageCount, config.seed);
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
    // bråket självt — se drawFractionIdentifyPercentAnswer.
    drawFractionIdentifyPercentAnswer(
      doc,
      problem,
      centerX,
      position.yMm,
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
