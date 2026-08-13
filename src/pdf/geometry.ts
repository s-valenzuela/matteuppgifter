/**
 * Delad av clockFace.ts och fractionShape.ts — båda behöver punkter på en
 * cirkel utifrån vinkel medurs från 12 (klockans visare respektive
 * bråkfigurens tårtbitsgränser).
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
