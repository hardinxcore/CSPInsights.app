import { useMemo } from 'react';
import type { BillingRecord } from '../../types/BillingData';
import { calculateSellPrice } from '../../utils/pricing';

/**
 * Dynamic column sizing based on canvas measureText.
 * Moved verbatim from Dashboard.tsx to keep the visible sizing identical.
 */
export function useColumnWidths(
    sortedRows: BillingRecord[],
    visibleColumns: Set<string>,
    globalMargin: number,
    marginRules: Record<string, number>
) {
    return useMemo(() => {
        const widths: Record<string, string> = {};
        if (sortedRows.length === 0) return widths;

        const context = document.createElement('canvas').getContext('2d');
        if (context) context.font = '0.875rem Inter'; // Match CSS font

        // Default constraints
        const config: Record<string, { min: number, max: number }> = {
            CustomerName: { min: 200, max: 400 },
            ProductName: { min: 150, max: 350 },
            Quantity: { min: 60, max: 100 },
            TotalAmount: { min: 120, max: 160 },
            UnitPrice: { min: 80, max: 120 },
            SellPrice: { min: 120, max: 160 },
            ChargeType: { min: 100, max: 150 },
            PublisherName: { min: 120, max: 250 }
        };

        // Columns to scan
        const colsToScan = Array.from(visibleColumns);

        colsToScan.forEach(col => {
            let maxPx = config[col]?.min || 120;
            const maxLimit = config[col]?.max || 300;

            // Scan subset for performance
            const limit = Math.min(sortedRows.length, 200);

            for (let i = 0; i < limit; i++) {
                const row = sortedRows[i];
                let val = '';

                if (col === 'TotalAmount') val = (row.Total || row.Subtotal || 0).toFixed(2);
                else if (col === 'SellPrice') val = calculateSellPrice(row, globalMargin, marginRules).toFixed(2);
                else val = String(row[col as keyof BillingRecord] || '');

                let w = 0;
                if (context) {
                    w = context.measureText(val).width + 32; // text + padding
                } else {
                    w = val.length * 8 + 32;
                }
                if (w > maxPx) maxPx = w;
            }

            if (maxPx > maxLimit) maxPx = maxLimit;
            widths[col] = `${Math.ceil(maxPx)}px`;
        });

        return widths;
    }, [sortedRows, visibleColumns, globalMargin, marginRules]);
}
