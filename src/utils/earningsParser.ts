import EarningsWorker from '../workers/earnings.worker?worker';
import type { EarningRecord, EarningsParseResult } from '../types/EarningsData';
import { currencyLabel, currencyTotals } from './aggregation';
import { validateImportFiles } from './fileValidation';

let activeWorker: Worker | null = null;
export const cancelEarningsParse = (): void => { activeWorker?.postMessage({ type: 'CANCEL' }); };

export const parseEarningsCSVs = (files: File[]): Promise<EarningsParseResult> => {
    validateImportFiles(files);
    return new Promise((resolve, reject) => {
        const worker = new EarningsWorker();
        activeWorker = worker;

        worker.onmessage = (e: MessageEvent) => {
            const { type, payload } = e.data;
            worker.terminate();

            if (type === 'SUCCESS') {
                const data: EarningRecord[] = payload.data;
                const totalEarningAmount = data.reduce((sum, r) => sum + (r.earningAmount || 0), 0);
                const customersCount = new Set(data.map(r => r.customerName).filter(Boolean)).size;
                const totalsByCurrency = currencyTotals(data, row => row.transactionCurrency, row => row.earningAmount);

                resolve({
                    data,
                    errors: payload.errors || [],
                    meta: {
                        totalRows: data.length,
                        customersCount,
                        totalEarningAmount,
                        currency: currencyLabel(totalsByCurrency),
                        totalsByCurrency,
                    }
                });
            } else if (type === 'CANCELLED') {
                reject(new Error('Import cancelled.'));
            } else {
                reject(new Error(payload));
            }
            activeWorker = null;
        };

        worker.onerror = (err) => {
            worker.terminate();
            activeWorker = null;
            reject(err);
        };

        worker.postMessage({ files });
    });
};
