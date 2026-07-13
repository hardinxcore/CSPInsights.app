import Papa from 'papaparse';
import { strFromU8, unzipSync } from 'fflate';
import { PriceRowSchema } from '../types/schemas';
import type { PriceRow } from '../types/PricingData';

// Worker context
const ctx: Worker = self as any;

ctx.onmessage = async (e: MessageEvent) => {
    const { file, archive } = e.data;

    if (!file) {
        ctx.postMessage({ error: 'No file provided' });
        return;
    }

    try {
        let input: File | string = file;
        if (archive) {
            const entries = unzipSync(new Uint8Array(await file.arrayBuffer()));
            const csvEntries = Object.entries(entries).filter(([name]) => name.toLowerCase().endsWith('.csv'));
            if (csvEntries.length !== 1) {
                throw new Error(csvEntries.length === 0
                    ? 'De ZIP bevat geen CSV-bestand.'
                    : 'De ZIP bevat meerdere CSV-bestanden; er mag precies één CSV in staan.');
            }
            input = strFromU8(csvEntries[0][1]);
        }

        Papa.parse(input, {
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
