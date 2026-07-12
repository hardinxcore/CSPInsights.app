import type { TermCategory } from './types';

// ── Constants ──────────────────────────────────────────────────────────────────

/** Indigo for subscriptions scheduled to enter EST (from PC upload) */
export const EST_FUTURE_COLOR = '#818CF8';

export const TERM_COLORS: Record<TermCategory, string> = {
    'Monthly (Flex)':        '#F59E0B',
    'Annual (Monthly Pay)':  '#00B5E2',
    'Annual (Prepaid)':      '#10B981',
    '3 Year (Commit)':       '#8B5CF6',
    'Trial':                 '#6B7280',
    'Other':                 '#FE5000',
};

export const TERM_LABELS: TermCategory[] = [
    'Monthly (Flex)', 'Annual (Monthly Pay)', 'Annual (Prepaid)', '3 Year (Commit)', 'Trial', 'Other',
];

export const DAY_HEADERS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

/** Offset to convert PapaParse's 0-based row index to a 1-based spreadsheet row number (accounting for the header row) */
export const CSV_ROW_NUMBER_OFFSET = 2;
