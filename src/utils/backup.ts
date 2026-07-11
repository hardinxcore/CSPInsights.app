import { useBillingStore } from '../store/billingStore';
import { useSettingsStore, type CompanyDetails } from '../store/settingsStore';
import { usePricingStore } from '../store/pricingStore';
import { useCartStore } from '../store/cartStore';
import type { BillingRecord } from '../types/BillingData';
import type { PriceRow } from '../types/PricingData';
import { BackupSchema } from '../types/schemas';

interface EncodedBackup {
    version: string;
    timestamp: string;
    billing: {
        data: BillingRecord[];
        meta: any;
        marginRules: Record<string, number>;
        customerTags: Record<string, string[]>;
        globalMargin: number;
        snapshots?: any[]; // SnapshotItem[] equivalent
    };
    settings: {
        companyDetails: CompanyDetails;
        defaultMargin: number;
        theme: 'light' | 'dark';
    };
    pricing: {
        rows: PriceRow[];
        meta: any;
        favorites: string[];
        snapshots?: any[]; // Pricing SnapshotItems
    };
    cart: {
        quantities: Record<string, number>;
        customerReference: string;
        savedQuotes: any[];
    };
}

interface EncryptedBackup {
    format: 'csp-insights-encrypted';
    version: 1;
    salt: string;
    iv: string;
    ciphertext: string;
}

const encodeBase64 = (bytes: Uint8Array): string => btoa(String.fromCharCode(...bytes));
const decodeBase64 = (value: string): Uint8Array => Uint8Array.from(atob(value), character => character.charCodeAt(0));
const asArrayBuffer = (bytes: Uint8Array): ArrayBuffer => bytes.slice().buffer as ArrayBuffer;

const deriveKey = async (password: string, salt: Uint8Array): Promise<CryptoKey> => {
    const material = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveKey']);
    return crypto.subtle.deriveKey({ name: 'PBKDF2', salt: asArrayBuffer(salt), iterations: 250_000, hash: 'SHA-256' }, material, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
};

export const createBackup = async (): Promise<Blob> => { // Async now to fetch from DB
    const billingState = useBillingStore.getState();
    const settingsState = useSettingsStore.getState();
    const pricingState = usePricingStore.getState();
    const cartState = useCartStore.getState();

    // Fetch Billing Snapshots (full data)
    const { getSnapshots, loadSnapshot } = await import('./db');
    const billingSnapList = await getSnapshots();
    const billingSnapshotsFull = [];
    for (const snap of billingSnapList) {
        // existing getSnapshots returns lean objects. We need full data.
        const fullSnap = await loadSnapshot(snap.id);
        if (fullSnap) billingSnapshotsFull.push(fullSnap);
    }

    // Fetch Pricing Snapshots (via the shared getDB so the schema/upgrade logic applies)
    const { getDB } = await import('../store/pricingStore');
    const pricingDB = await getDB();
    const pricingSnapshots = await pricingDB.getAll('snapshots');

    const backup: EncodedBackup = {
        version: '1.1', // Bump version
        timestamp: new Date().toISOString(),
        billing: {
            data: billingState.data,
            meta: billingState.meta,
            marginRules: billingState.marginRules,
            customerTags: billingState.customerTags,
            globalMargin: billingState.globalMargin,
            snapshots: billingSnapshotsFull
        },
        settings: {
            companyDetails: settingsState.companyDetails,
            defaultMargin: settingsState.defaultMargin,
            theme: settingsState.theme
        },
        pricing: {
            rows: pricingState.rows,
            meta: pricingState.meta,
            favorites: pricingState.favorites,
            snapshots: pricingSnapshots
        },
        cart: {
            quantities: cartState.quantities,
            customerReference: cartState.customerReference,
            savedQuotes: cartState.savedQuotes
        }
    };

    const json = JSON.stringify(backup, null, 2);
    return new Blob([json], { type: 'application/json' });
};

export const createEncryptedBackup = async (password: string): Promise<Blob> => {
    if (password.length < 12) throw new Error('Use a backup password of at least 12 characters.');
    const plaintext = await (await createBackup()).text();
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const key = await deriveKey(password, salt);
    const encrypted = await crypto.subtle.encrypt({ name: 'AES-GCM', iv: asArrayBuffer(iv) }, key, new TextEncoder().encode(plaintext));
    const payload: EncryptedBackup = { format: 'csp-insights-encrypted', version: 1, salt: encodeBase64(salt), iv: encodeBase64(iv), ciphertext: encodeBase64(new Uint8Array(encrypted)) };
    return new Blob([JSON.stringify(payload)], { type: 'application/json' });
};

const decryptIfNeeded = async (json: string, password?: string): Promise<string> => {
    const candidate = JSON.parse(json) as Partial<EncryptedBackup>;
    if (candidate.format !== 'csp-insights-encrypted') return json;
    if (!password) throw new Error('This backup is encrypted. Enter its password.');
    if (!candidate.salt || !candidate.iv || !candidate.ciphertext) throw new Error('Encrypted backup is incomplete.');
    try {
        const key = await deriveKey(password, decodeBase64(candidate.salt));
        const plaintext = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: asArrayBuffer(decodeBase64(candidate.iv)) }, key, asArrayBuffer(decodeBase64(candidate.ciphertext)));
        return new TextDecoder().decode(plaintext);
    } catch {
        throw new Error('Could not decrypt backup. Check the password and try again.');
    }
};

export const restoreBackup = async (file: File, password?: string): Promise<string> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = async (e) => {
            try {
                const json = e.target?.result as string;
                if (!json) throw new Error('Empty file');

                const decryptedJson = await decryptIfNeeded(json, password);
                const parsed = BackupSchema.safeParse(JSON.parse(decryptedJson));
                if (!parsed.success) {
                    throw new Error(`Invalid backup file: ${parsed.error.issues.slice(0, 3).map(issue => issue.path.join('.') + ' ' + issue.message).join('; ')}`);
                }
                const backup = parsed.data as unknown as EncodedBackup;
                const stats = {
                    billingRows: backup.billing?.data?.length || 0,
                    billingSnapshots: backup.billing?.snapshots?.length || 0,
                    pricingRows: backup.pricing?.rows?.length || 0,
                    pricingSnapshots: backup.pricing?.snapshots?.length || 0,
                    savedQuotes: backup.cart?.savedQuotes?.length || 0
                };

                if (!backup.version || !backup.billing || !backup.settings) {
                    throw new Error('Invalid backup file format');
                }

                // Restore Main Settings
                const settingsStore = useSettingsStore.getState();
                settingsStore.setCompanyDetails(backup.settings.companyDetails);
                settingsStore.setDefaultMargin(backup.settings.defaultMargin);
                if (backup.settings.theme) settingsStore.setTheme(backup.settings.theme);

                // --- 1. Billing Data ---
                const { saveBillingData, saveCustomerMetadata, initDB } = await import('./db');

                await saveBillingData(backup.billing.data, backup.billing.meta);
                await saveCustomerMetadata({
                    margins: backup.billing.marginRules,
                    tags: backup.billing.customerTags
                });

                // Restore Billing Snapshots
                if (backup.billing.snapshots && Array.isArray(backup.billing.snapshots)) {
                    const db = await initDB();
                    const tx = db.transaction('billing', 'readwrite');
                    const store = tx.objectStore('billing');
                    for (const snap of backup.billing.snapshots) {
                        // Ensure we don't overwrite 'latest' accidentally if id is wrong, though backup should be clean.
                        if (snap.id && snap.id !== 'latest') {
                            await store.put(snap);
                        }
                    }
                    await tx.done;
                    // Reload snapshot list in store
                    // We need to trigger a reload. The App.tsx doesn't listen to DB changes.
                    // It's safer to fetch the store and call reload.
                    const { useSnapshotStore } = await import('../store/snapshotStore');
                    useSnapshotStore.getState().loadSnapshots();
                }

                // --- 2. Pricing Data ---
                if (backup.pricing) {
                    const { getDB } = await import('../store/pricingStore');
                    const db = await getDB();
                    const tx = db.transaction(['pricing', 'snapshots'], 'readwrite');

                    // Main Pricing Data
                    const pStore = tx.objectStore('pricing');
                    if (backup.pricing.rows) await pStore.put(backup.pricing.rows, 'rows');
                    if (backup.pricing.meta) await pStore.put(backup.pricing.meta, 'meta');
                    if (backup.pricing.favorites) await pStore.put(backup.pricing.favorites, 'favorites');

                    // Pricing Snapshots
                    if (backup.pricing.snapshots && Array.isArray(backup.pricing.snapshots)) {
                        const sStore = tx.objectStore('snapshots');
                        for (const snap of backup.pricing.snapshots) {
                            await sStore.put(snap);
                        }
                    }

                    await tx.done;

                    // Reload store
                    const pricingStore = usePricingStore.getState();
                    await pricingStore.loadPricing(); // Reloads rows + snapshots
                }

                // --- 3. Cart Data ---
                if (backup.cart) {
                    useCartStore.setState({
                        quantities: backup.cart.quantities || {},
                        customerReference: backup.cart.customerReference || '',
                        savedQuotes: backup.cart.savedQuotes || []
                    });
                }

                // --- 4. Refresh Billing Store ---
                const billingStore = useBillingStore.getState();
                await billingStore.loadFromDisk();
                if (typeof backup.billing.globalMargin === 'number') {
                    billingStore.setGlobalMargin(backup.billing.globalMargin);
                }

                resolve(`Restore Complete!\n\nDetails:\n- Billing Rows: ${stats.billingRows}\n- Billing Snapshots: ${stats.billingSnapshots}\n- Price List Rows: ${stats.pricingRows}\n- Price List Snapshots: ${stats.pricingSnapshots}\n- Saved Quotes: ${stats.savedQuotes}`);
            } catch (err) {
                console.error('Restore failed', err);
                reject(err);
            }
        };
        reader.onerror = () => reject(new Error('Failed to read file'));
        reader.readAsText(file);
    });
};
