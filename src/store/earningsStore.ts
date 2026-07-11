import { create } from 'zustand';
import type { EarningRecord, EarningsMeta, PaymentRecord, PaymentsMeta } from '../types/EarningsData';
import {
    saveEarningsData, loadEarningsData, clearEarningsData,
    savePaymentsData, loadPaymentsData, clearPaymentsData,
} from '../utils/earningsDb';
import { currencyLabel, currencyTotals, uniqueByKey } from '../utils/aggregation';

const DEFAULT_EARNINGS_META: EarningsMeta = {
    totalRows: 0, customersCount: 0, totalEarningAmount: 0, currency: 'EUR', totalsByCurrency: {},
};

const DEFAULT_PAYMENTS_META: PaymentsMeta = {
    totalRows: 0, totalEarned: 0, totalPaid: 0, totalTax: 0, currency: 'EUR', totalsByCurrency: {},
};

interface EarningsState {
    // Earnings
    data: EarningRecord[];
    meta: EarningsMeta;

    // Payments
    payments: PaymentRecord[];
    paymentsMeta: PaymentsMeta;

    isLoading: boolean;
    error: string | null;

    // Earnings actions
    setData: (data: EarningRecord[], meta: EarningsMeta) => void;
    appendData: (data: EarningRecord[], meta: EarningsMeta) => void;
    reset: () => Promise<void>;

    // Payments actions
    setPayments: (data: PaymentRecord[], meta: PaymentsMeta) => void;
    appendPayments: (data: PaymentRecord[], meta: PaymentsMeta) => void;
    resetPayments: () => Promise<void>;

    loadFromDisk: () => Promise<void>;
}

export const useEarningsStore = create<EarningsState>((set) => ({
    data: [],
    meta: DEFAULT_EARNINGS_META,
    payments: [],
    paymentsMeta: DEFAULT_PAYMENTS_META,
    isLoading: false,
    error: null,

    setData: (data, meta) => {
        saveEarningsData(data, meta).catch(console.error);
        set({ data, meta, error: null });
    },

    appendData: (newData) => {
        set((state) => {
            const combined = uniqueByKey([...state.data, ...newData], row => row.earningId || [row.transactionId, row.customerId, row.productId, row.earningDate, row.earningAmount].join('|'));
            const totalEarningAmount = combined.reduce((sum, r) => sum + (r.earningAmount || 0), 0);
            const customersCount = new Set(combined.map(r => r.customerName).filter(Boolean)).size;
            const totalsByCurrency = currencyTotals(combined, row => row.transactionCurrency, row => row.earningAmount);
            const meta: EarningsMeta = { totalRows: combined.length, customersCount, totalEarningAmount, currency: currencyLabel(totalsByCurrency), totalsByCurrency };
            saveEarningsData(combined, meta).catch(console.error);
            return { data: combined, meta };
        });
    },

    reset: async () => {
        await clearEarningsData();
        set({ data: [], meta: DEFAULT_EARNINGS_META, error: null });
    },

    setPayments: (data, meta) => {
        savePaymentsData(data, meta).catch(console.error);
        set({ payments: data, paymentsMeta: meta, error: null });
    },

    appendPayments: (newData) => {
        set((state) => {
            const combined = uniqueByKey([...state.payments, ...newData], row => row.paymentId || [row.paymentDate, row.programName, row.earned, row.totalPayment].join('|'));
            const totalEarned = combined.reduce((s, r) => s + r.earned, 0);
            const totalPaid = combined.reduce((s, r) => s + r.totalPayment, 0);
            const totalTax = combined.reduce((s, r) => s + r.salesTax + r.withheldTax + r.serviceFeeTax, 0);
            const totalsByCurrency = combined.reduce<Record<string, { earned: number; paid: number; tax: number }>>((totals, row) => {
                const currency = row.earnedCurrencyCode || 'UNKNOWN';
                const current = totals[currency] || { earned: 0, paid: 0, tax: 0 };
                totals[currency] = { earned: current.earned + row.earned, paid: current.paid + row.totalPayment, tax: current.tax + row.salesTax + row.withheldTax + row.serviceFeeTax };
                return totals;
            }, {});
            const meta: PaymentsMeta = { totalRows: combined.length, totalEarned, totalPaid, totalTax, currency: currencyLabel(Object.fromEntries(Object.keys(totalsByCurrency).map(key => [key, 0]))), totalsByCurrency };
            savePaymentsData(combined, meta).catch(console.error);
            return { payments: combined, paymentsMeta: meta };
        });
    },

    resetPayments: async () => {
        await clearPaymentsData();
        set({ payments: [], paymentsMeta: DEFAULT_PAYMENTS_META });
    },

    loadFromDisk: async () => {
        set({ isLoading: true });
        try {
            const [savedEarnings, savedPayments] = await Promise.all([
                loadEarningsData(),
                loadPaymentsData(),
            ]);
            if (savedEarnings?.data) set({ data: savedEarnings.data, meta: savedEarnings.meta });
            if (savedPayments?.data) set({ payments: savedPayments.data, paymentsMeta: savedPayments.meta });
        } catch (err: any) {
            console.error('Failed to load from DB', err);
            set({ error: 'Failed to restore previous session.' });
        } finally {
            set({ isLoading: false });
        }
    },
}));
