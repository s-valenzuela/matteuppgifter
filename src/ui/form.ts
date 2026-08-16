import { FRACTION_DENOMINATORS } from '../core/fractions';
import type {
  AnswerStyle,
  ClockDirectionMode,
  ClockStep,
  DocumentLayout,
  FractionDirectionMode,
  FractionShapeMode,
  GeometryMeasureMode,
  GeometryShapeMode,
  MeasurementQuantityMode,
  Operation,
  SheetType,
} from '../types';
import { LEVEL_PRESETS } from './presets';
import { computeDefaultInstructions, type AppState } from './state';

const OPERATION_LABELS: Record<Operation, string> = {
  add: 'Addition (+)',
  sub: 'Subtraktion (−)',
  mul: 'Multiplikation (×)',
  div: 'Division (÷)',
};

const OPERATION_KEYS: readonly Operation[] = ['add', 'sub', 'mul', 'div'];

const CLOCK_STEP_KEYS: readonly ClockStep[] = ['hour', 'half', 'quarter', 'five'];

const CLOCK_STEP_LABELS: Record<ClockStep, string> = {
  hour: 'Hel timme (:00)',
  half: 'Halv (:30)',
  quarter: 'Kvart (:15, :45)',
  five: 'Fem minuter (:05, :10, :20, :25, :35, :40, :50, :55)',
};

const CLOCK_DIRECTION_LABELS: Record<ClockDirectionMode, string> = {
  read: 'Läs av klockan (skriv tiden i ord)',
  draw: 'Rita visarna (given tid i ord)',
  digital: 'Läs av klockan (skriv tiden digitalt, t.ex. 06:30)',
  digitalDraw: 'Rita visarna (given tid digitalt, t.ex. 06:30)',
  mixed: 'Blandat',
};

const FRACTION_SHAPE_LABELS: Record<FractionShapeMode, string> = {
  circle: 'Cirkel (tårtbit)',
  bar: 'Stapel',
  mixed: 'Blandat',
};

const FRACTION_DIRECTION_LABELS: Record<FractionDirectionMode, string> = {
  identify: 'Läs av figuren (skriv bråket)',
  shade: 'Färglägg figuren (givet bråk)',
  identifyPercent: 'Läs av figuren (skriv procent)',
  toPercent: 'Bråk till procent (utan figur, för äldre elever)',
  mixed: 'Blandat',
};

const GEOMETRY_SHAPE_LABELS: Record<GeometryShapeMode, string> = {
  rectangle: 'Rektangel',
  triangle: 'Triangel',
  circle: 'Cirkel',
  mixed: 'Blandat',
};

const GEOMETRY_MEASURE_LABELS: Record<GeometryMeasureMode, string> = {
  area: 'Area',
  perimeter: 'Omkrets',
  mixed: 'Blandat',
};

/** Kryssbara steg för mönsterblad — ett urval, inte en uttömmande lista:
 * PatternGeneratorConfig.steps är fria positiva heltal, se types.ts. */
const PATTERN_STEP_OPTIONS: readonly number[] = [1, 2, 3, 5, 10];

const MEASUREMENT_QUANTITY_LABELS: Record<MeasurementQuantityMode, string> = {
  length: 'Längd (mm/cm/dm/m/km)',
  mass: 'Massa (g/hg/kg)',
  volume: 'Volym (ml/cl/dl/l)',
  time: 'Tid (s/min/h)',
  mixed: 'Blandat',
};

// Feather-ikon (MIT), inbäddad som inline-SVG istället för en extern ikonfil
// eftersom appen inte har några andra tillgångar att ladda in.
const EDIT_ICON_SVG = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="14" height="14" aria-hidden="true" focusable="false"><path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"></path></svg>`;

export interface FormController {
  getState(): AppState;
  onChange(listener: (state: AppState) => void): void;
  setState(next: AppState): void;
  /** Slumpar en ny seed. Knappen som utlöser det här sitter bland de andra
   * handlingsknapparna (Ladda ner, Skriv ut, ...) i main.ts, inte i formuläret
   * själv, men logiken hör hemma här tillsammans med resten av seed-hanteringen. */
  randomizeSeed(): void;
}

export function mountForm(container: HTMLElement, initialState: AppState): FormController {
  container.innerHTML = renderTemplate();

  let state = initialState;
  const listeners: Array<(state: AppState) => void> = [];

  const sheetTypeRadios = Array.from(
    q<HTMLDivElement>(container, '#sheet-type-toggle').querySelectorAll<HTMLInputElement>(
      'input[type=radio]',
    ),
  );

  const operationsSection = q<HTMLElement>(container, '#operations-section');
  const layoutField = q<HTMLElement>(container, '#layout-field');
  const columnsField = q<HTMLElement>(container, '#columns-field');
  const missingNumberField = q<HTMLElement>(container, '#missingNumber-field');
  const shuffleField = q<HTMLElement>(container, '#shuffle-field');
  const clockSection = q<HTMLElement>(container, '#clock-section');
  const fractionSection = q<HTMLElement>(container, '#fraction-section');
  const geometrySection = q<HTMLElement>(container, '#geometry-section');
  const patternSection = q<HTMLElement>(container, '#pattern-section');
  const equationSection = q<HTMLElement>(container, '#equation-section');
  const measurementSection = q<HTMLElement>(container, '#measurement-section');

  const operationEls = new Map(
    OPERATION_KEYS.map((key) => [
      key,
      {
        enabled: q<HTMLInputElement>(container, `#op-${key}-enabled`),
        min: q<HTMLInputElement>(container, `#op-${key}-min`),
        max: q<HTMLInputElement>(container, `#op-${key}-max`),
        resultMin: q<HTMLInputElement>(container, `#op-${key}-resultMin`),
        resultMax: q<HTMLInputElement>(container, `#op-${key}-resultMax`),
      },
    ]),
  );

  const subNoNegative = q<HTMLInputElement>(container, '#op-sub-noNegative');
  const mulTables = q<HTMLInputElement>(container, '#op-mul-tables');
  const divAllowRemainder = q<HTMLInputElement>(container, '#op-div-allowRemainder');

  const clockStepEls = new Map(
    CLOCK_STEP_KEYS.map((key) => [key, q<HTMLInputElement>(container, `#clock-step-${key}`)]),
  );
  const clockDirectionEl = q<HTMLSelectElement>(container, '#clock-direction');
  const clockShowNumeralsEl = q<HTMLInputElement>(container, '#clock-showNumerals');
  const clockShowMinuteTicksEl = q<HTMLInputElement>(container, '#clock-showMinuteTicks');

  const fractionDenominatorEls = new Map(
    FRACTION_DENOMINATORS.map((d) => [d, q<HTMLInputElement>(container, `#fraction-denom-${d}`)]),
  );
  const fractionShapeField = q<HTMLElement>(container, '#fraction-shape-field');
  const fractionShapeEl = q<HTMLSelectElement>(container, '#fraction-shape');
  const fractionDirectionEl = q<HTMLSelectElement>(container, '#fraction-direction');
  const fractionShowPercentField = q<HTMLElement>(container, '#fraction-showPercent-field');
  const fractionShowPercentEl = q<HTMLInputElement>(container, '#fraction-showPercent');

  const geometryShapeEl = q<HTMLSelectElement>(container, '#geometry-shape');
  const geometryMeasureEl = q<HTMLSelectElement>(container, '#geometry-measure');
  const geometryMinEl = q<HTMLInputElement>(container, '#geometry-min');
  const geometryMaxEl = q<HTMLInputElement>(container, '#geometry-max');
  const geometryShowUnitsEl = q<HTMLInputElement>(container, '#geometry-showUnits');

  const patternStepEls = new Map(
    PATTERN_STEP_OPTIONS.map((step) => [
      step,
      q<HTMLInputElement>(container, `#pattern-step-${step}`),
    ]),
  );
  const patternDescendingEl = q<HTMLInputElement>(container, '#pattern-descending');
  const patternMinEl = q<HTMLInputElement>(container, '#pattern-min');
  const patternMaxEl = q<HTMLInputElement>(container, '#pattern-max');
  const patternTermCountEl = q<HTMLInputElement>(container, '#pattern-termCount');
  const patternHiddenCountEl = q<HTMLInputElement>(container, '#pattern-hiddenCount');

  const equationOperationEls = new Map(
    OPERATION_KEYS.map((key) => [key, q<HTMLInputElement>(container, `#equation-op-${key}`)]),
  );
  const equationMinEl = q<HTMLInputElement>(container, '#equation-min');
  const equationMaxEl = q<HTMLInputElement>(container, '#equation-max');
  const equationAllowNegativeEl = q<HTMLInputElement>(container, '#equation-allowNegative');

  const measurementQuantityEl = q<HTMLSelectElement>(container, '#measurement-quantity');
  const measurementMinEl = q<HTMLInputElement>(container, '#measurement-min');
  const measurementMaxEl = q<HTMLInputElement>(container, '#measurement-max');

  const countEl = q<HTMLInputElement>(container, '#count');
  const avoidDuplicatesEl = q<HTMLInputElement>(container, '#avoidDuplicates');
  const shuffleEl = q<HTMLInputElement>(container, '#shuffle');
  const missingNumberEl = q<HTMLInputElement>(container, '#missingNumber');
  const seedEl = q<HTMLInputElement>(container, '#seed');
  const seedEditButton = q<HTMLButtonElement>(container, '#seed-edit');

  const columnsEl = q<HTMLSelectElement>(container, '#columns');
  const fontSizeEl = q<HTMLInputElement>(container, '#fontSize');
  const fontSizeValueEl = q<HTMLSpanElement>(container, '#fontSize-value');
  const layoutEl = q<HTMLSelectElement>(container, '#layout');
  const answerStyleEl = q<HTMLSelectElement>(container, '#answerStyle');
  const includeAnswerKeyEl = q<HTMLInputElement>(container, '#includeAnswerKey');

  const titleEl = q<HTMLInputElement>(container, '#title');
  const showNameEl = q<HTMLInputElement>(container, '#showName');
  const showDateEl = q<HTMLInputElement>(container, '#showDate');
  const instructionsEl = q<HTMLInputElement>(container, '#instructions');
  const exampleFirstEl = q<HTMLInputElement>(container, '#exampleFirst');
  const showSeedEl = q<HTMLInputElement>(container, '#showSeed');

  function emitChange(): void {
    for (const listener of listeners) {
      listener(state);
    }
  }

  function isClock(): boolean {
    return state.sheetType === 'clock';
  }

  function isFraction(): boolean {
    return state.sheetType === 'fraction';
  }

  function isGeometry(): boolean {
    return state.sheetType === 'geometry';
  }

  function isPattern(): boolean {
    return state.sheetType === 'pattern';
  }

  function isEquation(): boolean {
    return state.sheetType === 'equation';
  }

  function isMeasurement(): boolean {
    return state.sheetType === 'measurement';
  }

  function isArithmetic(): boolean {
    return state.sheetType === 'arithmetic';
  }

  /** "Antal uppgifter"/"Undvik dubbletter"/Seed är samma synliga fält för
   * alla tre bladtyper (se AppState-kommentaren i ui/state.ts), men läser
   * och skriver till generator/clock/fraction beroende på vilken typ som är
   * aktiv just nu. Returnerar en referens till den riktiga delen av state,
   * inte en kopia — att mutera .count etc. på returvärdet muterar state. */
  function activeCountable(): { count: number; avoidDuplicates: boolean; seed: number } {
    if (isClock()) return state.clock;
    if (isFraction()) return state.fraction;
    if (isGeometry()) return state.geometry;
    if (isPattern()) return state.pattern;
    if (isEquation()) return state.equation;
    if (isMeasurement()) return state.measurement;
    return state.generator;
  }

  function refreshFromState(): void {
    for (const radio of sheetTypeRadios) {
      radio.checked = radio.value === state.sheetType;
    }
    operationsSection.hidden = !isArithmetic();
    layoutField.hidden = !isArithmetic();
    // Mönsterblad tvingar alltid en enda kolumn (se resolveColumns i
    // pdf/layout.ts) — kolumnväljaren döljs så att den inte antyder ett val
    // som ändå ignoreras.
    columnsField.hidden = isPattern();
    missingNumberField.hidden = !isArithmetic();
    shuffleField.hidden = !isArithmetic();
    clockSection.hidden = !isClock();
    fractionSection.hidden = !isFraction();
    geometrySection.hidden = !isGeometry();
    patternSection.hidden = !isPattern();
    equationSection.hidden = !isEquation();
    measurementSection.hidden = !isMeasurement();

    for (const key of OPERATION_KEYS) {
      const cfg = state.generator.operations[key];
      const els = operationEls.get(key);
      if (!els) continue;
      els.enabled.checked = cfg.enabled;
      els.min.value = String(cfg.operandRange.min);
      els.max.value = String(cfg.operandRange.max);
      els.resultMin.value = cfg.resultRange ? String(cfg.resultRange.min) : '';
      els.resultMax.value = cfg.resultRange ? String(cfg.resultRange.max) : '';
    }
    subNoNegative.checked = state.generator.operations.sub.noNegative ?? false;
    mulTables.value = state.generator.operations.mul.tables?.join(',') ?? '';
    divAllowRemainder.checked = state.generator.operations.div.allowRemainder ?? false;

    for (const [key, el] of clockStepEls) {
      el.checked = state.clock.steps.includes(key);
    }
    clockDirectionEl.value = state.clock.direction;
    clockShowNumeralsEl.checked = state.clock.showNumerals;
    clockShowMinuteTicksEl.checked = state.clock.showMinuteTicks;

    for (const [d, el] of fractionDenominatorEls) {
      el.checked = state.fraction.denominators.includes(d);
    }
    fractionShapeEl.value = state.fraction.shape;
    fractionDirectionEl.value = state.fraction.direction;
    fractionShowPercentEl.checked = state.fraction.showPercent;
    // "Form" är meningslös utan figur, och "Visa procent" är meningslös när
    // procent redan ÄR svaret (identifyPercent/toPercent) — se
    // FRACTION_DIRECTION_LABELS och drawFractionProblem i pdf/render.ts.
    fractionShapeField.hidden = state.fraction.direction === 'toPercent';
    fractionShowPercentField.hidden =
      state.fraction.direction === 'toPercent' || state.fraction.direction === 'identifyPercent';

    geometryShapeEl.value = state.geometry.shape;
    geometryMeasureEl.value = state.geometry.measure;
    geometryMinEl.value = String(state.geometry.sideRange.min);
    geometryMaxEl.value = String(state.geometry.sideRange.max);
    geometryShowUnitsEl.checked = state.geometry.showUnits;

    for (const [step, el] of patternStepEls) {
      el.checked = state.pattern.steps.includes(step);
    }
    patternDescendingEl.checked = state.pattern.allowDescending;
    patternMinEl.value = String(state.pattern.startRange.min);
    patternMaxEl.value = String(state.pattern.startRange.max);
    patternTermCountEl.value = String(state.pattern.termCount);
    patternHiddenCountEl.value = String(state.pattern.hiddenCount);

    for (const [key, el] of equationOperationEls) {
      el.checked = state.equation.operations[key];
    }
    equationMinEl.value = String(state.equation.operandRange.min);
    equationMaxEl.value = String(state.equation.operandRange.max);
    equationAllowNegativeEl.checked = state.equation.allowNegative;

    measurementQuantityEl.value = state.measurement.quantity;
    measurementMinEl.value = String(state.measurement.valueRange.min);
    measurementMaxEl.value = String(state.measurement.valueRange.max);

    const countable = activeCountable();
    countEl.value = String(countable.count);
    avoidDuplicatesEl.checked = countable.avoidDuplicates;
    shuffleEl.checked = state.generator.shuffle;
    missingNumberEl.checked = state.generator.missingNumber;
    seedEl.value = String(countable.seed);
    seedEl.readOnly = true;

    columnsEl.value = String(state.document.columns);
    fontSizeEl.value = String(state.document.fontSizePt);
    fontSizeValueEl.textContent = `${state.document.fontSizePt} pt`;
    layoutEl.value = state.document.layout;
    answerStyleEl.value = state.document.answerStyle;
    includeAnswerKeyEl.checked = state.document.includeAnswerKey;

    titleEl.value = state.document.header.title;
    showNameEl.checked = state.document.header.showName;
    showDateEl.checked = state.document.header.showDate;
    instructionsEl.value = state.document.header.instructions;
    exampleFirstEl.checked = state.document.exampleFirst;
    showSeedEl.checked = state.document.showSeed;
  }

  /**
   * Uppdaterar header.instructions till det nya standardvärdet, men BARA om
   * fältet fortfarande stod på det GAMLA standardvärdet — annars skulle en
   * användares egen, handskrivna instruktionstext skrivas över varje gång
   * bladtyp eller riktning ändras. `change` ska vara den funktion som faktiskt
   * utför state-ändringen (sheetType/clockDirection/fractionDirection/
   * missingNumber) — standardvärdet räknas ut både före och efter den.
   */
  function updateInstructionsIfDefault(change: () => void): void {
    const previousDefault = computeDefaultInstructions(state);
    const hadDefault = state.document.header.instructions === previousDefault;
    change();
    if (hadDefault) {
      state.document.header.instructions = computeDefaultInstructions(state);
    }
  }

  for (const radio of sheetTypeRadios) {
    radio.addEventListener('change', () => {
      if (radio.checked) {
        updateInstructionsIfDefault(() => {
          const previousType = state.sheetType;
          state.sheetType = radio.value as SheetType;
          // "Ruta" är ett naturligare standardval för bråk (en tydligt
          // avgränsad plats att skriva täljare/nämnare i) än "Tomt streck",
          // som är standard för räknesätt/klockan. Sätts bara vid en faktisk
          // växling TILL bråk, inte varje gång formuläret laddas om, så att
          // ett eget val av svarsstil inte skrivs över i onödan.
          if (state.sheetType === 'fraction' && previousType !== 'fraction') {
            state.document.answerStyle = 'box';
          }
          // Geometrisvar kan vara flersiffriga och till och med ha decimaler
          // ("~28,3"), vilket inte får plats i bråkens lilla ruta — en linje
          // ger eleven en rimlig yta att skriva på. Samma "sätts bara vid en
          // faktisk växling"-princip som bråkets ruta ovan.
          if (state.sheetType === 'geometry' && previousType !== 'geometry') {
            state.document.answerStyle = 'line';
          }
          // Ekvationssvar kan vara flersiffriga och negativa ("-12"), vilket
          // inte får plats i bråkens/räknesättens lilla ruta. Samma
          // "sätts bara vid en faktisk växling"-princip som ovan.
          if (state.sheetType === 'equation' && previousType !== 'equation') {
            state.document.answerStyle = 'line';
          }
          // Enhetsbytessvar kan vara flersiffriga decimaler ("~1,7"), samma
          // "sätts bara vid en faktisk växling"-princip som ovan.
          if (state.sheetType === 'measurement' && previousType !== 'measurement') {
            state.document.answerStyle = 'line';
          }
        });
        refreshFromState();
        emitChange();
      }
    });
  }

  for (const key of OPERATION_KEYS) {
    const els = operationEls.get(key);
    if (!els) continue;
    const cfg = () => state.generator.operations[key];

    els.enabled.addEventListener('change', () => {
      cfg().enabled = els.enabled.checked;
      emitChange();
    });
    els.min.addEventListener('input', () => {
      const value = Number(els.min.value);
      if (Number.isFinite(value)) {
        cfg().operandRange.min = value;
        emitChange();
      }
    });
    els.max.addEventListener('input', () => {
      const value = Number(els.max.value);
      if (Number.isFinite(value)) {
        cfg().operandRange.max = value;
        emitChange();
      }
    });

    // Tomt fält (endera eller båda) betyder "ingen gräns" (resultRange
    // ospecificerad) — bara när båda är ifyllda med giltiga tal aktiveras den.
    const updateResultRange = () => {
      const minRaw = els.resultMin.value.trim();
      const maxRaw = els.resultMax.value.trim();
      if (minRaw === '' || maxRaw === '') {
        cfg().resultRange = undefined;
        emitChange();
        return;
      }
      const min = Number(minRaw);
      const max = Number(maxRaw);
      if (Number.isFinite(min) && Number.isFinite(max)) {
        cfg().resultRange = { min, max };
        emitChange();
      }
    };
    els.resultMin.addEventListener('input', updateResultRange);
    els.resultMax.addEventListener('input', updateResultRange);
  }

  subNoNegative.addEventListener('change', () => {
    state.generator.operations.sub.noNegative = subNoNegative.checked;
    emitChange();
  });
  mulTables.addEventListener('input', () => {
    const tables = mulTables.value
      .split(',')
      .map((part) => Number(part.trim()))
      .filter((n) => Number.isFinite(n) && n > 0);
    state.generator.operations.mul.tables = tables.length > 0 ? tables : undefined;
    emitChange();
  });
  divAllowRemainder.addEventListener('change', () => {
    state.generator.operations.div.allowRemainder = divAllowRemainder.checked;
    emitChange();
  });

  for (const chip of q<HTMLDivElement>(container, '#level-chips').querySelectorAll('button')) {
    chip.addEventListener('click', () => {
      const min = Number(chip.dataset.min);
      const max = Number(chip.dataset.max);
      for (const key of OPERATION_KEYS) {
        state.generator.operations[key].operandRange = { min, max };
      }
      refreshFromState();
      emitChange();
    });
  }

  for (const [key, el] of clockStepEls) {
    el.addEventListener('change', () => {
      state.clock.steps = el.checked
        ? [...state.clock.steps, key]
        : state.clock.steps.filter((s) => s !== key);
      emitChange();
    });
  }
  clockDirectionEl.addEventListener('change', () => {
    updateInstructionsIfDefault(() => {
      state.clock.direction = clockDirectionEl.value as ClockDirectionMode;
    });
    // refreshFromState (inte bara emitChange) eftersom instruktionsfältet
    // kan ha uppdaterats till ett nytt standardvärde, se
    // updateInstructionsIfDefault.
    refreshFromState();
    emitChange();
  });
  clockShowNumeralsEl.addEventListener('change', () => {
    state.clock.showNumerals = clockShowNumeralsEl.checked;
    emitChange();
  });
  clockShowMinuteTicksEl.addEventListener('change', () => {
    state.clock.showMinuteTicks = clockShowMinuteTicksEl.checked;
    emitChange();
  });

  for (const [d, el] of fractionDenominatorEls) {
    el.addEventListener('change', () => {
      state.fraction.denominators = el.checked
        ? [...state.fraction.denominators, d]
        : state.fraction.denominators.filter((existing) => existing !== d);
      emitChange();
    });
  }
  fractionShapeEl.addEventListener('change', () => {
    state.fraction.shape = fractionShapeEl.value as FractionShapeMode;
    emitChange();
  });
  fractionDirectionEl.addEventListener('change', () => {
    updateInstructionsIfDefault(() => {
      state.fraction.direction = fractionDirectionEl.value as FractionDirectionMode;
    });
    // refreshFromState (inte bara emitChange) eftersom den även visar/döljer
    // "Form" och "Visa procent" beroende på den nya riktningen, och
    // instruktionsfältet kan ha uppdaterats till ett nytt standardvärde, se
    // updateInstructionsIfDefault.
    refreshFromState();
    emitChange();
  });
  fractionShowPercentEl.addEventListener('change', () => {
    state.fraction.showPercent = fractionShowPercentEl.checked;
    emitChange();
  });

  geometryShapeEl.addEventListener('change', () => {
    state.geometry.shape = geometryShapeEl.value as GeometryShapeMode;
    emitChange();
  });
  geometryMeasureEl.addEventListener('change', () => {
    updateInstructionsIfDefault(() => {
      state.geometry.measure = geometryMeasureEl.value as GeometryMeasureMode;
    });
    // refreshFromState (inte bara emitChange) eftersom instruktionsfältet kan
    // ha uppdaterats till ett nytt standardvärde, se updateInstructionsIfDefault.
    refreshFromState();
    emitChange();
  });
  geometryMinEl.addEventListener('input', () => {
    const value = Number(geometryMinEl.value);
    if (Number.isFinite(value)) {
      state.geometry.sideRange.min = value;
      emitChange();
    }
  });
  geometryMaxEl.addEventListener('input', () => {
    const value = Number(geometryMaxEl.value);
    if (Number.isFinite(value)) {
      state.geometry.sideRange.max = value;
      emitChange();
    }
  });
  geometryShowUnitsEl.addEventListener('change', () => {
    state.geometry.showUnits = geometryShowUnitsEl.checked;
    emitChange();
  });

  for (const [step, el] of patternStepEls) {
    el.addEventListener('change', () => {
      state.pattern.steps = el.checked
        ? [...state.pattern.steps, step]
        : state.pattern.steps.filter((existing) => existing !== step);
      emitChange();
    });
  }
  patternDescendingEl.addEventListener('change', () => {
    state.pattern.allowDescending = patternDescendingEl.checked;
    emitChange();
  });
  patternMinEl.addEventListener('input', () => {
    const value = Number(patternMinEl.value);
    if (Number.isFinite(value)) {
      state.pattern.startRange.min = value;
      emitChange();
    }
  });
  patternMaxEl.addEventListener('input', () => {
    const value = Number(patternMaxEl.value);
    if (Number.isFinite(value)) {
      state.pattern.startRange.max = value;
      emitChange();
    }
  });
  patternTermCountEl.addEventListener('input', () => {
    const value = Number(patternTermCountEl.value);
    if (Number.isFinite(value)) {
      state.pattern.termCount = value;
      emitChange();
    }
  });
  patternHiddenCountEl.addEventListener('input', () => {
    const value = Number(patternHiddenCountEl.value);
    if (Number.isFinite(value)) {
      state.pattern.hiddenCount = value;
      emitChange();
    }
  });

  for (const [key, el] of equationOperationEls) {
    el.addEventListener('change', () => {
      state.equation.operations[key] = el.checked;
      emitChange();
    });
  }
  equationMinEl.addEventListener('input', () => {
    const value = Number(equationMinEl.value);
    if (Number.isFinite(value)) {
      state.equation.operandRange.min = value;
      emitChange();
    }
  });
  equationMaxEl.addEventListener('input', () => {
    const value = Number(equationMaxEl.value);
    if (Number.isFinite(value)) {
      state.equation.operandRange.max = value;
      emitChange();
    }
  });
  equationAllowNegativeEl.addEventListener('change', () => {
    state.equation.allowNegative = equationAllowNegativeEl.checked;
    emitChange();
  });

  measurementQuantityEl.addEventListener('change', () => {
    state.measurement.quantity = measurementQuantityEl.value as MeasurementQuantityMode;
    emitChange();
  });
  measurementMinEl.addEventListener('input', () => {
    const value = Number(measurementMinEl.value);
    if (Number.isFinite(value)) {
      state.measurement.valueRange.min = value;
      emitChange();
    }
  });
  measurementMaxEl.addEventListener('input', () => {
    const value = Number(measurementMaxEl.value);
    if (Number.isFinite(value)) {
      state.measurement.valueRange.max = value;
      emitChange();
    }
  });

  // "Antal uppgifter"/"Undvik dubbletter" är samma synliga fält för alla tre
  // bladtyper (se activeCountable ovan).
  countEl.addEventListener('input', () => {
    const value = Number(countEl.value);
    if (Number.isFinite(value)) {
      activeCountable().count = value;
      emitChange();
    }
  });
  avoidDuplicatesEl.addEventListener('change', () => {
    activeCountable().avoidDuplicates = avoidDuplicatesEl.checked;
    emitChange();
  });
  shuffleEl.addEventListener('change', () => {
    state.generator.shuffle = shuffleEl.checked;
    emitChange();
  });
  missingNumberEl.addEventListener('change', () => {
    updateInstructionsIfDefault(() => {
      state.generator.missingNumber = missingNumberEl.checked;
    });
    // refreshFromState (inte bara emitChange) eftersom instruktionsfältet
    // kan ha uppdaterats till ett nytt standardvärde, se
    // updateInstructionsIfDefault.
    refreshFromState();
    emitChange();
  });
  // Seedfältet är skrivskyddat som standard — det är sällan man vill skriva
  // in en exakt seed för hand, och en låst text ser dessutom mer ut som "det
  // här bladets id" än som ett vanligt inmatningsfält. Pennknappen låser upp
  // det tillfälligt; fältet låses igen så fort man lämnar det.
  seedEditButton.addEventListener('click', () => {
    seedEl.readOnly = false;
    seedEl.focus();
    seedEl.select();
  });
  seedEl.addEventListener('input', () => {
    const digitsOnly = seedEl.value.replace(/[^0-9]/g, '');
    if (digitsOnly !== seedEl.value) {
      seedEl.value = digitsOnly;
    }
    if (digitsOnly !== '') {
      activeCountable().seed = Number(digitsOnly);
      emitChange();
    }
  });
  seedEl.addEventListener('blur', () => {
    seedEl.readOnly = true;
    seedEl.value = String(activeCountable().seed);
  });

  columnsEl.addEventListener('change', () => {
    state.document.columns = columnsEl.value === 'auto' ? 'auto' : Number(columnsEl.value);
    emitChange();
  });
  fontSizeEl.addEventListener('input', () => {
    const value = Number(fontSizeEl.value);
    if (Number.isFinite(value)) {
      state.document.fontSizePt = value;
      fontSizeValueEl.textContent = `${value} pt`;
      emitChange();
    }
  });
  layoutEl.addEventListener('change', () => {
    state.document.layout = layoutEl.value as DocumentLayout;
    emitChange();
  });
  answerStyleEl.addEventListener('change', () => {
    state.document.answerStyle = answerStyleEl.value as AnswerStyle;
    emitChange();
  });
  includeAnswerKeyEl.addEventListener('change', () => {
    state.document.includeAnswerKey = includeAnswerKeyEl.checked;
    emitChange();
  });

  titleEl.addEventListener('input', () => {
    state.document.header.title = titleEl.value;
    emitChange();
  });
  showNameEl.addEventListener('change', () => {
    state.document.header.showName = showNameEl.checked;
    emitChange();
  });
  showDateEl.addEventListener('change', () => {
    state.document.header.showDate = showDateEl.checked;
    emitChange();
  });
  instructionsEl.addEventListener('input', () => {
    state.document.header.instructions = instructionsEl.value;
    emitChange();
  });
  exampleFirstEl.addEventListener('change', () => {
    state.document.exampleFirst = exampleFirstEl.checked;
    emitChange();
  });
  showSeedEl.addEventListener('change', () => {
    state.document.showSeed = showSeedEl.checked;
    emitChange();
  });

  refreshFromState();

  return {
    getState: () => state,
    onChange: (listener) => listeners.push(listener),
    setState: (next) => {
      state = next;
      refreshFromState();
      emitChange();
    },
    randomizeSeed: () => {
      // Slumpar alla tre bladtypernas seed tillsammans, så att den delade
      // seed-knappen/fältet ger ett förutsägbart resultat oavsett vilken typ
      // som råkar vara aktiv — de driver annars annars isär vid manuell
      // redigering av seed-fältet, se seedEl:s input-hanterare ovan.
      const seed = Math.floor(Math.random() * 1_000_000);
      state.generator.seed = seed;
      state.clock.seed = seed;
      state.fraction.seed = seed;
      state.geometry.seed = seed;
      state.pattern.seed = seed;
      state.equation.seed = seed;
      state.measurement.seed = seed;
      refreshFromState();
      emitChange();
    },
  };
}

function q<T extends Element>(root: ParentNode, selector: string): T {
  const el = root.querySelector<T>(selector);
  if (!el) {
    throw new Error(`Formulärelement saknas: ${selector}`);
  }
  return el;
}

function operationCardHtml(key: Operation, extraHtml: string): string {
  return `
    <fieldset class="op-card">
      <legend>
        <label>
          <input type="checkbox" id="op-${key}-enabled" />
          ${OPERATION_LABELS[key]}
        </label>
      </legend>
      <div class="op-range">
        <label>Från <input type="number" id="op-${key}-min" step="1" /></label>
        <label>Till <input type="number" id="op-${key}-max" step="1" /></label>
      </div>
      <div class="op-range op-range-result">
        <label>Svar min <input type="number" id="op-${key}-resultMin" step="1" placeholder="valfritt" /></label>
        <label>Svar max <input type="number" id="op-${key}-resultMax" step="1" placeholder="valfritt" /></label>
      </div>
      ${extraHtml}
    </fieldset>
  `;
}

function renderTemplate(): string {
  const levelChips = LEVEL_PRESETS.map(
    ({ label, min, max }) =>
      `<button type="button" data-min="${min}" data-max="${max}">${label}</button>`,
  ).join('');

  const clockStepCheckboxes = CLOCK_STEP_KEYS.map(
    (key) =>
      `<label><input type="checkbox" id="clock-step-${key}" /> ${CLOCK_STEP_LABELS[key]}</label>`,
  ).join('');
  const clockDirectionOptions = (
    Object.entries(CLOCK_DIRECTION_LABELS) as [ClockDirectionMode, string][]
  )
    .map(([value, label]) => `<option value="${value}">${label}</option>`)
    .join('');

  const fractionDenominatorCheckboxes = FRACTION_DENOMINATORS.map(
    (d) => `<label><input type="checkbox" id="fraction-denom-${d}" /> 1/${d}</label>`,
  ).join('');
  const fractionShapeOptions = (
    Object.entries(FRACTION_SHAPE_LABELS) as [FractionShapeMode, string][]
  )
    .map(([value, label]) => `<option value="${value}">${label}</option>`)
    .join('');
  const fractionDirectionOptions = (
    Object.entries(FRACTION_DIRECTION_LABELS) as [FractionDirectionMode, string][]
  )
    .map(([value, label]) => `<option value="${value}">${label}</option>`)
    .join('');

  const geometryShapeOptions = (
    Object.entries(GEOMETRY_SHAPE_LABELS) as [GeometryShapeMode, string][]
  )
    .map(([value, label]) => `<option value="${value}">${label}</option>`)
    .join('');
  const geometryMeasureOptions = (
    Object.entries(GEOMETRY_MEASURE_LABELS) as [GeometryMeasureMode, string][]
  )
    .map(([value, label]) => `<option value="${value}">${label}</option>`)
    .join('');

  const patternStepCheckboxes = PATTERN_STEP_OPTIONS.map(
    (step) => `<label><input type="checkbox" id="pattern-step-${step}" /> ${step}</label>`,
  ).join('');

  const equationOperationCheckboxes = OPERATION_KEYS.map(
    (key) =>
      `<label><input type="checkbox" id="equation-op-${key}" /> ${OPERATION_LABELS[key]}</label>`,
  ).join('');

  const measurementQuantityOptions = (
    Object.entries(MEASUREMENT_QUANTITY_LABELS) as [MeasurementQuantityMode, string][]
  )
    .map(([value, label]) => `<option value="${value}">${label}</option>`)
    .join('');

  return `
    <section aria-labelledby="sheettype-heading">
      <h2 id="sheettype-heading">Typ av blad</h2>
      <div class="sheet-type-toggle" id="sheet-type-toggle">
        <label><input type="radio" name="sheetType" value="arithmetic" /> Räknesätt</label>
        <label><input type="radio" name="sheetType" value="clock" /> Klockan</label>
        <label><input type="radio" name="sheetType" value="fraction" /> Bråk</label>
        <label><input type="radio" name="sheetType" value="geometry" /> Geometri</label>
        <label><input type="radio" name="sheetType" value="pattern" /> Talmönster <span class="beta-tag">(beta)</span></label>
        <label><input type="radio" name="sheetType" value="equation" /> Ekvationer <span class="beta-tag">(beta)</span></label>
        <label><input type="radio" name="sheetType" value="measurement" /> Mätning <span class="beta-tag">(beta)</span></label>
      </div>
    </section>

    <section aria-labelledby="operations-heading" id="operations-section">
      <h2 id="operations-heading">Räknesätt</h2>
      <div class="level-chips" id="level-chips">
        <span class="level-chips-label">Nivå för alla räknesätt:</span>
        ${levelChips}
      </div>
      <div class="op-grid">
        ${operationCardHtml('add', '')}
        ${operationCardHtml(
          'sub',
          `<label class="op-extra"><input type="checkbox" id="op-sub-noNegative" /> Tillåt inte negativa svar</label>`,
        )}
        ${operationCardHtml(
          'mul',
          `<label class="op-extra">Tabeller (kommaseparerat, valfritt)
            <input type="text" id="op-mul-tables" placeholder="t.ex. 2,5,10" />
          </label>`,
        )}
        ${operationCardHtml(
          'div',
          `<label class="op-extra"><input type="checkbox" id="op-div-allowRemainder" /> Tillåt rest</label>`,
        )}
      </div>
    </section>

    <section aria-labelledby="clock-heading" id="clock-section">
      <h2 id="clock-heading">Klockan</h2>
      <div class="field-grid" id="clock-steps">
        <span class="level-chips-label">Minuter:</span>
        ${clockStepCheckboxes}
      </div>
      <div class="field-grid">
        <label>Riktning
          <select id="clock-direction">${clockDirectionOptions}</select>
        </label>
      </div>
      <div class="field-grid">
        <label><input type="checkbox" id="clock-showNumerals" /> Visa siffror på urtavlan</label>
        <label><input type="checkbox" id="clock-showMinuteTicks" /> Visa minutstreck</label>
      </div>
    </section>

    <section aria-labelledby="fraction-heading" id="fraction-section">
      <h2 id="fraction-heading">Bråk</h2>
      <div class="field-grid" id="fraction-denominators">
        <span class="level-chips-label">Nämnare:</span>
        ${fractionDenominatorCheckboxes}
      </div>
      <div class="field-grid">
        <label id="fraction-shape-field">Form
          <select id="fraction-shape">${fractionShapeOptions}</select>
        </label>
        <label>Riktning
          <select id="fraction-direction">${fractionDirectionOptions}</select>
        </label>
      </div>
      <label id="fraction-showPercent-field">
        <input type="checkbox" id="fraction-showPercent" /> Visa procent (t.ex. "= 75 %")
      </label>
    </section>

    <section aria-labelledby="geometry-heading" id="geometry-section">
      <h2 id="geometry-heading">Geometri</h2>
      <div class="field-grid">
        <label>Figur
          <select id="geometry-shape">${geometryShapeOptions}</select>
        </label>
        <label>Räkna ut
          <select id="geometry-measure">${geometryMeasureOptions}</select>
        </label>
      </div>
      <div class="op-range">
        <label>Mått från <input type="number" id="geometry-min" min="1" step="1" /></label>
        <label>Till <input type="number" id="geometry-max" min="1" step="1" /></label>
      </div>
      <label><input type="checkbox" id="geometry-showUnits" /> Visa enheter (cm och cm²)</label>
    </section>

    <section aria-labelledby="pattern-heading" id="pattern-section">
      <h2 id="pattern-heading">Talmönster <span class="beta-tag">(beta)</span></h2>
      <div class="field-grid" id="pattern-steps">
        <span class="level-chips-label">Steg:</span>
        ${patternStepCheckboxes}
      </div>
      <label><input type="checkbox" id="pattern-descending" /> Tillåt nedåtgående följder</label>
      <div class="op-range">
        <label>Starttal från <input type="number" id="pattern-min" step="1" /></label>
        <label>Till <input type="number" id="pattern-max" step="1" /></label>
      </div>
      <div class="op-range">
        <label>Antal termer <input type="number" id="pattern-termCount" min="4" step="1" /></label>
        <label>Antal dolda <input type="number" id="pattern-hiddenCount" min="1" step="1" /></label>
      </div>
    </section>

    <section aria-labelledby="equation-heading" id="equation-section">
      <h2 id="equation-heading">Ekvationer <span class="beta-tag">(beta)</span></h2>
      <div class="field-grid" id="equation-operations">
        <span class="level-chips-label">Räknesätt:</span>
        ${equationOperationCheckboxes}
      </div>
      <div class="op-range">
        <label>Tal från <input type="number" id="equation-min" min="1" step="1" /></label>
        <label>Till <input type="number" id="equation-max" min="1" step="1" /></label>
      </div>
      <label><input type="checkbox" id="equation-allowNegative" /> Tillåt negativa tal</label>
    </section>

    <section aria-labelledby="measurement-heading" id="measurement-section">
      <h2 id="measurement-heading">Mätning <span class="beta-tag">(beta)</span></h2>
      <div class="field-grid">
        <label>Storhet
          <select id="measurement-quantity">${measurementQuantityOptions}</select>
        </label>
      </div>
      <div class="op-range">
        <label>Tal från <input type="number" id="measurement-min" min="1" step="1" /></label>
        <label>Till <input type="number" id="measurement-max" min="1" step="1" /></label>
      </div>
    </section>

    <section aria-labelledby="sheet-heading">
      <h2 id="sheet-heading">Blad</h2>
      <div class="field-grid">
        <label>Antal uppgifter <input type="number" id="count" min="1" step="1" /></label>
        <label id="columns-field">Kolumner
          <select id="columns">
            <option value="auto">Auto</option>
            <option value="1">1</option>
            <option value="2">2</option>
            <option value="3">3</option>
            <option value="4">4</option>
            <option value="5">5</option>
            <option value="6">6</option>
          </select>
        </label>
        <label>Textstorlek
          <input type="range" id="fontSize" min="10" max="32" step="1" />
          <span id="fontSize-value"></span>
        </label>
        <label>Svarsstil
          <select id="answerStyle">
            <option value="blank">Tomt streck</option>
            <option value="line">Linje</option>
            <option value="box">Ruta</option>
          </select>
        </label>
        <label id="layout-field">Uppställning
          <select id="layout">
            <option value="grid">Vågrätt (12 + 7 = __)</option>
            <option value="vertical">Stapling (tal under varandra)</option>
          </select>
        </label>
      </div>
      <label><input type="checkbox" id="includeAnswerKey" /> Facit på egna sidor sist</label>
    </section>

    <section aria-labelledby="extra-heading">
      <h2 id="extra-heading">Extra</h2>
      <label>Rubrik <input type="text" id="title" /></label>
      <label>Instruktion till eleven
        <input type="text" id="instructions" placeholder="t.ex. Rita visarna." />
      </label>
      <div class="field-grid">
        <label><input type="checkbox" id="showName" /> Namn-fält</label>
        <label><input type="checkbox" id="showDate" /> Datum-fält</label>
        <label><input type="checkbox" id="avoidDuplicates" /> Undvik dubbletter</label>
        <label id="shuffle-field"><input type="checkbox" id="shuffle" /> Blanda ordningen</label>
        <label id="missingNumber-field"><input type="checkbox" id="missingNumber" /> Saknat tal (t.ex. 3 + __ = 10)</label>
        <label><input type="checkbox" id="exampleFirst" /> Lös första uppgiften som exempel</label>
        <label><input type="checkbox" id="showSeed" /> Visa seed i sidfoten</label>
      </div>
      <label>
        Seed
        <div class="seed-field">
          <input type="text" id="seed" inputmode="numeric" pattern="[0-9]*" readonly />
          <button type="button" id="seed-edit" class="icon-button" aria-label="Redigera seed" title="Redigera seed">
            ${EDIT_ICON_SVG}
          </button>
        </div>
      </label>
    </section>
  `;
}
