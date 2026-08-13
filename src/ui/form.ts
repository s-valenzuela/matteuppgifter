import type {
  AnswerStyle,
  ClockDirectionMode,
  ClockStep,
  DocumentLayout,
  Operation,
  SheetType,
} from '../types';
import { LEVEL_PRESETS } from './presets';
import type { AppState } from './state';

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
  const missingNumberField = q<HTMLElement>(container, '#missingNumber-field');
  const shuffleField = q<HTMLElement>(container, '#shuffle-field');
  const clockSection = q<HTMLElement>(container, '#clock-section');

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

  function emitChange(): void {
    for (const listener of listeners) {
      listener(state);
    }
  }

  function isClock(): boolean {
    return state.sheetType === 'clock';
  }

  function refreshFromState(): void {
    for (const radio of sheetTypeRadios) {
      radio.checked = radio.value === state.sheetType;
    }
    operationsSection.hidden = isClock();
    layoutField.hidden = isClock();
    missingNumberField.hidden = isClock();
    shuffleField.hidden = isClock();
    clockSection.hidden = !isClock();

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

    countEl.value = String(isClock() ? state.clock.count : state.generator.count);
    avoidDuplicatesEl.checked = isClock()
      ? state.clock.avoidDuplicates
      : state.generator.avoidDuplicates;
    shuffleEl.checked = state.generator.shuffle;
    missingNumberEl.checked = state.generator.missingNumber;
    seedEl.value = String(isClock() ? state.clock.seed : state.generator.seed);
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
  }

  for (const radio of sheetTypeRadios) {
    radio.addEventListener('change', () => {
      if (radio.checked) {
        state.sheetType = radio.value as SheetType;
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
    state.clock.direction = clockDirectionEl.value as ClockDirectionMode;
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

  // "Antal uppgifter"/"Undvik dubbletter" är samma synliga fält för båda
  // bladtyperna (se AppState-kommentaren i ui/state.ts), men skriver till
  // generator eller clock beroende på vilken typ som är aktiv just nu.
  countEl.addEventListener('input', () => {
    const value = Number(countEl.value);
    if (Number.isFinite(value)) {
      if (isClock()) {
        state.clock.count = value;
      } else {
        state.generator.count = value;
      }
      emitChange();
    }
  });
  avoidDuplicatesEl.addEventListener('change', () => {
    if (isClock()) {
      state.clock.avoidDuplicates = avoidDuplicatesEl.checked;
    } else {
      state.generator.avoidDuplicates = avoidDuplicatesEl.checked;
    }
    emitChange();
  });
  shuffleEl.addEventListener('change', () => {
    state.generator.shuffle = shuffleEl.checked;
    emitChange();
  });
  missingNumberEl.addEventListener('change', () => {
    state.generator.missingNumber = missingNumberEl.checked;
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
      if (isClock()) {
        state.clock.seed = Number(digitsOnly);
      } else {
        state.generator.seed = Number(digitsOnly);
      }
      emitChange();
    }
  });
  seedEl.addEventListener('blur', () => {
    seedEl.readOnly = true;
    seedEl.value = String(isClock() ? state.clock.seed : state.generator.seed);
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
      // Slumpar båda bladtypernas seed tillsammans, så att den delade
      // seed-knappen/fältet ger ett förutsägbart resultat oavsett vilken typ
      // som råkar vara aktiv — de driver annars annars isär vid manuell
      // redigering av seed-fältet, se seedEl:s input-hanterare ovan.
      const seed = Math.floor(Math.random() * 1_000_000);
      state.generator.seed = seed;
      state.clock.seed = seed;
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

  return `
    <section aria-labelledby="sheettype-heading">
      <h2 id="sheettype-heading">Typ av blad</h2>
      <div class="sheet-type-toggle" id="sheet-type-toggle">
        <label><input type="radio" name="sheetType" value="arithmetic" /> Räknesätt</label>
        <label><input type="radio" name="sheetType" value="clock" /> Klockan</label>
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

    <section aria-labelledby="sheet-heading">
      <h2 id="sheet-heading">Blad</h2>
      <div class="field-grid">
        <label>Antal uppgifter <input type="number" id="count" min="1" step="1" /></label>
        <label>Kolumner
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
      <div class="field-grid">
        <label><input type="checkbox" id="showName" /> Namn-fält</label>
        <label><input type="checkbox" id="showDate" /> Datum-fält</label>
        <label><input type="checkbox" id="avoidDuplicates" /> Undvik dubbletter</label>
        <label id="shuffle-field"><input type="checkbox" id="shuffle" /> Blanda ordningen</label>
        <label id="missingNumber-field"><input type="checkbox" id="missingNumber" /> Saknat tal (t.ex. 3 + __ = 10)</label>
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
