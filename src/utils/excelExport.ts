import type { PriceRow } from '../types/PricingData';

export const exportPricingToExcel = async (rows: PriceRow[], filename = 'pricing_catalog.xlsx') => {
    const XLSX = await import('xlsx');
    // Only the ERP (retail/sell) price is exported — the purchase price (cost)
    // is intentionally never exposed to app users.
    const data = rows.map(row => ({
        'Product Title': row.ProductTitle,
        'SKU Title': row.SkuTitle,
        'SKU ID': row.SkuId,
        'Publisher': row.Publisher,
        'Segment': row.Segment,
        'Term': `${row.TermDuration} (${row.BillingPlan})`,
        'Currency': row.Currency,
        'ERP Price (Retail)': row.ERPPrice,
    }));

    const worksheet = XLSX.utils.json_to_sheet(data);

    // Auto-width columns (simple estimation)
    const colWidths = [
        { wch: 40 }, // Product
        { wch: 40 }, // SKU
        { wch: 20 }, // ID
        { wch: 15 }, // Publisher
        { wch: 15 }, // Segment
        { wch: 15 }, // Term
        { wch: 10 }, // Currency
        { wch: 15 }, // ERP
    ];
    worksheet['!cols'] = colWidths;

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Pricing Catalog");

    // Generate timestamp for filename if default
    const finalName = filename === 'pricing_catalog.xlsx'
        ? `pricing_catalog_${new Date().toISOString().slice(0, 10)}.xlsx`
        : filename;

    XLSX.writeFile(workbook, finalName);
};
