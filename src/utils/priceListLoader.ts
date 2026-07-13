import type { PriceListCatalogItem } from '../types/PriceListCatalog';

export const fetchPriceListArchive = async (item: PriceListCatalogItem): Promise<File> => {
    if (!item.url) throw new Error(`${item.label} heeft geen downloadlocatie.`);

    let archiveUrl = item.url;
    if (item.url.startsWith('/api/price-lists/')) {
        const sasResponse = await fetch(item.url, { headers: { Accept: 'application/json' } });
        if (!sasResponse.ok) throw new Error(`${item.label} kon niet worden vrijgegeven.`);
        const payload = await sasResponse.json() as { url?: string };
        if (!payload.url) throw new Error(`${item.label} heeft geen geldige downloadlocatie.`);
        archiveUrl = payload.url;
    }

    const response = await fetch(archiveUrl, { headers: { Accept: 'application/zip' } });
    if (!response.ok) throw new Error(`${item.label} kon niet worden opgehaald.`);

    const archive = await response.blob();
    return new File([archive], item.fileName, { type: 'application/zip' });
};
