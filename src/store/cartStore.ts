import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface SavedQuote {
    id: string;
    name: string;
    date: string;
    quantities: Record<string, number>;
    customerReference: string;
    itemCount: number;
    totalAmount: number; // approximate total at save time for display
}

interface CartState {
    quantities: Record<string, number>;
    customerReference: string;
    savedQuotes: SavedQuote[];

    updateQuantity: (id: string, qty: number) => void;
    clearCart: () => void;
    setCustomerReference: (ref: string) => void;

    saveQuote: (name: string, total: number) => void;
    loadQuote: (id: string) => void;
    deleteQuote: (id: string) => void;
}

export const useCartStore = create<CartState>()(
    persist(
        (set, get) => ({
            quantities: {},
            customerReference: '',
            savedQuotes: [],

            updateQuantity: (id, qty) => set((state) => {
                const newQuantities = { ...state.quantities };
                if (qty > 0) {
                    newQuantities[id] = qty;
                } else {
                    delete newQuantities[id];
                }
                return { quantities: newQuantities };
            }),

            clearCart: () => set({ quantities: {}, customerReference: '' }),

            setCustomerReference: (ref) => set({ customerReference: ref }),

            saveQuote: (name, total) => {
                const state = get();
                const newQuote: SavedQuote = {
                    id: crypto.randomUUID(),
                    name,
                    date: new Date().toISOString(),
                    quantities: { ...state.quantities },
                    customerReference: state.customerReference,
                    itemCount: Object.keys(state.quantities).length,
                    totalAmount: total
                };
                set(state => ({ savedQuotes: [newQuote, ...state.savedQuotes] }));
            },

            loadQuote: (id) => {
                const quote = get().savedQuotes.find(q => q.id === id);
                if (quote) {
                    set({
                        quantities: { ...quote.quantities },
                        customerReference: quote.customerReference
                    });
                }
            },

            deleteQuote: (id) => set(state => ({
                savedQuotes: state.savedQuotes.filter(q => q.id !== id)
            })),
        }),
        {
            name: 'partner-center-cart', // unique name for localStorage key
        }
    )
);
