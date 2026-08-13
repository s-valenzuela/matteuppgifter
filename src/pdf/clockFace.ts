import type { jsPDF } from 'jspdf';
import { pointAt } from './trig';
import { MM_PER_PT } from './layout';

/** Var på radien (0–1) timmarkeringarnas inre kant börjar. */
const TICK_INNER_HOUR_FACTOR = 0.86;
/** Var på radien (0–1) minutmarkeringarnas inre kant börjar — kortare streck än timmarna. */
const TICK_INNER_MINUTE_FACTOR = 0.93;
/** Var på radien siffrorna 1–12 centreras. */
const NUMERAL_RADIUS_FACTOR = 0.76;
const MINUTE_HAND_FACTOR = 0.72;
const HOUR_HAND_FACTOR = 0.46;
const CENTER_DOT_RADIUS_MM = 0.7;
const HOUR_HAND_LINE_WIDTH_MM = 1.1;
const MINUTE_HAND_LINE_WIDTH_MM = 0.6;
const TICK_LINE_WIDTH_MM = 0.25;
const OUTLINE_LINE_WIDTH_MM = 0.4;
/** Siffrornas teckenstorlek som andel av radien. */
const NUMERAL_FONT_SIZE_RADIUS_FACTOR = 0.24;
/** Manuellt baslinje-justering för att centrera siffrorna vertikalt kring sin
 * position — jsPDF:s `align: 'center'` centrerar bara i sidled, inte höjdled. */
const NUMERAL_BASELINE_OFFSET_FACTOR = 0.32;

export interface ClockFaceOptions {
  /** Utelämnas (tillsammans med minute) för en tom urtavla utan visare — "Rita visarna"-läget innan facit. */
  hour?: number;
  minute?: number;
  showNumerals: boolean;
  showMinuteTicks: boolean;
}

/**
 * Ritar en urtavla som ren vektorgrafik (cirkel, streck, ev. siffror och
 * visare) — ingen rasterbild, så PDF:en förblir liten och skarp oavsett
 * storlek. cx/cy/radius är i mm, konsekvent med resten av pdf/-modulen.
 */
export function drawClockFace(
  doc: jsPDF,
  cx: number,
  cy: number,
  radius: number,
  options: ClockFaceOptions,
): void {
  doc.setLineWidth(OUTLINE_LINE_WIDTH_MM);
  doc.circle(cx, cy, radius);

  drawTicks(doc, cx, cy, radius, options.showMinuteTicks);

  if (options.showNumerals) {
    drawNumerals(doc, cx, cy, radius);
  }

  if (options.hour !== undefined && options.minute !== undefined) {
    drawHands(doc, cx, cy, radius, options.hour, options.minute);
  }

  doc.setLineWidth(OUTLINE_LINE_WIDTH_MM * 0.5);
  doc.circle(cx, cy, CENTER_DOT_RADIUS_MM, 'F');
}

function drawTicks(
  doc: jsPDF,
  cx: number,
  cy: number,
  radius: number,
  showMinuteTicks: boolean,
): void {
  doc.setLineWidth(TICK_LINE_WIDTH_MM);
  for (let m = 0; m < 60; m++) {
    const isHourTick = m % 5 === 0;
    if (!isHourTick && !showMinuteTicks) {
      continue;
    }
    const degrees = m * 6;
    const innerFactor = isHourTick ? TICK_INNER_HOUR_FACTOR : TICK_INNER_MINUTE_FACTOR;
    const [x1, y1] = pointAt(cx, cy, radius * innerFactor, degrees);
    const [x2, y2] = pointAt(cx, cy, radius, degrees);
    doc.line(x1, y1, x2, y2);
  }
}

function drawNumerals(doc: jsPDF, cx: number, cy: number, radius: number): void {
  const fontSizeMm = radius * NUMERAL_FONT_SIZE_RADIUS_FACTOR;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(fontSizeMm / MM_PER_PT);

  for (let n = 1; n <= 12; n++) {
    const degrees = n * 30;
    const [x, y] = pointAt(cx, cy, radius * NUMERAL_RADIUS_FACTOR, degrees);
    doc.text(String(n), x, y + fontSizeMm * NUMERAL_BASELINE_OFFSET_FACTOR, { align: 'center' });
  }
}

/**
 * Timvisaren står på den BRÅKDELADE positionen — `+ minute * 0.5` grader —
 * annars pekar den rakt på timsiffran även vid t.ex. halv sju, och urtavlan
 * skulle inte gå att läsa av som "halv sju" (visaren måste stå mitt emellan
 * 6 och 7). Det är den klassiska buggen i klockritning och den detalj som gör
 * hela övningen meningsfull.
 */
function drawHands(
  doc: jsPDF,
  cx: number,
  cy: number,
  radius: number,
  hour: number,
  minute: number,
): void {
  const minuteDegrees = minute * 6;
  const hourDegrees = (hour % 12) * 30 + minute * 0.5;

  doc.setLineWidth(HOUR_HAND_LINE_WIDTH_MM);
  const [hx, hy] = pointAt(cx, cy, radius * HOUR_HAND_FACTOR, hourDegrees);
  doc.line(cx, cy, hx, hy);

  doc.setLineWidth(MINUTE_HAND_LINE_WIDTH_MM);
  const [mx, my] = pointAt(cx, cy, radius * MINUTE_HAND_FACTOR, minuteDegrees);
  doc.line(cx, cy, mx, my);
}
