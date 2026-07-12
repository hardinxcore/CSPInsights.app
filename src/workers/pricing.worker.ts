import Papa from 'papaparse';
import { PriceRowSchema } from '../types/schemas';
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

                results.data.forEach((row: any) => {
                    // Require the identifying fields; skip empty/malformed rows
                    if (!row['ProductId'] || !row['SkuId']) {
                        return;
                    }

                    // Validate + coerce via Zod (handles number parsing and defaults)
                    const parsed = PriceRowSchema.safeParse({
                        ...row,
                        ERPPrice: row['ERP Price'],
                    });
                    if (parsed.success) {
                        rows.push(parsed.data);
                    }
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
