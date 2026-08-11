import { generateProblems } from './core/generate';
import { validateConfig } from './core/validate';
import type { GeneratorConfig } from './types';

const app = document.querySelector<HTMLDivElement>('#app');

if (app) {
  app.innerHTML = `
    <main>
      <h1>Matteuppgifter</h1>
      <p>PDF-generator för de fyra räknesätten. Under uppbyggnad.</p>
    </main>
  `;
}

const demoConfig: GeneratorConfig = {
  operations: {
    add: { enabled: true, operandRange: { min: 0, max: 20 } },
    sub: { enabled: true, operandRange: { min: 0, max: 20 }, noNegative: true },
    mul: { enabled: true, operandRange: { min: 0, max: 10 }, tables: [2, 5, 10] },
    div: { enabled: true, operandRange: { min: 1, max: 10 } },
  },
  count: 12,
  avoidDuplicates: true,
  shuffle: true,
  seed: 1,
};

const { config, warnings } = validateConfig(demoConfig);
if (warnings.length > 0) {
  console.warn('Varningar från validateConfig:', warnings);
}
console.log('Genererade uppgifter (demo):', generateProblems(config));
