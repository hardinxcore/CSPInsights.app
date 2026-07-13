export interface PriceListCatalogItem {
    id: string;
    fileName: string;
    month: number;
    year: number;
    label: string;
    sourceType?: 'AX' | 'NL';
    effectiveDate?: string;
    publishedAt?: string;
    fileSize?: number;
    sha256?: string;
    url?: string;
}

export interface PriceListCatalogResponse {
    items: PriceListCatalogItem[];
}
