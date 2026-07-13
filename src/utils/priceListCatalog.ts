import type { PriceListCatalogItem, PriceListCatalogResponse } from '../types/PriceListCatalog';

const MONTHS = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
] as const;

const FILE_PATTERN = /^(?:AX|NL)-(January|February|March|April|May|June|July|August|September|October|November|December)-(\d{4})-Newcommerce-Cloud-Reseller-Pricelist\.zip$/i;

export const parsePriceListFileName = (fileName: string): Omit<PriceListCatalogItem, 'url'> | null => {
    const match = FILE_PATTERN.exec(fileName);
    if (!match) return null;

    const monthName = match[1];
    const year = Number(match[2]);
    const monthIndex = MONTHS.findIndex(month => month.toLowerCase() === monthName.toLowerCase());
    if (monthIndex < 0 || !Number.isInteger(year)) return null;

    return {
        id: `${year}-${String(monthIndex + 1).padStart(2, '0')}`,
        fileName,
        month: monthIndex + 1,
        year,
        label: `${MONTHS[monthIndex]} ${year}`,
    };
};

export const getPriceListCatalog = async (): Promise<PriceListCatalogItem[]> => {
    const load = async (url: string, fallbackUrl: (fileName: string) => string, forceFallbackUrl = false) => {
        const response = await fetch(url, { headers: { Accept: 'application/json' } });
        if (!response.ok) throw new Error('Catalogus niet beschikbaar.');

        const payload = await response.json() as PriceListCatalogResponse;
        return payload.items
            .filter(item => parsePriceListFileName(item.fileName) !== null)
            .sort((a, b) => b.year - a.year || b.month - a.month)
            .map(item => ({ ...item, url: forceFallbackUrl ? fallbackUrl(item.fileName) : (item.url || fallbackUrl(item.fileName)) }));
    };

    try {
        return await load('/api/price-lists', fileName => `/api/price-lists/${encodeURIComponent(fileName)}`, true);
    } catch {
        return load('/price-lists/manifest.json', fileName => `/price-lists/${encodeURIComponent(fileName)}`);
    }
};
