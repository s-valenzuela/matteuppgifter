import type { Operation, Problem } from '../types';

export const OPERATION_SYMBOLS: Record<Operation, string> = {
  add: '+',
  // Bindestreck (U+002D), inte minustecken (U+2212). jsPDF:s inbyggda
  // Helvetica-typsnitt använder WinAnsi-kodning där U+2212 saknas — det
  // renderas som ett felaktigt tecken och får dessutom doc.getTextWidth()
  // att räkna fel, så att svaret hamnar ovanpå uppgiften i stället för
  // efter den. × och ÷ ligger inom Latin-1/WinAnsi och fungerar utan problem.
  sub: '-',
  mul: '×',
  div: '÷',
};

export interface OperandDigitCounts {
  a: number;
  b: number;
}

/**
 * Hur många siffror den bredaste operanden A respektive B behöver över alla
 * uppgifter i dokumentet. render.ts använder det här för att högerjustera
 * varje operand inom en gemensam kolumnbredd, så att operatorer och
 * likhetstecken hamnar på samma x-position rad efter rad — annars hoppar de
 * i sidled beroende på hur många siffror just den uppgiften råkar ha.
 */
export function computeOperandDigitCounts(problems: readonly Problem[]): OperandDigitCounts {
  let a = 1;
  let b = 1;
  for (const problem of problems) {
    a = Math.max(a, String(problem.a).length);
    b = Math.max(b, String(problem.b).length);
  }
  return { a, b };
}

/** T.ex. "19", eller "5 r 2" när division har en rest. */
export function formatAnswer(problem: Problem): string {
  if (problem.remainder !== undefined) {
    return `${problem.answer} r ${problem.remainder}`;
  }
  return `${problem.answer}`;
}
