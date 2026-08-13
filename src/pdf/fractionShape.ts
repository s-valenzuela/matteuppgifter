import type { jsPDF } from 'jspdf';
import type { FractionShape } from '../types';
import { pointAt } from './trig';

/** Fyllningsgrå för färglagda sektorer/fält — ljus nog att skrivas ut utan
 * att dränka gränslinjerna, mörk nog att tydligt läsas som "färglagt". */
const FILL_GRAY = 190;
const OUTLINE_LINE_WIDTH_MM = 0.4;
const DIVIDER_LINE_WIDTH_MM = 0.3;
/** Stapelns höjd som andel av den tilldelade rutans sida — en bred, låg
 * "chokladkaka"-form i stället för en fyrkant, se drawFractionShape. */
const BAR_HEIGHT_FACTOR = 0.42;
/** Hur många grader varje polygonsegment i en färglagd sektor max täcker —
 * jsPDF har ingen inbyggd cirkelbåge att fylla, så bågen approximeras med en
 * polygon (se drawFilledSector). Mindre värde ger en rundare, dyrare kurva. */
const SECTOR_SEGMENT_DEGREES = 6;

/**
 * Ritar en bråkfigur centrerad i en `size` × `size`-ruta vars topp är
 * `topY` — cirkel (tårtbit) eller stapel (rektangel), delad i `denominator`
 * lika delar där de första `numerator` är färglagda om `shaded` är sant.
 * Ren vektorgrafik, samma princip som drawClockFace.
 */
export function drawFractionShape(
  doc: jsPDF,
  shape: FractionShape,
  centerX: number,
  topY: number,
  size: number,
  numerator: number,
  denominator: number,
  shaded: boolean,
): void {
  if (shape === 'circle') {
    const radius = size / 2;
    drawFractionCircle(doc, centerX, topY + radius, radius, numerator, denominator, shaded);
  } else {
    const width = size;
    const height = size * BAR_HEIGHT_FACTOR;
    drawFractionBar(
      doc,
      centerX - width / 2,
      topY + (size - height) / 2,
      width,
      height,
      numerator,
      denominator,
      shaded,
    );
  }
}

/**
 * Fyllningen ritas FÖRE cirkeln och sektorgränserna (inte efter) så att de
 * tunna svarta linjerna alltid hamnar överst och förblir skarpa — annars
 * riskerar den grå fyllningen att delvis täcka över en gränslinje beroende på
 * exakt pixelavrundning där sektorns egen polygonkant sammanfaller med den.
 */
function drawFractionCircle(
  doc: jsPDF,
  cx: number,
  cy: number,
  radius: number,
  numerator: number,
  denominator: number,
  shaded: boolean,
): void {
  const sliceDegrees = 360 / denominator;

  if (shaded && numerator > 0) {
    doc.setFillColor(FILL_GRAY, FILL_GRAY, FILL_GRAY);
    drawFilledSector(doc, cx, cy, radius, 0, sliceDegrees * numerator);
  }

  doc.setDrawColor(0);
  doc.setLineWidth(OUTLINE_LINE_WIDTH_MM);
  doc.circle(cx, cy, radius);

  doc.setLineWidth(DIVIDER_LINE_WIDTH_MM);
  for (let i = 0; i < denominator; i++) {
    const [x, y] = pointAt(cx, cy, radius, i * sliceDegrees);
    doc.line(cx, cy, x, y);
  }
}

/** Fyller sektorn cx/cy → startDeg..endDeg (medurs) som en polygon-approximation
 * av bågen — jsPDF:s `lines()` tar deltasteg från en startpunkt, så cirkelns
 * centrum är förste punkten och båda kanterna löper tillbaka dit (`closed: true`). */
function drawFilledSector(
  doc: jsPDF,
  cx: number,
  cy: number,
  radius: number,
  startDeg: number,
  endDeg: number,
): void {
  const span = endDeg - startDeg;
  const segments = Math.max(1, Math.ceil(span / SECTOR_SEGMENT_DEGREES));

  const points: [number, number][] = [[cx, cy]];
  for (let i = 0; i <= segments; i++) {
    points.push(pointAt(cx, cy, radius, startDeg + (span * i) / segments));
  }

  const deltas = points
    .slice(1)
    .map((point, i) => [point[0] - points[i][0], point[1] - points[i][1]]);
  doc.lines(deltas, points[0][0], points[0][1], [1, 1], 'F', true);
}

function drawFractionBar(
  doc: jsPDF,
  x: number,
  y: number,
  width: number,
  height: number,
  numerator: number,
  denominator: number,
  shaded: boolean,
): void {
  const segmentWidth = width / denominator;

  if (shaded && numerator > 0) {
    doc.setFillColor(FILL_GRAY, FILL_GRAY, FILL_GRAY);
    doc.rect(x, y, segmentWidth * numerator, height, 'F');
  }

  doc.setDrawColor(0);
  doc.setLineWidth(OUTLINE_LINE_WIDTH_MM);
  doc.rect(x, y, width, height);

  doc.setLineWidth(DIVIDER_LINE_WIDTH_MM);
  for (let i = 1; i < denominator; i++) {
    const dividerX = x + segmentWidth * i;
    doc.line(dividerX, y, dividerX, y + height);
  }
}
