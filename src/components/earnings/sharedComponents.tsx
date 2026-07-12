import React from 'react';
import { ChevronUp, ChevronDown } from 'lucide-react';
import { PAYMENT_STATUS_COLORS, type SortDir } from './shared';

export const PaymentBadge: React.FC<{ status: string }> = ({ status }) => {
    const color = PAYMENT_STATUS_COLORS[status] || 'var(--text-tertiary)';
    return <span style={{ fontSize: '0.72rem', fontWeight: 600, padding: '0.2rem 0.55rem', borderRadius: '1rem', background: `${color}22`, color, textTransform: 'uppercase', letterSpacing: '0.04em', whiteSpace: 'nowrap' }}>
        {status || '—'}
    </span>;
};

export const SortIcon: React.FC<{ col: string; current: { key: string; dir: SortDir } }> = ({ col, current }) => {
    if (current.key !== col) return <ChevronDown size={14} style={{ opacity: 0.3, flexShrink: 0 }} />;
    return current.dir === 'asc' ? <ChevronUp size={14} style={{ flexShrink: 0 }} /> : <ChevronDown size={14} style={{ flexShrink: 0 }} />;
};
