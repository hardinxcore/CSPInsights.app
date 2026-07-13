// Single source of truth lives in schemas.ts (Zod), re-exported here so
// existing imports from types/PricingData keep working.
import type { PriceRow } from './schemas';
export type { PriceRow };

export interface PricingMeta {
    totalRows: number;
    lastUpdated: string; // ISO date
    sourceLabel?: string;
    sourceFileName?: string;
    sourceType?: 'AX' | 'NL';
    effectiveDate?: string;
    publishedAt?: string;
    fileSize?: number;
    sha256?: string;
}

export interface SnapshotItem {
    id: string;
    name?: string;
    updatedAt: number;
    meta: any;
}

export interface PricingState {
    rows: PriceRow[];
    favorites: string[]; // IDs of favorite products

    // Comparison Feature
    comparisonRows: PriceRow[];
    isComparing: boolean;
    loadComparison: (file: File) => Promise<void>;
    loadComparisonArchive: (file: File) => Promise<void>;
    loadComparisonFromSnapshot: (id: string) => Promise<boolean>;
    clearComparison: () => void;

    // History / Snapshots
    snapshots: SnapshotItem[];
    loadSnapshots: () => Promise<void>;
    saveCurrentAsSnapshot: (name: string) => Promise<boolean>;
    restoreSnapshot: (id: string) => Promise<boolean>;
    removeSnapshot: (id: string) => Promise<void>;
    renameSnapshot: (id: string, newName: string) => Promise<void>;

    meta: PricingMeta | null;
    isLoading: boolean;
    error: string | null;
    loadPricing: () => Promise<void>;
    importPricing: (file: File) => Promise<void>;
    importPricingArchive: (file: File, source?: Partial<PricingMeta> & { label: string; fileName: string }) => Promise<void>;
    clearPricing: () => Promise<void>;
    toggleFavorite: (compositeKey: string) => void;
}
