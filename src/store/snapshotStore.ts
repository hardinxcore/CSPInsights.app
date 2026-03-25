import { create } from 'zustand';
import { getSnapshots, saveSnapshot, deleteSnapshot, loadSnapshot, updateSnapshotName } from '../utils/db';
import { useBillingStore } from './billingStore';

interface SnapshotItem {
    id: string;
    name?: string;
    updatedAt: number;
    meta: any;
}

interface SnapshotState {
    snapshots: SnapshotItem[];
    isLoading: boolean;
    error: string | null;

    // Actions
    loadSnapshots: () => Promise<void>;
    saveCurrentAsSnapshot: (name: string) => Promise<boolean>;
    restoreSnapshot: (id: string) => Promise<boolean>;
    removeSnapshot: (id: string) => Promise<void>;
    renameSnapshot: (id: string, newName: string) => Promise<void>;
}

export const useSnapshotStore = create<SnapshotState>((set, get) => ({
    snapshots: [],
    isLoading: false,
    error: null,

    loadSnapshots: async () => {
        set({ isLoading: true });
        try {
            const list = await getSnapshots();
            set({ snapshots: list as SnapshotItem[] });
        } catch (err) {
            console.error('Failed to load snapshots', err);
            set({ error: 'Failed to load history.' });
        } finally {
            set({ isLoading: false });
        }
    },

    saveCurrentAsSnapshot: async (name: string) => {
        const { data, meta } = useBillingStore.getState();
        if (!data || data.length === 0) {
            set({ error: 'No data to save.' });
            return false;
        }

        try {
            await saveSnapshot(name, data, meta);
            await get().loadSnapshots(); // Reload list
            return true;
        } catch (err) {
            console.error(err);
            set({ error: 'Failed to save snapshot.' });
            return false;
        }
    },

    restoreSnapshot: async (id: string) => {
        set({ isLoading: true });
        try {
            const result = await loadSnapshot(id);
            if (result) {
                // Update main billing store
                useBillingStore.getState().setData(result.data);
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
            await deleteSnapshot(id);
            // Optimistic update
            set(state => ({
                snapshots: state.snapshots.filter(s => s.id !== id)
            }));
        } catch (err) {
            console.error(err);
            set({ error: 'Could not delete snapshot.' });
        }
    },

    renameSnapshot: async (id: string, newName: string) => {
        try {
            // Optimistic update
            set(state => ({
                snapshots: state.snapshots.map(s => s.id === id ? { ...s, name: newName } : s)
            }));
            // Update DB
            await updateSnapshotName(id, newName);
        } catch (err) {
            console.error(err);
            set({ error: 'Could not rename snapshot.' });
            await get().loadSnapshots(); // Revert on failure
        }
    }
}));
