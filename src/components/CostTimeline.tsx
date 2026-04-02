import React, { useMemo, useState } from 'react';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
    AreaChart, Area, Cell,
} from 'recharts';
import { useBillingStore } from '../store/billingStore';
import type { BillingRecord } from '../types/BillingData';
import { TrendingUp, TrendingDown, Minus, ChevronUp, ChevronDown, X } from 'lucide-react';

// ── Category detection ─────────────────────────────────────────────────────────

type Category = 'Azure' | 'M365' | 'Dynamics' | 'Marketplace' | 'Other';

const CAT_COLORS: Record<Category, string> = {
    Azure:       '#00B5E2',
    M365:        '#10B981',
    Dynamics:    '#8B5CF6',
    Marketplace: '#F59E0B',
    Other:       '#6B7280',
};

const CATEGORIES: Category[] = ['M365', 'Azure', 'Dynamics', 'Marketplace', 'Other'];

function categorize(row: BillingRecord): Category {
    const product  = (row.ProductName    || '').toLowerCase();
    const publisher = (row.PublisherName || '').toLowerCase();

    // Usage-based (Azure) rows always have a MeterId or MeterCategory
    if (row.MeterId || row.MeterCategory) return 'Azure';
    if (product.includes('azure'))        return 'Azure';

    // ISV / Marketplace — non-Microsoft publisher
    if (publisher && publisher !== 'microsoft' && publisher !== 'microsoft corporation') return 'Marketplace';

    // Dynamics / Power Platform
    if (product.includes('dynamics') || product.includes('d365')
        || product.includes('power platform') || product.includes('power apps')
        || product.includes('power automate') || product.includes('power bi')
        || product.includes('power virtual') || product.includes('power pages'))
        return 'Dynamics';

    // M365 / Modern Work
    if (product.includes('microsoft 365') || product.includes('office 365')
        || product.includes('teams') || product.includes('exchange')
        || product.includes('sharepoint') || product.includes('defender')
        || product.includes('intune') || product.includes('entra')
        || product.includes('windows') || product.includes('visio')
        || product.includes('project online'))
        return 'M365';

    return 'Other';
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function rowValue(r: BillingRecord): number {
    return r.Total ?? r.Subtotal ?? 0;
}

function parseMonth(dateStr: string): string | null {
    if (!dateStr) return null;
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return null;
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function parseDay(dateStr: string): string | null {
    if (!dateStr) return null;
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return null;
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function monthLabel(ym: string): string {
    const [y, m] = ym.split('-');
    return new Date(Number(y), Number(m) - 1, 1).toLocaleDateString('en-GB', { month: 'short', year: 'numeric' });
}

function fmt(v: number, currency = 'EUR'): string {
    return v.toLocaleString('nl-NL', { style: 'currency', currency, minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

function fmtShort(v: number, _currency = 'EUR'): string {
    if (Math.abs(v) >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
    if (Math.abs(v) >= 1_000)     return `${(v / 1_000).toFixed(0)}k`;
    return v.toFixed(0);
}

const axisStyle  = { fontSize: 11, fill: 'var(--text-tertiary)' };
const gridStyle  = { stroke: 'var(--border-color)', strokeDasharray: '3 3' };
const tooltipStyle = {
    contentStyle: { background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: '8px', fontSize: '0.82rem', color: 'var(--text-primary)' },
    labelStyle:   { color: 'var(--text-primary)', fontWeight: 600 },
    itemStyle:    { color: 'var(--text-secondary)' },
    cursor:       { fill: 'var(--bg-tertiary)' },
};

// ── Types ──────────────────────────────────────────────────────────────────────

interface MonthBucket {
    month: string;
    label: string;
    Azure: number; M365: number; Dynamics: number; Marketplace: number; Other: number;
    total: number;
}

interface DayBucket {
    day: string;
    label: string;
    total: number;
}

// ── Sub-components ─────────────────────────────────────────────────────────────

const SummaryCard: React.FC<{ label: string; value: string; sub?: string; color?: string; icon?: React.ReactNode }> = ({ label, value, sub, color = 'var(--text-primary)', icon }) => (
    <div style={{ background: 'var(--bg-secondary)', borderRadius: '12px', padding: '1rem 1.25rem', border: '1px solid var(--border-color)', display: 'flex', gap: '0.75rem', alignItems: 'flex-start' }}>
        {icon && <div style={{ color, marginTop: '0.1rem', flexShrink: 0 }}>{icon}</div>}
        <div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', marginBottom: '0.25rem' }}>{label}</div>
            <div style={{ fontSize: '1.3rem', fontWeight: 700, color, lineHeight: 1 }}>{value}</div>
            {sub && <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>{sub}</div>}
        </div>
    </div>
);

// ── Main Component ─────────────────────────────────────────────────────────────

export const CostTimeline: React.FC = () => {
    const { data } = useBillingStore();

    const [selectedMonth, setSelectedMonth] = useState<string | null>(null);
    const [search, setSearch] = useState('');
    const [sort, setSort] = useState<{ key: keyof BillingRecord | 'value'; dir: 'asc' | 'desc' }>({ key: 'value', dir: 'desc' });

    const currency = useMemo(() => data.find(r => r.Currency)?.Currency ?? data.find(r => r.PricingCurrency)?.PricingCurrency ?? 'EUR', [data]);

    // ── Monthly aggregation ────────────────────────────────────────────────────
    const { months, recordsByMonth } = useMemo(() => {
        const buckets = new Map<string, MonthBucket>();
        const byMonth = new Map<string, BillingRecord[]>();

        for (const row of data) {
            const month = parseMonth(row.ChargeStartDate);
            if (!month) continue;

            if (!buckets.has(month)) {
                buckets.set(month, { month, label: monthLabel(month), Azure: 0, M365: 0, Dynamics: 0, Marketplace: 0, Other: 0, total: 0 });
                byMonth.set(month, []);
            }
            const b = buckets.get(month)!;
            const v = rowValue(row);
            const cat = categorize(row);
            b[cat] += v;
            b.total += v;
            byMonth.get(month)!.push(row);
        }

        const sorted = Array.from(buckets.values()).sort((a, b) => a.month.localeCompare(b.month));
        return { months: sorted, recordsByMonth: byMonth };
    }, [data]);

    // ── Daily breakdown for selected month ────────────────────────────────────
    const dailyData = useMemo<DayBucket[]>(() => {
        if (!selectedMonth) return [];
        const rows = recordsByMonth.get(selectedMonth) ?? [];
        const buckets = new Map<string, number>();
        for (const row of rows) {
            const day = parseDay(row.ChargeStartDate);
            if (!day) continue;
            buckets.set(day, (buckets.get(day) ?? 0) + rowValue(row));
        }
        return Array.from(buckets.entries())
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([day, total]) => ({
                day,
                label: new Date(day).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }),
                total,
            }));
    }, [selectedMonth, recordsByMonth]);

    // ── Top customers for selected month ──────────────────────────────────────
    const topCustomers = useMemo(() => {
        const rows = selectedMonth ? (recordsByMonth.get(selectedMonth) ?? []) : [];
        const map = new Map<string, number>();
        for (const row of rows) map.set(row.CustomerName, (map.get(row.CustomerName) ?? 0) + rowValue(row));
        return Array.from(map.entries())
            .sort(([, a], [, b]) => b - a)
            .slice(0, 8)
            .map(([name, value]) => ({ name, value }));
    }, [selectedMonth, recordsByMonth]);

    // ── Records table for selected month ──────────────────────────────────────
    const tableRows = useMemo(() => {
        const rows = selectedMonth ? (recordsByMonth.get(selectedMonth) ?? []) : [];
        const s = search.toLowerCase();
        const filtered = s
            ? rows.filter(r => r.CustomerName.toLowerCase().includes(s) || r.ProductName.toLowerCase().includes(s))
            : rows;
        return [...filtered].sort((a, b) => {
            if (sort.key === 'value') {
                const av = rowValue(a), bv = rowValue(b);
                return sort.dir === 'asc' ? av - bv : bv - av;
            }
            const av = String((a as any)[sort.key] ?? '');
            const bv = String((b as any)[sort.key] ?? '');
            return sort.dir === 'asc' ? av.localeCompare(bv) : bv.localeCompare(av);
        });
    }, [selectedMonth, recordsByMonth, search, sort]);

    // ── Summary stats ──────────────────────────────────────────────────────────
    const stats = useMemo(() => {
        if (!months.length) return null;
        const last = months[months.length - 1];
        const prev = months.length > 1 ? months[months.length - 2] : null;
        const mom = prev && prev.total > 0 ? ((last.total - prev.total) / prev.total) * 100 : null;
        const avg = months.reduce((s, m) => s + m.total, 0) / months.length;
        const peak = months.reduce((best, m) => m.total > best.total ? m : best, months[0]);
        return { last, prev, mom, avg, peak };
    }, [months]);

    const toggleSort = (key: typeof sort.key) => {
        setSort(s => s.key === key ? { key, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'desc' });
    };

    const SortIcon = ({ col }: { col: typeof sort.key }) =>
        sort.key === col
            ? sort.dir === 'asc' ? <ChevronUp size={12} /> : <ChevronDown size={12} />
            : <span style={{ opacity: 0.3 }}><ChevronDown size={12} /></span>;

    // ── Empty state ────────────────────────────────────────────────────────────
    if (!data.length) return (
        <div style={{ padding: '4rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
            <TrendingUp size={48} style={{ margin: '0 auto 1rem', opacity: 0.3, display: 'block' }} />
            <p>Load billing data to view the cost timeline.</p>
        </div>
    );

    const selectedData = selectedMonth ? months.find(m => m.month === selectedMonth) : null;
    const hasDailyData = dailyData.length > 1;

    return (
        <div style={{ padding: '1.5rem', maxWidth: '1400px', margin: '0 auto' }}>

            {/* Summary cards */}
            {stats && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
                    <SummaryCard
                        label="Latest Month"
                        value={fmt(stats.last.total, currency)}
                        sub={stats.last.label}
                        color="var(--text-primary)"
                        icon={<TrendingUp size={20} />}
                    />
                    <SummaryCard
                        label="Month-over-Month"
                        value={stats.mom != null ? `${stats.mom >= 0 ? '+' : ''}${stats.mom.toFixed(1)}%` : '—'}
                        sub={stats.prev ? `vs ${stats.prev.label}` : 'No previous month'}
                        color={stats.mom == null ? 'var(--text-secondary)' : stats.mom > 5 ? '#FE5000' : stats.mom < -5 ? '#10B981' : 'var(--text-primary)'}
                        icon={stats.mom == null ? <Minus size={20} /> : stats.mom >= 0 ? <TrendingUp size={20} /> : <TrendingDown size={20} />}
                    />
                    <SummaryCard
                        label="Monthly Average"
                        value={fmt(stats.avg, currency)}
                        sub={`Over ${months.length} month${months.length > 1 ? 's' : ''}`}
                        icon={<Minus size={20} />}
                    />
                    <SummaryCard
                        label="Peak Month"
                        value={fmt(stats.peak.total, currency)}
                        sub={stats.peak.label}
                        color="#F59E0B"
                        icon={<TrendingUp size={20} />}
                    />
                </div>
            )}

            {/* Monthly stacked bar chart */}
            <div style={{ background: 'var(--bg-secondary)', borderRadius: '12px', border: '1px solid var(--border-color)', padding: '1.25rem', marginBottom: '1rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                    <div>
                        <div style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '0.95rem' }}>Monthly Cost Breakdown</div>
                        <div style={{ fontSize: '0.78rem', color: 'var(--text-tertiary)', marginTop: '0.15rem' }}>Click a bar to drill into that month</div>
                    </div>
                    {/* Legend */}
                    <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                        {CATEGORIES.map(cat => (
                            <div key={cat} style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                                <span style={{ width: 10, height: 10, borderRadius: '2px', background: CAT_COLORS[cat], display: 'inline-block' }} />
                                {cat}
                            </div>
                        ))}
                    </div>
                </div>
                <ResponsiveContainer width="100%" height={260}>
                    <BarChart data={months} barCategoryGap="25%" onClick={e => {
                        if (e?.activeLabel) {
                            const m = months.find(x => x.label === e.activeLabel);
                            if (m) setSelectedMonth(selectedMonth === m.month ? null : m.month);
                        }
                    }}>
                        <CartesianGrid {...gridStyle} />
                        <XAxis dataKey="label" tick={axisStyle} />
                        <YAxis tickFormatter={v => fmtShort(v, currency)} tick={axisStyle} width={65} />
                        <Tooltip
                            {...tooltipStyle}
                            formatter={(v: any, name: any) => [fmt(v, currency), name]}
                        />
                        {CATEGORIES.map(cat => (
                            <Bar key={cat} dataKey={cat} stackId="a" fill={CAT_COLORS[cat]} radius={cat === 'Other' ? [4, 4, 0, 0] : [0, 0, 0, 0]} cursor="pointer">
                                {months.map((m, i) => (
                                    <Cell
                                        key={i}
                                        fill={CAT_COLORS[cat]}
                                        opacity={selectedMonth && selectedMonth !== m.month ? 0.35 : 1}
                                    />
                                ))}
                            </Bar>
                        ))}
                    </BarChart>
                </ResponsiveContainer>
            </div>

            {/* Selected month drill-down */}
            {selectedMonth && selectedData && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>

                    {/* Month header */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <div>
                            <span style={{ fontWeight: 700, fontSize: '1.05rem', color: 'var(--text-primary)' }}>{selectedData.label}</span>
                            <span style={{ marginLeft: '0.75rem', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                                {fmt(selectedData.total, currency)} · {(recordsByMonth.get(selectedMonth) ?? []).length} records
                            </span>
                        </div>
                        <button onClick={() => setSelectedMonth(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-tertiary)', display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.82rem' }}>
                            <X size={14} /> Clear selection
                        </button>
                    </div>

                    {/* Category breakdown pills */}
                    <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap' }}>
                        {CATEGORIES.filter(cat => selectedData[cat] > 0).map(cat => (
                            <div key={cat} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.3rem 0.75rem', borderRadius: '20px', border: `1px solid ${CAT_COLORS[cat]}44`, background: `${CAT_COLORS[cat]}11`, fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                                <span style={{ width: 8, height: 8, borderRadius: '50%', background: CAT_COLORS[cat], display: 'inline-block' }} />
                                {cat}: <strong style={{ color: 'var(--text-primary)' }}>{fmt(selectedData[cat], currency)}</strong>
                                <span style={{ color: 'var(--text-tertiary)' }}>({((selectedData[cat] / selectedData.total) * 100).toFixed(0)}%)</span>
                            </div>
                        ))}
                    </div>

                    {/* Daily chart + top customers side by side */}
                    <div style={{ display: 'grid', gridTemplateColumns: hasDailyData ? '1fr 340px' : '1fr', gap: '1rem' }}>

                        {hasDailyData && (
                            <div style={{ background: 'var(--bg-secondary)', borderRadius: '12px', border: '1px solid var(--border-color)', padding: '1.25rem' }}>
                                <div style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '0.9rem', marginBottom: '1rem' }}>Daily Costs — {selectedData.label}</div>
                                <ResponsiveContainer width="100%" height={200}>
                                    <AreaChart data={dailyData}>
                                        <defs>
                                            <linearGradient id="dailyGrad" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="5%"  stopColor="#00B5E2" stopOpacity={0.25} />
                                                <stop offset="95%" stopColor="#00B5E2" stopOpacity={0} />
                                            </linearGradient>
                                        </defs>
                                        <CartesianGrid {...gridStyle} />
                                        <XAxis dataKey="label" tick={{ ...axisStyle, fontSize: 10 }} interval="preserveStartEnd" />
                                        <YAxis tickFormatter={v => fmtShort(v, currency)} tick={axisStyle} width={65} />
                                        <Tooltip {...tooltipStyle} formatter={(v: any) => [fmt(v, currency), 'Cost']} />
                                        <Area type="monotone" dataKey="total" stroke="#00B5E2" strokeWidth={2} fill="url(#dailyGrad)" dot={false} />
                                    </AreaChart>
                                </ResponsiveContainer>
                            </div>
                        )}

                        {/* Top customers */}
                        {topCustomers.length > 0 && (
                            <div style={{ background: 'var(--bg-secondary)', borderRadius: '12px', border: '1px solid var(--border-color)', padding: '1.25rem' }}>
                                <div style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '0.9rem', marginBottom: '0.85rem' }}>Top Customers</div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                    {topCustomers.map((c, i) => {
                                        const pct = selectedData.total > 0 ? (c.value / selectedData.total) * 100 : 0;
                                        return (
                                            <div key={c.name}>
                                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem', marginBottom: '0.2rem' }}>
                                                    <span style={{ color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '60%' }}>{c.name}</span>
                                                    <span style={{ color: 'var(--text-secondary)', flexShrink: 0 }}>{fmt(c.value, currency)}</span>
                                                </div>
                                                <div style={{ height: 4, borderRadius: 2, background: 'var(--bg-tertiary)', overflow: 'hidden' }}>
                                                    <div style={{ height: '100%', width: `${pct}%`, background: `hsl(${(i * 47) % 360}, 65%, 55%)`, borderRadius: 2, transition: 'width 0.4s ease' }} />
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Records table */}
                    <div style={{ background: 'var(--bg-secondary)', borderRadius: '12px', border: '1px solid var(--border-color)', overflow: 'hidden' }}>
                        <div style={{ padding: '0.75rem 1rem', borderBottom: '1px solid var(--border-color)', display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                            <input
                                type="text"
                                placeholder="Filter customer or product..."
                                value={search}
                                onChange={e => setSearch(e.target.value)}
                                style={{ flex: 1, padding: '0.35rem 0.7rem', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'var(--bg-tertiary)', color: 'var(--text-primary)', fontSize: '0.83rem' }}
                            />
                            <span style={{ fontSize: '0.78rem', color: 'var(--text-tertiary)', whiteSpace: 'nowrap' }}>
                                {tableRows.length} record{tableRows.length !== 1 ? 's' : ''}
                            </span>
                        </div>

                        {/* Table header */}
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto auto auto', gap: '0.5rem', padding: '0.5rem 0.75rem', background: 'var(--bg-tertiary)', borderBottom: '1px solid var(--border-color)', fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-tertiary)', letterSpacing: '0.04em' }}>
                            {([
                                ['CustomerName', 'Customer'],
                                ['ProductName', 'Product'],
                                ['ChargeType', 'Type'],
                                ['ChargeStartDate', 'Date'],
                                ['value', 'Amount'],
                            ] as const).map(([key, label]) => (
                                <div key={key} onClick={() => toggleSort(key as any)}
                                    style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.25rem', userSelect: 'none',
                                        justifyContent: key === 'value' || key === 'ChargeType' || key === 'ChargeStartDate' ? 'flex-end' : 'flex-start' }}>
                                    {label} <SortIcon col={key as any} />
                                </div>
                            ))}
                        </div>

                        {/* Table body — capped at 200 rows for performance */}
                        <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
                            {tableRows.slice(0, 200).map((row, i) => (
                                <div key={`${row.SubscriptionId}-${row.ChargeStartDate}-${i}`}
                                    style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto auto auto', gap: '0.5rem', padding: '0.5rem 0.75rem', borderBottom: '1px solid var(--border-color)', fontSize: '0.82rem', background: i % 2 === 0 ? 'transparent' : 'var(--bg-tertiary)' }}>
                                    <div style={{ color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{row.CustomerName}</div>
                                    <div style={{ color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{row.ProductName}</div>
                                    <div style={{ color: 'var(--text-tertiary)', textAlign: 'right', whiteSpace: 'nowrap', fontSize: '0.75rem' }}>{row.ChargeType ?? '—'}</div>
                                    <div style={{ color: 'var(--text-tertiary)', textAlign: 'right', whiteSpace: 'nowrap', fontSize: '0.75rem' }}>
                                        {row.ChargeStartDate ? new Date(row.ChargeStartDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }) : '—'}
                                    </div>
                                    <div style={{ color: 'var(--text-primary)', fontWeight: 600, textAlign: 'right', whiteSpace: 'nowrap' }}>{fmt(rowValue(row), currency)}</div>
                                </div>
                            ))}
                            {tableRows.length > 200 && (
                                <div style={{ padding: '0.75rem', textAlign: 'center', fontSize: '0.78rem', color: 'var(--text-tertiary)' }}>
                                    Showing first 200 of {tableRows.length} records — use the filter to narrow down
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
