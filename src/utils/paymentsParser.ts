import PaymentsWorker from '../workers/payments.worker?worker';
import type { PaymentRecord, PaymentsParseResult } from '../types/EarningsData';
import { currencyLabel } from './aggregation';
import { validateImportFiles } from './fileValidation';

let activeWorker: Worker | null = null;
export const cancelPaymentsParse = (): void => { activeWorker?.postMessage({ type: 'CANCEL' }); };

export const parsePaymentsCSV = (files: File[]): Promise<PaymentsParseResult> => {
    validateImportFiles(files);
    return new Promise((resolve, reject) => {
        const worker = new PaymentsWorker();
        activeWorker = worker;

        worker.onmessage = (e: MessageEvent) => {
            const { type, payload } = e.data;
            worker.terminate();

            if (type === 'SUCCESS') {
                const data: PaymentRecord[] = payload.data;
                const totalEarned = data.reduce((s, r) => s + r.earned, 0);
                const totalPaid = data.reduce((s, r) => s + r.totalPayment, 0);
                const totalTax = data.reduce((s, r) => s + r.salesTax + r.withheldTax + r.serviceFeeTax, 0);
                const totalsByCurrency = data.reduce<Record<string, { earned: number; paid: number; tax: number }>>((totals, row) => {
                    const currency = row.earnedCurrencyCode || 'UNKNOWN';
                    const current = totals[currency] || { earned: 0, paid: 0, tax: 0 };
                    totals[currency] = { earned: current.earned + row.earned, paid: current.paid + row.totalPayment, tax: current.tax + row.salesTax + row.withheldTax + row.serviceFeeTax };
                    return totals;
                }, {});

                resolve({
                    data,
                    errors: payload.errors || [],
                    meta: { totalRows: data.length, totalEarned, totalPaid, totalTax, currency: currencyLabel(Object.fromEntries(Object.keys(totalsByCurrency).map(key => [key, 0]))), totalsByCurrency }
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
