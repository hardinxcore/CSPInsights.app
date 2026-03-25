import Papa from 'papaparse';
import { BillingRecordSchema } from '../types/schemas';

const EXPECTED_COLUMNS = ['PartnerId', 'CustomerId', 'ProductId', 'SkuId'];

const normalizeHeader = (header: string): string => {
    return header.replace(/\s+/g, '');
};

self.onmessage = async (e: MessageEvent) => {
    const { files } = e.data;
    const allData: any[] = [];
    const errors: string[] = [];

    try {
        for (const file of files) {
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
                            results.data.forEach((row: any) => {
                                // Basic mapping before validation
                                // Note: Zod schema has defaults and preprocessors to handle string->number
                                const mapped = {
                                    ...row,
                                    CustomerName: row.CustomerName || row.CustomerDomainName,
                                    Quantity: row.Quantity || row.BillableQuantity,
                                    SourceFile: file.name,
                                    IsUnbilled: !row.InvoiceNumber && (file.name.toLowerCase().includes('unbilled') || !!row.ChargeType),
                                    BillableDays: (() => {
                                        if (row.ChargeStartDate && row.ChargeEndDate) {
                                            const start = new Date(row.ChargeStartDate);
                                            const end = new Date(row.ChargeEndDate);
                                            // Calculate check if valid dates
                                            if (!isNaN(start.getTime()) && !isNaN(end.getTime())) {
                                                const diffTime = Math.abs(end.getTime() - start.getTime());
                                                const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1; // +1 to include both start and end date
                                                return diffDays;
                                            }
                                        }
                                        return 0;
                                    })()
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

                // Read first 10KB for header detection
                preReader.readAsText(file.slice(0, 10240));
            });
        }

        // Post back results
        self.postMessage({ type: 'SUCCESS', payload: { data: allData, errors } });

    } catch (err: any) {
        self.postMessage({ type: 'ERROR', payload: err.message });
    }
};
