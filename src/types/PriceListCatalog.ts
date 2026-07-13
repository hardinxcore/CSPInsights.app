export interface PriceListCatalogItem {
    id: string;
    fileName: string;
    month: number;
    year: number;
    label: string;
    url?: string;
}

export interface PriceListCatalogResponse {
    items: PriceListCatalogItem[];
}
