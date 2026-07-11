/**
 * Parses money/number values from CSV exports that may use either
 * US ("1,234.56") or EU ("1.234,56") formatting, accounting-style
 * negatives ("(1.23)"), trailing minus signs and currency symbols.
 *
 * Ambiguity note: values with a single separator followed by exactly
 * 3 digits are resolved using the invariant en-US format Partner Center
 * exports use: "1,234" → 1234 (thousands), "1.234" → 1.234 (decimal).
 *
 * Returns 0 for unparseable input.
 */
export const parseMoney = (val: unknown): number => {
    if (typeof val === 'number') return isNaN(val) ? 0 : val;
    if (typeof val !== 'string') return 0;

    let s = val.trim();
    if (s === '') return 0;

    // Accounting notation: (1.23) means -1.23
    let negative = false;
    const parenMatch = /^\((.*)\)$/.exec(s);
    if (parenMatch) {
        negative = true;
        s = parenMatch[1];
    }

    // Strip currency symbols, spaces and other noise
    s = s.replace(/[^0-9.,-]/g, '');

    // Any minus sign (leading or trailing) marks the value negative
    if (s.includes('-')) {
        negative = true;
        s = s.replace(/-/g, '');
    }
    if (s === '') return 0;

    const lastComma = s.lastIndexOf(',');
    const lastDot = s.lastIndexOf('.');

    let normalized: string;
    if (lastComma > -1 && lastDot > -1) {
        // Both present: the one occurring last is the decimal separator
        if (lastComma > lastDot) {
            normalized = s.replace(/\./g, '').replace(',', '.');
        } else {
            normalized = s.replace(/,/g, '');
        }
    } else if (lastComma > -1) {
        if (/^\d{1,3}(,\d{3})+$/.test(s)) {
            // "1,234" / "1,234,567" → thousands separators
            normalized = s.replace(/,/g, '');
        } else {
            // "1,5" / "1234,56" → comma is the decimal separator
            // (strip any earlier commas, keep the last as decimal point)
            normalized = s.slice(0, lastComma).replace(/,/g, '') + '.' + s.slice(lastComma + 1);
        }
    } else if (lastDot > -1) {
        if (/^\d{1,3}(\.\d{3})+$/.test(s) && s.indexOf('.') !== lastDot) {
            // "1.234.567" → thousands separators (only when unambiguous: 2+ dots)
            normalized = s.replace(/\./g, '');
        } else if (s.indexOf('.') !== lastDot) {
            // Multiple dots but not a clean thousands pattern: keep last as decimal
            normalized = s.slice(0, lastDot).replace(/\./g, '') + '.' + s.slice(lastDot + 1);
        } else {
            // Single dot → decimal separator (invariant format)
            normalized = s;
        }
    } else {
        normalized = s;
    }

    const num = parseFloat(normalized);
    if (isNaN(num)) return 0;
    return negative ? -num : num;
};

export const toStr = (val: unknown): string => (val != null ? String(val).trim() : '');
