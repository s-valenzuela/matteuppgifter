import './style.css';
import { generateProblems } from './core/generate';
import { validateConfig } from './core/validate';
import { renderProblemsToPdf } from './pdf/render';
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
const resetButton = mustQuery<HTMLButtonElement>('#reset-button');

const form = mountForm(settingsPanel, createDefaultState());
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

resetButton.addEventListener('click', () => form.setState(createDefaultState()));

form.onChange(regenerate);
regenerate(form.getState());
