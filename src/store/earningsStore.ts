import { create } from 'zustand';
import type { EarningRecord, EarningsMeta, PaymentRecord, PaymentsMeta } from '../types/EarningsData';
import {
    saveEarningsData, loadEarningsData, clearEarningsData,
    savePaymentsData, loadPaymentsData, clearPaymentsData,
} from '../utils/earningsDb';

const DEFAULT_EARNINGS_META: EarningsMeta = {
    totalRows: 0, customersCount: 0, totalEarningAmount: 0, currency: 'EUR',
};

const DEFAULT_PAYMENTS_META: PaymentsMeta = {
    totalRows: 0, totalEarned: 0, totalPaid: 0, totalTax: 0, currency: 'EUR',
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

    appendData: (newData, _newMeta) => {
        set((state) => {
            const combined = [...state.data, ...newData];
            const currency = combined[0]?.transactionCurrency || 'EUR';
            const totalEarningAmount = combined.reduce((sum, r) => sum + (r.earningAmount || 0), 0);
            const customersCount = new Set(combined.map(r => r.customerName).filter(Boolean)).size;
            const meta: EarningsMeta = { totalRows: combined.length, customersCount, totalEarningAmount, currency };
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

    appendPayments: (newData, _newMeta) => {
        set((state) => {
            const combined = [...state.payments, ...newData];
            const currency = combined[0]?.earnedCurrencyCode || 'EUR';
            const totalEarned = combined.reduce((s, r) => s + r.earned, 0);
            const totalPaid = combined.reduce((s, r) => s + r.totalPayment, 0);
            const totalTax = combined.reduce((s, r) => s + r.salesTax + r.withheldTax, 0);
            const meta: PaymentsMeta = { totalRows: combined.length, totalEarned, totalPaid, totalTax, currency };
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
