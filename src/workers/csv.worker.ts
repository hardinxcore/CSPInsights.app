import Papa from 'papaparse';
import { BillingRecordSchema } from '../types/schemas';
import { billableDaysBetween } from '../utils/parseDate';

const EXPECTED_COLUMNS = ['PartnerId', 'CustomerId', 'ProductId', 'SkuId'];
let cancelled = false;

const normalizeHeader = (header: string): string => {
    return header.replace(/\s+/g, '');
};

self.onmessage = async (e: MessageEvent) => {
    if (e.data?.type === 'CANCEL') {
        cancelled = true;
        return;
    }
    cancelled = false;
    const { files } = e.data;
    const allData: any[] = [];
    const errors: string[] = [];

    try {
        for (const file of files) {
            if (cancelled) {
                self.postMessage({ type: 'CANCELLED' });
                return;
            }
            await new Promise<void>((resolve) => {
                let headerRowIndex = 0;

                // Pre-read to find header
                const preReader = new FileReader();
                preReader.onload = (evt) => {
                    const text = evt.target?.result as string;
                    if (!text) {
                        resolve();
                        return;
                    }
                    const lines = text.split(/\r\n|\n|\r/);
                    const foundIndex = lines.findIndex(line => {
                        const normalizedLine = line.replace(/['"]/g, '');
                        return EXPECTED_COLUMNS.filter(col => normalizedLine.includes(col)).length >= 2;
                    });
                    if (foundIndex > -1) headerRowIndex = foundIndex;

                    // Now Parse
                    Papa.parse(file, {
                        header: true,
                        skipEmptyLines: 'greedy',
                        encoding: 'UTF-8',
                        transformHeader: (header) => normalizeHeader(header),
                        beforeFirstChunk: (chunk) => {
                            const rows = chunk.split(/\r\n|\n|\r/);
                            if (headerRowIndex > 0 && rows.length > headerRowIndex) {
                                return rows.slice(headerRowIndex).join('\n');
                            }
                            return chunk;
                        },
                        complete: (results) => {
                            if (cancelled) { resolve(); return; }
                            results.data.forEach((row: any) => {
                                // Basic mapping before validation
                                // Note: Zod schema has defaults and preprocessors to handle string->number
                                const mapped = {
                                    ...row,
                                    CustomerName: row.CustomerName || row.CustomerDomainName,
                                    Quantity: row.Quantity || row.BillableQuantity,
                                    SourceFile: file.name,
                                    IsUnbilled: !row.InvoiceNumber && (file.name.toLowerCase().includes('unbilled') || !!row.ChargeType),
                                    BillableDays: billableDaysBetween(row.ChargeStartDate, row.ChargeEndDate)
                                };

                                // Validate with Zod
                                const result = BillingRecordSchema.safeParse(mapped);
                                if (result.success) {
                                    // Only keep valid rows that have at least a PartnerId (sanity check)
                                    if (result.data.PartnerId) {
                                        allData.push(result.data);
                                    }
                                } else {
                                    // Optionally log specific validation errors
                                    if (errors.length < 5) {
                                        errors.push(`Row validation failed (Row ${allData.length // Relative to success count, kinda
                                            + 2}): ${result.error.issues.map(i => `${i.path.join('.')}: ${i.message}`).join(', ')}`);
                                    }
                                }
                            });
                            resolve();
                        },
                        error: (err) => {
                            errors.push(`Error in file ${file.name}: ${err.message}`);
                            resolve(); // Continue to next file even if one fails
                        }
                    });
                };

                preReader.onerror = () => {
                    errors.push(`Failed to read file ${file.name}`);
                    resolve();
                };

                // Read first 10KB for header detection
                preReader.readAsText(file.slice(0, 10240));
            });
            self.postMessage({ type: 'PROGRESS', payload: { progress: Math.round(((files.indexOf(file) + 1) / files.length) * 100) } });
        }

        // Post back results
        if (cancelled) {
            self.postMessage({ type: 'CANCELLED' });
            return;
        }
        self.postMessage({ type: 'SUCCESS', payload: { data: allData, errors } });

    } catch (err: any) {
        self.postMessage({ type: 'ERROR', payload: err.message });
    }
};
