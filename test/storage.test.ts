import { beforeEach, describe, expect, it, vi } from 'vitest';
import { clearState, loadState, saveState } from '../src/state/storage';
import { createDefaultState } from '../src/ui/state';

describe('saveState / loadState', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('sparar och läser tillbaka exakt samma tillstånd', () => {
    const state = createDefaultState();
    saveState(state);
    expect(loadState()).toEqual(state);
  });

  it('returnerar null när inget är sparat', () => {
    expect(loadState()).toBeNull();
  });

  it('returnerar null och kraschar inte för skräp i localStorage', () => {
    localStorage.setItem('matteuppgifter:state:v1', '{ det här är inte json');
    expect(loadState()).toBeNull();
  });

  it('returnerar null för JSON som saknar förväntad form (t.ex. äldre schema)', () => {
    localStorage.setItem('matteuppgifter:state:v1', JSON.stringify({ foo: 'bar' }));
    expect(loadState()).toBeNull();
  });

  it('clearState tar bort sparat tillstånd', () => {
    saveState(createDefaultState());
    clearState();
    expect(loadState()).toBeNull();
  });

  it('saveState kraschar inte om localStorage.setItem kastar (t.ex. full kvot)', () => {
    const spy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('QuotaExceededError');
    });
    expect(() => saveState(createDefaultState())).not.toThrow();
    spy.mockRestore();
  });
});
