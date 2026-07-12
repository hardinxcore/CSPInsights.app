import React from 'react';
import { AlertTriangle } from 'lucide-react';
import type { RenewalEntry, ESTUploadRecord } from './types';
import { formatCurrency, formatDate } from './helpers';
import { TermDot } from './TermDot';
import { ESTListPanel } from './ESTUploadPanel';

export const RenewalListView: React.FC<{
    estUploadSorted: ESTUploadRecord[];
    upcomingRenewals: RenewalEntry[];
    expandedRow: string | null;
    setExpandedRow: React.Dispatch<React.SetStateAction<string | null>>;
}> = ({ estUploadSorted, upcomingRenewals, expandedRow, setExpandedRow }) => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>

    {/* Partner Center EST upload section */}
    {estUploadSorted.length > 0 && (
        <ESTListPanel estUploadSorted={estUploadSorted} expandedRow={expandedRow} setExpandedRow={setExpandedRow} />
    )}

    <div style={{ background: 'var(--bg-secondary)', borderRadius: '12px', border: '1px solid var(--border-color)', overflow: 'hidden' }}>
        {upcomingRenewals.length === 0 ? (
            <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-tertiary)' }}>
                No renewals found in the selected window.
            </div>
        ) : (() => {
            // Group by month for section headers
            const groups = new Map<string, RenewalEntry[]>();
            for (const r of upcomingRenewals) {
                const label = r.endDate.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
                if (!groups.has(label)) groups.set(label, []);
                groups.get(label)!.push(r);
            }
            return Array.from(groups.entries()).map(([month, items]) => (
                <React.Fragment key={month}>
                    <div style={{ padding: '0.5rem 0.75rem', background: 'var(--bg-tertiary)', borderBottom: '1px solid var(--border-color)', fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-tertiary)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                        {month} — {items.length} renewal{items.length > 1 ? 's' : ''}
                    </div>
                    {items.map((r, i) => {
                        const isExpanded = expandedRow === r.subscriptionId;
                        const urgencyColor = r.daysUntil <= 7 ? '#FE5000' : r.daysUntil <= 30 ? '#F59E0B' : 'var(--text-secondary)';
                        return (
                            <React.Fragment key={r.subscriptionId}>
                                <div onClick={() => setExpandedRow(isExpanded ? null : r.subscriptionId)}
                                    style={{
                                        display: 'grid', gridTemplateColumns: '1fr 1fr auto auto auto auto',
                                        gap: '0.5rem', alignItems: 'center',
                                        padding: '0.6rem 0.75rem', cursor: 'pointer',
                                        borderBottom: '1px solid var(--border-color)',
                                        background: i % 2 === 0 ? 'transparent' : 'var(--bg-tertiary)',
                                        fontSize: '0.85rem',
                                    }}>
                                    <div style={{ color: 'var(--text-primary)', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.customerName}</div>
                                    <div style={{ color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.productName}</div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', whiteSpace: 'nowrap' }}>
                                        <TermDot category={r.termCategory} />
                                        <span style={{ color: 'var(--text-tertiary)', fontSize: '0.78rem' }}>{r.termCategory}</span>
                                    </div>
                                    <div style={{ color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>{formatDate(r.endDate)}</div>
                                    <div style={{ fontWeight: 700, color: urgencyColor, whiteSpace: 'nowrap', textAlign: 'right' }}>
                                        {r.daysUntil === 0 ? 'Today' : `${r.daysUntil}d`}
                                    </div>
                                    <div style={{ fontWeight: 600, color: 'var(--text-primary)', whiteSpace: 'nowrap', textAlign: 'right' }}>{formatCurrency(r.value, r.currency)}</div>
                                </div>
                                {isExpanded && (
                                    <div style={{ padding: '0.75rem 1rem', background: 'rgba(99,102,241,0.04)', borderBottom: '1px solid var(--border-color)', fontSize: '0.8rem' }}>
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
                            </React.Fragment>
                        );
                    })}
                </React.Fragment>
            ));
        })()}
    </div>
    </div>
);
