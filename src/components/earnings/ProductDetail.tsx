import React, { useMemo } from 'react';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
} from 'recharts';
import { ArrowLeft, Package } from 'lucide-react';
import type { EarningRecord } from '../../types/EarningsData';
import { RecordsTable } from './RecordsTable';
import { CHART_COLORS, axisStyle, gridStyle, tooltipStyle, fmt, fmtShort } from './shared';

// ── Product detail view ───────────────────────────────────────────────────────
export const ProductDetail: React.FC<{
    productName: string;
    records: EarningRecord[];
    currency: string;
    onBack: () => void;
}> = ({ productName, records, currency, onBack }) => {
    const byCustomer = useMemo(() => {
        const map = new Map<string, number>();
        records.forEach(r => { if (r.customerName) map.set(r.customerName, (map.get(r.customerName) || 0) + r.earningAmount); });
        return Array.from(map.entries()).map(([name, amount]) => ({ name, amount })).sort((a, b) => b.amount - a.amount).slice(0, 12);
    }, [records]);
    const lever = records[0]?.lever || '';
    const avgRate = records.length > 0 ? records.reduce((s, r) => s + r.earningRate, 0) / records.length : 0;

    return (
        <div className="animate-fade-in">
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '2rem' }}>
                <button onClick={onBack} className="secondary-btn"
                    style={{ borderRadius: '50%', width: 40, height: 40, padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <ArrowLeft size={20} />
                </button>
                <div style={{ background: 'rgba(0,181,226,0.12)', padding: '0.75rem', borderRadius: '12px', color: 'var(--brand-turquoise)', flexShrink: 0 }}>
                    <Package size={24} />
                </div>
                <div style={{ minWidth: 0 }}>
                    <h2 style={{ margin: 0, fontSize: '1.4rem', fontWeight: 700 }} className="text-gradient" title={productName}>{productName}</h2>
                    <div style={{ color: 'var(--text-tertiary)', marginTop: '0.2rem', fontSize: '0.85rem' }}>
                        {new Set(records.map(r => r.customerName)).size} customers · {records.length} records · avg {avgRate.toFixed(2)}% earning rate
                        {lever && <> · <span style={{ color: 'var(--text-secondary)' }}>{lever}</span></>}
                    </div>
                </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(380px, 1fr))', gap: '1.5rem', marginBottom: '1.5rem' }}>
                <div className="glass-panel" style={{ padding: '1.5rem', border: '1px solid var(--border-color)', gridColumn: '1 / -1' }}>
                    <h3 style={{ margin: '0 0 1.25rem', fontSize: '1rem', fontWeight: 600, color: 'var(--text-primary)' }}>Earnings by Customer</h3>
                    <ResponsiveContainer width="100%" height={220}>
                        <BarChart data={byCustomer} margin={{ left: 10, right: 20, top: 4, bottom: 60 }}>
                            <CartesianGrid {...gridStyle} />
                            <XAxis dataKey="name" tick={{ ...axisStyle, textAnchor: 'end' }} angle={-35} interval={0} />
                            <YAxis tickFormatter={v => fmtShort(v, currency)} tick={axisStyle} width={70} />
                            <Tooltip formatter={(v: any) => [fmt(v, currency), 'Earnings']} {...tooltipStyle} />
                            <Bar dataKey="amount" radius={[4, 4, 0, 0]}>
                                {byCustomer.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
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
