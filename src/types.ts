export type Operation = 'add' | 'sub' | 'mul' | 'div';

export interface Range {
  min: number;
  max: number;
}

export interface OperationConfig {
  enabled: boolean;
  /** Talområde för operanderna (för division: divisor och kvot). */
  operandRange: Range;
  /** Valfri gräns på svaret. Används i M1 endast för addition. */
  resultRange?: Range;
  /** Subtraktion: byt plats på operanderna i stället för att ge ett negativt svar. */
  noNegative?: boolean;
  /** Multiplikation: begränsa den ena faktorn till dessa tabeller, t.ex. [2, 5, 10]. */
  tables?: number[];
  /** Division: lägg till en rest 0 <= r < divisor i stället för att alltid gå jämnt upp. */
  allowRemainder?: boolean;
}

export interface GeneratorConfig {
  operations: Record<Operation, OperationConfig>;
  /** Totalt antal uppgifter att generera, fördelat jämnt över valda räknesätt. */
  count: number;
  /** Undvik dubbletter (samma a och b) inom varje räknesätt så länge talområdet räcker till. */
  avoidDuplicates: boolean;
  /** Blanda ordningen på uppgifterna när fler än ett räknesätt är valt. */
  shuffle: boolean;
  seed: number;
}

export interface Problem {
  op: Operation;
  a: number;
  b: number;
  /** Svaret som ska skrivas i uppgiften (för division: kvoten). */
  answer: number;
  /** Endast satt för division när allowRemainder är true. */
  remainder?: number;
}
