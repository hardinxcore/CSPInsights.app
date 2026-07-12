import React, { useMemo } from 'react';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
} from 'recharts';
import { ArrowLeft, User } from 'lucide-react';
import type { EarningRecord } from '../../types/EarningsData';
import { RecordsTable } from './RecordsTable';
import { CHART_COLORS, axisStyle, gridStyle, tooltipStyle, fmt, fmtShort, truncate } from './shared';

// ── Customer detail view ──────────────────────────────────────────────────────
export const CustomerDetail: React.FC<{
    customerName: string;
    records: EarningRecord[];
    currency: string;
    onBack: () => void;
}> = ({ customerName, records, currency, onBack }) => {
    const total = records.reduce((s, r) => s + r.earningAmount, 0);
    const byProduct = useMemo(() => {
        const map = new Map<string, number>();
        records.forEach(r => { if (r.productName) map.set(r.productName, (map.get(r.productName) || 0) + r.earningAmount); });
        return Array.from(map.entries()).map(([name, amount]) => ({ name, shortName: truncate(name, 30), amount })).sort((a, b) => b.amount - a.amount);
    }, [records]);
    const byLever = useMemo(() => {
        const map = new Map<string, number>();
        records.forEach(r => { if (r.lever) map.set(r.lever, (map.get(r.lever) || 0) + r.earningAmount); });
        return Array.from(map.entries()).map(([lever, amount]) => ({ lever, shortLever: truncate(lever, 28), amount })).sort((a, b) => b.amount - a.amount);
    }, [records]);

    return (
        <div className="animate-fade-in">
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '2rem' }}>
                <button onClick={onBack} className="secondary-btn"
                    style={{ borderRadius: '50%', width: 40, height: 40, padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <ArrowLeft size={20} />
                </button>
                <div style={{ background: 'rgba(16,185,129,0.12)', padding: '0.75rem', borderRadius: '12px', color: '#10B981', flexShrink: 0 }}>
                    <User size={24} />
                </div>
                <div style={{ minWidth: 0 }}>
                    <h2 style={{ margin: 0, fontSize: '1.4rem', fontWeight: 700 }} className="text-gradient" title={customerName}>{customerName}</h2>
                    <div style={{ color: 'var(--text-tertiary)', marginTop: '0.2rem', fontSize: '0.85rem' }}>
                        {records.length} records · {fmt(total, currency)} total earnings
                    </div>
                </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(380px, 1fr))', gap: '1.5rem', marginBottom: '1.5rem' }}>
                <div className="glass-panel" style={{ padding: '1.5rem', border: '1px solid var(--border-color)' }}>
                    <h3 style={{ margin: '0 0 1.25rem', fontSize: '1rem', fontWeight: 600, color: 'var(--text-primary)' }}>By Product</h3>
                    <ResponsiveContainer width="100%" height={Math.max(180, byProduct.length * 40)}>
                        <BarChart data={byProduct} layout="vertical" margin={{ left: 0, right: 20, top: 4, bottom: 4 }}>
                            <CartesianGrid {...gridStyle} horizontal={false} />
                            <XAxis type="number" tickFormatter={v => fmtShort(v, currency)} tick={axisStyle} />
                            <YAxis type="category" dataKey="shortName" width={190} tick={axisStyle} />
                            <Tooltip formatter={(v: any) => [fmt(v, currency), 'Earnings']} {...tooltipStyle} />
                            <Bar dataKey="amount" radius={[0, 4, 4, 0]}>
                                {byProduct.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                            </Bar>
                        </BarChart>
                    </ResponsiveContainer>
                </div>

                <div className="glass-panel" style={{ padding: '1.5rem', border: '1px solid var(--border-color)' }}>
                    <h3 style={{ margin: '0 0 1.25rem', fontSize: '1rem', fontWeight: 600, color: 'var(--text-primary)' }}>By Lever</h3>
                    <ResponsiveContainer width="100%" height={Math.max(180, byLever.length * 40)}>
                        <BarChart data={byLever} layout="vertical" margin={{ left: 0, right: 20, top: 4, bottom: 4 }}>
                            <CartesianGrid {...gridStyle} horizontal={false} />
                            <XAxis type="number" tickFormatter={v => fmtShort(v, currency)} tick={axisStyle} />
                            <YAxis type="category" dataKey="shortLever" width={190} tick={axisStyle} />
                            <Tooltip formatter={(v: any) => [fmt(v, currency), 'Earnings']} {...tooltipStyle} />
                            <Bar dataKey="amount" radius={[0, 4, 4, 0]}>
                                {byLever.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                            </Bar>
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            </div>

            <div className="glass-panel" style={{ border: '1px solid var(--border-color)' }}>
                <div style={{ padding: '1rem 1.25rem', borderBottom: '1px solid var(--border-color)', fontWeight: 600, color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                    All Records
                </div>
                <RecordsTable records={records} currency={currency} />
            </div>
        </div>
    );
};
