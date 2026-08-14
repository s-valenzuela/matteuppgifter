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
  /**
   * Instruktionstext till eleven, t.ex. "Rita visarna." eller "Skriv i
   * bråkform." — skrivs ut i sidhuvudet på uppgiftssidan (inte facit), under
   * namn/datum-fälten. Tom sträng = ingen rad skrivs ut. Fylls i med ett
   * vettigt standardvärde automatiskt när bladtyp eller riktning ändras (se
   * computeDefaultInstructions i ui/state.ts), men går att skriva över för
   * hand.
   */
  instructions: string;
}

export interface DocumentConfig {
  header: DocumentHeader;
  fontSizePt: number;
  columns: number | 'auto';
  layout: DocumentLayout;
  answerStyle: AnswerStyle;
  /** Lägg till facit-sidor sist i dokumentet. */
  includeAnswerKey: boolean;
  /**
   * Löser den FÖRSTA uppgiften på uppgiftssidan redan i förväg, som ett
   * löst exempel — resten av uppgiftssidan är opåverkad (facit visar redan
   * alla uppgifter lösta, oavsett detta fält). En rad skrivs ut i
   * sidhuvudet så att det är tydligt att uppgift 1 redan är löst, se
   * drawHeader i pdf/render.ts.
   */
  exampleFirst: boolean;
  /** Visas i sidfoten så att bladet kan återskapas från samma GeneratorConfig. */
  seed: number;
}

/** Vilken typ av blad som ska genereras — styr vilken av
 * generator/clock/fraction/geometry/pattern/equation/measurement som används. */
export type SheetType =
  'arithmetic' | 'clock' | 'fraction' | 'geometry' | 'pattern' | 'equation' | 'measurement';

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
 * med visare, skriv tiden digitalt (t.ex. "06:30") i stället för i ord.
 * 'digitalDraw' — given tid digitalt (t.ex. "06:30"), rita visarna på en tom
 * urtavla — samma som 'draw' men källan är siffror i stället för ord. */
export type ClockDirection = 'read' | 'draw' | 'digital' | 'digitalDraw';

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

/** 'circle' — en tårtbit-figur (cirkel delad i lika stora sektorer). 'bar' —
 * en stapel (rektangel delad i lika breda fält). Se pdf/fractionShape.ts. */
export type FractionShape = 'circle' | 'bar';

/** 'mixed' slumpar form per uppgift, se core/fractions.ts. */
export type FractionShapeMode = FractionShape | 'mixed';

/**
 * 'identify' — figuren är redan färglagd, eleven läser av och skriver
 * bråket. 'shade' — bråket ges som text, eleven färglägger figuren själv
 * (facit visar den rätt färglagd). 'identifyPercent' — som 'identify', men
 * eleven skriver bråkets andel i procent i stället för som bråk (t.ex. en
 * halvfärgad cirkel → "50 %"). 'toPercent' — helt utan figur: bråket ges som
 * text och eleven räknar om det till procent, för äldre elever som inte
 * längre behöver den visuella crutchen. 'mixed' slumpar bara mellan de tre
 * figurbaserade riktningarna (inte 'toPercent', som saknar figur och därför
 * har en annan sidlayout, se pdf/layout.ts:s 'fractionText'-läge och
 * resolveDirection i core/fractions.ts).
 */
export type FractionDirection = 'identify' | 'shade' | 'identifyPercent' | 'toPercent';

/** 'mixed' slumpar riktning per uppgift, se core/fractions.ts. */
export type FractionDirectionMode = FractionDirection | 'mixed';

export interface FractionProblem {
  /** 1 till denominator−1 (äkta bråk — aldrig 0 eller hela figuren). */
  numerator: number;
  denominator: number;
  shape: FractionShape;
  direction: FractionDirection;
}

export interface FractionGeneratorConfig {
  /** Vilka nämnare som får förekomma — minst en bör vara ikryssad, se
   * FRACTION_DENOMINATORS i core/fractions.ts och validateFractionConfig. */
  denominators: number[];
  shape: FractionShapeMode;
  direction: FractionDirectionMode;
  /** Visa bråkets procentvärde (avrundat till närmaste heltal, med "≈" om
   * det inte går jämnt upp) bredvid bråket, varhelst det skrivs ut som
   * siffror — se drawStackedFractionText i pdf/render.ts. */
  showPercent: boolean;
  /** Totalt antal uppgifter att generera. */
  count: number;
  /** Undvik dubbletter (samma form, täljare och nämnare) så länge poolen räcker till. */
  avoidDuplicates: boolean;
  /** Visas i sidfoten — separat seed, se motsvarande kommentar på ClockGeneratorConfig. */
  seed: number;
}

/** Geometrifigurerna eleven kan få räkna på. Se pdf/geometryFigure.ts. */
export type GeometryShape = 'rectangle' | 'triangle' | 'circle';

/** 'mixed' slumpar figur per uppgift, se core/geometry.ts. */
export type GeometryShapeMode = GeometryShape | 'mixed';

/** Vad som ska räknas ut: arean eller omkretsen. */
export type GeometryMeasure = 'area' | 'perimeter';

/** 'mixed' slumpar per uppgift — varje uppgift skriver ändå ut sitt eget
 * "Area ="/"Omkrets =", så eleven ser alltid vad som efterfrågas. */
export type GeometryMeasureMode = GeometryMeasure | 'mixed';

/**
 * En geometriuppgift. Medvetet en union och inte ett platt objekt med
 * valfria fält: vilka mått som behövs beror på BÅDE figur och efterfrågat
 * mått, och unionen gör de omöjliga kombinationerna orepresenterbara.
 *
 * Framför allt triangeln: arean kräver bas och höjd, medan omkretsen kräver
 * alla tre sidorna (de går inte att räkna ut ur bas+höjd). Omkretstrianglar
 * byggs därför av pythagoreiska tripplar — rätvinkliga med heltalssidor — så
 * att a+b+c alltid går jämnt ut, se PYTHAGOREAN_TRIPLES i core/geometry.ts.
 * Areatrianglar har ingen sådan begränsning och slumpas fritt (med bas×höjd
 * jämnt, så att bas×höjd/2 blir ett heltal), vilket ger en mycket större pool.
 */
export type GeometryProblem =
  | { shape: 'rectangle'; measure: GeometryMeasure; widthCm: number; heightCm: number }
  | { shape: 'circle'; measure: GeometryMeasure; radiusCm: number }
  | { shape: 'triangle'; measure: 'area'; baseCm: number; heightCm: number }
  | { shape: 'triangle'; measure: 'perimeter'; sidesCm: [number, number, number] };

export interface GeometryGeneratorConfig {
  shape: GeometryShapeMode;
  measure: GeometryMeasureMode;
  /** Talområde för figurernas mått i cm (rektangelns sidor, triangelns bas
   * och höjd, cirkelns radie). */
  sideRange: Range;
  /** Skriv ut enheter: "6 cm" på figuren och "cm²"/"cm" efter svaret. */
  showUnits: boolean;
  /** Totalt antal uppgifter att generera. */
  count: number;
  /** Undvik dubbletter (samma figur, mått och efterfrågat mått) så länge poolen räcker till. */
  avoidDuplicates: boolean;
  /** Visas i sidfoten — separat seed, se motsvarande kommentar på ClockGeneratorConfig. */
  seed: number;
}

/**
 * En talföljd med jämnt mellanrum (steg), t.ex. "2, 4, 6, __, 10". Index 0
 * och 1 i terms är ALLTID synliga (aldrig med i hiddenIndices) — de två
 * ankartermerna gör att steget går att läsa av direkt, se
 * generatePatternProblems i core/patterns.ts.
 */
export interface PatternProblem {
  /** Alla termer i följden, i ordning. */
  terms: number[];
  /** 0-baserade index i terms som är dolda och ska fyllas i av eleven. */
  hiddenIndices: number[];
  /** Skillnaden mellan varje term (negativ för en nedåtgående följd). */
  step: number;
}

/**
 * En enkel ekvation med en obekant, t.ex. "x + 5 = 12" eller "12 - x = 4".
 * Det obekanta talet skrivs alltid som "x" INUTI uttrycket (aldrig ensamt på
 * högersidan, t.ex. "5 + 7 = x" — det vore bara ett omdöpt vanligt tal, inte
 * en ekvation att lösa) — se unknownSlot. `a`/`b` är de SANNA värdena;
 * `result` är op(a, b), talet på ekvationens högersida.
 */
export interface EquationProblem {
  op: Operation;
  a: number;
  b: number;
  result: number;
  /** Vilken operand som skrivs som "x". Division har alltid 'a' (dividenden)
   * — se core/equations.ts för samma solvability-resonemang som
   * chooseMissingSlot i core/generate.ts. */
  unknownSlot: 'a' | 'b';
}

export interface EquationGeneratorConfig {
  /** Vilka räknesätt som får förekomma — minst ett bör vara ikryssat, se
   * validateEquationConfig. */
  operations: Record<Operation, boolean>;
  /** Talområde för de kända talen (och för x:s värde). */
  operandRange: Range;
  /** Tillåt att x eller mellanledet blir negativt — annars byts a/b vid
   * subtraktion, som OperationConfig.noNegative. */
  allowNegative: boolean;
  /** Totalt antal uppgifter att generera. */
  count: number;
  /** Undvik dubbletter (samma räknesätt, tal och obekant plats) så länge poolen räcker till. */
  avoidDuplicates: boolean;
  /** Visas i sidfoten — separat seed, se motsvarande kommentar på ClockGeneratorConfig. */
  seed: number;
}

/** Storhetstyperna som kan räknas om mellan enheter. Se core/measurement.ts
 * för resp. enhetstabell (mm/cm/dm/m/km, g/hg/kg, ml/cl/dl/l, s/min/h). */
export type MeasurementQuantity = 'length' | 'mass' | 'volume' | 'time';

/** 'mixed' slumpar storhet per uppgift, se core/measurement.ts. */
export type MeasurementQuantityMode = MeasurementQuantity | 'mixed';

/**
 * En enhetsbytesuppgift, t.ex. "3,5 m = ____ cm". `fromUnit`/`toUnit` är
 * alltid GRANNAR i storhetens enhetstabell (t.ex. cm↔dm, inte mm↔km) — se
 * core/measurement.ts för varför. `answerText` är redan omräknat OCH
 * formaterat (kan ha ett "~"-prefix, se formatDecimal1) eftersom
 * omräkningen inte alltid går jämnt ut (framför allt tid, där kvoten mellan
 * enheter är 60 i stället för en tiopotens).
 */
export interface MeasurementProblem {
  quantity: MeasurementQuantity;
  fromValue: number;
  fromUnit: string;
  toUnit: string;
  answerText: string;
}

export interface MeasurementGeneratorConfig {
  quantity: MeasurementQuantityMode;
  /** Talområde för det KÄNDA talet (fromValue) innan omräkning. */
  valueRange: Range;
  /** Totalt antal uppgifter att generera. */
  count: number;
  /** Undvik dubbletter (samma storhet, enheter och tal) så länge poolen räcker till. */
  avoidDuplicates: boolean;
  /** Visas i sidfoten — separat seed, se motsvarande kommentar på ClockGeneratorConfig. */
  seed: number;
}

export interface PatternGeneratorConfig {
  /** Talområde för följdens första term. */
  startRange: Range;
  /** Möjliga steg (skillnaden mellan varje term) — minst ett bör vara ikryssat, se
   * validatePatternConfig. */
  steps: number[];
  /** Om steget slumpmässigt kan bli negativt (nedåtgående följd) utöver de
   * positiva talen i `steps`. */
  allowDescending: boolean;
  /** Antal termer per talföljd (minst 4: två synliga ankartermer + minst en
   * dold + minst en till). */
  termCount: number;
  /** Antal dolda termer (minst 1, som mest termCount - 2). */
  hiddenCount: number;
  /** Totalt antal uppgifter att generera. */
  count: number;
  /** Undvik dubbletter (samma start, steg och dolda index) så länge poolen räcker till. */
  avoidDuplicates: boolean;
  /** Visas i sidfoten — separat seed, se motsvarande kommentar på ClockGeneratorConfig. */
  seed: number;
}
