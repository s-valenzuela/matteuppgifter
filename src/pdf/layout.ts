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

const MM_PER_PT = 0.352778;
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
/** Extra luft per kolumn utöver den uppskattade textbredden. */
const COLUMN_GUTTER_MM = 4;

export interface GridLayoutInput {
  problemCount: number;
  fontSizePt: number;
  columns: number | 'auto';
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
  const fontSizeMm = input.fontSizePt * MM_PER_PT;
  const availableWidthMm = metrics.pageWidthMm - 2 * metrics.marginMm;
  const availableHeightMm =
    metrics.pageHeightMm - 2 * metrics.marginMm - metrics.headerHeightMm - metrics.footerHeightMm;

  const rowHeightMm = Math.max(fontSizeMm * LINE_HEIGHT_FACTOR, MIN_ROW_HEIGHT_MM);
  const rowsPerPage = Math.max(1, Math.floor(availableHeightMm / rowHeightMm));

  const columns = resolveColumns(input.columns, fontSizeMm, availableWidthMm);
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
  fontSizeMm: number,
  availableWidthMm: number,
): number {
  if (columns === 'auto') {
    const estimatedCellWidthMm =
      fontSizeMm * AVG_CHAR_WIDTH_FACTOR * ESTIMATED_CHARS_PER_PROBLEM + COLUMN_GUTTER_MM;
    return Math.max(1, Math.floor(availableWidthMm / estimatedCellWidthMm));
  }
  return Math.max(1, Math.floor(columns));
}
