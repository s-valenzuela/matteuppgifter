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

/** T.ex. "12 + 7 =" — utan uppgiftsnummer och utan svar. */
export function formatProblemPrompt(problem: Problem): string {
  const symbol = OPERATION_SYMBOLS[problem.op];
  return `${problem.a} ${symbol} ${problem.b} =`;
}

/** T.ex. "19", eller "5 r 2" när division har en rest. */
export function formatAnswer(problem: Problem): string {
  if (problem.remainder !== undefined) {
    return `${problem.answer} r ${problem.remainder}`;
  }
  return `${problem.answer}`;
}
