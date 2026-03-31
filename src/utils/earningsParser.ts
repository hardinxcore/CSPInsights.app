import EarningsWorker from '../workers/earnings.worker?worker';
import type { EarningRecord, EarningsParseResult } from '../types/EarningsData';

export const parseEarningsCSVs = (files: File[]): Promise<EarningsParseResult> => {
    return new Promise((resolve, reject) => {
        const worker = new EarningsWorker();

        worker.onmessage = (e: MessageEvent) => {
            const { type, payload } = e.data;
            worker.terminate();

            if (type === 'SUCCESS') {
                const data: EarningRecord[] = payload.data;
                const currency = data[0]?.transactionCurrency || 'EUR';
                const totalEarningAmount = data.reduce((sum, r) => sum + (r.earningAmount || 0), 0);
                const customersCount = new Set(data.map(r => r.customerName).filter(Boolean)).size;

                resolve({
                    data,
                    errors: payload.errors || [],
                    meta: {
                        totalRows: data.length,
                        customersCount,
                        totalEarningAmount,
                        currency,
                    }
                });
            } else {
                reject(new Error(payload));
            }
        };

        worker.onerror = (err) => {
            worker.terminate();
            reject(err);
        };

        worker.postMessage({ files });
    });
};
