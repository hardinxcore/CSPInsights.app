import React, { useMemo, useState } from 'react';

import { useBillingStore } from '../store/billingStore';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip as RechartsTooltip, Legend } from 'recharts';
import { AlertTriangle, Calendar, CheckCircle, Filter, X } from 'lucide-react';

export const NceAnalyzer: React.FC = () => {
    const { data } = useBillingStore();
    const [daysThreshold, setDaysThreshold] = useState(30);
    const [selectedTerm, setSelectedTerm] = useState<string | null>(null);
    const [showCancellableOnly, setShowCancellableOnly] = useState(false);
    const [expandedSubs, setExpandedSubs] = useState<Set<string>>(new Set());

    const toggleExpand = (id: string, e: React.MouseEvent) => {
        // Don't trigger if clicking a button/chip inside the row
        if ((e.target as HTMLElement).closest('button') || (e.target as HTMLElement).closest('.chip')) return;

        const next = new Set(expandedSubs);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        setExpandedSubs(next);
    };

    const stats = useMemo(() => {
        let monthly = 0;       // Monthly | Monthly
        let annualMonthly = 0; // Annual | Monthly
        let annualPrepaid = 0; // Annual | Annual (OneTime)
        let triennial = 0;
        let other = 0;

        const renewals: any[] = [];
        const today = new Date();
        const futureDate = new Date();
        futureDate.setDate(today.getDate() + daysThreshold);

        const seenSubs = new Set<string>();

        // Filter Function to check if a row matches the selected Term filter
        const matchesFilter = (termCategory: string) => {
            if (showCancellableOnly) return true;
            if (!selectedTerm) return true;
            return selectedTerm === termCategory;
        };

        data.forEach(row => {
            const termRaw = (row.TermAndBillingCycle || '').toLowerCase();
            const cost = row.Total || row.Subtotal || 0;

            let category = 'Other';

            // Classification Logic
            // Classification Logic
            if (termRaw.includes('trial')) {
                category = 'Trial';
            }
            else if (termRaw.includes('one-month commitment for monthly') || termRaw === 'monthly') {
                category = 'Monthly (Flex)';
                monthly += cost;
            }
            else if (termRaw.includes('one-year commitment for monthly')) {
                category = 'Annual (Monthly Pay)';
                annualMonthly += cost;
            }
            else if (termRaw.includes('one-year commitment for yearly') || termRaw.includes('one-year commitment for annual') || termRaw === 'annual') {
                category = 'Annual (Prepaid)';
                annualPrepaid += cost;
            }
            else if (termRaw.includes('three-year') || termRaw.includes('3 year') || termRaw.includes('triennial') || termRaw.includes('p3y')) {
                category = '3 Year (Commit)';
                triennial += cost;
            }
            // Broad Fallbacks (Legacy / Incomplete data)
            else if (termRaw.includes('annual') || termRaw.includes('1 year')) {
                if (termRaw.includes('monthly')) {
                    category = 'Year/Month';
                    annualMonthly += cost;
                } else {
                    category = 'Year/Year';
                    annualPrepaid += cost;
                }
            } else if (termRaw.includes('month') || termRaw.includes('p1m')) {
                category = 'Month/Month';
                monthly += cost;
            } else {
                other += cost;
            }

            // Renewal / Cancellable Logic
            if (matchesFilter(category)) {
                let shouldAdd = false;
                let isCancellable = false;

                // Check Cancellable Status (New Orders <= 7 days)
                if (row.SubscriptionStartDate) {
                    const start = new Date(row.SubscriptionStartDate);
                    if (!isNaN(start.getTime())) {
                        const ageMs = today.getTime() - start.getTime();
                        const ageDays = ageMs / (1000 * 60 * 60 * 24);
                        // Check if within 7 days (including future starts if any)
                        if (ageDays >= -1 && ageDays <= 7) {
                            isCancellable = true;
                        }
                    }
                }

                if (showCancellableOnly) {
                    shouldAdd = isCancellable;
                }
                else if (selectedTerm) {
                    shouldAdd = true; // Category matched by matchesFilter (if cancellable not forcing us)
                    // If Cancellable is false, we rely on matchesFilter. 
                    // Wait, matchesFilter returns true if showCancellableOnly is true.
                    // So if showCancellableOnly is true, we ONLY add if isCancellable is true.
                } else {
                    // Default View: Show renewals
                    if (row.SubscriptionEndDate && row.SubscriptionId && !seenSubs.has(row.SubscriptionId)) {
                        const endDate = new Date(row.SubscriptionEndDate);
                        if (!isNaN(endDate.getTime())) {
                            if (endDate <= futureDate && endDate >= new Date(today.getTime() - 86400000)) {
                                shouldAdd = true;
                            }
                        }
                    }
                }

                if (shouldAdd && row.SubscriptionId && !seenSubs.has(row.SubscriptionId)) {
                    // Try to get EndDate, fallback for display
                    let displayDate = new Date();
                    if (row.SubscriptionEndDate) {
                        const d = new Date(row.SubscriptionEndDate);
                        if (!isNaN(d.getTime())) displayDate = d;
                    }

                    renewals.push({
                        customer: row.CustomerName,
                        product: row.ProductName,
                        endDate: displayDate,
                        term: row.TermAndBillingCycle,
                        cost: cost,
                        id: row.SubscriptionId,
                        category: category,
                        isCancellable: isCancellable,
                        originalRow: row
                    });

                    seenSubs.add(row.SubscriptionId);
                }
            }
        });

        return {
            commitment: [
                { name: 'Monthly (Flex)', value: monthly, color: '#00B5E2' },       // Brand Turquoise
                { name: 'Annual (Monthly Pay)', value: annualMonthly, color: '#0078D4' }, // Brand Blue
                { name: 'Annual (Prepaid)', value: annualPrepaid, color: '#5B6770' },     // Brand Grey
                { name: '3 Year (Commit)', value: triennial, color: '#FE5000' },          // Brand Orange
                { name: 'Trial', value: 0, color: '#AAB4BA' },                            // Brand Light Grey
                { name: 'Other', value: other, color: '#F0F0F0' }                         // Brand BG Grey
            ].filter(i => i.value > 0),
            renewals: renewals.sort((a, b) => b.cost - a.cost)
        };
    }, [data, daysThreshold, selectedTerm, showCancellableOnly]);

    return (
        <div className="animate-fade-in" style={{ paddingBottom: '4rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '2rem' }}>
                <h2 className="section-title" style={{ margin: 0 }}>NCE Intelligence</h2>

                <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                    {/* Cancellable Toggle */}
                    <button
                        onClick={() => { setShowCancellableOnly(!showCancellableOnly); setSelectedTerm(null); }}
                        style={{
                            display: 'flex', alignItems: 'center', gap: '0.5rem',
                            padding: '0.5rem 1rem',
                            borderRadius: '20px',
                            border: showCancellableOnly ? '1px solid var(--danger)' : '1px solid var(--border-color)',
                            background: showCancellableOnly ? 'rgba(239, 68, 68, 0.1)' : 'var(--bg-secondary)',
                            color: showCancellableOnly ? 'var(--danger)' : 'var(--text-secondary)',
                            cursor: 'pointer', fontWeight: 500, transition: 'all 0.2s',
                            fontSize: '0.85rem'
                        }}
                    >
                        <AlertTriangle size={14} />
                        7-Day Cancellable
                        {showCancellableOnly && <CheckCircle size={14} />}
                    </button>

                    {/* Active Filter Indicator */}
                    {selectedTerm && (
                        <button
                            onClick={() => setSelectedTerm(null)}
                            className="chip"
                            style={{ background: 'var(--brand-orange)', color: 'white', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.5rem 1rem' }}
                        >
                            <Filter size={14} /> Filter: {selectedTerm} <X size={14} />
                        </button>
                    )}
                </div>
            </div>

            {/* Top Cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1.5rem', marginBottom: '2rem' }}>

                {/* Chart */}
                <div className="glass-panel" style={{ padding: '1.5rem' }}>
                    <h3 style={{ margin: '0 0 1rem 0', fontSize: '1.1rem' }}>Commitment Risk (Spend)</h3>
                    <div style={{ height: '250px' }}>
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie
                                    data={stats.commitment}
                                    cx="50%"
                                    cy="50%"
                                    innerRadius={60}
                                    outerRadius={80}
                                    paddingAngle={5}
                                    dataKey="value"
                                    onClick={(data) => {
                                        if (showCancellableOnly) setShowCancellableOnly(false);
                                        setSelectedTerm(data.name === selectedTerm ? null : data.name);
                                    }}
                                    style={{ cursor: 'pointer' }}
                                >
                                    {stats.commitment.map((entry, index) => (
                                        <Cell
                                            key={`cell-${index}`}
                                            fill={entry.color}
                                            opacity={selectedTerm && selectedTerm !== entry.name ? 0.3 : 1}
                                        />
                                    ))}
                                </Pie>
                                <RechartsTooltip
                                    formatter={(value: number | undefined) => new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR' }).format(value || 0)}
                                    contentStyle={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-color)' }}
                                />
                                <Legend
                                    verticalAlign="middle"
                                    align="right"
                                    layout="vertical"
                                    onClick={(data) => {
                                        if (showCancellableOnly) setShowCancellableOnly(false);
                                        // Ensure we pass string or null, handle undefined
                                        const val = data.value || null;
                                        setSelectedTerm(val === selectedTerm ? null : val);
                                    }}
                                    wrapperStyle={{ cursor: 'pointer' }}
                                />
                            </PieChart>
                        </ResponsiveContainer>
                    </div>
                    <div style={{ textAlign: 'center', fontSize: '0.85rem', color: 'var(--text-tertiary)', marginTop: '0.5rem' }}>
                        Click on a slice to filter the list below
                    </div>
                </div>

                {/* Renewals List */}
                <div className="glass-panel" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                        <h3 style={{ margin: 0, fontSize: '1.1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <Calendar size={18} />
                            {showCancellableOnly ? 'Cancellable Orders (<7 Days)' : (selectedTerm ? `All ${selectedTerm} Subscriptions` : 'Upcoming Renewals')}
                        </h3>
                        {(!selectedTerm && !showCancellableOnly) && (
                            <select
                                value={daysThreshold}
                                onChange={(e) => setDaysThreshold(Number(e.target.value))}
                                className="input-field"
                                style={{ padding: '0.25rem' }}
                            >
                                <option value={7}>Next 7 Days</option>
                                <option value={30}>Next 30 Days</option>
                                <option value={60}>Next 60 Days</option>
                                <option value={90}>Next Quarter</option>
                            </select>
                        )}
                    </div>

                    <div style={{ flex: 1, overflowY: 'auto' }}>
                        {stats.renewals.length === 0 ? (
                            <div style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'var(--text-tertiary)' }}>
                                <CheckCircle size={48} style={{ marginBottom: '1rem', opacity: 0.5 }} />
                                <p>No items found matching criteria.</p>
                            </div>
                        ) : (
                            <table style={{ width: '100%', fontSize: '0.85rem', borderCollapse: 'collapse' }}>
                                <thead>
                                    <tr style={{ textAlign: 'left', color: 'var(--text-secondary)', borderBottom: '1px solid var(--border-color)' }}>
                                        <th style={{ padding: '0.5rem' }}>Date</th>
                                        <th style={{ padding: '0.5rem' }}>Customer</th>
                                        <th style={{ padding: '0.5rem' }}>Product</th>
                                        <th style={{ padding: '0.5rem' }}>Term</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {stats.renewals.map(r => (
                                        <React.Fragment key={r.id}>
                                            <tr
                                                onClick={(e) => toggleExpand(r.id, e)}
                                                style={{
                                                    borderBottom: expandedSubs.has(r.id) ? 'none' : '1px solid var(--border-color)',
                                                    background: expandedSubs.has(r.id) ? 'var(--bg-tertiary)' : (r.isCancellable ? 'rgba(239, 68, 68, 0.05)' : 'transparent'),
                                                    cursor: 'pointer'
                                                }}
                                            >
                                                <td style={{ padding: '0.5rem', whiteSpace: 'nowrap' }}>
                                                    <div style={{ fontWeight: 500 }}>{r.endDate.toLocaleDateString('nl-NL')}</div>
                                                    {/* Show different badge if Cancellable or Expiring */}
                                                    {r.isCancellable ? (
                                                        <span style={{ fontSize: '0.75rem', color: 'var(--danger)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                            <AlertTriangle size={10} /> Cancellable
                                                        </span>
                                                    ) : (
                                                        (r.endDate.getTime() - new Date().getTime()) < (7 * 24 * 60 * 60 * 1000) &&
                                                        <span style={{ fontSize: '0.75rem', color: 'var(--danger)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                            <AlertTriangle size={10} /> Expiring soon
                                                        </span>
                                                    )}
                                                </td>
                                                <td style={{ padding: '0.5rem' }}>
                                                    <div className="truncate" style={{ maxWidth: '120px' }} title={r.customer}>{r.customer}</div>
                                                </td>
                                                <td style={{ padding: '0.5rem' }}>
                                                    <div className="truncate" style={{ maxWidth: '150px' }} title={r.product}>{r.product}</div>

                                                </td>
                                                <td style={{ padding: '0.5rem' }}>
                                                    <span className="chip" style={{
                                                        background:
                                                            r.category.includes('3 Year') ? 'rgba(254, 80, 0, 0.1)' :
                                                                r.category.includes('Annual (Prepaid)') ? 'rgba(91, 103, 112, 0.1)' :
                                                                    r.category.includes('Annual (Monthly)') ? 'rgba(0, 120, 212, 0.1)' :
                                                                        'rgba(0, 181, 226, 0.1)',
                                                        color:
                                                            r.category.includes('3 Year') ? '#FE5000' :
                                                                r.category.includes('Annual (Prepaid)') ? '#5B6770' :
                                                                    r.category.includes('Annual (Monthly)') ? '#0078D4' :
                                                                        '#00B5E2'
                                                    }}>
                                                        {r.category}
                                                    </span>
                                                </td>
                                            </tr>
                                            {expandedSubs.has(r.id) && (
                                                <tr>
                                                    <td colSpan={4} style={{ padding: '0 0 1rem 0', background: 'var(--bg-tertiary)', borderBottom: '1px solid var(--border-color)' }}>
                                                        <div style={{ padding: '1rem', display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '1rem', fontSize: '0.85rem' }}>
                                                            <div className="glass-panel" style={{ padding: '0.75rem', background: 'rgba(255,255,255,0.5)' }}>
                                                                <h4 style={{ marginTop: 0, marginBottom: '0.5rem', color: 'var(--text-secondary)' }}>Billing & Quantity</h4>
                                                                <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '0.5rem 1rem' }}>
                                                                    <span style={{ color: 'var(--text-tertiary)' }}>Unit Price:</span>
                                                                    <span style={{ fontFamily: 'monospace' }}>{new Intl.NumberFormat('nl-NL', { style: 'currency', currency: r.originalRow.Currency || 'EUR' }).format(r.originalRow.UnitPrice)}</span>

                                                                    <span style={{ color: 'var(--text-tertiary)' }}>Quantity:</span>
                                                                    <span>{r.originalRow.Quantity}</span>

                                                                    <span style={{ color: 'var(--text-tertiary)' }}>Total:</span>
                                                                    <span style={{ fontWeight: 600 }}>{new Intl.NumberFormat('nl-NL', { style: 'currency', currency: r.originalRow.Currency || 'EUR' }).format(r.cost)}</span>

                                                                    <span style={{ color: 'var(--text-tertiary)' }}>Charge Type:</span>
                                                                    <span>{r.originalRow.ChargeType || '-'}</span>
                                                                </div>
                                                            </div>

                                                            <div className="glass-panel" style={{ padding: '0.75rem', background: 'rgba(255,255,255,0.5)' }}>
                                                                <h4 style={{ marginTop: 0, marginBottom: '0.5rem', color: 'var(--text-secondary)' }}>Identifiers</h4>
                                                                <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '0.5rem 1rem' }}>
                                                                    <span style={{ color: 'var(--text-tertiary)' }}>Sub ID:</span>
                                                                    <span className="truncate" title={r.id} style={{ fontFamily: 'monospace', fontSize: '0.8rem' }}>{r.id}</span>

                                                                    <span style={{ color: 'var(--text-tertiary)' }}>Order ID:</span>
                                                                    <span className="truncate" title={r.originalRow.OrderId} style={{ fontFamily: 'monospace', fontSize: '0.8rem' }}>{r.originalRow.OrderId || '-'}</span>

                                                                    <span style={{ color: 'var(--text-tertiary)' }}>Sku ID:</span>
                                                                    <span className="truncate" title={r.originalRow.SkuId} style={{ fontFamily: 'monospace', fontSize: '0.8rem' }}>{r.originalRow.SkuId}</span>

                                                                    <span style={{ color: 'var(--text-tertiary)' }}>Start Date:</span>
                                                                    <span>{r.originalRow.SubscriptionStartDate ? new Date(r.originalRow.SubscriptionStartDate).toLocaleDateString() : '-'}</span>
                                                                </div>
                                                            </div>

                                                            <div className="glass-panel" style={{ gridColumn: '1 / -1', padding: '0.75rem', background: 'rgba(255,255,255,0.5)' }}>
                                                                <h4 style={{ marginTop: 0, marginBottom: '0.5rem', color: 'var(--text-secondary)' }}>Term Details</h4>
                                                                <div>{r.term}</div>
                                                            </div>
                                                        </div>
                                                    </td>
                                                </tr>
                                            )}
                                        </React.Fragment>
                                    ))}
                                </tbody>
                            </table>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};
