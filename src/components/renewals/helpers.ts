import type { TermCategory } from './types';

// ── Helpers ────────────────────────────────────────────────────────────────────

export function classifyTerm(raw: string): TermCategory {
    const t = (raw || '').toLowerCase();
    if (t.includes('trial')) return 'Trial';
    if (t.includes('three-year') || t.includes('3 year') || t.includes('triennial') || t.includes('p3y')) return '3 Year (Commit)';
    if (t.includes('one-year commitment for monthly')) return 'Annual (Monthly Pay)';
    if (t.includes('one-year commitment for yearly') || t.includes('one-year commitment for annual') || t === 'annual') return 'Annual (Prepaid)';
    if (t.includes('one-month commitment for monthly') || t === 'monthly' || t.includes('p1m')) return 'Monthly (Flex)';
    if (t.includes('annual') || t.includes('1 year')) return t.includes('monthly') ? 'Annual (Monthly Pay)' : 'Annual (Prepaid)';
    if (t.includes('month')) return 'Monthly (Flex)';
    return 'Other';
}

export function parseDate(s: string | undefined): Date | null {
    if (!s) return null;
    const d = new Date(s);
    return isNaN(d.getTime()) ? null : d;
}

export function toMidnight(d: Date): Date {
    const c = new Date(d);
    c.setHours(0, 0, 0, 0);
    return c;
}

export function formatDate(d: Date): string {
    return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

export function formatCurrency(v: number, currency: string): string {
    return v.toLocaleString('nl-NL', {
        style: 'currency', currency: currency || 'EUR',
        minimumFractionDigits: 0, maximumFractionDigits: 0,
    });
}

/** Parse Partner Center EST export date: MM/DD/YYYY HH:MM:SS */
export function parseESTDate(s: string | undefined): Date | null {
    if (!s) return null;
    const m = s.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s+(\d{1,2}):(\d{2}):(\d{2}))?$/);
    if (!m) return null;
    const month = parseInt(m[1], 10) - 1;
    const day = parseInt(m[2], 10);
    const year = parseInt(m[3], 10);
    const hours = m[4] ? parseInt(m[4], 10) : 0;
    const minutes = m[5] ? parseInt(m[5], 10) : 0;
    const seconds = m[6] ? parseInt(m[6], 10) : 0;
    return new Date(year, month, day, hours, minutes, seconds);
}

/** Format a P-duration string to a readable label */
export function formatDuration(d: string): string {
    if (!d) return d;
    if (d.toUpperCase() === 'P1Y') return '1 Year';
    if (d.toUpperCase() === 'P3Y') return '3 Year';
    if (d.toUpperCase() === 'P1M') return '1 Month';
    return d;
}

export function isSameDay(a: Date, b: Date): boolean {
    return a.getFullYear() === b.getFullYear()
        && a.getMonth() === b.getMonth()
        && a.getDate() === b.getDate();
}

export function dayKey(d: Date): string {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
