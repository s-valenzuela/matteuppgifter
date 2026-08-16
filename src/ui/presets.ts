import { computeDefaultInstructions, createDefaultState, type AppState } from './state';

export interface Preset {
  id: string;
  label: string;
  build: () => AppState;
  /** Visas direkt i snabbstartsraden, utan att öppna "Fler snabbstartsval".
   * En handfull (helst en per bladtyp) så att alla sju bladtyperna syns med
   * en gång utan att raden svämmar över — resten göms bakom expandern, se
   * mountForm i ui/form.ts. */
  featured?: boolean;
}

export const PRESETS: Preset[] = [
  {
    id: 'add-0-10',
    label: 'Addition 0–10',
    featured: true,
    build: () => {
      const state = createDefaultState();
      state.generator.operations = {
        add: { enabled: true, operandRange: { min: 0, max: 10 } },
        sub: { enabled: false, operandRange: { min: 0, max: 10 } },
        mul: { enabled: false, operandRange: { min: 0, max: 10 } },
        div: { enabled: false, operandRange: { min: 1, max: 10 } },
      };
      state.document.header.title = 'Addition 0–10';
      state.document.header.instructions = computeDefaultInstructions(state);
      return state;
    },
  },
  {
    id: 'multiplication-tables',
    label: 'Multiplikationstabeller',
    build: () => {
      const state = createDefaultState();
      state.generator.operations = {
        add: { enabled: false, operandRange: { min: 0, max: 10 } },
        sub: { enabled: false, operandRange: { min: 0, max: 10 } },
        mul: {
          enabled: true,
          operandRange: { min: 1, max: 10 },
          tables: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
        },
        div: { enabled: false, operandRange: { min: 1, max: 10 } },
      };
      state.document.header.title = 'Multiplikationstabeller';
      state.document.header.instructions = computeDefaultInstructions(state);
      return state;
    },
  },
  {
    id: 'mixed-0-100',
    label: 'Blandat 0–100',
    build: () => {
      const state = createDefaultState();
      state.generator.operations = {
        add: { enabled: true, operandRange: { min: 0, max: 100 } },
        sub: { enabled: true, operandRange: { min: 0, max: 100 }, noNegative: true },
        mul: { enabled: true, operandRange: { min: 0, max: 10 } },
        div: { enabled: true, operandRange: { min: 1, max: 10 } },
      };
      state.document.header.title = 'Blandat 0–100';
      state.document.header.instructions = computeDefaultInstructions(state);
      return state;
    },
  },
  {
    id: 'clock-hour-half',
    label: 'Klockan hel & halv',
    featured: true,
    build: () => {
      const state = createDefaultState();
      state.sheetType = 'clock';
      state.clock.steps = ['hour', 'half'];
      state.document.header.title = 'Klockan — hel och halv';
      state.document.header.instructions = computeDefaultInstructions(state);
      return state;
    },
  },
  {
    id: 'clock-quarter',
    label: 'Klockan kvart',
    build: () => {
      const state = createDefaultState();
      state.sheetType = 'clock';
      state.clock.steps = ['hour', 'half', 'quarter'];
      state.document.header.title = 'Klockan — kvart';
      state.document.header.instructions = computeDefaultInstructions(state);
      return state;
    },
  },
  {
    id: 'clock-five',
    label: 'Klockan alla minuter',
    build: () => {
      const state = createDefaultState();
      state.sheetType = 'clock';
      state.clock.steps = ['hour', 'half', 'quarter', 'five'];
      state.document.header.title = 'Klockan — alla minuter';
      state.document.header.instructions = computeDefaultInstructions(state);
      return state;
    },
  },
  {
    id: 'fraction-circle',
    label: 'Bråk cirkel',
    featured: true,
    build: () => {
      const state = createDefaultState();
      state.sheetType = 'fraction';
      state.fraction.denominators = [2, 3, 4];
      state.fraction.shape = 'circle';
      state.fraction.direction = 'identify';
      state.document.answerStyle = 'box';
      state.document.header.title = 'Bråk — cirkel';
      state.document.header.instructions = computeDefaultInstructions(state);
      return state;
    },
  },
  {
    id: 'fraction-shade',
    label: 'Bråk färglägg',
    build: () => {
      const state = createDefaultState();
      state.sheetType = 'fraction';
      state.fraction.denominators = [2, 3, 4, 5, 6];
      state.fraction.shape = 'mixed';
      state.fraction.direction = 'shade';
      state.document.answerStyle = 'box';
      state.document.header.title = 'Bråk — färglägg';
      state.document.header.instructions = computeDefaultInstructions(state);
      return state;
    },
  },
  {
    id: 'geometry-area',
    label: 'Area rektangel',
    featured: true,
    build: () => {
      const state = createDefaultState();
      state.sheetType = 'geometry';
      state.geometry.shape = 'rectangle';
      state.geometry.measure = 'area';
      state.document.answerStyle = 'line';
      state.document.header.title = 'Area — rektangel';
      state.document.header.instructions = computeDefaultInstructions(state);
      return state;
    },
  },
  {
    id: 'geometry-perimeter-mixed',
    label: 'Omkrets blandat',
    build: () => {
      const state = createDefaultState();
      state.sheetType = 'geometry';
      state.geometry.shape = 'mixed';
      state.geometry.measure = 'perimeter';
      state.document.answerStyle = 'line';
      state.document.header.title = 'Omkrets — blandade figurer';
      state.document.header.instructions = computeDefaultInstructions(state);
      return state;
    },
  },
  {
    id: 'pattern-ascending',
    label: 'Talföljder uppåt',
    featured: true,
    build: () => {
      const state = createDefaultState();
      state.sheetType = 'pattern';
      state.pattern.steps = [1, 2, 5, 10];
      state.pattern.allowDescending = false;
      state.document.header.title = 'Talföljder — uppåt';
      state.document.header.instructions = computeDefaultInstructions(state);
      return state;
    },
  },
  {
    id: 'pattern-mixed',
    label: 'Talföljder blandat',
    build: () => {
      const state = createDefaultState();
      state.sheetType = 'pattern';
      state.pattern.steps = [1, 2, 3, 5, 10];
      state.pattern.allowDescending = true;
      state.document.header.title = 'Talföljder — blandat';
      state.document.header.instructions = computeDefaultInstructions(state);
      return state;
    },
  },
  {
    id: 'equation-add-sub',
    label: 'Ekvationer + och −',
    featured: true,
    build: () => {
      const state = createDefaultState();
      state.sheetType = 'equation';
      state.equation.operations = { add: true, sub: true, mul: false, div: false };
      state.equation.operandRange = { min: 1, max: 20 };
      state.document.answerStyle = 'line';
      state.document.header.title = 'Ekvationer — plus och minus';
      state.document.header.instructions = computeDefaultInstructions(state);
      return state;
    },
  },
  {
    id: 'equation-all-operations',
    label: 'Ekvationer alla räknesätt',
    build: () => {
      const state = createDefaultState();
      state.sheetType = 'equation';
      state.equation.operations = { add: true, sub: true, mul: true, div: true };
      state.equation.operandRange = { min: 1, max: 12 };
      state.document.answerStyle = 'line';
      state.document.header.title = 'Ekvationer — alla räknesätt';
      state.document.header.instructions = computeDefaultInstructions(state);
      return state;
    },
  },
  {
    id: 'measurement-length',
    label: 'Enhetsbyten längd',
    featured: true,
    build: () => {
      const state = createDefaultState();
      state.sheetType = 'measurement';
      state.measurement.quantity = 'length';
      state.document.answerStyle = 'line';
      state.document.header.title = 'Enhetsbyten — längd';
      state.document.header.instructions = computeDefaultInstructions(state);
      return state;
    },
  },
  {
    id: 'measurement-mixed',
    label: 'Enhetsbyten blandat',
    build: () => {
      const state = createDefaultState();
      state.sheetType = 'measurement';
      state.measurement.quantity = 'mixed';
      state.document.answerStyle = 'line';
      state.document.header.title = 'Enhetsbyten — blandat';
      state.document.header.instructions = computeDefaultInstructions(state);
      return state;
    },
  },
];

/** Nivå-chips: sätter samma talområde på alla fyra räknesätt, oavsett om de är aktiverade. */
export const LEVEL_PRESETS: { label: string; min: number; max: number }[] = [
  { label: '0–10', min: 0, max: 10 },
  { label: '0–20', min: 0, max: 20 },
  { label: '10–20', min: 10, max: 20 },
  { label: '0–100', min: 0, max: 100 },
];
