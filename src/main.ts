import './style.css';
import type { jsPDF } from 'jspdf';
import { generateClockProblems } from './core/clock';
import { generateEquationProblems } from './core/equations';
import { generateFractionProblems } from './core/fractions';
import { generateProblems } from './core/generate';
import { generateGeometryProblems } from './core/geometry';
import { generateMeasurementProblems } from './core/measurement';
import { generatePatternProblems } from './core/patterns';
import {
  validateClockConfig,
  validateConfig,
  validateEquationConfig,
  validateFractionConfig,
  validateGeometryConfig,
  validateMeasurementConfig,
  validatePatternConfig,
} from './core/validate';
import type * as RenderModule from './pdf/render';
import { decodeState, encodeState } from './state/urlState';
import { loadState, saveState } from './state/storage';
import { mountForm } from './ui/form';
import { mountPreview } from './ui/preview';
import { PRESETS } from './ui/presets';
import { createDefaultState, toDocumentConfig, type AppState } from './ui/state';

function mustQuery<T extends Element>(selector: string): T {
  const el = document.querySelector<T>(selector);
  if (!el) {
    throw new Error(`Sidan saknar förväntat element: ${selector}`);
  }
  return el;
}

const settingsPanel = mustQuery<HTMLDivElement>('#settings-panel');
const quickstartContainer = mustQuery<HTMLDivElement>('#quickstart');
const warningsContainer = mustQuery<HTMLDivElement>('#warnings');
const previewFrame = mustQuery<HTMLIFrameElement>('#preview');
const downloadButton = mustQuery<HTMLButtonElement>('#download-button');
const printButton = mustQuery<HTMLButtonElement>('#print-button');
const copyLinkButton = mustQuery<HTMLButtonElement>('#copy-link-button');
const copyLinkStatus = mustQuery<HTMLSpanElement>('#copy-link-status');
const seedRandomizeButton = mustQuery<HTMLButtonElement>('#seed-randomize-button');
const resetButton = mustQuery<HTMLButtonElement>('#reset-button');

// En länk ska återskapa exakt samma blad: URL:en tar företräde (delad länk),
// annars återanvänds senaste sparade inställningar från den här webbläsaren.
const initialState = decodeState(window.location.search) ?? loadState() ?? createDefaultState();

const form = mountForm(settingsPanel, initialState);
const preview = mountPreview(previewFrame);

for (const preset of PRESETS) {
  const button = document.createElement('button');
  button.type = 'button';
  button.textContent = preset.label;
  button.addEventListener('click', () => form.setState(preset.build()));
  quickstartContainer.appendChild(button);
}

/**
 * pdf/render.ts drar med sig jsPDF, som ensam står för merparten av appens
 * JS-vikt (jsPDF:s källa är över 800 kB oförminskad). Den behövs INTE för att
 * rita upp och koppla in formuläret — bara för att faktiskt bygga en PDF —
 * så den laddas här på begäran (Vites `import()`-kodklyvning) i stället för
 * att vara en del av det skript som måste hämtas och köras innan sidan ens
 * blir interaktiv. Modulen cachas i en delad promise så att bara det FÖRSTA
 * anropet (regenerate() vid sidladdning) faktiskt väntar in nedladdningen —
 * varje senare anrop (formulärändringar, Ladda ner, Skriv ut) återanvänder
 * samma redan uppladdade modul.
 */
let renderModulePromise: Promise<typeof RenderModule> | undefined;

function loadRenderModule(): Promise<typeof RenderModule> {
  renderModulePromise ??= import('./pdf/render');
  return renderModulePromise;
}

function renderWarnings(warnings: string[]): void {
  if (warnings.length === 0) {
    warningsContainer.innerHTML = '';
    return;
  }
  const items = warnings.map((w) => `<li>${escapeHtml(w)}</li>`).join('');
  warningsContainer.innerHTML = `<div class="warnings"><strong>Att tänka på:</strong><ul>${items}</ul></div>`;
}

function escapeHtml(text: string): string {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

async function regenerate(state: AppState): Promise<void> {
  const render = await loadRenderModule();

  if (state.sheetType === 'clock') {
    const { config, warnings } = validateClockConfig(state.clock);
    renderWarnings(warnings);
    preview.update(() =>
      render.renderClockSheetToPdf(generateClockProblems(config), toDocumentConfig(state), config),
    );
    return;
  }

  if (state.sheetType === 'fraction') {
    const { config, warnings } = validateFractionConfig(state.fraction);
    renderWarnings(warnings);
    preview.update(() =>
      render.renderFractionSheetToPdf(
        generateFractionProblems(config),
        toDocumentConfig(state),
        config,
      ),
    );
    return;
  }

  if (state.sheetType === 'geometry') {
    const { config, warnings } = validateGeometryConfig(state.geometry);
    renderWarnings(warnings);
    preview.update(() =>
      render.renderGeometrySheetToPdf(
        generateGeometryProblems(config),
        toDocumentConfig(state),
        config,
      ),
    );
    return;
  }

  if (state.sheetType === 'pattern') {
    const { config, warnings } = validatePatternConfig(state.pattern);
    renderWarnings(warnings);
    preview.update(() =>
      render.renderPatternSheetToPdf(
        generatePatternProblems(config),
        toDocumentConfig(state),
        config,
      ),
    );
    return;
  }

  if (state.sheetType === 'equation') {
    const { config, warnings } = validateEquationConfig(state.equation);
    renderWarnings(warnings);
    preview.update(() =>
      render.renderEquationSheetToPdf(generateEquationProblems(config), toDocumentConfig(state)),
    );
    return;
  }

  if (state.sheetType === 'measurement') {
    const { config, warnings } = validateMeasurementConfig(state.measurement);
    renderWarnings(warnings);
    preview.update(() =>
      render.renderMeasurementSheetToPdf(
        generateMeasurementProblems(config),
        toDocumentConfig(state),
      ),
    );
    return;
  }

  const { config, warnings } = validateConfig(state.generator);
  renderWarnings(warnings);
  preview.update(() =>
    render.renderProblemsToPdf(generateProblems(config), toDocumentConfig(state)),
  );
}

let copyLinkStatusTimeoutId: number | undefined;

/**
 * Håller URL:en och localStorage i synk med formuläret. history.replaceState
 * (inte pushState) så att varje tangenttryckning inte fyller bakåtknappen
 * med mellansteg — bara den senaste, delbara länken behövs.
 */
function persistState(state: AppState): void {
  saveState(state);
  const url = `${window.location.pathname}?${encodeState(state).toString()}`;
  window.history.replaceState(null, '', url);
}

async function buildCurrentPdf(): Promise<jsPDF> {
  const render = await loadRenderModule();
  const state = form.getState();
  if (state.sheetType === 'clock') {
    const { config } = validateClockConfig(state.clock);
    return render.renderClockSheetToPdf(
      generateClockProblems(config),
      toDocumentConfig(state),
      config,
    );
  }
  if (state.sheetType === 'fraction') {
    const { config } = validateFractionConfig(state.fraction);
    return render.renderFractionSheetToPdf(
      generateFractionProblems(config),
      toDocumentConfig(state),
      config,
    );
  }
  if (state.sheetType === 'geometry') {
    const { config } = validateGeometryConfig(state.geometry);
    return render.renderGeometrySheetToPdf(
      generateGeometryProblems(config),
      toDocumentConfig(state),
      config,
    );
  }
  if (state.sheetType === 'pattern') {
    const { config } = validatePatternConfig(state.pattern);
    return render.renderPatternSheetToPdf(
      generatePatternProblems(config),
      toDocumentConfig(state),
      config,
    );
  }
  if (state.sheetType === 'equation') {
    const { config } = validateEquationConfig(state.equation);
    return render.renderEquationSheetToPdf(
      generateEquationProblems(config),
      toDocumentConfig(state),
    );
  }
  if (state.sheetType === 'measurement') {
    const { config } = validateMeasurementConfig(state.measurement);
    return render.renderMeasurementSheetToPdf(
      generateMeasurementProblems(config),
      toDocumentConfig(state),
    );
  }
  const { config } = validateConfig(state.generator);
  return render.renderProblemsToPdf(generateProblems(config), toDocumentConfig(state));
}

function sanitizeFilename(title: string): string {
  return title
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9åäö]+/gi, '-')
    .replace(/^-+|-+$/g, '');
}

downloadButton.addEventListener('click', () => {
  void handleDownload();
});

async function handleDownload(): Promise<void> {
  const doc = await buildCurrentPdf();
  const filename = sanitizeFilename(form.getState().document.header.title) || 'matteuppgifter';
  doc.save(`${filename}.pdf`);
}

printButton.addEventListener('click', () => {
  void handlePrint();
});

async function handlePrint(): Promise<void> {
  const doc = await buildCurrentPdf();
  // output('bloburl') returnerar i praktiken en sträng, trots vad jsPDF:s
  // typer säger — se kommentaren i ui/preview.ts.
  const url = doc.output('bloburl') as unknown as string;
  window.open(url, '_blank', 'noopener');
}

copyLinkButton.addEventListener('click', () => {
  void copyCurrentLink();
});

async function copyCurrentLink(): Promise<void> {
  try {
    await navigator.clipboard.writeText(window.location.href);
    showCopyLinkStatus('Länk kopierad!');
  } catch {
    showCopyLinkStatus('Kunde inte kopiera länken.');
  }
}

function showCopyLinkStatus(message: string): void {
  copyLinkStatus.textContent = message;
  if (copyLinkStatusTimeoutId !== undefined) {
    window.clearTimeout(copyLinkStatusTimeoutId);
  }
  copyLinkStatusTimeoutId = window.setTimeout(() => {
    copyLinkStatus.textContent = '';
  }, 2500);
}

seedRandomizeButton.addEventListener('click', () => form.randomizeSeed());

resetButton.addEventListener('click', () => form.setState(createDefaultState()));

form.onChange((state) => void regenerate(state));
form.onChange(persistState);
void regenerate(form.getState());
persistState(form.getState());

// Registrerar service workern (public/sw.js) så appen fungerar offline efter
// första besöket, se PLAN.md avsnitt 8. BASE_URL respekterar vite.config.ts:s
// `base` i både dev och prod. Offline/PWA är en bonus, inte kritiskt — en
// misslyckad registrering (äldre webbläsare, testmiljö utan https) ska
// aldrig störa resten av appen.
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`).catch(() => {
      // Se kommentaren ovan — tystnar avsiktligt.
    });
  });
}
