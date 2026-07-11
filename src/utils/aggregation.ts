export const currencyTotals = <T>(
    rows: T[],
    getCurrency: (row: T) => string | undefined,
    getAmount: (row: T) => number,
): Record<string, number> => {
    return rows.reduce<Record<string, number>>((totals, row) => {
        const currency = getCurrency(row) || 'UNKNOWN';
        totals[currency] = (totals[currency] || 0) + (Number.isFinite(getAmount(row)) ? getAmount(row) : 0);
        return totals;
    }, {});
};

export const currencyLabel = (totals: Record<string, number>): string => {
    const currencies = Object.keys(totals).filter(currency => currency !== 'UNKNOWN');
    return currencies.length === 1 ? currencies[0] : currencies.length > 1 ? 'MIXED' : 'UNKNOWN';
};

export const uniqueByKey = <T>(rows: T[], keyOf: (row: T) => string): T[] => {
    const seen = new Set<string>();
    return rows.filter(row => {
        const key = keyOf(row);
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
    });
};
