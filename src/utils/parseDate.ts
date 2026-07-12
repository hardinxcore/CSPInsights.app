/**
 * Locale-independent date parsing for CSV exports.
 *
 * `new Date('01-02-2026')` is engine/locale dependent and silently
 * misparses European day-first notation. This helper handles the formats
 * Partner Center actually emits:
 * - ISO 8601 ("2026-07-01", "2026-07-01T00:00:00Z") — preferred
 * - Slash/dash separated with a 4-digit year ("7/1/2026", "01-07-2026")
 *
 * Ambiguity note: "01/02/2026" is read as month-first (en-US invariant,
 * consistent with parseMoney); a first component > 12 flips to day-first.
 *
 * Returns null for unparseable input instead of an Invalid Date.
 */
export const parseDateSafe = (val: unknown): Date | null => {
    if (val instanceof Date) return isNaN(val.getTime()) ? null : val;
    if (typeof val !== 'string') return null;
    const s = val.trim();
    if (!s) return null;

    // ISO 8601 — unambiguous, let the engine parse it
    if (/^\d{4}-\d{2}-\d{2}/.test(s)) {
        const d = new Date(s);
        return isNaN(d.getTime()) ? null : d;
    }

    const m = /^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{4})/.exec(s);
    if (m) {
        const a = parseInt(m[1], 10);
        const b = parseInt(m[2], 10);
        const y = parseInt(m[3], 10);
        // A first component that cannot be a month must be the day
        const [month, day] = a > 12 ? [b, a] : [a, b];
        if (month < 1 || month > 12 || day < 1 || day > 31) return null;
        const d = new Date(Date.UTC(y, month - 1, day));
        return isNaN(d.getTime()) ? null : d;
    }

    const d = new Date(s);
    return isNaN(d.getTime()) ? null : d;
};

/** Whole days between two parseable dates, inclusive of both ends; 0 when unparseable. */
export const billableDaysBetween = (start: unknown, end: unknown): number => {
    const s = parseDateSafe(start);
    const e = parseDateSafe(end);
    if (!s || !e) return 0;
    const diff = Math.abs(e.getTime() - s.getTime());
    return Math.ceil(diff / (1000 * 60 * 60 * 24)) + 1;
};
