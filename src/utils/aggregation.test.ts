import { describe, expect, it } from 'vitest';
import { currencyLabel, currencyTotals, uniqueByKey } from './aggregation';

describe('aggregation helpers', () => {
  it('keeps totals separated by currency', () => {
    const rows = [{ currency: 'EUR', amount: 10 }, { currency: 'USD', amount: 5 }, { currency: 'EUR', amount: 2 }];
    const totals = currencyTotals(rows, row => row.currency, row => row.amount);
    expect(totals).toEqual({ EUR: 12, USD: 5 });
    expect(currencyLabel(totals)).toBe('MIXED');
  });

  it('removes duplicate rows while preserving order', () => {
    expect(uniqueByKey([{ id: 'a' }, { id: 'a' }, { id: 'b' }], row => row.id)).toEqual([{ id: 'a' }, { id: 'b' }]);
  });
});
