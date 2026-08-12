/**
 * Ren mm-matematik för rutnätslayouten på ett A4-blad. Inga beroenden mot
 * jsPDF eller DOM här — det gör den här filen lätt att enhetstesta.
 */

export interface PageMetrics {
  pageWidthMm: number;
  pageHeightMm: number;
  marginMm: number;
  headerHeightMm: number;
  footerHeightMm: number;
}

export const A4_METRICS: PageMetrics = {
  pageWidthMm: 210,
  pageHeightMm: 297,
  marginMm: 15,
  headerHeightMm: 20,
  footerHeightMm: 8,
};

/** Exporterad eftersom render.ts behöver samma mm/pt-omräkning för att
 * positionera raderna inom ett uppställningsblock (se drawVerticalProblem) —
 * annars kan de två filerna glida isär och rader börja överlappa. */
export const MM_PER_PT = 0.352778;
/**
 * Ungefärlig teckenbredd i förhållande till teckenstorleken, för Helvetica.
 * Kalibrerad mot jsPDF:s faktiska doc.getTextWidth(): ca 0.464 uppmätt,
 * här satt till 0.5 med liten marginal uppåt.
 */
const AVG_CHAR_WIDTH_FACTOR = 0.5;
/** Radhöjd som multipel av teckenstorleken, för luft mellan raderna. */
const LINE_HEIGHT_FACTOR = 2.4;
/** Minsta tillåtna radhöjd, oavsett hur liten teckenstorleken är. */
const MIN_ROW_HEIGHT_MM = 6;
/**
 * Uppskattat antal tecken i den längsta rimliga uppgiftssträngen, t.ex.
 * "100 + 100 = _______" (tresiffriga operander, tomt svarsfält — uppgifter
 * har inget uppgiftsnummer, se render.ts). Satt lågt ger för många kolumner
 * och text som överlappar nästa kolumn, så den här ska hellre vara i
 * överkant. Kalibrerad mot jsPDF:s doc.getTextWidth() (uppmätt värsta fall:
 * 19 tecken), med någon marginal.
 */
const ESTIMATED_CHARS_PER_PROBLEM = 20;
/**
 * Samma uppskattning men för uppställningsläget, där varje kolumn bara
 * behöver rymma operator + det bredaste talet (staplat, inte i följd på en
 * rad) — se drawVerticalProblem i render.ts.
 */
const ESTIMATED_CHARS_PER_PROBLEM_VERTICAL = 7;
/** Extra luft per kolumn utöver den uppskattade textbredden. */
const COLUMN_GUTTER_MM = 4;
/**
 * Avstånd mellan baslinjerna INOM ett uppställningsblock (operand 1 →
 * operand 2 → svar), som multipel av teckenstorleken. Delad med render.ts av
 * samma skäl som MM_PER_PT — layout.ts måste reservera exakt lika mycket
 * radhöjd som render.ts faktiskt använder för att rita blocket.
 */
export const VERTICAL_LINE_STEP_FACTOR = 1.6;
/**
 * Luft mellan operand 2:s baslinje och strecket, som multipel av
 * teckenstorleken. Exporterad av samma skäl som VERTICAL_LINE_STEP_FACTOR.
 */
export const VERTICAL_RULE_GAP_FACTOR = 0.25;
/** Luft mellan strecket och svarsrutan (endast 'box'-svarsstil). */
export const VERTICAL_BOX_GAP_FACTOR = 0.3;
/** Svarsrutans höjd i uppställningsläget (endast 'box'-svarsstil). */
export const VERTICAL_BOX_HEIGHT_FACTOR = 1.4;
/**
 * Extra luft under ett uppställningsblock innan nästa rads block börjar.
 * Måste rymma streck + eventuell svarsruta oavsett vilken answerStyle som
 * faktiskt används (computeGridLayout känner inte till answerStyle här) —
 * annars kan nästa uppgifts översta tal hamna ovanpå svarsrutan, se
 * drawVerticalProblem i render.ts.
 */
const VERTICAL_ROW_EXTRA_GAP_FACTOR =
  VERTICAL_RULE_GAP_FACTOR + VERTICAL_BOX_GAP_FACTOR + VERTICAL_BOX_HEIGHT_FACTOR + 0.5;

export type DocumentLayoutMode = 'grid' | 'vertical';

export interface GridLayoutInput {
  problemCount: number;
  fontSizePt: number;
  columns: number | 'auto';
  /** Standard 'grid' om utelämnad. */
  layout?: DocumentLayoutMode;
  metrics?: PageMetrics;
}

export interface CellPosition {
  /** 0-baserat index i den fullständiga uppgiftslistan. */
  index: number;
  /** 0-baserat sidnummer. */
  page: number;
  row: number;
  column: number;
  xMm: number;
  yMm: number;
}

export interface GridLayout {
  columns: number;
  columnWidthMm: number;
  rowHeightMm: number;
  rowsPerPage: number;
  problemsPerPage: number;
  pageCount: number;
  positions: CellPosition[];
}

export function computeGridLayout(input: GridLayoutInput): GridLayout {
  const metrics = input.metrics ?? A4_METRICS;
  const layoutMode = input.layout ?? 'grid';
  const fontSizeMm = input.fontSizePt * MM_PER_PT;
  const availableWidthMm = metrics.pageWidthMm - 2 * metrics.marginMm;
  const availableHeightMm =
    metrics.pageHeightMm - 2 * metrics.marginMm - metrics.headerHeightMm - metrics.footerHeightMm;

  const rowHeightMm =
    layoutMode === 'vertical'
      ? Math.max(
          fontSizeMm * (2 * VERTICAL_LINE_STEP_FACTOR + VERTICAL_ROW_EXTRA_GAP_FACTOR),
          MIN_ROW_HEIGHT_MM * 2.5,
        )
      : Math.max(fontSizeMm * LINE_HEIGHT_FACTOR, MIN_ROW_HEIGHT_MM);
  const rowsPerPage = Math.max(1, Math.floor(availableHeightMm / rowHeightMm));

  const columns = resolveColumns(input.columns, layoutMode, fontSizeMm, availableWidthMm);
  const columnWidthMm = availableWidthMm / columns;
  const problemsPerPage = columns * rowsPerPage;
  const pageCount = input.problemCount > 0 ? Math.ceil(input.problemCount / problemsPerPage) : 0;

  const positions: CellPosition[] = [];
  for (let index = 0; index < input.problemCount; index++) {
    const indexOnPage = index % problemsPerPage;
    const row = Math.floor(indexOnPage / columns);
    const column = indexOnPage % columns;
    positions.push({
      index,
      page: Math.floor(index / problemsPerPage),
      row,
      column,
      xMm: metrics.marginMm + column * columnWidthMm,
      yMm: metrics.marginMm + metrics.headerHeightMm + (row + 1) * rowHeightMm,
    });
  }

  return {
    columns,
    columnWidthMm,
    rowHeightMm,
    rowsPerPage,
    problemsPerPage,
    pageCount,
    positions,
  };
}

function resolveColumns(
  columns: number | 'auto',
  layoutMode: DocumentLayoutMode,
  fontSizeMm: number,
  availableWidthMm: number,
): number {
  if (columns === 'auto') {
    const estimatedChars =
      layoutMode === 'vertical'
        ? ESTIMATED_CHARS_PER_PROBLEM_VERTICAL
        : ESTIMATED_CHARS_PER_PROBLEM;
    const estimatedCellWidthMm =
      fontSizeMm * AVG_CHAR_WIDTH_FACTOR * estimatedChars + COLUMN_GUTTER_MM;
    return Math.max(1, Math.floor(availableWidthMm / estimatedCellWidthMm));
  }
  return Math.max(1, Math.floor(columns));
}
