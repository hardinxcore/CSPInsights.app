import type { ParseResult } from '../types/BillingData';
// Import worker constructor directly
import CsvWorker from '../workers/csv.worker?worker';
import { validateImportFiles } from './fileValidation';

let activeWorker: Worker | null = null;

export const cancelBillingParse = (): void => {
    activeWorker?.postMessage({ type: 'CANCEL' });
};

export const parseBillingCSVs = async (files: File[], onProgress?: (progress: number) => void): Promise<ParseResult> => {
    validateImportFiles(files);
    return new Promise((resolve, reject) => {
        const worker = new CsvWorker();
        activeWorker = worker;

        worker.onmessage = (e) => {
            const { type, payload } = e.data;

            if (type === 'PROGRESS') {
                onProgress?.(payload.progress);
                return;
            }

            if (type === 'SUCCESS') {
                const { data, errors } = payload;
                const totalAmount = data.reduce((sum: number, r: any) => sum + (r.Total || r.Subtotal || 0), 0);
                const customers = new Set(data.map((r: any) => r.CustomerName)).size;

                resolve({
                    data,
                    errors,
                    meta: {
                        totalRows: data.length,
                        customersCount: customers,
                        totalAmount
                    }
                });
            } else if (type === 'CANCELLED') {
                reject(new Error('Import cancelled.'));
            } else {
                reject(new Error(payload)); // Error message
            }
            worker.terminate();
            activeWorker = null;
        };

        worker.onerror = (err) => {
            reject(err);
            worker.terminate();
            activeWorker = null;
        };

        worker.postMessage({ files });
    });
};
