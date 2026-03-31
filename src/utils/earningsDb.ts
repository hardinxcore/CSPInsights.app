import { openDB, type DBSchema } from 'idb';
import type { EarningRecord, EarningsMeta, PaymentRecord, PaymentsMeta } from '../types/EarningsData';

interface EarningsDB extends DBSchema {
    earnings: {
        key: string;
        value: {
            id: string;
            name?: string;
            data: EarningRecord[];
            meta: EarningsMeta;
            updatedAt: number;
        };
    };
    payments: {
        key: string;
        value: {
            id: string;
            name?: string;
            data: PaymentRecord[];
            meta: PaymentsMeta;
            updatedAt: number;
        };
    };
}

const DB_NAME = 'csp-earnings-db';

const initEarningsDB = async () => {
    return openDB<EarningsDB>(DB_NAME, 2, {
        upgrade(db) {
            if (!db.objectStoreNames.contains('earnings')) {
                db.createObjectStore('earnings', { keyPath: 'id' });
            }
            if (!db.objectStoreNames.contains('payments')) {
                db.createObjectStore('payments', { keyPath: 'id' });
            }
        },
    });
};

// ── Earnings ──────────────────────────────────────────────────────────────────

export const saveEarningsData = async (data: EarningRecord[], meta: EarningsMeta) => {
    const db = await initEarningsDB();
    await db.put('earnings', { id: 'latest', name: 'Current Session', data, meta, updatedAt: Date.now() });
};

export const loadEarningsData = async () => {
    const db = await initEarningsDB();
    return db.get('earnings', 'latest');
};

export const clearEarningsData = async () => {
    const db = await initEarningsDB();
    await db.delete('earnings', 'latest');
};

export const saveEarningsSnapshot = async (name: string, data: EarningRecord[], meta: EarningsMeta) => {
    const db = await initEarningsDB();
    const id = `snap-${Date.now()}`;
    await db.put('earnings', { id, name, data, meta, updatedAt: Date.now() });
    return id;
};

export const getEarningsSnapshots = async () => {
    const db = await initEarningsDB();
    const all = await db.getAll('earnings');
    return all
        .filter(item => item.id !== 'latest')
        .sort((a, b) => b.updatedAt - a.updatedAt)
        .map(({ id, name, updatedAt, meta }) => ({ id, name, updatedAt, meta }));
};

export const loadEarningsSnapshot = async (id: string) => {
    const db = await initEarningsDB();
    return db.get('earnings', id);
};

export const deleteEarningsSnapshot = async (id: string) => {
    const db = await initEarningsDB();
    await db.delete('earnings', id);
};

// ── Payments ──────────────────────────────────────────────────────────────────

export const savePaymentsData = async (data: PaymentRecord[], meta: PaymentsMeta) => {
    const db = await initEarningsDB();
    await db.put('payments', { id: 'latest', name: 'Current Session', data, meta, updatedAt: Date.now() });
};

export const loadPaymentsData = async () => {
    const db = await initEarningsDB();
    return db.get('payments', 'latest');
};

export const clearPaymentsData = async () => {
    const db = await initEarningsDB();
    await db.delete('payments', 'latest');
};
