import PaymentsWorker from '../workers/payments.worker?worker';
import type { PaymentRecord, PaymentsParseResult } from '../types/EarningsData';

export const parsePaymentsCSV = (files: File[]): Promise<PaymentsParseResult> => {
    return new Promise((resolve, reject) => {
        const worker = new PaymentsWorker();

        worker.onmessage = (e: MessageEvent) => {
            const { type, payload } = e.data;
            worker.terminate();

            if (type === 'SUCCESS') {
                const data: PaymentRecord[] = payload.data;
                const currency = data[0]?.earnedCurrencyCode || 'EUR';
                const totalEarned = data.reduce((s, r) => s + r.earned, 0);
                const totalPaid = data.reduce((s, r) => s + r.totalPayment, 0);
                const totalTax = data.reduce((s, r) => s + r.salesTax + r.withheldTax, 0);

                resolve({
                    data,
                    errors: payload.errors || [],
                    meta: { totalRows: data.length, totalEarned, totalPaid, totalTax, currency }
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
