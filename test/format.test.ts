import { describe, expect, it } from 'vitest';
import { computeOperandDigitCounts, formatAnswer, OPERATION_SYMBOLS } from '../src/pdf/format';
import type { Problem } from '../src/types';

describe('OPERATION_SYMBOLS', () => {
  it('har ett unikt symbol per räknesätt', () => {
    const symbols = Object.values(OPERATION_SYMBOLS);
    expect(new Set(symbols).size).toBe(symbols.length);
  });

  it('använder ett vanligt bindestreck för subtraktion, inte minustecken', () => {
    // U+2212 (minustecken) saknas i jsPDF:s WinAnsi-kodade Helvetica och gör
    // att svaret hamnar fel placerat på sidan — se render.ts.
    expect(OPERATION_SYMBOLS.sub).toBe('-');
  });
});

function problem(overrides: Partial<Problem>): Problem {
  return { op: 'add', a: 0, b: 0, answer: 0, missingSlot: 'answer', ...overrides };
}

describe('computeOperandDigitCounts', () => {
  it('ger minst en siffra för en tom lista', () => {
    expect(computeOperandDigitCounts([])).toEqual({ a: 1, b: 1 });
  });

  it('ger minst en siffra när alla operander är ensiffriga', () => {
    const problems = [problem({ a: 5, b: 3 }), problem({ a: 9, b: 1 })];
    expect(computeOperandDigitCounts(problems)).toEqual({ a: 1, b: 1 });
  });

  it('räknar a och b oberoende av varandra', () => {
    const problems = [problem({ a: 5, b: 100 }), problem({ a: 23, b: 1 })];
    // a: max(1, 2) = 2 siffror ("23"). b: max(3, 1) = 3 siffror ("100").
    expect(computeOperandDigitCounts(problems)).toEqual({ a: 2, b: 3 });
  });

  it('tar hänsyn till alla uppgifter, inte bara den första eller sista', () => {
    const problems = [problem({ a: 1, b: 1 }), problem({ a: 1234, b: 1 }), problem({ a: 1, b: 1 })];
    expect(computeOperandDigitCounts(problems).a).toBe(4);
  });
});

describe('formatAnswer', () => {
  it('formaterar ett vanligt svar', () => {
    const problem: Problem = { op: 'add', a: 12, b: 7, answer: 19, missingSlot: 'answer' };
    expect(formatAnswer(problem)).toBe('19');
  });

  it('formaterar division med rest som "kvot r rest"', () => {
    const problem: Problem = {
      op: 'div',
      a: 17,
      b: 5,
      answer: 3,
      remainder: 2,
      missingSlot: 'answer',
    };
    expect(formatAnswer(problem)).toBe('3 r 2');
  });

  it('visar "r 0" när resten råkar bli noll, i stället för att tysta försvinna', () => {
    const problem: Problem = {
      op: 'div',
      a: 15,
      b: 5,
      answer: 3,
      remainder: 0,
      missingSlot: 'answer',
    };
    expect(formatAnswer(problem)).toBe('3 r 0');
  });
});
