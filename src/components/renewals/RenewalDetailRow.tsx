import React from 'react';
import { AlertTriangle } from 'lucide-react';
import type { RenewalEntry } from './types';
import { formatCurrency, formatDate } from './helpers';
import { TermDot } from './TermDot';

export const RenewalDetailRow: React.FC<{ renewal: RenewalEntry; isExpanded: boolean; onToggle: () => void }> = ({ renewal: r, isExpanded, onToggle }) => (
    <div style={{ borderRadius: '8px', border: '1px solid var(--border-color)', overflow: 'hidden' }}>
        <div onClick={onToggle} style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            padding: '0.55rem 0.75rem', background: isExpanded ? 'rgba(99,102,241,0.08)' : 'var(--bg-tertiary)',
            gap: '0.75rem', cursor: 'pointer',
        }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', flex: 1, minWidth: 0 }}>
                <TermDot category={r.termCategory} size={10} />
                <div style={{ minWidth: 0 }}>
                    <div style={{ fontWeight: 600, fontSize: '0.85rem', color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.customerName}</div>
                    <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.productName}</div>
                </div>
            </div>
            <div style={{ textAlign: 'right', flexShrink: 0 }}>
                <div style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary)' }}>{formatCurrency(r.value, r.currency)}</div>
                <div style={{ fontSize: '0.74rem', color: 'var(--text-tertiary)' }}>{r.termCategory}</div>
            </div>
        </div>
        {isExpanded && (
            <div style={{ padding: '0.75rem 1rem', background: 'rgba(99,102,241,0.04)', borderTop: '1px solid var(--border-color)', fontSize: '0.8rem' }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.5rem', color: 'var(--text-secondary)' }}>
                    <div><span style={{ color: 'var(--text-tertiary)' }}>Subscription ID</span><br /><code style={{ fontSize: '0.75rem' }}>{r.subscriptionId}</code></div>
                    {r.startDate && <div><span style={{ color: 'var(--text-tertiary)' }}>Start Date</span><br />{formatDate(r.startDate)}</div>}
                    <div><span style={{ color: 'var(--text-tertiary)' }}>Renewal Date</span><br />{formatDate(r.endDate)}</div>
                    <div><span style={{ color: 'var(--text-tertiary)' }}>Quantity</span><br />{r.quantity}</div>
                    {r.orderId && <div><span style={{ color: 'var(--text-tertiary)' }}>Order ID</span><br /><code style={{ fontSize: '0.75rem' }}>{r.orderId}</code></div>}
                    <div><span style={{ color: 'var(--text-tertiary)' }}>Full Term</span><br />{r.term}</div>
                    {r.isCancellable && (
                        <div style={{ gridColumn: '1 / -1', background: 'rgba(254,80,0,0.08)', border: '1px solid rgba(254,80,0,0.3)', borderRadius: '6px', padding: '0.4rem 0.65rem', color: '#FE5000', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                            <AlertTriangle size={14} /> NCE 7-day cancellation window active
                        </div>
                    )}
                </div>
            </div>
        )}
    </div>
);
