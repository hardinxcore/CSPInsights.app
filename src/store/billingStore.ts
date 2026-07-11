import { create } from 'zustand';
import type { BillingMeta, BillingRecord } from '../types/BillingData';
import { loadBillingData, saveBillingData, clearBillingData, loadCustomerMetadata, saveCustomerMetadata } from '../utils/db';
import { useSettingsStore } from './settingsStore';
import { currencyLabel, currencyTotals, uniqueByKey } from '../utils/aggregation';

interface BillingState {
    data: BillingRecord[];
    meta: BillingMeta;
    marginRules: Record<string, number>; // CustomerName -> Margin %
    customerTags: Record<string, string[]>; // CustomerName -> Tags[]
    globalMargin: number;
    isLoading: boolean;
    error: string | null;

    searchQuery: string;
    setSearchQuery: (query: string) => void;

    // Actions
    setData: (data: BillingRecord[]) => void;
    appendData: (data: BillingRecord[]) => void;
    setGlobalMargin: (margin: number) => void;
    setCustomerMargin: (customerName: string, margin: number) => void;
    loadFromDisk: () => Promise<void>;
    reset: () => Promise<void>;

    addTag: (customerName: string, tag: string) => void;
    removeTag: (customerName: string, tag: string) => void;
}

const persistErrorMessage = (err: unknown): string => {
    if (err instanceof DOMException && err.name === 'QuotaExceededError') {
        return 'Browser storage is full: your data could NOT be saved and will be lost on reload. Export a backup or clear old data.';
    }
    return 'Failed to save data to local storage. Changes may be lost on reload.';
};

export const useBillingStore = create<BillingState>((set) => ({
    data: [],
    meta: { totalRows: 0, customersCount: 0, totalAmount: 0, currency: 'UNKNOWN', totalsByCurrency: {} },
    marginRules: {},
    customerTags: {},
    globalMargin: 20,
    isLoading: false,
    error: null,

    setData: (data: BillingRecord[]) => {
        const dedupedData = uniqueByKey(data, billingRecordKey);
        const totalAmount = dedupedData.reduce((sum, r) => sum + (r.Total || r.Subtotal || 0), 0);
        const customersCount = new Set(dedupedData.map(r => r.CustomerName)).size;
        const totalsByCurrency = currencyTotals(dedupedData, row => row.Currency || row.PricingCurrency, row => row.Total || row.Subtotal || 0);
        const meta = { totalRows: dedupedData.length, customersCount, totalAmount, currency: currencyLabel(totalsByCurrency), totalsByCurrency };

        saveBillingData(data, meta).catch((err) => {
            console.error('Failed to persist billing data', err);
            set({ error: persistErrorMessage(err) });
        });
        // Apply the configured default margin when loading a fresh dataset
        set({ data: dedupedData, meta, globalMargin: useSettingsStore.getState().defaultMargin, error: null });
    },

    appendData: (newData: BillingRecord[]) => {
        set((state) => {
            const combinedData = [...state.data, ...newData];
            const dedupedData = uniqueByKey(combinedData, billingRecordKey);
            const dedupedTotal = dedupedData.reduce((sum, r) => sum + (r.Total || r.Subtotal || 0), 0);
            const totalsByCurrency = currencyTotals(dedupedData, row => row.Currency || row.PricingCurrency, row => row.Total || row.Subtotal || 0);
            const meta = { totalRows: dedupedData.length, customersCount: new Set(dedupedData.map(r => r.CustomerName)).size, totalAmount: dedupedTotal, currency: currencyLabel(totalsByCurrency), totalsByCurrency };

            saveBillingData(dedupedData, meta).catch((err) => {
                console.error('Failed to persist billing data', err);
                set({ error: persistErrorMessage(err) });
            });
            return { data: dedupedData, meta, error: null };
        });
    },

    setGlobalMargin: (margin: number) => {
        set({ globalMargin: margin });
        const state = useBillingStore.getState();
        saveCustomerMetadata({ margins: state.marginRules, tags: state.customerTags, globalMargin: margin }).catch(console.error);
    },

    setCustomerMargin: (customerName: string, margin: number) => {
        set((state) => {
            const newMargins = { ...state.marginRules, [customerName]: margin };
            saveCustomerMetadata({ margins: newMargins, tags: state.customerTags }).catch(console.error);
            return { marginRules: newMargins };
        });
    },

    loadFromDisk: async () => {
        set({ isLoading: true });
        try {
            const saved = await loadBillingData();
            if (saved && saved.data) {
                set({ data: saved.data, meta: saved.meta, globalMargin: useSettingsStore.getState().defaultMargin });
            }

            // Load persistent settings (margins & tags)
            const metadata = await loadCustomerMetadata();
            if (metadata) {
                set({
                    marginRules: metadata.margins || {},
                    customerTags: metadata.tags || {},
                    globalMargin: typeof metadata.globalMargin === 'number' ? metadata.globalMargin : useSettingsStore.getState().defaultMargin
                });
            }
        } catch (err: any) {
            console.error('Failed to load from DB', err);
            set({ error: 'Failed to restore previous session.' });
        } finally {
            set({ isLoading: false });
        }
    },

    searchQuery: '',
    setSearchQuery: (query: string) => set({ searchQuery: query }),

    reset: async () => {
        await clearBillingData();
        // NOTE: We do NOT clear customerMetadata (tags/margins) on reset, as requested.
        set({ data: [], meta: { totalRows: 0, customersCount: 0, totalAmount: 0, currency: 'UNKNOWN', totalsByCurrency: {} }, error: null, searchQuery: '' });
    },

    addTag: (customerName: string, tag: string) => {
        set((state) => {
            const currentTags = state.customerTags[customerName] || [];
            if (currentTags.includes(tag)) return state;

            const newTags = { ...state.customerTags, [customerName]: [...currentTags, tag] };
            saveCustomerMetadata({ margins: state.marginRules, tags: newTags }).catch(console.error);
            return { customerTags: newTags };
        });
    },

    removeTag: (customerName: string, tag: string) => {
        set((state) => {
            const currentTags = state.customerTags[customerName] || [];
            const newTags = { ...state.customerTags, [customerName]: currentTags.filter(t => t !== tag) };
            saveCustomerMetadata({ margins: state.marginRules, tags: newTags }).catch(console.error);
            return { customerTags: newTags };
        });
    }
}));

const billingRecordKey = (row: BillingRecord): string => [
    row.InvoiceNumber, row.OrderId, row.SubscriptionId, row.ProductId, row.SkuId,
    row.ChargeStartDate, row.ChargeEndDate, row.Total, row.Currency, row.SourceFile,
].map(value => value ?? '').join('|');
