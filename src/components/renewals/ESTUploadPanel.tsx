import React from 'react';
import { AlertTriangle, Hourglass, Upload } from 'lucide-react';
import type { ESTUploadRecord } from './types';
import { EST_FUTURE_COLOR } from './constants';
import { formatDate, formatDuration } from './helpers';

/** Partner Center EST upload section — list view (expandable table) */
export const ESTListPanel: React.FC<{
    estUploadSorted: ESTUploadRecord[];
    expandedRow: string | null;
    setExpandedRow: React.Dispatch<React.SetStateAction<string | null>>;
}> = ({ estUploadSorted, expandedRow, setExpandedRow }) => (
    <div style={{ background: 'var(--bg-secondary)', borderRadius: '12px', border: `1px solid ${EST_FUTURE_COLOR}44`, overflow: 'hidden' }}>
        <div style={{ padding: '0.55rem 0.75rem', background: `${EST_FUTURE_COLOR}11`, borderBottom: '1px solid var(--border-color)', fontSize: '0.78rem', fontWeight: 700, color: EST_FUTURE_COLOR, letterSpacing: '0.06em', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Upload size={13} /> Entering EST — {estUploadSorted.length} subscription{estUploadSorted.length > 1 ? 's' : ''} (Partner Center AI Assist)
        </div>
        {estUploadSorted.map((r, i) => {
            const key = r.subscriptionId;
            const isExpanded = expandedRow === `est-pc-${key}`;
            const displayName = r.resolvedCustomerName || r.customerTenantId;
            const urgencyColor = r.daysUntilEST <= 30 ? '#FE5000' : r.daysUntilEST <= 90 ? '#F59E0B' : 'var(--text-secondary)';
            return (
                <React.Fragment key={key}>
                    <div onClick={() => setExpandedRow(isExpanded ? null : `est-pc-${key}`)} style={{
                        display: 'grid', gridTemplateColumns: '1fr 1fr auto auto auto',
                        gap: '0.5rem', alignItems: 'center',
                        padding: '0.6rem 0.75rem', cursor: 'pointer',
                        borderBottom: '1px solid var(--border-color)',
                        background: i % 2 === 0 ? 'transparent' : 'var(--bg-tertiary)',
                        fontSize: '0.85rem',
                    }}>
                        <div style={{ color: 'var(--text-primary)', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{displayName}</div>
                        <div style={{ color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.subscriptionName}</div>
                        <div style={{ color: 'var(--text-tertiary)', fontSize: '0.78rem', whiteSpace: 'nowrap' }}>
                            {formatDuration(r.termDuration)} · {r.billingCycle}
                        </div>
                        <div style={{ color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
                            {r.termEndDate ? formatDate(r.termEndDate) : '—'}
                        </div>
                        <div style={{ fontWeight: 700, color: urgencyColor, whiteSpace: 'nowrap', textAlign: 'right', fontSize: '0.82rem' }}>
                            {!isFinite(r.daysUntilEST) ? '—' : r.daysUntilEST < 0 ? 'Now' : r.daysUntilEST === 0 ? 'Today' : `${r.daysUntilEST}d`}
                        </div>
                    </div>
                    {isExpanded && (
                        <div style={{ padding: '0.75rem 1rem', background: `${EST_FUTURE_COLOR}08`, borderBottom: '1px solid var(--border-color)', fontSize: '0.8rem' }}>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.5rem', color: 'var(--text-secondary)' }}>
                                <div><span style={{ color: 'var(--text-tertiary)' }}>Subscription ID</span><br /><code style={{ fontSize: '0.75rem' }}>{r.subscriptionId}</code></div>
                                <div><span style={{ color: 'var(--text-tertiary)' }}>Customer Tenant ID</span><br /><code style={{ fontSize: '0.75rem' }}>{r.customerTenantId}</code></div>
                                {r.resolvedCustomerName && <div><span style={{ color: 'var(--text-tertiary)' }}>Customer Name</span><br />{r.resolvedCustomerName}</div>}
                                <div><span style={{ color: 'var(--text-tertiary)' }}>Offer ID</span><br /><code style={{ fontSize: '0.75rem' }}>{r.offerId}</code></div>
                                <div><span style={{ color: 'var(--text-tertiary)' }}>Quantity</span><br />{r.quantity}</div>
                                <div><span style={{ color: 'var(--text-tertiary)' }}>Term / Billing Cycle</span><br />{formatDuration(r.termDuration)} / {r.billingCycle}</div>
                                <div><span style={{ color: 'var(--text-tertiary)' }}>Term End Date</span><br />{r.termEndDate ? formatDate(r.termEndDate) : '—'}</div>
                                {r.resellerPartnerId && <div><span style={{ color: 'var(--text-tertiary)' }}>Reseller Partner ID</span><br /><code style={{ fontSize: '0.75rem' }}>{r.resellerPartnerId}</code></div>}
                                {r.errorMessage && <div style={{ gridColumn: '1 / -1', color: '#FE5000', fontSize: '0.78rem' }}><AlertTriangle size={12} style={{ verticalAlign: 'middle', marginRight: '4px' }} />{r.errorMessage}</div>}
                                <div style={{ gridColumn: '1 / -1', background: `${EST_FUTURE_COLOR}11`, border: `1px solid ${EST_FUTURE_COLOR}44`, borderRadius: '6px', padding: '0.4rem 0.65rem', color: EST_FUTURE_COLOR, fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                    <Hourglass size={14} /> This subscription is configured to enter Extended Service Term when its annual term expires
                                </div>
                            </div>
                        </div>
                    )}
                </React.Fragment>
            );
        })}
    </div>
);

/** Partner Center EST panel — calendar view (compact summary list) */
export const ESTCalendarPanel: React.FC<{ estUploadSorted: ESTUploadRecord[] }> = ({ estUploadSorted }) => (
    <div style={{ marginTop: '1.5rem', background: `${EST_FUTURE_COLOR}08`, border: `1px solid ${EST_FUTURE_COLOR}33`, borderRadius: '12px', padding: '1rem' }}>
        <div style={{ fontWeight: 600, fontSize: '0.9rem', color: EST_FUTURE_COLOR, display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
            <Upload size={16} />
            {estUploadSorted.length} subscription{estUploadSorted.length > 1 ? 's' : ''} entering EST — scheduled at term end (Partner Center AI Assist)
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
            {estUploadSorted.map(r => {
                const displayName = r.resolvedCustomerName || r.customerTenantId;
                const urgencyColor = r.daysUntilEST <= 30 ? '#FE5000' : r.daysUntilEST <= 90 ? '#F59E0B' : 'var(--text-secondary)';
                return (
                    <div key={r.subscriptionId} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.83rem', color: 'var(--text-secondary)' }}>
                        <span><strong style={{ color: 'var(--text-primary)' }}>{displayName}</strong> — {r.subscriptionName}</span>
                        <span style={{ color: urgencyColor, fontWeight: r.daysUntilEST <= 30 ? 600 : 400 }}>
                            {r.termEndDate ? formatDate(r.termEndDate) : '—'} · {!isFinite(r.daysUntilEST) ? '—' : r.daysUntilEST < 0 ? 'overdue' : r.daysUntilEST === 0 ? 'today' : `${r.daysUntilEST}d`}
                        </span>
                    </div>
                );
            })}
        </div>
    </div>
);
