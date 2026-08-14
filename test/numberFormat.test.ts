import { describe, expect, it } from 'vitest';
import { formatDecimal1 } from '../src/core/numberFormat';

describe('formatDecimal1', () => {
  it('skriver heltal utan decimaler och utan ~', () => {
    expect(formatDecimal1(24)).toBe('24');
    expect(formatDecimal1(314)).toBe('314');
  });

  it('använder decimalkomma, inte punkt', () => {
    expect(formatDecimal1(62.8)).toBe('62,8');
  });

  it('markerar med ~ bara när avrundningen faktiskt tappar information', () => {
    expect(formatDecimal1(28.26)).toBe('~28,3');
    expect(formatDecimal1(1 / 3)).toBe('~0,3');
  });

  it('flyttalsbrus stämplar inte ett exakt värde som avrundat', () => {
    // 3.14 * 9 = 28.259999999999998 i flyttal, men "på riktigt" 28,26 (inte
    // exakt 1 decimal) — ska ändå få ~ eftersom AVRUNDNINGEN till 28,3
    // faktiskt tappar information (28,26 ≠ 28,3), oavsett flyttalsbruset.
    expect(formatDecimal1(3.14 * 9)).toBe('~28,3');
    // 0.1 + 0.2 är i flyttal 0.30000000000000004, men det är brus kring det
    // EXAKTA värdet 0,3 (redan en decimal) — ska INTE få ~.
    expect(formatDecimal1(0.1 + 0.2)).toBe('0,3');
  });

  it('innehåller aldrig tecken som saknas i jsPDF:s WinAnsi-kodning', () => {
    const values = [24, 28.26, 62.8, 1 / 3, 100 / 60];
    for (const value of values) {
      const text = formatDecimal1(value);
      expect(text).not.toMatch(/[π≈−]/);
    }
  });
});
