/**
 * Delad av clockFace.ts och fractionShape.ts — båda behöver punkter på en
 * cirkel utifrån vinkel medurs från 12 (klockans visare respektive
 * bråkfigurens tårtbitsgränser).
 *
 * Hette tidigare geometry.ts, men det namnet hör numera hemma hos
 * geometribladen (core/geometry.ts, pdf/geometryFigure.ts) — det här är bara
 * en trigonometrisk hjälpfunktion, inte en modell av geometriuppgifter.
 */

/** Punkt på cirkeln `distance` mm från centrum, `degrees` grader medurs från 12. */
export function pointAt(
  cx: number,
  cy: number,
  distance: number,
  degrees: number,
): [number, number] {
  const rad = (degrees * Math.PI) / 180;
  return [cx + distance * Math.sin(rad), cy - distance * Math.cos(rad)];
}
