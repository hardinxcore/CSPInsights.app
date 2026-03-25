export interface PriceRow {
    ProductTitle: string;
    ProductId: string;
    SkuId: string;
    SkuTitle: string;
    Publisher: string;
    SkuDescription: string;
    UnitOfMeasure: string;
    TermDuration: string;
    BillingPlan: string;
    Market: string;
    Currency: string;
    UnitPrice: number;
    ERPPrice: number; // Mapped from "ERP Price"
    EffectiveStartDate: string;
    Segment: string;
    Tags?: string;
}

export interface PricingMeta {
    totalRows: number;
    lastUpdated: string; // ISO date
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
    clearPricing: () => Promise<void>;
    toggleFavorite: (compositeKey: string) => void;
}
