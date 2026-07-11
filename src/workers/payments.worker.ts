import Papa from 'papaparse';
import { parseMoney as toNum, toStr } from '../utils/parseNumber';

const EXPECTED_COLUMNS = ['participantID', 'paymentID', 'totalPayment'];
let cancelled = false;

self.onmessage = async (e: MessageEvent) => {
    if (e.data?.type === 'CANCEL') { cancelled = true; return; }
    cancelled = false;
    const { files } = e.data;
    const allData: any[] = [];
    const errors: string[] = [];

    try {
        for (const file of files) {
            if (cancelled) { self.postMessage({ type: 'CANCELLED' }); return; }
            await new Promise<void>((resolve) => {
                let headerRowIndex = 0;

                const preReader = new FileReader();
                preReader.onload = (evt) => {
                    const text = evt.target?.result as string;
                    if (!text) { resolve(); return; }

                    const lines = text.split(/\r\n|\n|\r/);
                    const foundIndex = lines.findIndex(line => {
                        const normalized = line.replace(/['"]/g, '').toLowerCase();
                        return EXPECTED_COLUMNS.filter(col => normalized.includes(col.toLowerCase())).length >= 2;
                    });
                    if (foundIndex > -1) headerRowIndex = foundIndex;

                    Papa.parse(file, {
                        header: true,
                        skipEmptyLines: 'greedy',
                        encoding: 'UTF-8',
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
                                // participantID header has no quotes; accept both casing variants
                                const pid = row['participantID'] || row['participantId'] || '';
                                if (!pid) return;

                                const record = {
                                    participantId: toStr(pid),
                                    participantIdType: toStr(row['participantIDType'] || row['participantIdType']),
                                    participantName: toStr(row.participantName),
                                    programName: toStr(row.programName),
                                    earned: toNum(row.earned),
                                    earnedUSD: toNum(row.earnedUSD),
                                    withheldTax: toNum(row.withheldTax),
                                    salesTax: toNum(row.salesTax),
                                    serviceFeeTax: toNum(row.serviceFeeTax),
                                    totalPayment: toNum(row.totalPayment),
                                    earnedCurrencyCode: toStr(row.earnedCurrencyCode) || 'EUR',
                                    paymentCurrencyCode: toStr(row.paymentCurrencyCode) || 'EUR',
                                    paymentMethod: toStr(row.paymentMethod),
                                    paymentId: toStr(row.paymentID || row.paymentId),
                                    paymentStatus: toStr(row.paymentStatus),
                                    paymentStatusDescription: toStr(row.paymentStatusDescription),
                                    paymentDate: toStr(row.paymentDate),
                                    ...(row.ciReferenceNumber ? { ciReferenceNumber: toStr(row.ciReferenceNumber) } : {}),
                                };

                                allData.push(record);
                            });
                            resolve();
                        },
                        error: (err: any) => {
                            errors.push(`Error in file ${file.name}: ${err.message}`);
                            resolve();
                        }
                    });
                };

                preReader.onerror = () => {
                    errors.push(`Failed to read file ${file.name}`);
                    resolve();
                };

                preReader.readAsText(file.slice(0, 10240));
            });
        }

        if (cancelled) { self.postMessage({ type: 'CANCELLED' }); return; }
        self.postMessage({ type: 'SUCCESS', payload: { data: allData, errors } });
    } catch (err: any) {
        self.postMessage({ type: 'ERROR', payload: err.message });
    }
};
