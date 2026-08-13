import type {
  AnswerStyle,
  ClockDirectionMode,
  ClockStep,
  DocumentLayout,
  Operation,
  OperationConfig,
  Range,
  SheetType,
} from '../types';
import { createDefaultState, type AppState } from '../ui/state';

const OPERATION_KEYS: readonly Operation[] = ['add', 'sub', 'mul', 'div'];
const ANSWER_STYLES: readonly AnswerStyle[] = ['blank', 'line', 'box'];
const DOCUMENT_LAYOUTS: readonly DocumentLayout[] = ['grid', 'vertical'];
const SHEET_TYPES: readonly SheetType[] = ['arithmetic', 'clock'];
const CLOCK_STEPS: readonly ClockStep[] = ['hour', 'half', 'quarter', 'five'];
const CLOCK_DIRECTIONS: readonly ClockDirectionMode[] = ['read', 'draw', 'digital', 'mixed'];

/**
 * Speglar AppState i en query-sträng så att ett blad kan delas eller
 * bokmärkas ("Kopiera länk"). Formatet är kompakt (t.ex. `add=0:20`) snarare
 * än JSON, dels för läsbara URL:er, dels för att en URL som klistras in
 * ofärdig eller manipulerad aldrig ska kunna krascha appen — decodeState
 * faller alltid tillbaka till standardvärden fält för fält i stället för att
 * kasta ett fel.
 */
export function encodeState(state: AppState): URLSearchParams {
  const params = new URLSearchParams();

  // 'arithmetic' skrivs inte ut — det är standardvärdet och gör att äldre,
  // redan delade länkar (från innan klockfunktionen fanns) fortsätter fungera
  // oförändrat, se decodeState.
  if (state.sheetType === 'clock') {
    params.set('type', 'clock');
  }

  for (const key of OPERATION_KEYS) {
    const cfg = state.generator.operations[key];
    // Ett avstängt räknesätts talområde påverkar aldrig det genererade bladet,
    // så det utelämnas ur länken (kortare, mer delbar URL). decodeState
    // återställer i så fall standardområdet för det räknesättet i stället.
    if (cfg.enabled) {
      params.set(key, encodeOperation(key, cfg));
    }
  }

  params.set('n', String(state.generator.count));
  params.set('dup', boolStr(state.generator.avoidDuplicates));
  params.set('shuffle', boolStr(state.generator.shuffle));
  params.set('missing', boolStr(state.generator.missingNumber));
  params.set('seed', String(state.generator.seed));

  params.set('cols', String(state.document.columns));
  params.set('fs', String(state.document.fontSizePt));
  params.set('layout', state.document.layout);
  params.set('ans', state.document.answerStyle);
  params.set('facit', boolStr(state.document.includeAnswerKey));
  params.set('title', state.document.header.title);
  params.set('name', boolStr(state.document.header.showName));
  params.set('date', boolStr(state.document.header.showDate));

  params.set('cstep', state.clock.steps.join(','));
  params.set('cdir', state.clock.direction);
  params.set('cnum', boolStr(state.clock.showNumerals));
  params.set('cticks', boolStr(state.clock.showMinuteTicks));
  params.set('cn', String(state.clock.count));
  params.set('cdup', boolStr(state.clock.avoidDuplicates));
  params.set('cseed', String(state.clock.seed));

  return params;
}

/** Tolkar en query-sträng (t.ex. `location.search`). Returnerar null om den saknar kända fält. */
export function decodeState(search: string): AppState | null {
  const params = new URLSearchParams(search);
  if ([...params.keys()].length === 0) {
    return null;
  }

  const fallback = createDefaultState();
  const state = createDefaultState();

  // Frånvarande 'type' betyder 'arithmetic' — det gör att alla länkar delade
  // innan klockfunktionen fanns fortsätter återskapa exakt samma blad.
  state.sheetType = decodeSheetType(params.get('type'), fallback.sheetType);

  for (const key of OPERATION_KEYS) {
    const raw = params.get(key);
    state.generator.operations[key] =
      raw === null
        ? disabledOperation(fallback.generator.operations[key])
        : decodeOperation(key, raw, fallback.generator.operations[key]);
  }

  state.generator.count = intOr(params.get('n'), fallback.generator.count);
  state.generator.avoidDuplicates = boolOr(params.get('dup'), fallback.generator.avoidDuplicates);
  state.generator.shuffle = boolOr(params.get('shuffle'), fallback.generator.shuffle);
  state.generator.missingNumber = boolOr(params.get('missing'), fallback.generator.missingNumber);
  state.generator.seed = intOr(params.get('seed'), fallback.generator.seed);

  state.document.columns = decodeColumns(params.get('cols'), fallback.document.columns);
  state.document.fontSizePt = intOr(params.get('fs'), fallback.document.fontSizePt);
  state.document.layout = decodeDocumentLayout(params.get('layout'), fallback.document.layout);
  state.document.answerStyle = decodeAnswerStyle(params.get('ans'), fallback.document.answerStyle);
  state.document.includeAnswerKey = boolOr(params.get('facit'), fallback.document.includeAnswerKey);
  state.document.header.title = params.get('title') ?? fallback.document.header.title;
  state.document.header.showName = boolOr(params.get('name'), fallback.document.header.showName);
  state.document.header.showDate = boolOr(params.get('date'), fallback.document.header.showDate);

  state.clock.steps = decodeClockSteps(params.get('cstep'), fallback.clock.steps);
  state.clock.direction = decodeClockDirection(params.get('cdir'), fallback.clock.direction);
  state.clock.showNumerals = boolOr(params.get('cnum'), fallback.clock.showNumerals);
  state.clock.showMinuteTicks = boolOr(params.get('cticks'), fallback.clock.showMinuteTicks);
  state.clock.count = intOr(params.get('cn'), fallback.clock.count);
  state.clock.avoidDuplicates = boolOr(params.get('cdup'), fallback.clock.avoidDuplicates);
  state.clock.seed = intOr(params.get('cseed'), fallback.clock.seed);

  return state;
}

function decodeSheetType(raw: string | null, fallback: SheetType): SheetType {
  return raw !== null && (SHEET_TYPES as readonly string[]).includes(raw)
    ? (raw as SheetType)
    : fallback;
}

/** Kommaseparerad lista av ikryssade minutgrupper, t.ex. "hour,half". En tom
 * eller helt ogiltig lista faller tillbaka i sin helhet, precis som övriga
 * fält — annars skulle en manipulerad länk kunna ge en klockuppgift utan
 * någon giltig minutgrupp alls. */
function decodeClockSteps(raw: string | null, fallback: ClockStep[]): ClockStep[] {
  if (raw === null) return fallback;
  const steps = raw
    .split(',')
    .filter((part): part is ClockStep => (CLOCK_STEPS as readonly string[]).includes(part));
  return steps.length > 0 ? steps : fallback;
}

function decodeClockDirection(
  raw: string | null,
  fallback: ClockDirectionMode,
): ClockDirectionMode {
  return raw !== null && (CLOCK_DIRECTIONS as readonly string[]).includes(raw)
    ? (raw as ClockDirectionMode)
    : fallback;
}

function encodeOperation(key: Operation, cfg: OperationConfig): string {
  const parts = [String(cfg.operandRange.min), String(cfg.operandRange.max)];
  switch (key) {
    case 'sub':
      parts.push(boolStr(cfg.noNegative ?? false));
      break;
    case 'mul':
      parts.push(cfg.tables && cfg.tables.length > 0 ? cfg.tables.join(',') : '');
      break;
    case 'div':
      parts.push(boolStr(cfg.allowRemainder ?? false));
      break;
    case 'add':
      parts.push('');
      break;
  }
  // Alltid sist, oavsett räknesätt, så indexplatsen är förutsägbar vid
  // avkodning. Talen separeras med "," snarare än ":" (som redan används
  // mellan hela delarna ovan) eftersom ett negativt gräns-tal annars skulle
  // ge ett extra "-"-tecken som kolliderar med separatorn.
  parts.push(cfg.resultRange ? `${cfg.resultRange.min},${cfg.resultRange.max}` : '');
  return parts.join(':');
}

function decodeOperation(key: Operation, raw: string, fallback: OperationConfig): OperationConfig {
  const [rawMin, rawMax, rawExtra, rawResultRange] = raw.split(':');
  const min = numberOr(rawMin, fallback.operandRange.min);
  const max = numberOr(rawMax, fallback.operandRange.max);
  const cfg: OperationConfig = { enabled: true, operandRange: { min, max } };

  switch (key) {
    case 'sub':
      cfg.noNegative = boolOr(rawExtra, false);
      break;
    case 'mul': {
      const tables = (rawExtra ?? '')
        .split(',')
        .map((part) => Number(part.trim()))
        .filter((n) => Number.isFinite(n) && n > 0);
      cfg.tables = tables.length > 0 ? tables : undefined;
      break;
    }
    case 'div':
      cfg.allowRemainder = boolOr(rawExtra, false);
      break;
    case 'add':
      break;
  }

  cfg.resultRange = decodeResultRange(rawResultRange);
  return cfg;
}

function decodeResultRange(raw: string | undefined): Range | undefined {
  if (!raw) return undefined;
  const [minRaw, maxRaw] = raw.split(',');
  const min = Number(minRaw);
  const max = Number(maxRaw);
  return Number.isFinite(min) && Number.isFinite(max) ? { min, max } : undefined;
}

function disabledOperation(fallback: OperationConfig): OperationConfig {
  return { ...fallback, enabled: false };
}

function decodeColumns(raw: string | null, fallback: number | 'auto'): number | 'auto' {
  if (raw === null) return fallback;
  if (raw === 'auto') return 'auto';
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : fallback;
}

function decodeAnswerStyle(raw: string | null, fallback: AnswerStyle): AnswerStyle {
  return raw !== null && (ANSWER_STYLES as readonly string[]).includes(raw)
    ? (raw as AnswerStyle)
    : fallback;
}

function decodeDocumentLayout(raw: string | null, fallback: DocumentLayout): DocumentLayout {
  return raw !== null && (DOCUMENT_LAYOUTS as readonly string[]).includes(raw)
    ? (raw as DocumentLayout)
    : fallback;
}

function boolStr(value: boolean): string {
  return value ? '1' : '0';
}

function boolOr(raw: string | null | undefined, fallback: boolean): boolean {
  if (raw === '1') return true;
  if (raw === '0') return false;
  return fallback;
}

function numberOr(raw: string | undefined, fallback: number): number {
  const n = Number(raw);
  return raw !== undefined && Number.isFinite(n) ? n : fallback;
}

function intOr(raw: string | null, fallback: number): number {
  if (raw === null) return fallback;
  const n = Number(raw);
  return Number.isFinite(n) ? Math.floor(n) : fallback;
}
