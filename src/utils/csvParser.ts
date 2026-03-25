import type { ParseResult } from '../types/BillingData';
// Import worker constructor directly
import CsvWorker from '../workers/csv.worker?worker';

export const parseBillingCSVs = async (files: File[]): Promise<ParseResult> => {
    return new Promise((resolve, reject) => {
        const worker = new CsvWorker();

        worker.onmessage = (e) => {
            const { type, payload } = e.data;

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
            } else {
                reject(new Error(payload)); // Error message
            }
            worker.terminate();
        };

        worker.onerror = (err) => {
            reject(err);
            worker.terminate();
        };

        worker.postMessage({ files });
    });
};
