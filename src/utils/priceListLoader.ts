import type { PriceListCatalogItem } from '../types/PriceListCatalog';

export const fetchPriceListArchive = async (item: PriceListCatalogItem): Promise<File> => {
    if (!item.url) throw new Error(`${item.label} heeft geen downloadlocatie.`);

    let archiveUrl = item.url;
    if (item.url.startsWith('/api/price-lists/')) {
        archiveUrl = `${item.url}?download=1`;
    }

    const response = await fetch(archiveUrl, { headers: { Accept: 'application/zip' } });
    if (!response.ok) throw new Error(`${item.label} kon niet worden opgehaald.`);

    const archive = await response.blob();
    return new File([archive], item.fileName, { type: 'application/zip' });
};
