import { createDefaultState, type AppState } from './state';

export interface Preset {
  id: string;
  label: string;
  build: () => AppState;
}

export const PRESETS: Preset[] = [
  {
    id: 'add-0-10',
    label: 'Addition 0–10',
    build: () => {
      const state = createDefaultState();
      state.generator.operations = {
        add: { enabled: true, operandRange: { min: 0, max: 10 } },
        sub: { enabled: false, operandRange: { min: 0, max: 10 } },
        mul: { enabled: false, operandRange: { min: 0, max: 10 } },
        div: { enabled: false, operandRange: { min: 1, max: 10 } },
      };
      state.document.header.title = 'Addition 0–10';
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
