import { describe, expect, it } from 'vitest';
import { formatAnswer, formatProblemPrompt, OPERATION_SYMBOLS } from '../src/pdf/format';
import type { Problem } from '../src/types';

describe('OPERATION_SYMBOLS', () => {
  it('har ett unikt symbol per räknesätt', () => {
    const symbols = Object.values(OPERATION_SYMBOLS);
    expect(new Set(symbols).size).toBe(symbols.length);
  });
});

describe('formatProblemPrompt', () => {
  it('formaterar addition', () => {
    const problem: Problem = { op: 'add', a: 12, b: 7, answer: 19 };
    expect(formatProblemPrompt(problem)).toBe('12 + 7 =');
  });

  it('formaterar subtraktion med ett vanligt bindestreck, inte minustecken', () => {
    // U+2212 (minustecken) saknas i jsPDF:s WinAnsi-kodade Helvetica och gör
    // att svaret hamnar fel placerat på sidan — se render.ts.
    const problem: Problem = { op: 'sub', a: 9, b: 4, answer: 5 };
    expect(formatProblemPrompt(problem)).toBe('9 - 4 =');
  });

  it('formaterar multiplikation', () => {
    const problem: Problem = { op: 'mul', a: 6, b: 7, answer: 42 };
    expect(formatProblemPrompt(problem)).toBe('6 × 7 =');
  });

  it('formaterar division med täljare och nämnare, inte kvoten', () => {
    const problem: Problem = { op: 'div', a: 56, b: 8, answer: 7 };
    expect(formatProblemPrompt(problem)).toBe('56 ÷ 8 =');
  });
});

describe('formatAnswer', () => {
  it('formaterar ett vanligt svar', () => {
    const problem: Problem = { op: 'add', a: 12, b: 7, answer: 19 };
    expect(formatAnswer(problem)).toBe('19');
  });

  it('formaterar division med rest som "kvot r rest"', () => {
    const problem: Problem = { op: 'div', a: 17, b: 5, answer: 3, remainder: 2 };
    expect(formatAnswer(problem)).toBe('3 r 2');
  });

  it('visar "r 0" när resten råkar bli noll, i stället för att tysta försvinna', () => {
    const problem: Problem = { op: 'div', a: 15, b: 5, answer: 3, remainder: 0 };
    expect(formatAnswer(problem)).toBe('3 r 0');
  });
});
