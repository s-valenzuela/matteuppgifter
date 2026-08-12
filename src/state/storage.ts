import { createDefaultState, type AppState } from '../ui/state';

const STORAGE_KEY = 'matteuppgifter:state:v1';

/**
 * Läser senast sparade AppState från localStorage. Skyddad med try/catch
 * eftersom localStorage kan sakna (privat läge i vissa webbläsare), vara
 * fullt, eller innehålla skräp/gammalt schema — appen ska starta med
 * standardvärden i stället för att krascha om något av detta inträffar.
 */
export function loadState(): AppState | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    return isAppState(parsed) ? normalizeState(parsed) : null;
  } catch {
    return null;
  }
}

/**
 * Fyller på sheetType/clock för ett tillstånd sparat innan klockfunktionen
 * fanns — isAppState() nedan är en medvetet ytlig kontroll som INTE känner av
 * dessa fält, så ett äldre sparat tillstånd passar igenom den och skulle
 * annars komma tillbaka med sheetType/clock som undefined.
 */
function normalizeState(state: AppState): AppState {
  const fallback = createDefaultState();
  return {
    sheetType: state.sheetType === 'clock' ? 'clock' : 'arithmetic',
    generator: state.generator,
    clock: state.clock ?? fallback.clock,
    document: state.document,
  };
}

export function saveState(state: AppState): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Kvot full eller localStorage otillgängligt — då sparas bara inte.
  }
}

export function clearState(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Se saveState.
  }
}

/** Ytlig formkontroll — räcker för att avvisa skräp eller ett äldre schema utan att krascha. */
function isAppState(value: unknown): value is AppState {
  if (typeof value !== 'object' || value === null) return false;
  const obj = value as Record<string, unknown>;
  const generator = obj.generator;
  const document = obj.document;
  if (typeof generator !== 'object' || generator === null) return false;
  if (typeof document !== 'object' || document === null) return false;

  const gen = generator as Record<string, unknown>;
  const ops = gen.operations;
  if (typeof ops !== 'object' || ops === null) return false;
  const opsObj = ops as Record<string, unknown>;
  for (const key of ['add', 'sub', 'mul', 'div']) {
    if (typeof opsObj[key] !== 'object' || opsObj[key] === null) return false;
  }

  return (
    typeof gen.count === 'number' &&
    typeof gen.seed === 'number' &&
    typeof (document as Record<string, unknown>).header === 'object'
  );
}
