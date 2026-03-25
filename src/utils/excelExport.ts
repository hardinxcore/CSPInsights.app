import * as XLSX from 'xlsx';
import type { PriceRow } from '../types/PricingData';

export const exportPricingToExcel = (rows: PriceRow[], showMargins: boolean, filename = 'pricing_catalog.xlsx') => {
    const data = rows.map(row => {
        const margin = row.ERPPrice - row.UnitPrice;
        const marginPercent = row.ERPPrice > 0 ? (margin / row.ERPPrice) : 0;

        const base: any = {
            'Product Title': row.ProductTitle,
            'SKU Title': row.SkuTitle,
            'SKU ID': row.SkuId,
            'Publisher': row.Publisher,
            'Segment': row.Segment,
            'Term': `${row.TermDuration} (${row.BillingPlan})`,
            'Currency': row.Currency,
            'Unit Price (Cost)': row.UnitPrice,
            'ERP Price (Retail)': row.ERPPrice,
        };

        if (showMargins) {
            base['Margin Amount'] = margin;
            base['Margin %'] = marginPercent;
        }

        return base;
    });

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
        { wch: 15 }, // Unit
        { wch: 15 }, // ERP
    ];
    if (showMargins) {
        colWidths.push({ wch: 15 });
        colWidths.push({ wch: 10 });
    }
    worksheet['!cols'] = colWidths;

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Pricing Catalog");

    // Generate timestamp for filename if default
    const finalName = filename === 'pricing_catalog.xlsx'
        ? `pricing_catalog_${new Date().toISOString().slice(0, 10)}.xlsx`
        : filename;

    XLSX.writeFile(workbook, finalName);
};
