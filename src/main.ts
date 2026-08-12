import './style.css';
import { generateProblems } from './core/generate';
import { validateConfig } from './core/validate';
import { renderProblemsToPdf } from './pdf/render';
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

function regenerate(state: AppState): void {
  const { config, warnings } = validateConfig(state.generator);
  renderWarnings(warnings);
  const problems = generateProblems(config);
  preview.update(problems, toDocumentConfig(state));
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

function buildCurrentPdf() {
  const state = form.getState();
  const { config } = validateConfig(state.generator);
  const problems = generateProblems(config);
  return renderProblemsToPdf(problems, toDocumentConfig(state));
}

function sanitizeFilename(title: string): string {
  return title
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9åäö]+/gi, '-')
    .replace(/^-+|-+$/g, '');
}

downloadButton.addEventListener('click', () => {
  const doc = buildCurrentPdf();
  const filename = sanitizeFilename(form.getState().document.header.title) || 'matteuppgifter';
  doc.save(`${filename}.pdf`);
});

printButton.addEventListener('click', () => {
  const doc = buildCurrentPdf();
  // output('bloburl') returnerar i praktiken en sträng, trots vad jsPDF:s
  // typer säger — se kommentaren i ui/preview.ts.
  const url = doc.output('bloburl') as unknown as string;
  window.open(url, '_blank');
});

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

form.onChange(regenerate);
form.onChange(persistState);
regenerate(form.getState());
persistState(form.getState());

// Registrerar service workern (public/sw.js) så appen fungerar offline efter
// första besöket, se PLAN.md avsnitt 8. BASE_URL respekterar vite.config.ts:s
// `base: '/matteuppgifter/'` i både dev och prod. Offline/PWA är en bonus,
// inte kritiskt — en misslyckad registrering (äldre webbläsare, testmiljö
// utan https) ska aldrig störa resten av appen.
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`).catch(() => {
      // Se kommentaren ovan — tystnar avsiktligt.
    });
  });
}
