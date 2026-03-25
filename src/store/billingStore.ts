import { create } from 'zustand';
import type { BillingRecord } from '../types/BillingData';
import { loadBillingData, saveBillingData, clearBillingData, loadCustomerMetadata, saveCustomerMetadata } from '../utils/db';

interface BillingState {
    data: BillingRecord[];
    meta: {
        totalRows: number;
        customersCount: number;
        totalAmount: number;
    };
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

export const useBillingStore = create<BillingState>((set) => ({
    data: [],
    meta: { totalRows: 0, customersCount: 0, totalAmount: 0 },
    marginRules: {},
    customerTags: {},
    globalMargin: 20,
    isLoading: false,
    error: null,

    setData: (data: BillingRecord[]) => {
        const totalAmount = data.reduce((sum, r) => sum + (r.Total || r.Subtotal || 0), 0);
        const customersCount = new Set(data.map(r => r.CustomerName)).size;
        const meta = { totalRows: data.length, customersCount, totalAmount };

        saveBillingData(data, meta).catch(console.error);
        set({ data, meta, error: null });
    },

    appendData: (newData: BillingRecord[]) => {
        set((state) => {
            const combinedData = [...state.data, ...newData];
            const totalAmount = combinedData.reduce((sum, r) => sum + (r.Total || r.Subtotal || 0), 0);
            const customersCount = new Set(combinedData.map(r => r.CustomerName)).size;
            const meta = { totalRows: combinedData.length, customersCount, totalAmount };

            saveBillingData(combinedData, meta).catch(console.error);
            return { data: combinedData, meta, error: null };
        });
    },

    setGlobalMargin: (margin: number) => set({ globalMargin: margin }),

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
                set({ data: saved.data, meta: saved.meta });
            }

            // Load persistent settings (margins & tags)
            const metadata = await loadCustomerMetadata();
            if (metadata) {
                set({
                    marginRules: metadata.margins || {},
                    customerTags: metadata.tags || {}
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
        set({ data: [], meta: { totalRows: 0, customersCount: 0, totalAmount: 0 }, error: null, searchQuery: '' });
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
