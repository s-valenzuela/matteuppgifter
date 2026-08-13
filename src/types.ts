export type Operation = 'add' | 'sub' | 'mul' | 'div';

export interface Range {
  min: number;
  max: number;
}

export interface OperationConfig {
  enabled: boolean;
  /** Talområde för operanderna (för division: divisor och kvot). */
  operandRange: Range;
  /** Valfri gräns på svaret. */
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
  /** Saknat tal: slumpar vilken del av uppgiften (a, b eller svaret) som är tom, t.ex. "3 + __ = 10". */
  missingNumber: boolean;
  seed: number;
}

/** Vilken del av uppgiften som är tom att fylla i. Standard 'answer' (den vanliga varianten). */
export type MissingSlot = 'a' | 'b' | 'answer';

export interface Problem {
  op: Operation;
  a: number;
  b: number;
  /** Svaret som ska skrivas i uppgiften (för division: kvoten). */
  answer: number;
  /** Endast satt för division när allowRemainder är true. */
  remainder?: number;
  missingSlot: MissingSlot;
}

/** Hur svarsfältet ritas när facit inte visas. */
export type AnswerStyle = 'blank' | 'line' | 'box';

/**
 * 'grid' — vågrätt: "12 + 7 = ____". 'vertical' — uppställning med talen
 * staplade och ett streck ovanför svaret, mer lämpat för större tal.
 */
export type DocumentLayout = 'grid' | 'vertical';

export interface DocumentHeader {
  title: string;
  showName: boolean;
  showDate: boolean;
}

export interface DocumentConfig {
  header: DocumentHeader;
  fontSizePt: number;
  columns: number | 'auto';
  layout: DocumentLayout;
  answerStyle: AnswerStyle;
  /** Lägg till facit-sidor sist i dokumentet. */
  includeAnswerKey: boolean;
  /** Visas i sidfoten så att bladet kan återskapas från samma GeneratorConfig. */
  seed: number;
}

/** Vilken typ av blad som ska genereras — styr vilken av generator/clock som används. */
export type SheetType = 'arithmetic' | 'clock';

/**
 * Ett kryssbart minutmärke för klockuppgifter — flera kan vara påslagna
 * samtidigt (se ui/form.ts), och den slutgiltiga minutpoolen är unionen av
 * alla påslagna gruppers minuter. Grupperna är disjunkta så att ingen
 * kombination av kryssrutor ger dubbletter: hour=[0], half=[30],
 * quarter=[15,45], five=[5,10,20,25,35,40,50,55] — se core/clock.ts.
 */
export type ClockStep = 'hour' | 'half' | 'quarter' | 'five';

/** 'read' — läs av en urtavla med visare, skriv tiden i ord. 'draw' — given
 * tid i ord, rita visarna på en tom urtavla. 'digital' — läs av en urtavla
 * med visare, skriv tiden digitalt (t.ex. "06:30") i stället för i ord. */
export type ClockDirection = 'read' | 'draw' | 'digital';

/** 'mixed' slumpar riktning per uppgift, se core/clock.ts. */
export type ClockDirectionMode = ClockDirection | 'mixed';

export interface ClockProblem {
  /** 1–12, som på urtavlan (inte 0–23). */
  hour: number;
  /** 0–55, alltid en multipel av 5. */
  minute: number;
  direction: ClockDirection;
}

export interface ClockGeneratorConfig {
  /** Minst en grupp bör vara ikryssad — validateClockConfig faller tillbaka
   * till ['hour'] och varnar annars, se core/validate.ts. */
  steps: ClockStep[];
  direction: ClockDirectionMode;
  showNumerals: boolean;
  showMinuteTicks: boolean;
  /** Totalt antal uppgifter att generera. */
  count: number;
  /** Undvik dubbletter (samma timme och minut) så länge steget rymmer tillräckligt många unika tider. */
  avoidDuplicates: boolean;
  /** Visas i sidfoten så att bladet kan återskapas — separat från generator.seed
   * eftersom klockblad och räknesättsblad är oberoende av varandra (se ui/state.ts). */
  seed: number;
}
