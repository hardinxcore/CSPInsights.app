import { create } from 'zustand';
import { openDB } from 'idb';
import type { PricingState } from '../types/PricingData';
import PricingWorker from '../workers/pricing.worker?worker';

const DB_NAME = 'PartnerCenterPricingDB';
const STORE_NAME = 'pricing';
const DB_VERSION = 4;

const getDB = async () => {
    return openDB(DB_NAME, DB_VERSION, {
        upgrade(db) {
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                db.createObjectStore(STORE_NAME);
            }
            if (!db.objectStoreNames.contains('snapshots')) {
                db.createObjectStore('snapshots', { keyPath: 'id' });
            }
        },
        blocked() {
            console.warn('[PricingStore] DB Upgrade blocked explicitly.');
            alert('Database update blocked by another open tab. Please close other "CSP Insights" tabs and reload this page to fix the issue.');
        },
        blocking() {
            console.warn('[PricingStore] This connection is blocking a future upgrade.');
        },
        terminated() {
            console.error('[PricingStore] DB connection terminated.');
        }
    });
};

export const usePricingStore = create<PricingState>((set, get) => ({
    rows: [],
    favorites: [],
    comparisonRows: [],
    isComparing: false,
    meta: null,
    isLoading: false,
    error: null,

    snapshots: [],

    loadPricing: async () => {
        set({ isLoading: true, error: null });
        try {
            const db = await getDB();
            const storedRows = await db.get(STORE_NAME, 'rows');
            const storedMeta = await db.get(STORE_NAME, 'meta');
            const storedFavs = await db.get(STORE_NAME, 'favorites');

            // Initial snapshot load
            const allSnaps = await db.getAll('snapshots');
            const snapList = allSnaps
                .sort((a, b) => b.updatedAt - a.updatedAt)
                .map(({ id, name, updatedAt, meta }) => ({ id, name, updatedAt, meta }));

            if (storedRows) set({ rows: storedRows });
            if (storedMeta) set({ meta: storedMeta });
            if (storedFavs) set({ favorites: storedFavs });
            set({ snapshots: snapList });

            set({ isLoading: false });
        } catch (err) {
            console.error('Failed to load pricing from DB', err);
            // Don't show error to user on initial load failure (empty state is fine)
            set({ isLoading: false });
        }
    },

    loadSnapshots: async () => {
        // Just reload logic if needed, but loadPricing handles init. 
        // We can expose a refresh method.
        try {
            const db = await getDB();
            const allSnaps = await db.getAll('snapshots');
            const snapList = allSnaps
                .sort((a, b) => b.updatedAt - a.updatedAt)
                .map(({ id, name, updatedAt, meta }) => ({ id, name, updatedAt, meta }));
            set({ snapshots: snapList });
        } catch (e) { console.error(e) }
    },

    saveCurrentAsSnapshot: async (name: string) => {
        const { rows, meta } = get();
        if (!rows || rows.length === 0) {
            set({ error: 'No data to save. Pricing list is empty.' });
            return false;
        }

        const id = `snap-${Date.now()}`;
        // Create a deep clone/simplified version if needed, or just store as is.
        // IDB handles structured cloning.
        const snapshot = {
            id,
            name,
            rows,
            meta,
            updatedAt: Date.now()
        };

        try {
            const db = await getDB();
            await db.put('snapshots', snapshot);

            // Refresh list
            const allSnaps = await db.getAll('snapshots');
            const snapList = allSnaps
                .sort((a, b) => b.updatedAt - a.updatedAt)
                .map(({ id, name, updatedAt, meta }) => ({ id, name, updatedAt, meta }));

            set({ snapshots: snapList });
            return true;
        } catch (err) {
            console.error(err);
            set({ error: 'Failed to save snapshot. See console for details.' });
            return false;
        }
    },

    restoreSnapshot: async (id: string) => {
        set({ isLoading: true });
        try {
            const db = await getDB();
            const snap = await db.get('snapshots', id);
            if (snap) {
                set({ rows: snap.rows, meta: snap.meta });

                // Also update 'current' state in DB so it persists on reload
                await db.put(STORE_NAME, snap.rows, 'rows');
                await db.put(STORE_NAME, snap.meta, 'meta');
                return true;
            }
            return false;
        } catch (err) {
            console.error(err);
            set({ error: 'Failed to restore snapshot.' });
            return false;
        } finally {
            set({ isLoading: false });
        }
    },

    removeSnapshot: async (id: string) => {
        try {
            const db = await getDB();
            await db.delete('snapshots', id);
            set(state => ({ snapshots: state.snapshots.filter(s => s.id !== id) }));
        } catch (e) {
            console.error(e);
        }
    },

    renameSnapshot: async (id: string, newName: string) => {
        try {
            const db = await getDB();
            const snap = await db.get('snapshots', id);
            if (snap) {
                snap.name = newName;
                await db.put('snapshots', snap);
                // Refresh list state
                set(state => ({
                    snapshots: state.snapshots.map(s => s.id === id ? { ...s, name: newName } : s)
                }));
            }
        } catch (e) {
            console.error(e);
        }
    },

    importPricing: async (file: File) => {
        set({ isLoading: true, error: null });

        return new Promise<void>((resolve, reject) => {
            const worker = new PricingWorker();

            worker.onmessage = async (e) => {
                const { data, meta, error } = e.data;

                if (error) {
                    set({ error, isLoading: false });
                    reject(error);
                    return;
                }

                if (data) {
                    // Update Store
                    set({ rows: data, meta });

                    // Persist to IDB
                    try {
                        const db = await getDB();
                        await db.put(STORE_NAME, data, 'rows');
                        await db.put(STORE_NAME, meta, 'meta');
                    } catch (err) {
                        console.error('Failed to save pricing to DB', err);
                    }

                    set({ isLoading: false });
                    resolve();
                }
                worker.terminate();
            };

            worker.onerror = (err) => {
                set({ error: 'Worker Error', isLoading: false });
                worker.terminate();
                reject(err);
            };

            worker.postMessage({ file });
        });
    },

    loadComparison: async (file: File) => {
        set({ isLoading: true, error: null });
        return new Promise<void>((resolve, reject) => {
            const worker = new PricingWorker();
            worker.onmessage = (e) => {
                const { data, error } = e.data;
                if (error) {
                    set({ error, isLoading: false });
                    reject(error);
                } else if (data) {
                    set({
                        comparisonRows: data,
                        isComparing: true,
                        isLoading: false
                    });
                    resolve();
                }
                worker.terminate();
            };
            worker.onerror = (err) => {
                set({ error: 'Comparison Load Error', isLoading: false });
                worker.terminate();
                reject(err);
            };
            worker.postMessage({ file });
        });
    },

    loadComparisonFromSnapshot: async (id: string) => {
        set({ isLoading: true, error: null });
        try {
            const db = await getDB();
            const snap = await db.get('snapshots', id);

            if (snap && snap.rows && snap.rows.length > 0) {
                set({
                    comparisonRows: snap.rows,
                    isComparing: true,
                    isLoading: false
                });
                return true;
            } else {
                set({ error: 'Snapshot empty or not found.', isLoading: false });
                return false;
            }
        } catch (err) {
            console.error(err);
            set({ error: 'Failed to load comparison snapshot.', isLoading: false });
            return false;
        }
    },

    clearComparison: () => {
        set({ comparisonRows: [], isComparing: false });
    },

    clearPricing: async () => {
        set({ rows: [], meta: null });
        try {
            const db = await getDB();
            await db.clear(STORE_NAME);
        } catch (err) {
            console.error(err);
        }
    },

    toggleFavorite: async (compositeKey: string) => {
        // We use compositeKey (Product+Sku+Term+Plan) for UI uniqueness, 
        // but maybe for favorites we want to favorite the SKU regardless of term?
        // User said "Articles I use often". Usually that means specific SKU.
        // Let's store the compositeKey to be safe and specific.
        const { favorites } = get();
        const isFav = favorites.includes(compositeKey);
        const newFavs = isFav
            ? favorites.filter(k => k !== compositeKey)
            : [...favorites, compositeKey];

        set({ favorites: newFavs });

        try {
            const db = await getDB();
            await db.put(STORE_NAME, newFavs, 'favorites');
        } catch (err) {
            console.error('Failed to save favorites', err);
        }
    }
}));
