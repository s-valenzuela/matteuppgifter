/** Hur nära ett avrundat värde måste ligga det exakta för att räknas som
 * exakt. 3,14 × 9 blir 28.259999999999998 i flyttal, så en rak !== -jämförelse
 * skulle stämpla även exakta svar som avrundade. */
const EXACTNESS_EPSILON = 1e-9;

/**
 * T.ex. "24" (heltal), "28,3" (avrundat, med ~ eftersom avrundningen tappar
 * information) eller "314" (ett värde som råkar gå jämnt ut). Decimalkomma,
 * inte punkt — bladen är på svenska. "~" i stället för "≈" av samma skäl som
 * i formatFractionPercent: ≈ saknas i jsPDF:s WinAnsi-kodning.
 *
 * Delad mellan core/geometry.ts (formatGeometryValue) och
 * core/measurement.ts — samma "ärliga avrundning"-princip på två håll, se
 * respektive fils kommentar för sammanhanget.
 */
export function formatDecimal1(value: number): string {
  const rounded = Math.round(value * 10) / 10;
  const isExact = Math.abs(rounded - value) < EXACTNESS_EPSILON;
  const text = Number.isInteger(rounded) ? String(rounded) : String(rounded).replace('.', ',');
  return isExact ? text : `~${text}`;
}
