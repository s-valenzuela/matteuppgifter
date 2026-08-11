import { generateProblems } from './core/generate';
import { validateConfig } from './core/validate';
import { renderProblemsToPdf } from './pdf/render';
import type { DocumentConfig, GeneratorConfig } from './types';

const app = document.querySelector<HTMLDivElement>('#app');

if (app) {
  app.innerHTML = `
    <main>
      <h1>Matteuppgifter</h1>
      <p>PDF-generator för de fyra räknesätten. Under uppbyggnad — det riktiga
      formuläret (M3) finns inte än. Knappen nedan är en tillfällig manuell
      koll av PDF-renderingen från M2.</p>
      <button id="download">Ladda ner exempel-PDF</button>
    </main>
  `;
}

const demoGeneratorConfig: GeneratorConfig = {
  operations: {
    add: { enabled: true, operandRange: { min: 0, max: 20 } },
    sub: { enabled: true, operandRange: { min: 0, max: 20 }, noNegative: true },
    mul: { enabled: true, operandRange: { min: 0, max: 10 }, tables: [2, 5, 10] },
    div: { enabled: true, operandRange: { min: 1, max: 10 } },
  },
  count: 30,
  avoidDuplicates: true,
  shuffle: true,
  seed: 1,
};

const demoDocumentConfig: DocumentConfig = {
  header: { title: 'Matteuppgifter', showName: true, showDate: true },
  fontSizePt: 14,
  columns: 'auto',
  answerStyle: 'blank',
  includeAnswerKey: true,
  seed: demoGeneratorConfig.seed,
};

const { config, warnings } = validateConfig(demoGeneratorConfig);
if (warnings.length > 0) {
  console.warn('Varningar från validateConfig:', warnings);
}
const demoProblems = generateProblems(config);
console.log('Genererade uppgifter (demo):', demoProblems);

document.querySelector<HTMLButtonElement>('#download')?.addEventListener('click', () => {
  const doc = renderProblemsToPdf(demoProblems, demoDocumentConfig);
  doc.save('matteuppgifter-demo.pdf');
});
