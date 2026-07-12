/**
 * Shared currency formatting (nl-NL locale). Replaces a dozen per-component
 * implementations. Formatter instances are cached because constructing
 * Intl.NumberFormat is expensive and these run inside table/chart renders.
 */
const cache = new Map<string, Intl.NumberFormat>();

const getFormatter = (currency: string, maxFractionDigits?: number): Intl.NumberFormat => {
    const key = `${currency}|${maxFractionDigits ?? 'std'}`;
    let fmt = cache.get(key);
    if (!fmt) {
        fmt = new Intl.NumberFormat('nl-NL', {
            style: 'currency',
            currency,
            ...(maxFractionDigits !== undefined ? { maximumFractionDigits: maxFractionDigits } : {}),
        });
        cache.set(key, fmt);
    }
    return fmt;
};

/** "€ 1.234,56" — standard two-decimal currency display. */
export const formatCurrency = (value: number, currency: string = 'EUR'): string => {
    try {
        return getFormatter(currency || 'EUR').format(value);
    } catch {
        // Unknown/garbage currency code from a CSV — degrade gracefully
        return `${value.toFixed(2)} ${currency}`;
    }
};

/** "€ 1.235" — whole units, for axis labels and compact stats. */
export const formatCurrencyShort = (value: number, currency: string = 'EUR'): string => {
    try {
        return getFormatter(currency || 'EUR', 0).format(value);
    } catch {
        return `${Math.round(value)} ${currency}`;
    }
};
