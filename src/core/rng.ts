export type Rng = () => number;

/**
 * mulberry32 — liten, snabb och deterministisk PRNG. Samma seed ger alltid
 * samma sekvens, vilket gör genererade blad reproducerbara och testbara.
 */
export function mulberry32(seed: number): Rng {
  let state = seed >>> 0;
  return function rng(): number {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Slumpat heltal i det slutna intervallet [min, max]. */
export function randomInt(rng: Rng, min: number, max: number): number {
  return min + Math.floor(rng() * (max - min + 1));
}

/** Slumpat element ur en icke-tom array. */
export function pick<T>(rng: Rng, values: readonly T[]): T {
  return values[randomInt(rng, 0, values.length - 1)];
}
