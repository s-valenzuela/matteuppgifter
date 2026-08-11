import type { AnswerStyle, Operation } from '../types';
import { LEVEL_PRESETS } from './presets';
import type { AppState } from './state';

const OPERATION_LABELS: Record<Operation, string> = {
  add: 'Addition (+)',
  sub: 'Subtraktion (−)',
  mul: 'Multiplikation (×)',
  div: 'Division (÷)',
};

const OPERATION_KEYS: readonly Operation[] = ['add', 'sub', 'mul', 'div'];

// Feather-ikoner (MIT), inbäddade som inline-SVG istället för en extern ikonfil
// eftersom appen inte har några andra tillgångar att ladda in.
const REFRESH_ICON_SVG = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="16" height="16" aria-hidden="true" focusable="false"><polyline points="23 4 23 10 17 10"></polyline><polyline points="1 20 1 14 7 14"></polyline><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path></svg>`;
const EDIT_ICON_SVG = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="14" height="14" aria-hidden="true" focusable="false"><path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"></path></svg>`;

export interface FormController {
  getState(): AppState;
  onChange(listener: (state: AppState) => void): void;
  setState(next: AppState): void;
}

export function mountForm(container: HTMLElement, initialState: AppState): FormController {
  container.innerHTML = renderTemplate();

  let state = initialState;
  const listeners: Array<(state: AppState) => void> = [];

  const operationEls = new Map(
    OPERATION_KEYS.map((key) => [
      key,
      {
        enabled: q<HTMLInputElement>(container, `#op-${key}-enabled`),
        min: q<HTMLInputElement>(container, `#op-${key}-min`),
        max: q<HTMLInputElement>(container, `#op-${key}-max`),
      },
    ]),
  );

  const subNoNegative = q<HTMLInputElement>(container, '#op-sub-noNegative');
  const mulTables = q<HTMLInputElement>(container, '#op-mul-tables');
  const divAllowRemainder = q<HTMLInputElement>(container, '#op-div-allowRemainder');

  const countEl = q<HTMLInputElement>(container, '#count');
  const avoidDuplicatesEl = q<HTMLInputElement>(container, '#avoidDuplicates');
  const shuffleEl = q<HTMLInputElement>(container, '#shuffle');
  const seedEl = q<HTMLInputElement>(container, '#seed');
  const seedEditButton = q<HTMLButtonElement>(container, '#seed-edit');
  const seedRandomizeButton = q<HTMLButtonElement>(container, '#seed-randomize');

  const columnsEl = q<HTMLSelectElement>(container, '#columns');
  const fontSizeEl = q<HTMLInputElement>(container, '#fontSize');
  const fontSizeValueEl = q<HTMLSpanElement>(container, '#fontSize-value');
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

  function refreshFromState(): void {
    for (const key of OPERATION_KEYS) {
      const cfg = state.generator.operations[key];
      const els = operationEls.get(key);
      if (!els) continue;
      els.enabled.checked = cfg.enabled;
      els.min.value = String(cfg.operandRange.min);
      els.max.value = String(cfg.operandRange.max);
    }
    subNoNegative.checked = state.generator.operations.sub.noNegative ?? false;
    mulTables.value = state.generator.operations.mul.tables?.join(',') ?? '';
    divAllowRemainder.checked = state.generator.operations.div.allowRemainder ?? false;

    countEl.value = String(state.generator.count);
    avoidDuplicatesEl.checked = state.generator.avoidDuplicates;
    shuffleEl.checked = state.generator.shuffle;
    seedEl.value = String(state.generator.seed);
    seedEl.readOnly = true;

    columnsEl.value = String(state.document.columns);
    fontSizeEl.value = String(state.document.fontSizePt);
    fontSizeValueEl.textContent = `${state.document.fontSizePt} pt`;
    answerStyleEl.value = state.document.answerStyle;
    includeAnswerKeyEl.checked = state.document.includeAnswerKey;

    titleEl.value = state.document.header.title;
    showNameEl.checked = state.document.header.showName;
    showDateEl.checked = state.document.header.showDate;
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

  countEl.addEventListener('input', () => {
    const value = Number(countEl.value);
    if (Number.isFinite(value)) {
      state.generator.count = value;
      emitChange();
    }
  });
  avoidDuplicatesEl.addEventListener('change', () => {
    state.generator.avoidDuplicates = avoidDuplicatesEl.checked;
    emitChange();
  });
  shuffleEl.addEventListener('change', () => {
    state.generator.shuffle = shuffleEl.checked;
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
      state.generator.seed = Number(digitsOnly);
      emitChange();
    }
  });
  seedEl.addEventListener('blur', () => {
    seedEl.readOnly = true;
    seedEl.value = String(state.generator.seed);
  });
  seedRandomizeButton.addEventListener('click', () => {
    state.generator.seed = Math.floor(Math.random() * 1_000_000);
    refreshFromState();
    emitChange();
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
      ${extraHtml}
    </fieldset>
  `;
}

function renderTemplate(): string {
  const levelChips = LEVEL_PRESETS.map(
    ({ label, min, max }) =>
      `<button type="button" data-min="${min}" data-max="${max}">${label}</button>`,
  ).join('');

  return `
    <section aria-labelledby="operations-heading">
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
        <label><input type="checkbox" id="shuffle" /> Blanda ordningen</label>
      </div>
      <label>
        Seed
        <div class="seed-field">
          <input type="text" id="seed" inputmode="numeric" pattern="[0-9]*" readonly />
          <button type="button" id="seed-edit" class="icon-button" aria-label="Redigera seed" title="Redigera seed">
            ${EDIT_ICON_SVG}
          </button>
          <button type="button" id="seed-randomize" class="icon-button-labelled" title="Slumpa om en ny seed">
            ${REFRESH_ICON_SVG}
            <span>Slumpa om</span>
          </button>
        </div>
      </label>
    </section>
  `;
}
