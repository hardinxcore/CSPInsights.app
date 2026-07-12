import { describe, it, expect } from 'vitest';
import { parseDateSafe, billableDaysBetween } from './parseDate';

describe('parseDateSafe', () => {
    it('parses ISO 8601 dates and timestamps', () => {
        expect(parseDateSafe('2026-07-01')?.getUTCFullYear()).toBe(2026);
        expect(parseDateSafe('2026-07-01T12:30:00Z')?.getUTCHours()).toBe(12);
    });

    it('parses month-first slash dates (en-US invariant)', () => {
        const d = parseDateSafe('7/1/2026');
        expect(d?.getUTCMonth()).toBe(6);
        expect(d?.getUTCDate()).toBe(1);
    });

    it('flips to day-first when the first component cannot be a month', () => {
        const d = parseDateSafe('25-07-2026');
        expect(d?.getUTCDate()).toBe(25);
        expect(d?.getUTCMonth()).toBe(6);
    });

    it('returns null for garbage, empty and impossible dates', () => {
        expect(parseDateSafe('')).toBeNull();
        expect(parseDateSafe('not a date')).toBeNull();
        expect(parseDateSafe(null)).toBeNull();
        expect(parseDateSafe(undefined)).toBeNull();
        expect(parseDateSafe('99/99/2026')).toBeNull();
    });
});

describe('billableDaysBetween', () => {
    it('counts days inclusive of both start and end', () => {
        expect(billableDaysBetween('2026-07-01', '2026-07-31')).toBe(31);
        expect(billableDaysBetween('2026-07-01', '2026-07-01')).toBe(1);
    });

    it('handles mixed and non-ISO formats', () => {
        expect(billableDaysBetween('7/1/2026', '2026-07-31')).toBe(31);
    });

    it('returns 0 when either date is unparseable', () => {
        expect(billableDaysBetween('', '2026-07-31')).toBe(0);
        expect(billableDaysBetween('2026-07-01', 'oops')).toBe(0);
    });
});
