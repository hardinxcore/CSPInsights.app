import type { CSSProperties } from 'react';
import { formatCurrency, formatCurrencyShort } from '../../utils/format';

export type TabType = 'overview' | 'customers' | 'products' | 'records' | 'payments';
export type SortDir = 'asc' | 'desc';
export const CHART_COLORS = ['#10B981', '#00B5E2', '#FE5000', '#8B5CF6', '#F59E0B', '#0078D4', '#EC4899'];
export const PAYMENT_STATUS_COLORS: Record<string, string> = { UNPROCESSED: '#F59E0B', SENT: '#00B5E2', PAID: '#10B981' };
export const axisStyle = { fontSize: 11, fill: 'var(--text-tertiary)' };
export const gridStyle = { stroke: 'var(--border-color)', strokeDasharray: '3 3' };
export const tooltipStyle = {
    contentStyle: { background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: '8px', fontSize: '0.85rem', color: 'var(--text-primary)' },
    labelStyle: { color: 'var(--text-primary)', fontWeight: 600 }, itemStyle: { color: 'var(--text-secondary)' }, cursor: { fill: 'var(--bg-tertiary)' },
};
export const fmt = formatCurrency;
export const fmtShort = formatCurrencyShort;
export const truncate = (str: string, max: number) => str && str.length > max ? str.slice(0, max) + '…' : (str || '');
export const thStyle: CSSProperties = { padding: '0.75rem 1rem', textAlign: 'left', fontSize: '0.8rem', color: 'var(--text-tertiary)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', whiteSpace: 'nowrap', cursor: 'pointer', userSelect: 'none' };
export const tdStyle: CSSProperties = { padding: '0.75rem 1rem', fontSize: '0.88rem', color: 'var(--text-primary)', borderTop: '1px solid var(--border-color)', whiteSpace: 'nowrap' };
