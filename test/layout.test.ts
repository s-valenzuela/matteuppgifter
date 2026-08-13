import { describe, expect, it } from 'vitest';
import {
  A4_METRICS,
  computeGridLayout,
  computeHeaderHeightMm,
  HEADER_EXTRA_LINE_MM,
} from '../src/pdf/layout';

describe('computeGridLayout', () => {
  it('returnerar noll sidor och tomma positioner för 0 uppgifter', () => {
    const layout = computeGridLayout({ problemCount: 0, fontSizePt: 14, columns: 'auto' });
    expect(layout.pageCount).toBe(0);
    expect(layout.positions).toEqual([]);
  });

  it('placerar aldrig innehåll utanför marginalerna', () => {
    for (const columns of ['auto', 1, 2, 4, 6] as const) {
      for (const fontSizePt of [10, 14, 24]) {
        const layout = computeGridLayout({ problemCount: 97, fontSizePt, columns });
        for (const p of layout.positions) {
          expect(p.xMm).toBeGreaterThanOrEqual(A4_METRICS.marginMm);
          expect(p.xMm + layout.columnWidthMm).toBeLessThanOrEqual(
            A4_METRICS.pageWidthMm - A4_METRICS.marginMm + 1e-9,
          );
          expect(p.yMm).toBeGreaterThanOrEqual(A4_METRICS.marginMm + A4_METRICS.headerHeightMm);
          expect(p.yMm).toBeLessThanOrEqual(
            A4_METRICS.pageHeightMm - A4_METRICS.marginMm - A4_METRICS.footerHeightMm + 1e-9,
          );
        }
      }
    }
  });

  it('ger aldrig två uppgifter på samma sida samma rad och kolumn', () => {
    const layout = computeGridLayout({ problemCount: 123, fontSizePt: 14, columns: 3 });
    const seen = new Set<string>();
    for (const p of layout.positions) {
      const key = `${p.page}:${p.row}:${p.column}`;
      expect(seen.has(key)).toBe(false);
      seen.add(key);
    }
  });

  it('respekterar ett manuellt kolumnantal', () => {
    const layout = computeGridLayout({ problemCount: 10, fontSizePt: 14, columns: 3 });
    expect(layout.columns).toBe(3);
  });

  it('rundar av och klamrar ett manuellt kolumnantal till minst 1', () => {
    const layout = computeGridLayout({ problemCount: 10, fontSizePt: 14, columns: 0 });
    expect(layout.columns).toBe(1);
  });

  it('väljer minst en kolumn även med "auto" och stor teckenstorlek', () => {
    const layout = computeGridLayout({ problemCount: 5, fontSizePt: 72, columns: 'auto' });
    expect(layout.columns).toBeGreaterThanOrEqual(1);
  });

  it('ger fler rader per sida vid mindre teckenstorlek', () => {
    const small = computeGridLayout({ problemCount: 1, fontSizePt: 10, columns: 2 });
    const large = computeGridLayout({ problemCount: 1, fontSizePt: 24, columns: 2 });
    expect(small.rowsPerPage).toBeGreaterThanOrEqual(large.rowsPerPage);
  });

  it('fördelar uppgifter över rätt antal sidor', () => {
    const layout = computeGridLayout({ problemCount: 10, fontSizePt: 14, columns: 3 });
    // 3 kolumner ger ett känt antal rader per sida för denna teckenstorlek/A4.
    const expectedPageCount = Math.ceil(10 / layout.problemsPerPage);
    expect(layout.pageCount).toBe(expectedPageCount);

    const lastPage = layout.positions.filter((p) => p.page === layout.pageCount - 1);
    expect(lastPage.length).toBeGreaterThan(0);
    expect(lastPage.length).toBeLessThanOrEqual(layout.problemsPerPage);
  });

  it('genererar exakt en position per uppgift, med rätt index och stigande sidnummer', () => {
    const layout = computeGridLayout({ problemCount: 55, fontSizePt: 14, columns: 4 });
    expect(layout.positions).toHaveLength(55);
    layout.positions.forEach((p, i) => {
      expect(p.index).toBe(i);
    });
    for (let i = 1; i < layout.positions.length; i++) {
      expect(layout.positions[i].page).toBeGreaterThanOrEqual(layout.positions[i - 1].page);
    }
  });

  describe('uppställningsläge (layout: "vertical")', () => {
    it('reserverar mer radhöjd än det vågräta läget, för de tre staplade raderna', () => {
      const grid = computeGridLayout({
        problemCount: 1,
        fontSizePt: 14,
        columns: 3,
        layout: 'grid',
      });
      const vertical = computeGridLayout({
        problemCount: 1,
        fontSizePt: 14,
        columns: 3,
        layout: 'vertical',
      });
      expect(vertical.rowHeightMm).toBeGreaterThan(grid.rowHeightMm * 1.5);
    });

    it('placerar aldrig innehåll utanför marginalerna', () => {
      for (const columns of ['auto', 1, 2, 4, 6] as const) {
        for (const fontSizePt of [10, 14, 24]) {
          const layout = computeGridLayout({
            problemCount: 97,
            fontSizePt,
            columns,
            layout: 'vertical',
          });
          for (const p of layout.positions) {
            expect(p.xMm).toBeGreaterThanOrEqual(A4_METRICS.marginMm);
            expect(p.xMm + layout.columnWidthMm).toBeLessThanOrEqual(
              A4_METRICS.pageWidthMm - A4_METRICS.marginMm + 1e-9,
            );
            expect(p.yMm).toBeGreaterThanOrEqual(A4_METRICS.marginMm + A4_METRICS.headerHeightMm);
            expect(p.yMm).toBeLessThanOrEqual(
              A4_METRICS.pageHeightMm - A4_METRICS.marginMm - A4_METRICS.footerHeightMm + 1e-9,
            );
          }
        }
      }
    });

    it('utelämnad layout beter sig som "grid" (bakåtkompatibelt)', () => {
      const withoutLayout = computeGridLayout({ problemCount: 10, fontSizePt: 14, columns: 3 });
      const explicitGrid = computeGridLayout({
        problemCount: 10,
        fontSizePt: 14,
        columns: 3,
        layout: 'grid',
      });
      expect(withoutLayout).toEqual(explicitGrid);
    });
  });

  describe('klockläge (layout: "clock")', () => {
    it('sätter en positiv clockDiameterMm, bara för klockläget', () => {
      const clock = computeGridLayout({
        problemCount: 10,
        fontSizePt: 14,
        columns: 3,
        layout: 'clock',
      });
      expect(clock.clockDiameterMm).toBeGreaterThan(0);

      const grid = computeGridLayout({
        problemCount: 10,
        fontSizePt: 14,
        columns: 3,
        layout: 'grid',
      });
      expect(grid.clockDiameterMm).toBeUndefined();
    });

    it('placerar aldrig innehåll utanför marginalerna', () => {
      for (const columns of ['auto', 1, 2, 4, 6] as const) {
        for (const fontSizePt of [10, 14, 24]) {
          const layout = computeGridLayout({
            problemCount: 41,
            fontSizePt,
            columns,
            layout: 'clock',
          });
          for (const p of layout.positions) {
            expect(p.xMm).toBeGreaterThanOrEqual(A4_METRICS.marginMm);
            expect(p.xMm + layout.columnWidthMm).toBeLessThanOrEqual(
              A4_METRICS.pageWidthMm - A4_METRICS.marginMm + 1e-9,
            );
            expect(p.yMm).toBeGreaterThanOrEqual(A4_METRICS.marginMm + A4_METRICS.headerHeightMm);
            expect(p.yMm).toBeLessThanOrEqual(
              A4_METRICS.pageHeightMm - A4_METRICS.marginMm - A4_METRICS.footerHeightMm + 1e-9,
            );
          }
        }
      }
    });

    it('urtavlan ryms aldrig bredare än sin egen kolumn, även med ett smalt manuellt kolumnantal', () => {
      for (const columns of [1, 2, 3, 4, 5, 6]) {
        const layout = computeGridLayout({
          problemCount: 6,
          fontSizePt: 14,
          columns,
          layout: 'clock',
        });
        expect(layout.clockDiameterMm!).toBeLessThanOrEqual(layout.columnWidthMm);
      }
    });

    it('ger en större urtavla vid större teckenstorlek, upp till maxtaket', () => {
      const small = computeGridLayout({
        problemCount: 1,
        fontSizePt: 10,
        columns: 2,
        layout: 'clock',
      });
      const large = computeGridLayout({
        problemCount: 1,
        fontSizePt: 20,
        columns: 2,
        layout: 'clock',
      });
      expect(large.clockDiameterMm!).toBeGreaterThan(small.clockDiameterMm!);
    });

    it('fördelar uppgifter över rätt antal sidor', () => {
      const layout = computeGridLayout({
        problemCount: 30,
        fontSizePt: 14,
        columns: 3,
        layout: 'clock',
      });
      const expectedPageCount = Math.ceil(30 / layout.problemsPerPage);
      expect(layout.pageCount).toBe(expectedPageCount);
    });
  });

  describe('bråk-till-procent utan figur (layout: "fractionText")', () => {
    it('sätter aldrig fractionSizeMm — det finns ingen figur att mäta upp', () => {
      const layout = computeGridLayout({
        problemCount: 10,
        fontSizePt: 14,
        columns: 3,
        layout: 'fractionText',
      });
      expect(layout.fractionSizeMm).toBeUndefined();
    });

    it('reserverar mindre radhöjd än det figurbaserade bråkläget, för samma teckenstorlek', () => {
      const withFigure = computeGridLayout({
        problemCount: 1,
        fontSizePt: 14,
        columns: 3,
        layout: 'fraction',
      });
      const withoutFigure = computeGridLayout({
        problemCount: 1,
        fontSizePt: 14,
        columns: 3,
        layout: 'fractionText',
      });
      expect(withoutFigure.rowHeightMm).toBeLessThan(withFigure.rowHeightMm);
    });

    it('placerar aldrig innehåll utanför marginalerna', () => {
      for (const columns of ['auto', 1, 2, 4, 6] as const) {
        for (const fontSizePt of [10, 14, 24]) {
          const layout = computeGridLayout({
            problemCount: 97,
            fontSizePt,
            columns,
            layout: 'fractionText',
          });
          for (const p of layout.positions) {
            expect(p.xMm).toBeGreaterThanOrEqual(A4_METRICS.marginMm);
            expect(p.xMm + layout.columnWidthMm).toBeLessThanOrEqual(
              A4_METRICS.pageWidthMm - A4_METRICS.marginMm + 1e-9,
            );
            expect(p.yMm).toBeGreaterThanOrEqual(A4_METRICS.marginMm + A4_METRICS.headerHeightMm);
            expect(p.yMm).toBeLessThanOrEqual(
              A4_METRICS.pageHeightMm - A4_METRICS.marginMm - A4_METRICS.footerHeightMm + 1e-9,
            );
          }
        }
      }
    });

    it('fördelar uppgifter över rätt antal sidor', () => {
      const layout = computeGridLayout({
        problemCount: 40,
        fontSizePt: 14,
        columns: 3,
        layout: 'fractionText',
      });
      const expectedPageCount = Math.ceil(40 / layout.problemsPerPage);
      expect(layout.pageCount).toBe(expectedPageCount);
    });
  });

  describe('computeHeaderHeightMm', () => {
    it('ger tillbaka bashöjden oförändrad utan extra rader', () => {
      expect(computeHeaderHeightMm(A4_METRICS.headerHeightMm, 0)).toBe(A4_METRICS.headerHeightMm);
    });

    it('lägger till exakt HEADER_EXTRA_LINE_MM per extra rad', () => {
      expect(computeHeaderHeightMm(A4_METRICS.headerHeightMm, 1)).toBe(
        A4_METRICS.headerHeightMm + HEADER_EXTRA_LINE_MM,
      );
      expect(computeHeaderHeightMm(A4_METRICS.headerHeightMm, 2)).toBe(
        A4_METRICS.headerHeightMm + 2 * HEADER_EXTRA_LINE_MM,
      );
    });

    it('en högre headerHeightMm via metrics ger mindre plats åt uppgifterna (färre rader per sida)', () => {
      const normal = computeGridLayout({ problemCount: 1, fontSizePt: 14, columns: 3 });
      const tallerHeader = computeGridLayout({
        problemCount: 1,
        fontSizePt: 14,
        columns: 3,
        metrics: {
          ...A4_METRICS,
          headerHeightMm: computeHeaderHeightMm(A4_METRICS.headerHeightMm, 2),
        },
      });
      expect(tallerHeader.rowsPerPage).toBeLessThanOrEqual(normal.rowsPerPage);
    });
  });
});
