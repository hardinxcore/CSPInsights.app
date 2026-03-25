import type { BillingRecord } from '../types/BillingData';

export const calculateSellPrice = (
    row: BillingRecord,
    globalMargin: number,
    marginRules: Record<string, number>
): number => {
    const cost = (row.Total || row.Subtotal || 0);

    // Hierarchy: 
    // 1. Specific Customer Rule
    // 2. Global Margin

    let margin = globalMargin;

    if (marginRules[row.CustomerName] !== undefined) {
        margin = marginRules[row.CustomerName];
    }

    // Note: Could extend to Product specific rules later if needed
    // key = `${row.CustomerName}::${row.ProductId}`

    return cost * (1 + margin / 100);
};

export const getAppliedMargin = (
    row: BillingRecord,
    globalMargin: number,
    marginRules: Record<string, number>
): number => {
    if (marginRules[row.CustomerName] !== undefined) {
        return marginRules[row.CustomerName];
    }
    return globalMargin;
};
