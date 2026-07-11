import { describe, it, expect } from 'vitest';
import { calculateSellPrice, getAppliedMargin } from './pricing';
import type { BillingRecord } from '../types/BillingData';

const record = (overrides: Partial<BillingRecord>): BillingRecord => ({
    CustomerName: 'Contoso',
    ...overrides,
} as BillingRecord);

describe('calculateSellPrice', () => {
    it('applies the global margin when no customer rule exists', () => {
        const row = record({ Total: 100 });
        expect(calculateSellPrice(row, 20, {})).toBeCloseTo(120);
    });

    it('prefers a customer-specific margin rule over the global margin', () => {
        const row = record({ Total: 100 });
        expect(calculateSellPrice(row, 20, { Contoso: 35 })).toBeCloseTo(135);
    });

    it('honours an explicit 0% customer rule', () => {
        const row = record({ Total: 100 });
        expect(calculateSellPrice(row, 20, { Contoso: 0 })).toBeCloseTo(100);
    });

    it('falls back to Subtotal when Total is missing', () => {
        const row = record({ Subtotal: 50 });
        expect(calculateSellPrice(row, 10, {})).toBeCloseTo(55);
    });

    it('returns 0 for rows without any amount', () => {
        const row = record({});
        expect(calculateSellPrice(row, 20, {})).toBe(0);
    });
});

describe('getAppliedMargin', () => {
    it('returns the customer rule when present, otherwise the global margin', () => {
        const row = record({});
        expect(getAppliedMargin(row, 20, { Contoso: 12 })).toBe(12);
        expect(getAppliedMargin(row, 20, {})).toBe(20);
        expect(getAppliedMargin(row, 20, { Contoso: 0 })).toBe(0);
    });
});
