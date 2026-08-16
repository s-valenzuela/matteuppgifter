import { FRACTION_DENOMINATORS } from '../core/fractions';
import type {
  ClockDirectionMode,
  ClockGeneratorConfig,
  DocumentConfig,
  EquationGeneratorConfig,
  FractionDirectionMode,
  FractionGeneratorConfig,
  GeneratorConfig,
  GeometryGeneratorConfig,
  GeometryMeasureMode,
  MeasurementGeneratorConfig,
  OperationConfig,
  PatternGeneratorConfig,
  SheetType,
} from '../types';

/**
 * Formulärets tillstånd. `document` saknar `seed` — det speglas alltid från
 * den AKTIVA sidans seed (generator.seed eller clock.seed, beroende på
 * sheetType) via {@link toDocumentConfig} i stället för att lagras (och
 * riskera att bli osynkat) på fler ställen.
 *
 * `generator` och `clock` hålls medvetet som två helt separata, oberoende
 * konfigurationer (i stället för att t.ex. dela count/avoidDuplicates/seed i
 * ett gemensamt objekt) — formuläret (ui/form.ts) visar dem som samma fält
 * för användaren, men det låter hela räknesättsvägen (generate.ts,
 * validate.ts, GeneratorConfig) förbli helt orörd av klockfunktionen.
 */
export interface AppState {
  sheetType: SheetType;
  generator: GeneratorConfig;
  clock: ClockGeneratorConfig;
  fraction: FractionGeneratorConfig;
  geometry: GeometryGeneratorConfig;
  pattern: PatternGeneratorConfig;
  equation: EquationGeneratorConfig;
  measurement: MeasurementGeneratorConfig;
  document: Omit<DocumentConfig, 'seed'>;
}

export function toDocumentConfig(state: AppState): DocumentConfig {
  const seed =
    state.sheetType === 'clock'
      ? state.clock.seed
      : state.sheetType === 'fraction'
        ? state.fraction.seed
        : state.sheetType === 'geometry'
          ? state.geometry.seed
          : state.sheetType === 'pattern'
            ? state.pattern.seed
            : state.sheetType === 'equation'
              ? state.equation.seed
              : state.sheetType === 'measurement'
                ? state.measurement.seed
                : state.generator.seed;
  return { ...state.document, seed };
}

function op(overrides: Partial<OperationConfig> = {}): OperationConfig {
  return {
    enabled: false,
    operandRange: { min: 0, max: 10 },
    ...overrides,
  };
}

export function createDefaultState(): AppState {
  return {
    sheetType: 'arithmetic',
    generator: {
      operations: {
        add: op({ enabled: true, operandRange: { min: 0, max: 20 } }),
        sub: op({ enabled: true, operandRange: { min: 0, max: 20 }, noNegative: true }),
        mul: op({ enabled: false, operandRange: { min: 0, max: 10 } }),
        div: op({ enabled: false, operandRange: { min: 1, max: 10 } }),
      },
      count: 30,
      avoidDuplicates: true,
      shuffle: true,
      missingNumber: false,
      seed: randomSeed(),
    },
    clock: createDefaultClockConfig(),
    fraction: createDefaultFractionConfig(),
    geometry: createDefaultGeometryConfig(),
    pattern: createDefaultPatternConfig(),
    equation: createDefaultEquationConfig(),
    measurement: createDefaultMeasurementConfig(),
    document: {
      header: { title: 'Matteuppgifter', showName: true, showDate: true, instructions: '' },
      fontSizePt: 14,
      columns: 3,
      layout: 'grid',
      answerStyle: 'blank',
      includeAnswerKey: true,
      exampleFirst: false,
      showSeed: true,
    },
  };
}

/** Instruktionstext per klockriktning — se DocumentHeader.instructions.
 * 'mixed' saknar en enskild, rättvisande beskrivning eftersom riktningen
 * varierar slumpmässigt per uppgift. */
const CLOCK_INSTRUCTIONS: Record<ClockDirectionMode, string> = {
  read: 'Läs av klockan och skriv tiden.',
  draw: 'Rita visarna.',
  digital: 'Läs av klockan och skriv tiden digitalt.',
  digitalDraw: 'Rita visarna.',
  mixed: '',
};

/** Instruktionstext per efterfrågat geometrimått — se
 * DocumentHeader.instructions. 'mixed' lämnas tom eftersom varje uppgift
 * själv skriver ut "Area ="/"Omkrets =": en gemensam instruktion skulle då
 * bli direkt missvisande, inte bara intetsägande. */
const GEOMETRY_INSTRUCTIONS: Record<GeometryMeasureMode, string> = {
  area: 'Beräkna arean.',
  perimeter: 'Beräkna omkretsen.',
  mixed: '',
};

/** Instruktionstext per bråkriktning — se DocumentHeader.instructions. */
const FRACTION_INSTRUCTIONS: Record<FractionDirectionMode, string> = {
  identify: 'Skriv bråket.',
  shade: 'Färglägg figuren.',
  identifyPercent: 'Skriv hur många procent som är färglagt.',
  toPercent: 'Skriv i procentform.',
  mixed: '',
};

/** Instruktionstext för mönsterblad — se DocumentHeader.instructions. Bara en
 * variant (till skillnad från klockan/bråket/geometrin) eftersom mönsterblad
 * inte har någon "riktning" som varierar. */
const PATTERN_INSTRUCTIONS = 'Fyll i de tal som saknas i talföljden.';

/** Instruktionstext för ekvationsblad — se DocumentHeader.instructions. */
const EQUATION_INSTRUCTIONS = 'Lös ekvationerna. Skriv värdet på x.';

/** Instruktionstext för enhetsbytesblad — se DocumentHeader.instructions. */
const MEASUREMENT_INSTRUCTIONS = 'Räkna om till rätt enhet.';

/**
 * Ett vettigt standardvärde för header.instructions, beräknat utifrån
 * bladtyp och (för klocka/bråk) vald riktning, eller (för räknesätt) om
 * "Saknat tal" är påslaget. Anropas av ui/form.ts:s change-handlers när
 * sheetType eller en riktning ändras — men bara för att SÄTTA fältet om
 * användaren inte redan skrivit över det för hand, se refreshFromState.
 */
export function computeDefaultInstructions(state: AppState): string {
  switch (state.sheetType) {
    case 'arithmetic':
      return state.generator.missingNumber ? 'Fyll i det som saknas.' : '';
    case 'clock':
      return CLOCK_INSTRUCTIONS[state.clock.direction];
    case 'fraction':
      return FRACTION_INSTRUCTIONS[state.fraction.direction];
    case 'geometry':
      return GEOMETRY_INSTRUCTIONS[state.geometry.measure];
    case 'pattern':
      return PATTERN_INSTRUCTIONS;
    case 'equation':
      return EQUATION_INSTRUCTIONS;
    case 'measurement':
      return MEASUREMENT_INSTRUCTIONS;
  }
}

function createDefaultClockConfig(): ClockGeneratorConfig {
  return {
    steps: ['hour', 'half', 'quarter'],
    direction: 'read',
    showNumerals: true,
    showMinuteTicks: false,
    count: 12,
    avoidDuplicates: true,
    seed: randomSeed(),
  };
}

function createDefaultFractionConfig(): FractionGeneratorConfig {
  return {
    denominators: FRACTION_DENOMINATORS.filter((d) => d <= 4),
    shape: 'circle',
    direction: 'identify',
    showPercent: false,
    count: 12,
    avoidDuplicates: true,
    seed: randomSeed(),
  };
}

function createDefaultGeometryConfig(): GeometryGeneratorConfig {
  return {
    shape: 'rectangle',
    measure: 'area',
    // Små, hanterbara mått som standard: rektangelns sidor och triangelns
    // bas/höjd blir tal man kan multiplicera i huvudet, och en radie på 2–10
    // ger cirkelareor under 320 cm².
    sideRange: { min: 2, max: 10 },
    showUnits: true,
    count: 9,
    avoidDuplicates: true,
    seed: randomSeed(),
  };
}

function createDefaultPatternConfig(): PatternGeneratorConfig {
  return {
    startRange: { min: 0, max: 20 },
    steps: [1, 2],
    allowDescending: false,
    termCount: 6,
    hiddenCount: 2,
    count: 10,
    avoidDuplicates: true,
    seed: randomSeed(),
  };
}

function createDefaultEquationConfig(): EquationGeneratorConfig {
  return {
    operations: { add: true, sub: true, mul: false, div: false },
    operandRange: { min: 1, max: 20 },
    allowNegative: false,
    count: 12,
    avoidDuplicates: true,
    seed: randomSeed(),
  };
}

function createDefaultMeasurementConfig(): MeasurementGeneratorConfig {
  return {
    quantity: 'length',
    valueRange: { min: 1, max: 200 },
    count: 10,
    avoidDuplicates: true,
    seed: randomSeed(),
  };
}

export function randomSeed(): number {
  return Math.floor(Math.random() * 1_000_000);
}
