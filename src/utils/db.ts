import { openDB, type DBSchema } from 'idb';
import type { BillingRecord } from '../types/BillingData';

interface BillingDB extends DBSchema {
    billing: {
        key: string;
        value: {
            id: string; // 'latest' or uuid/timestamp
            name?: string; // User-friendly name
            data: BillingRecord[];
            meta: any;
            updatedAt: number;
        };
    };
    settings: {
        key: string;
        value: any;
    };
}

const DB_NAME = 'partner-center-automation-db';
const STORE_NAME = 'billing';
const SETTINGS_STORE = 'settings';

export const initDB = async () => {
    return openDB<BillingDB>(DB_NAME, 2, {
        upgrade(db) {
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                db.createObjectStore(STORE_NAME, { keyPath: 'id' });
            }
            if (!db.objectStoreNames.contains(SETTINGS_STORE)) {
                db.createObjectStore(SETTINGS_STORE);
            }
        },
    });
};

export const saveBillingData = async (data: BillingRecord[], meta: any) => {
    const db = await initDB();
    await db.put(STORE_NAME, {
        id: 'latest',
        name: 'Current Session',
        data,
        meta,
        updatedAt: Date.now(),
    });
};

export const loadBillingData = async () => {
    const db = await initDB();
    return db.get(STORE_NAME, 'latest');
};

export const clearBillingData = async () => {
    const db = await initDB();
    await db.delete(STORE_NAME, 'latest');
};

/* Snapshot Functions */

export const saveSnapshot = async (name: string, data: BillingRecord[], meta: any) => {
    const db = await initDB();
    const id = `snap-${Date.now()}`;
    await db.put(STORE_NAME, {
        id,
        name,
        data,
        meta,
        updatedAt: Date.now(),
    });
    return id; // Return ID so UI can confirm
};

export const getSnapshots = async () => {
    const db = await initDB();
    const all = await db.getAll(STORE_NAME);
    // Filter out 'latest' and sort by date desc
    return all
        .filter(item => item.id !== 'latest')
        .sort((a, b) => b.updatedAt - a.updatedAt)
        .map(({ id, name, updatedAt, meta }) => ({ id, name, updatedAt, meta })); // Don't return huge data array for the list
};

export const loadSnapshot = async (id: string) => {
    const db = await initDB();
    return db.get(STORE_NAME, id);
};

export const deleteSnapshot = async (id: string) => {
    const db = await initDB();
    await db.delete(STORE_NAME, id);
};

export const updateSnapshotName = async (id: string, newName: string) => {
    const db = await initDB();
    const record = await db.get(STORE_NAME, id);
    if (record) {
        record.name = newName;
        await db.put(STORE_NAME, record);
    }
}


export const saveCustomerMetadata = async (metadata: Record<string, any>) => {
    const db = await initDB();
    await db.put(SETTINGS_STORE, metadata, 'customer-metadata');
};

export const loadCustomerMetadata = async () => {
    const db = await initDB();
    return await db.get(SETTINGS_STORE, 'customer-metadata') || {};
};
