import React, { useState, useMemo } from 'react';
import { Search, X, ChevronUp, ChevronDown } from 'lucide-react';
import type { EarningRecord } from '../../types/EarningsData';
import { thStyle, tdStyle, truncate, fmt } from './shared';
import { PaymentBadge } from './sharedComponents';

// ── Records table with sort + filter (reused in detail views) ────────────────
export const RecordsTable: React.FC<{ records: EarningRecord[]; currency: string }> = ({ records, currency }) => {
    const [search, setSearch] = useState('');
    const [sort, setSort] = useState<{ key: string; dir: 'asc' | 'desc' }>({ key: 'earningDate', dir: 'desc' });

    const filtered = useMemo(() => {
        let f = records;
        if (search) {
            const q = search.toLowerCase();
            f = f.filter(r =>
                r.customerName?.toLowerCase().includes(q) ||
                r.productName?.toLowerCase().includes(q) ||
                r.lever?.toLowerCase().includes(q) ||
                r.paymentStatus?.toLowerCase().includes(q) ||
                r.earningId?.toLowerCase().includes(q)
            );
        }
        return [...f].sort((a, b) => {
            const av = (a as any)[sort.key] ?? '';
            const bv = (b as any)[sort.key] ?? '';
            if (sort.key === 'earningDate') {
                const ad = new Date(av).getTime() || 0;
                const bd = new Date(bv).getTime() || 0;
                return sort.dir === 'asc' ? ad - bd : bd - ad;
            }
            if (typeof av === 'number') return sort.dir === 'asc' ? av - bv : bv - av;
            return sort.dir === 'asc'
                ? String(av).localeCompare(String(bv))
                : String(bv).localeCompare(String(av));
        });
    }, [records, search, sort]);

    const toggleSort = (key: string) =>
        setSort(s => ({ key, dir: s.key === key && s.dir === 'desc' ? 'asc' : 'desc' }));

    const ColHeader: React.FC<{ col: string; label: string; alignRight?: boolean }> = ({ col, label, alignRight }) => (
        <th style={{ ...thStyle, textAlign: alignRight ? 'right' : 'left' }} onClick={() => toggleSort(col)}>
            <span style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', justifyContent: alignRight ? 'flex-end' : 'flex-start' }}>
                {label}
                {sort.key === col
                    ? (sort.dir === 'asc' ? <ChevronUp size={13} style={{ flexShrink: 0 }} /> : <ChevronDown size={13} style={{ flexShrink: 0 }} />)
                    : <ChevronDown size={13} style={{ opacity: 0.3, flexShrink: 0 }} />}
            </span>
        </th>
    );

    return (
        <div>
            {/* Filter bar */}
            <div style={{ padding: '0.75rem 1rem', borderBottom: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
                <div style={{ position: 'relative', flex: '1 1 200px', maxWidth: '360px' }}>
                    <Search size={14} style={{ position: 'absolute', left: '0.65rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-tertiary)' }} />
                    <input
                        type="text"
                        placeholder="Filter records…"
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        style={{ width: '100%', padding: '0.45rem 1.8rem', border: '1px solid var(--border-color)', borderRadius: '2rem', background: 'var(--bg-primary)', color: 'var(--text-primary)', fontSize: '0.83rem', outline: 'none' }}
                    />
                    {search && (
                        <button onClick={() => setSearch('')} style={{ position: 'absolute', right: '0.65rem', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-tertiary)', padding: 0 }}>
                            <X size={13} />
                        </button>
                    )}
                </div>
                <span style={{ fontSize: '0.82rem', color: 'var(--text-tertiary)', whiteSpace: 'nowrap' }}>
                    {filtered.length !== records.length
                        ? `${filtered.length} of ${records.length} records`
                        : `${records.length} records`}
                </span>
            </div>

            <div style={{ overflowX: 'auto', maxHeight: '420px', overflowY: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead style={{ position: 'sticky', top: 0, zIndex: 2, background: 'var(--bg-secondary)' }}>
                        <tr>
                            <ColHeader col="customerName" label="Customer" />
                            <ColHeader col="productName" label="Product" />
                            <ColHeader col="lever" label="Lever" />
                            <ColHeader col="earningRate" label="Rate %" alignRight />
                            <ColHeader col="quantity" label="Qty" alignRight />
                            <ColHeader col="earningAmount" label="Earning" alignRight />
                            <ColHeader col="paymentStatus" label="Status" />
                            <ColHeader col="estimatedPaymentMonth" label="Est. Payment" />
                            <ColHeader col="earningDate" label="Date" />
                        </tr>
                    </thead>
                    <tbody>
                        {filtered.slice(0, 500).map(r => (
                            <tr key={r.earningId}
                                onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-tertiary)')}
                                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                                style={{ transition: 'background 0.12s' }}
                            >
                                <td style={tdStyle}>{r.customerName}</td>
                                <td style={{ ...tdStyle, maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                    <span title={r.productName}>{truncate(r.productName, 35)}</span>
                                </td>
                                <td style={{ ...tdStyle, maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                    <span title={r.lever}>{truncate(r.lever, 28)}</span>
                                </td>
                                <td style={{ ...tdStyle, textAlign: 'right', color: 'var(--text-secondary)' }}>{r.earningRate}%</td>
                                <td style={{ ...tdStyle, textAlign: 'right', color: 'var(--text-secondary)' }}>{r.quantity}</td>
                                <td style={{ ...tdStyle, textAlign: 'right', fontWeight: 600, color: '#10B981' }}>{fmt(r.earningAmount, currency)}</td>
                                <td style={tdStyle}><PaymentBadge status={r.paymentStatus} /></td>
                                <td style={{ ...tdStyle, color: 'var(--text-secondary)' }}>{r.estimatedPaymentMonth || '—'}</td>
                                <td style={{ ...tdStyle, color: 'var(--text-tertiary)', fontSize: '0.82rem' }}>
                                    {r.earningDate ? new Date(r.earningDate).toLocaleDateString('nl-NL') : '—'}
                                </td>
                            </tr>
                        ))}
                        {filtered.length === 0 && (
                            <tr>
                                <td colSpan={9} style={{ ...tdStyle, textAlign: 'center', color: 'var(--text-tertiary)', padding: '2rem' }}>
                                    No records match your filter.
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
                {filtered.length > 500 && (
                    <div style={{ padding: '0.75rem 1rem', fontSize: '0.85rem', color: 'var(--text-tertiary)', borderTop: '1px solid var(--border-color)', textAlign: 'center' }}>
                        Showing first 500 of {filtered.length.toLocaleString('nl-NL')} records. Use Export Excel for the full dataset.
                    </div>
                )}
            </div>
        </div>
    );
};
