import { describe, expect, it } from 'vitest';
import { parsePriceListFileName } from './priceListCatalog';

describe('price list filename parsing', () => {
    it('extracts month and year from the AX archive naming convention', () => {
        expect(parsePriceListFileName('AX-July-2026-Newcommerce-Cloud-Reseller-Pricelist.zip')).toMatchObject({
            id: '2026-07',
            month: 7,
            year: 2026,
            label: 'July 2026',
        });
    });

    it('rejects archives with an unsupported filename', () => {
        expect(parsePriceListFileName('July-2026.zip')).toBeNull();
    });

    it('accepts the NL reseller price list prefix', () => {
        expect(parsePriceListFileName('NL-July-2026-Newcommerce-Cloud-Reseller-Pricelist.zip')).toMatchObject({
            id: '2026-07',
            label: 'July 2026',
        });
    });
});
