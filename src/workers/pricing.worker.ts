import Papa from 'papaparse';
import type { PriceRow } from '../types/PricingData';

// Worker context
const ctx: Worker = self as any;

ctx.onmessage = async (e: MessageEvent) => {
    const { file } = e.data;

    if (!file) {
        ctx.postMessage({ error: 'No file provided' });
        return;
    }

    try {
        Papa.parse(file, {
            header: true,
            skipEmptyLines: true,
            complete: (results) => {
                const rows: PriceRow[] = [];
                // const errors: string[] = []; // Removed unused

                results.data.forEach((row: any) => { // Removed index
                    // Basic validation: ensure minimal fields
                    if (!row['ProductId'] || !row['SkuId']) {
                        return; // Skip empty or malformed
                    }

                    // Map fields
                    const newRow: PriceRow = {
                        ProductTitle: row['ProductTitle'] || 'Unknown Product',
                        ProductId: row['ProductId'],
                        SkuId: row['SkuId'],
                        SkuTitle: row['SkuTitle'] || '',
                        Publisher: row['Publisher'] || '',
                        SkuDescription: row['SkuDescription'] || '',
                        UnitOfMeasure: row['UnitOfMeasure'] || '',
                        TermDuration: row['TermDuration'] || '',
                        BillingPlan: row['BillingPlan'] || '',
                        Market: row['Market'] || '',
                        Currency: row['Currency'] || '',
                        UnitPrice: parseFloat(row['UnitPrice'] || '0'),
                        ERPPrice: parseFloat(row['ERP Price'] || '0'),
                        EffectiveStartDate: row['EffectiveStartDate'] || '',
                        Segment: row['Segment'] || '',
                        Tags: row['Tags'] || ''
                    };

                    rows.push(newRow);
                });

                ctx.postMessage({
                    data: rows,
                    meta: {
                        totalRows: rows.length,
                        lastUpdated: new Date().toISOString()
                    }
                });
            },
            error: (err) => {
                ctx.postMessage({ error: err.message });
            }
        });
    } catch (err: any) {
        ctx.postMessage({ error: err.message });
    }
};

export { };
