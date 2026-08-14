import type { jsPDF } from 'jspdf';
import type { GeometryProblem } from '../types';
import { MM_PER_PT } from './layout';

const OUTLINE_LINE_WIDTH_MM = 0.4;
/** Höjdlinjen i areatriangeln — tunnare och streckad, så att den läses som en
 * hjälplinje och inte som en av triangelns sidor. */
const HELPER_LINE_WIDTH_MM = 0.25;
const HELPER_DASH_MM = 1.2;
/** Sidan på den lilla vinkelhaken som markerar den räta vinkeln. */
const RIGHT_ANGLE_MARK_MM = 2.6;

/**
 * Hur stor del av den tilldelade rutan själva figuren får uppta. Resten är
 * marginal åt måttetiketterna, som ritas UTANFÖR figuren (till vänster om
 * höjden, under basen) men INNANFÖR rutan — layout.ts reserverar radhöjd
 * utifrån rutans sida, så en etikett som stack utanför den skulle krocka med
 * raden ovanför eller nästa kolumn.
 */
const FIGURE_INSET_FACTOR = 0.74;
/** Avstånd mellan figurens kant och måttetiketten, i mm. */
const LABEL_GAP_MM = 1.8;
/** Liten extra luft utöver den beräknade etiketthöjden, se bottomLabelReachMm. */
const BOTTOM_LABEL_SAFETY_MM = 0.5;
/** Grundavstånd mellan hypotenusan och dess etikett, utöver den skalning med
 * etikettens egen storlek som drawPerimeterTriangleFigure lägger på. */
const HYPOTENUSE_LABEL_OFFSET_MM = 1.6;
/** Etiketterna är medvetet mindre än uppgiftens textstorlek — de är mått på
 * figuren, inte det eleven ska svara. Aldrig under MIN_LABEL_FONT_PT. */
const LABEL_FONT_FACTOR = 0.62;
const MIN_LABEL_FONT_PT = 6.5;

/**
 * Ritar en geometrifigur med sina mått utsatta, centrerad i en `size` ×
 * `size`-ruta vars topp är `topY`. Ren vektorgrafik, samma princip som
 * drawClockFace och drawFractionShape.
 *
 * Figuren skalas efter sina VERKLIGA proportioner (en 3×12-rektangel ser lång
 * och smal ut), begränsad så att den längsta sidan fyller den indragna ytan —
 * annars skulle måtten på figuren motsäga bilden eleven ser.
 */
export function drawGeometryFigure(
  doc: jsPDF,
  problem: GeometryProblem,
  centerX: number,
  topY: number,
  size: number,
  showUnits: boolean,
  fontSizePt: number,
): void {
  const labelFontPt = Math.max(fontSizePt * LABEL_FONT_FACTOR, MIN_LABEL_FONT_PT);
  const box = size * FIGURE_INSET_FACTOR;
  const centerY = topY + size / 2;

  // Rektangeln och triangeln har en BOTTEN-etikett (bredden/basen) som ritas
  // UTANFÖR figuren, strax under dess nederkant — till skillnad från
  // sido-etiketterna (höjd, radie) krävs alltså garanterat utrymme rakt
  // NEDANFÖR figuren, inte bara runt om den. `box` (den symmetriska
  // indragningen ovan) räcker inte för det: en HÖG figur (höjd ≥ bredd) fyller
  // hela `box` på höjden och lämnar bara den lilla marginalen mellan `box` och
  // `size` åt botten-etiketten — vid vanliga teckenstorlekar är den marginalen
  // tunnare än etiketten själv, så etiketten hamnar klämd mot svarsraden
  // (position.yMm i render.ts, som ligger GEOMETRY_FIGURE_LABEL_GAP_MM under
  // `size`). maxHeightMm nedan begränsar därför figurens höjd separat från
  // dess bredd, med tillräcklig marginal reserverad symmetriskt upptill och
  // nedtill för att botten-etiketten alltid ska få plats innan `size`.
  const reach = bottomLabelReachMm(labelFontPt);
  const maxHeightMm = Math.max(size - 2 * reach, size * 0.3);

  doc.setDrawColor(0);
  doc.setLineWidth(OUTLINE_LINE_WIDTH_MM);

  switch (problem.shape) {
    case 'rectangle':
      drawRectangleFigure(doc, problem, centerX, centerY, box, maxHeightMm, showUnits, labelFontPt);
      return;
    case 'circle':
      drawCircleFigure(doc, problem, centerX, centerY, box, showUnits, labelFontPt);
      return;
    case 'triangle':
      if (problem.measure === 'area') {
        drawAreaTriangleFigure(
          doc,
          problem,
          centerX,
          centerY,
          box,
          maxHeightMm,
          showUnits,
          labelFontPt,
        );
      } else {
        drawPerimeterTriangleFigure(
          doc,
          problem,
          centerX,
          centerY,
          box,
          maxHeightMm,
          showUnits,
          labelFontPt,
        );
      }
      return;
  }
}

/** Skalfaktor så att figuren fyller `maxWidthMm`/`maxHeightMm` så mycket som
 * möjligt utan att sticka ut ur någotdera — den snävare av de två vinner. */
function scaleFor(
  widthUnits: number,
  heightUnits: number,
  maxWidthMm: number,
  maxHeightMm: number,
): number {
  return Math.min(maxWidthMm / widthUnits, maxHeightMm / heightUnits);
}

/** Hur mycket vertikalt utrymme en botten-etikett (rektangelns bredd,
 * triangelns bas) behöver under figuren, för att aldrig hamna klämd mot
 * svarsraden — se kommentaren i drawGeometryFigure. */
function bottomLabelReachMm(labelFontPt: number): number {
  return LABEL_GAP_MM + labelHeightMm(labelFontPt) + BOTTOM_LABEL_SAFETY_MM;
}

function measureLabel(value: number, showUnits: boolean): string {
  return showUnits ? `${value} cm` : String(value);
}

function drawLabel(doc: jsPDF, text: string, x: number, y: number, fontPt: number): void {
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(fontPt);
  doc.text(text, x, y, { align: 'center' });
}

/**
 * Som drawLabel, men krymper texten (aldrig under MIN_LABEL_FONT_PT) om den
 * annars skulle bli bredare än maxWidthMm — samma princip som
 * drawFittedCenteredClockLabel i render.ts. Används där etiketten annars
 * riskerar att korsa figurens egen kontur, t.ex. cirkelns radiemått.
 */
function drawFittedLabel(
  doc: jsPDF,
  text: string,
  x: number,
  y: number,
  fontPt: number,
  maxWidthMm: number,
): void {
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(fontPt);
  const width = doc.getTextWidth(text);
  if (width > maxWidthMm) {
    doc.setFontSize(Math.max(fontPt * (maxWidthMm / width), MIN_LABEL_FONT_PT));
  }
  doc.text(text, x, y, { align: 'center' });
}

/** Höjd över baslinjen för en etikett satt i `fontPt`, så att den kan
 * placeras strax under en kant utan att nudda den. */
function labelHeightMm(fontPt: number): number {
  return fontPt * MM_PER_PT;
}

function drawRectangleFigure(
  doc: jsPDF,
  problem: Extract<GeometryProblem, { shape: 'rectangle' }>,
  centerX: number,
  centerY: number,
  box: number,
  maxHeightMm: number,
  showUnits: boolean,
  labelFontPt: number,
): void {
  const scale = scaleFor(problem.widthCm, problem.heightCm, box, maxHeightMm);
  const width = problem.widthCm * scale;
  const height = problem.heightCm * scale;
  const left = centerX - width / 2;
  const top = centerY - height / 2;

  doc.rect(left, top, width, height);

  // Bredden under figuren, höjden roterad längs vänsterkanten hade krävt
  // textrotation — enklare och lika läsbart är att sätta den vågrätt strax
  // till vänster om kanten, vilket ryms i indragningsmarginalen.
  drawLabel(
    doc,
    measureLabel(problem.widthCm, showUnits),
    centerX,
    top + height + LABEL_GAP_MM + labelHeightMm(labelFontPt),
    labelFontPt,
  );
  doc.setFontSize(labelFontPt);
  const heightText = measureLabel(problem.heightCm, showUnits);
  doc.text(heightText, left - LABEL_GAP_MM, centerY, { align: 'right', baseline: 'middle' });
}

function drawCircleFigure(
  doc: jsPDF,
  problem: Extract<GeometryProblem, { shape: 'circle' }>,
  centerX: number,
  centerY: number,
  box: number,
  showUnits: boolean,
  labelFontPt: number,
): void {
  const radius = box / 2;
  doc.circle(centerX, centerY, radius);

  // Radien ritas ut som en linje från centrum, med måttet ovanför — så att
  // det är otvetydigt att talet är radien och inte diametern.
  doc.setLineWidth(HELPER_LINE_WIDTH_MM);
  doc.line(centerX, centerY, centerX + radius, centerY);
  doc.setLineWidth(OUTLINE_LINE_WIDTH_MM);

  // Etiketten centreras över radiens mitt och begränsas till radiens längd,
  // så att den aldrig korsar cirkelns kontur — "r = 10 cm" är bredare än
  // halva radien vid små figurer och stack annars ut genom cirkeln.
  drawFittedLabel(
    doc,
    `r = ${measureLabel(problem.radiusCm, showUnits)}`,
    centerX + radius / 2,
    centerY - LABEL_GAP_MM,
    labelFontPt,
    radius,
  );
}

/**
 * Den klassiska läroboksfiguren för bas×höjd/2: en trubbig triangel med en
 * streckad höjdlinje från spetsen ner till basen. Spetsen sitter medvetet
 * INTE mitt över basen, så att höjden syns som en egen sträcka och inte
 * förväxlas med en av sidorna.
 */
function drawAreaTriangleFigure(
  doc: jsPDF,
  problem: Extract<GeometryProblem, { shape: 'triangle'; measure: 'area' }>,
  centerX: number,
  centerY: number,
  box: number,
  maxHeightMm: number,
  showUnits: boolean,
  labelFontPt: number,
): void {
  const scale = scaleFor(problem.baseCm, problem.heightCm, box, maxHeightMm);
  const base = problem.baseCm * scale;
  const height = problem.heightCm * scale;
  const left = centerX - base / 2;
  const bottom = centerY + height / 2;
  const apexX = left + base * 0.32;
  const apexY = bottom - height;

  doc.lines(
    [
      [base, 0],
      [apexX - (left + base), apexY - bottom],
    ],
    left,
    bottom,
    [1, 1],
    'S',
    true,
  );

  doc.setLineWidth(HELPER_LINE_WIDTH_MM);
  doc.setLineDashPattern([HELPER_DASH_MM, HELPER_DASH_MM], 0);
  doc.line(apexX, apexY, apexX, bottom);
  doc.setLineDashPattern([], 0);
  doc.setLineWidth(OUTLINE_LINE_WIDTH_MM);

  drawLabel(
    doc,
    measureLabel(problem.baseCm, showUnits),
    centerX,
    bottom + LABEL_GAP_MM + labelHeightMm(labelFontPt),
    labelFontPt,
  );
  // Höjdmåttet får inte plats INNE i triangeln — den smalnar av uppåt, så en
  // etikett vid höjdlinjens mitt korsar alltid någon av de sneda sidorna vid
  // rimliga figurstorlekar. Den sätts därför utanför figuren, till vänster,
  // precis som rektangelns höjd, och märks "h = " (samma grepp som cirkelns
  // "r = ") så att det ändå är otvetydigt vilket mått det är. Den streckade
  // linjen visar var höjden mäts.
  doc.setFontSize(labelFontPt);
  doc.text(
    `h = ${measureLabel(problem.heightCm, showUnits)}`,
    left - LABEL_GAP_MM,
    (apexY + bottom) / 2,
    { align: 'right', baseline: 'middle' },
  );
}

/**
 * Rätvinklig triangel med alla tre sidorna utsatta — omkretsen går inte att
 * räkna ut ur bas och höjd, se GeometryProblem i types.ts. Vinkelhaken i
 * hörnet gör det tydligt varför figuren ser ut som den gör.
 */
function drawPerimeterTriangleFigure(
  doc: jsPDF,
  problem: Extract<GeometryProblem, { shape: 'triangle'; measure: 'perimeter' }>,
  centerX: number,
  centerY: number,
  box: number,
  maxHeightMm: number,
  showUnits: boolean,
  labelFontPt: number,
): void {
  const [aCm, bCm, cCm] = problem.sidesCm;
  const scale = scaleFor(aCm, bCm, box, maxHeightMm);
  const base = aCm * scale;
  const height = bCm * scale;
  const left = centerX - base / 2;
  const bottom = centerY + height / 2;

  // Rät vinkel nere till vänster: basen åt höger, höjden rakt upp.
  doc.lines(
    [
      [base, 0],
      [-base, -height],
    ],
    left,
    bottom,
    [1, 1],
    'S',
    true,
  );

  doc.setLineWidth(HELPER_LINE_WIDTH_MM);
  doc.rect(left, bottom - RIGHT_ANGLE_MARK_MM, RIGHT_ANGLE_MARK_MM, RIGHT_ANGLE_MARK_MM);
  doc.setLineWidth(OUTLINE_LINE_WIDTH_MM);

  drawLabel(
    doc,
    measureLabel(aCm, showUnits),
    centerX,
    bottom + LABEL_GAP_MM + labelHeightMm(labelFontPt),
    labelFontPt,
  );
  doc.setFontSize(labelFontPt);
  doc.text(measureLabel(bCm, showUnits), left - LABEL_GAP_MM, bottom - height / 2, {
    align: 'right',
    baseline: 'middle',
  });

  // Hypotenusan märks vid sin egen mittpunkt, förskjuten längs den ÄKTA
  // normalen (height, -base) — riktningen från den räta vinkeln ut mot
  // mittpunkten är INTE vinkelrät mot hypotenusan annat än när katetrarna är
  // lika långa, och gav därför för liten marginal åt smala tripplar som
  // 7-24-25: linjen gick tvärs igenom texten.
  //
  // Förskjutningen skalas dessutom med etikettens egen utsträckning i
  // normalens riktning. En brant hypotenusa har en nästan vågrät normal och
  // behöver halva textbredden att flytta sig, medan en flack hypotenusa har
  // en nästan lodrät normal och bara behöver halva texthöjden — en fast
  // förskjutning kan omöjligt räcka för båda.
  const midX = left + base / 2;
  const midY = bottom - height / 2;
  const normalLength = Math.hypot(height, base) || 1;
  const normalX = height / normalLength;
  const normalY = -base / normalLength;

  doc.setFontSize(labelFontPt);
  const halfTextWidth = doc.getTextWidth(measureLabel(cCm, showUnits)) / 2;
  const halfTextHeight = labelHeightMm(labelFontPt) / 2;
  const clearance =
    HYPOTENUSE_LABEL_OFFSET_MM +
    Math.abs(normalX) * halfTextWidth +
    Math.abs(normalY) * halfTextHeight;

  drawLabel(
    doc,
    measureLabel(cCm, showUnits),
    midX + normalX * clearance,
    midY + normalY * clearance,
    labelFontPt,
  );
}
