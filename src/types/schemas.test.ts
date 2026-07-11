import { describe, it, expect } from 'vitest';
import { BillingRecordSchema } from './schemas';

describe('BillingRecordSchema', () => {
    it('coerces string amounts in both US and EU notation', () => {
        const result = BillingRecordSchema.parse({
            PartnerId: 'p1',
            CustomerName: 'Contoso',
            Total: '1.234,56',
            Subtotal: '1,234.56',
            TaxTotal: '(12,50)',
            Quantity: '3',
        });
        expect(result.Total).toBe(1234.56);
        expect(result.Subtotal).toBe(1234.56);
        expect(result.TaxTotal).toBe(-12.5);
        expect(result.Quantity).toBe(3);
    });

    it('defaults missing numeric fields to 0', () => {
        const result = BillingRecordSchema.parse({ PartnerId: 'p1', CustomerName: 'Contoso' });
        expect(result.Total).toBe(0);
        expect(result.EffectiveUnitPrice).toBe(0);
    });
});
