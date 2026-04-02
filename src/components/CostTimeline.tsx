import React, { useMemo, useState, useEffect, useRef } from 'react';
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
    const product   = (row.ProductName    || '').toLowerCase();
    const publisher = (row.PublisherName  || '').toLowerCase();
    if (row.MeterId || row.MeterCategory) return 'Azure';
    if (product.includes('azure'))        return 'Azure';
    if (publisher && publisher !== 'microsoft' && publisher !== 'microsoft corporation') return 'Marketplace';
    if (product.includes('dynamics') || product.includes('d365')
        || product.includes('power platform') || product.includes('power apps')
        || product.includes('power automate') || product.includes('power bi')
        || product.includes('power virtual') || product.includes('power pages'))
        return 'Dynamics';
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

function rowValue(r: BillingRecord): number { return r.Total ?? r.Subtotal ?? 0; }

function parseMonth(d: string): string | null {
    if (!d) return null;
    const dt = new Date(d);
    if (isNaN(dt.getTime())) return null;
    return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}`;
}

function parseDay(d: string): string | null {
    if (!d) return null;
    const dt = new Date(d);
    if (isNaN(dt.getTime())) return null;
    return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
}

function monthLabel(ym: string): string {
    const [y, m] = ym.split('-');
    return new Date(Number(y), Number(m) - 1, 1).toLocaleDateString('en-GB', { month: 'short', year: 'numeric' });
}

function fmt(v: number, currency = 'EUR'): string {
    return v.toLocaleString('nl-NL', { style: 'currency', currency, minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

function fmtShort(v: number): string {
    if (Math.abs(v) >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
    if (Math.abs(v) >= 1_000)     return `${(v / 1_000).toFixed(0)}k`;
    return v.toFixed(0);
}

function fmtDate(s: string | undefined): string {
    if (!s) return '—';
    const d = new Date(s);
    return isNaN(d.getTime()) ? s : d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

const axisStyle   = { fontSize: 11, fill: 'var(--text-tertiary)' };
const gridStyle   = { stroke: 'var(--border-color)', strokeDasharray: '3 3' };
const tooltipStyle = {
    contentStyle: { background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: '8px', fontSize: '0.82rem', color: 'var(--text-primary)' },
    labelStyle:   { color: 'var(--text-primary)', fontWeight: 600 },
    itemStyle:    { color: 'var(--text-secondary)' },
    cursor:       { fill: 'var(--bg-tertiary)' },
};

// ── Types ──────────────────────────────────────────────────────────────────────

interface MonthBucket {
    month: string; label: string;
    Azure: number; M365: number; Dynamics: number; Marketplace: number; Other: number;
    total: number;
}

interface DayBucket { day: string; label: string; total: number; }

// ── Sub-components ─────────────────────────────────────────────────────────────

const SummaryCard: React.FC<{ label: string; value: string; sub?: string; color?: string; icon?: React.ReactNode }> =
    ({ label, value, sub, color = 'var(--text-primary)', icon }) => (
    <div style={{ background: 'var(--bg-secondary)', borderRadius: '12px', padding: '1rem 1.25rem', border: '1px solid var(--border-color)', display: 'flex', gap: '0.75rem', alignItems: 'flex-start' }}>
        {icon && <div style={{ color, marginTop: '0.1rem', flexShrink: 0 }}>{icon}</div>}
        <div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', marginBottom: '0.25rem' }}>{label}</div>
            <div style={{ fontSize: '1.3rem', fontWeight: 700, color, lineHeight: 1 }}>{value}</div>
            {sub && <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>{sub}</div>}
        </div>
    </div>
);

// ── Dual Range Slider ──────────────────────────────────────────────────────────
// Uses a single pointer-capture hit area instead of two overlapping <input>
// elements, which avoids the z-index race that makes the start handle unreachable.

const DualRangeSlider: React.FC<{
    min: number; max: number;
    start: number; end: number;
    onStartChange: (v: number) => void;
    onEndChange:   (v: number) => void;
    labels: string[];
}> = ({ min, max, start, end, onStartChange, onEndChange, labels }) => {
    const trackRef  = useRef<HTMLDivElement>(null);
    const dragging  = useRef<'start' | 'end' | null>(null);
    const range     = max - min || 1;
    const startPct  = ((start - min) / range) * 100;
    const endPct    = ((end   - min) / range) * 100;

    const valueFromClient = (clientX: number): number => {
        const rect = trackRef.current!.getBoundingClientRect();
        const pct  = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
        return Math.round(min + pct * range);
    };

    const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
        e.currentTarget.setPointerCapture(e.pointerId);
        const val        = valueFromClient(e.clientX);
        const distStart  = Math.abs(val - start);
        const distEnd    = Math.abs(val - end);
        // When equidistant prefer start if moving left, end if moving right
        dragging.current = distStart <= distEnd ? 'start' : 'end';
        if (dragging.current === 'start' && val <= end)   onStartChange(val);
        if (dragging.current === 'end'   && val >= start) onEndChange(val);
    };

    const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
        if (!dragging.current || !(e.buttons & 1)) return;
        const val = valueFromClient(e.clientX);
        if (dragging.current === 'start' && val <= end)   onStartChange(val);
        if (dragging.current === 'end'   && val >= start) onEndChange(val);
    };

    const handlePointerUp = () => { dragging.current = null; };

    const handleStyle: React.CSSProperties = {
        position: 'absolute', top: '50%', width: 16, height: 16, borderRadius: '50%',
        background: 'var(--accent-primary, #6366F1)', border: '2.5px solid var(--bg-secondary)',
        transform: 'translate(-50%, -50%)', pointerEvents: 'none',
        boxShadow: '0 1px 5px rgba(0,0,0,0.25)', transition: 'left 0.04s',
    };

    return (
        <div>
            <div ref={trackRef}
                onPointerDown={handlePointerDown}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
                style={{ position: 'relative', height: '28px', margin: '0 8px', cursor: 'pointer', touchAction: 'none' }}
            >
                {/* Base track */}
                <div style={{ position: 'absolute', top: '50%', left: 0, right: 0, height: 4, background: 'var(--bg-tertiary)', borderRadius: 2, transform: 'translateY(-50%)', border: '1px solid var(--border-color)' }} />
                {/* Highlighted range */}
                <div style={{ position: 'absolute', top: '50%', left: `${startPct}%`, width: `${endPct - startPct}%`, height: 4, background: 'var(--accent-primary, #6366F1)', borderRadius: 2, transform: 'translateY(-50%)' }} />
                {/* Start handle */}
                <div style={{ ...handleStyle, left: `${startPct}%` }} />
                {/* End handle */}
                <div style={{ ...handleStyle, left: `${endPct}%` }} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '0.35rem' }}>
                <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', fontWeight: 600 }}>{labels[start]}</span>
                {start !== end && <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', fontWeight: 600 }}>{labels[end]}</span>}
            </div>
        </div>
    );
};

// ── Record Detail Panel ────────────────────────────────────────────────────────

const RecordDetail: React.FC<{ row: BillingRecord; currency: string }> = ({ row, currency }) => {
    const fields: [string, string | number | undefined][] = [
        ['Customer',           row.CustomerName],
        ['Customer ID',        row.CustomerId],
        ['Domain',             row.CustomerDomainName],
        ['Product',            row.ProductName],
        ['SKU',                row.SkuName],
        ['SKU ID',             row.SkuId],
        ['Publisher',          row.PublisherName],
        ['Subscription',       row.SubscriptionDescription],
        ['Subscription ID',    row.SubscriptionId],
        ['Term',               row.TermAndBillingCycle],
        ['Charge Type',        row.ChargeType],
        ['Charge Start',       fmtDate(row.ChargeStartDate)],
        ['Charge End',         fmtDate(row.ChargeEndDate)],
        ['Order Date',         fmtDate(row.OrderDate)],
        ['Quantity',           row.Quantity],
        ['Billable Qty',       row.BillableQuantity],
        ['Unit Price',         row.UnitPrice != null ? fmt(row.UnitPrice, currency) : undefined],
        ['Eff. Unit Price',    row.EffectiveUnitPrice != null ? fmt(row.EffectiveUnitPrice, currency) : undefined],
        ['Subtotal',           row.Subtotal != null ? fmt(row.Subtotal, currency) : undefined],
        ['Tax',                row.TaxTotal != null ? fmt(row.TaxTotal, currency) : undefined],
        ['Total',              row.Total != null ? fmt(row.Total, currency) : undefined],
        ['Invoice #',          row.InvoiceNumber],
        ['Order ID',           row.OrderId],
        ['Meter',              row.MeterName],
        ['Meter Category',     row.MeterCategory],
    ];

    return (
        <div style={{ padding: '0.75rem 1rem', background: 'rgba(99,102,241,0.04)', borderTop: '1px solid var(--border-color)', fontSize: '0.8rem' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '0.45rem 1rem' }}>
                {fields.filter(([, v]) => v != null && v !== '' && v !== '—').map(([label, val]) => (
                    <div key={label}>
                        <span style={{ color: 'var(--text-tertiary)', display: 'block', fontSize: '0.7rem', marginBottom: '0.1rem' }}>{label}</span>
                        <span style={{ color: 'var(--text-primary)', wordBreak: 'break-all' }}>{String(val)}</span>
                    </div>
                ))}
            </div>
        </div>
    );
};

// ── Main Component ─────────────────────────────────────────────────────────────

export const CostTimeline: React.FC = () => {
    const { data } = useBillingStore();

    const [granularity,   setGranularity]  = useState<'month' | 'day'>('month');
    const [rangeStart,    setRangeStart]    = useState(0);
    const [rangeEnd,      setRangeEnd]      = useState(0);
    const [rangeReady,    setRangeReady]    = useState(false);
    const [selectedMonth, setSelectedMonth] = useState<string | null>(null);
    const [search,        setSearch]        = useState('');
    const [sort,          setSort]          = useState<{ key: string; dir: 'asc' | 'desc' }>({ key: 'value', dir: 'desc' });
    const [expandedRow,   setExpandedRow]   = useState<string | null>(null);

    const currency = useMemo(() =>
        data.find(r => r.Currency)?.Currency ?? data.find(r => r.PricingCurrency)?.PricingCurrency ?? 'EUR',
        [data]);

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
            b[categorize(row)] += v;
            b.total += v;
            byMonth.get(month)!.push(row);
        }
        const sorted = Array.from(buckets.values()).sort((a, b) => a.month.localeCompare(b.month));
        return { months: sorted, recordsByMonth: byMonth };
    }, [data]);

    // ── Daily aggregation ─────────────────────────────────────────────────────
    const { days, recordsByDay } = useMemo(() => {
        const buckets = new Map<string, { day: string; label: string; total: number; records: BillingRecord[] }>();
        for (const row of data) {
            const day = parseDay(row.ChargeStartDate);
            if (!day) continue;
            if (!buckets.has(day)) {
                const label = new Date(day).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
                buckets.set(day, { day, label, total: 0, records: [] });
            }
            const b = buckets.get(day)!;
            b.total += rowValue(row);
            b.records.push(row);
        }
        const sorted = Array.from(buckets.values()).sort((a, b) => a.day.localeCompare(b.day));
        const byDay  = new Map(sorted.map(b => [b.day, b.records]));
        return { days: sorted, recordsByDay: byDay };
    }, [data]);

    // Initialise range to full span on first load or granularity switch
    useEffect(() => {
        if (!rangeReady && months.length) {
            setRangeStart(0);
            setRangeEnd(months.length - 1);
            setRangeReady(true);
        }
    }, [months, rangeReady]);

    // Reset range when switching granularity
    useEffect(() => {
        setRangeStart(0);
        setRangeEnd(granularity === 'month' ? Math.max(0, months.length - 1) : Math.max(0, days.length - 1));
        setSelectedMonth(null);
        setExpandedRow(null);
    }, [granularity]); // eslint-disable-line react-hooks/exhaustive-deps

    const monthLabels = useMemo(() => months.map(m => m.label), [months]);
    const dayLabels   = useMemo(() => days.map(d => d.label), [days]);

    // Months inside the selected range (month mode)
    const periodMonths = useMemo(
        () => granularity === 'month' ? months.slice(rangeStart, rangeEnd + 1) : [],
        [granularity, months, rangeStart, rangeEnd]);

    // Days inside the selected range (day mode)
    const periodDays = useMemo(
        () => granularity === 'day' ? days.slice(rangeStart, rangeEnd + 1) : [],
        [granularity, days, rangeStart, rangeEnd]);

    // All records in the selected period
    const periodRecords = useMemo(() => {
        if (granularity === 'month') {
            const rows: BillingRecord[] = [];
            for (const m of periodMonths) rows.push(...(recordsByMonth.get(m.month) ?? []));
            return rows;
        } else {
            const rows: BillingRecord[] = [];
            for (const d of periodDays) rows.push(...(recordsByDay.get(d.day) ?? []));
            return rows;
        }
    }, [granularity, periodMonths, periodDays, recordsByMonth, recordsByDay]);

    // Daily chart data — for month drill-down (month mode) or the full period (day mode)
    const dailyData = useMemo<DayBucket[]>(() => {
        if (granularity === 'day') {
            return periodDays.map(d => ({ day: d.day, label: new Date(d.day).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }), total: d.total }));
        }
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
    }, [granularity, selectedMonth, recordsByMonth, periodDays]);

    // Top customers for selected month (drill-down) or full period
    const topCustomers = useMemo(() => {
        const rows = selectedMonth ? (recordsByMonth.get(selectedMonth) ?? []) : periodRecords;
        const map = new Map<string, number>();
        for (const row of rows) map.set(row.CustomerName, (map.get(row.CustomerName) ?? 0) + rowValue(row));
        return Array.from(map.entries()).sort(([, a], [, b]) => b - a).slice(0, 8).map(([name, value]) => ({ name, value }));
    }, [selectedMonth, recordsByMonth, periodRecords]);

    // Records for the table — drill-down month OR full period
    const baseRows = selectedMonth ? (recordsByMonth.get(selectedMonth) ?? []) : periodRecords;
    const tableRows = useMemo(() => {
        const s = search.toLowerCase();
        const filtered = s
            ? baseRows.filter(r => r.CustomerName.toLowerCase().includes(s) || r.ProductName.toLowerCase().includes(s))
            : baseRows;
        return [...filtered].sort((a, b) => {
            if (sort.key === 'value') {
                const av = rowValue(a), bv = rowValue(b);
                return sort.dir === 'asc' ? av - bv : bv - av;
            }
            const av = String((a as any)[sort.key] ?? '');
            const bv = String((b as any)[sort.key] ?? '');
            return sort.dir === 'asc' ? av.localeCompare(bv) : bv.localeCompare(av);
        });
    }, [baseRows, search, sort]);

    // Period summary stats
    const stats = useMemo(() => {
        if (granularity === 'month') {
            if (!periodMonths.length) return null;
            const periodTotal = periodMonths.reduce((s, m) => s + m.total, 0);
            const prev        = rangeStart > 0 ? months[rangeStart - 1] : null;
            const mom         = prev && prev.total > 0 ? ((periodMonths[0].total - prev.total) / prev.total) * 100 : null;
            const avg         = periodTotal / periodMonths.length;
            const peak        = periodMonths.reduce((b, m) => m.total > b.total ? m : b, periodMonths[0]);
            return { periodTotal, mom, avg, avgLabel: 'Monthly Average', peak: { total: peak.total, label: peak.label } };
        } else {
            if (!periodDays.length) return null;
            const periodTotal = periodDays.reduce((s, d) => s + d.total, 0);
            const prev        = rangeStart > 0 ? days[rangeStart - 1] : null;
            const mom         = prev && prev.total > 0 ? ((periodDays[0].total - prev.total) / prev.total) * 100 : null;
            const avg         = periodTotal / periodDays.length;
            const peak        = periodDays.reduce((b, d) => d.total > b.total ? d : b, periodDays[0]);
            return { periodTotal, mom, avg, avgLabel: 'Daily Average', peak: { total: peak.total, label: peak.label } };
        }
    }, [granularity, periodMonths, periodDays, months, days, rangeStart]);

    // Category totals for period
    const periodCatTotals = useMemo(() => {
        const t: Record<Category, number> = { Azure: 0, M365: 0, Dynamics: 0, Marketplace: 0, Other: 0 };
        if (granularity === 'month') {
            for (const m of periodMonths) CATEGORIES.forEach(cat => { t[cat] += m[cat]; });
        } else {
            for (const row of periodRecords) t[categorize(row)] += rowValue(row);
        }
        return t;
    }, [granularity, periodMonths, periodRecords]);

    const toggleSort = (key: string) =>
        setSort(s => s.key === key ? { key, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'desc' });

    const SortIcon = ({ col }: { col: string }) =>
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

    const selectedData  = selectedMonth ? months.find(m => m.month === selectedMonth) : null;
    const hasDailyData  = dailyData.length > 1;
    const periodTotal   = stats?.periodTotal ?? 0;
    const drillTotal    = selectedData?.total ?? 0;
    const displayTotal  = selectedMonth ? drillTotal : periodTotal;

    const sliderMax     = granularity === 'month' ? Math.max(0, months.length - 1) : Math.max(0, days.length - 1);
    const sliderLabels  = granularity === 'month' ? monthLabels : dayLabels;
    const periodCount   = granularity === 'month' ? periodMonths.length : periodDays.length;
    const periodUnit    = granularity === 'month' ? 'month' : 'day';

    return (
        <div style={{ padding: '1.5rem', maxWidth: '1400px', margin: '0 auto' }}>

            {/* ── Period selector ─────────────────────────────────────────── */}
            {sliderMax > 0 && (
                <div style={{ background: 'var(--bg-secondary)', borderRadius: '12px', border: '1px solid var(--border-color)', padding: '1rem 1.25rem', marginBottom: '1rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                            <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary)' }}>Period</span>
                            {/* Granularity toggle */}
                            <div style={{ display: 'flex', background: 'var(--bg-tertiary)', borderRadius: '6px', padding: '2px', border: '1px solid var(--border-color)' }}>
                                {(['month', 'day'] as const).map(g => (
                                    <button key={g} onClick={() => setGranularity(g)} style={{
                                        padding: '0.2rem 0.6rem', borderRadius: '4px', border: 'none', cursor: 'pointer',
                                        fontSize: '0.75rem', fontWeight: 600,
                                        background: granularity === g ? 'var(--bg-secondary)' : 'transparent',
                                        color: granularity === g ? 'var(--text-primary)' : 'var(--text-tertiary)',
                                        boxShadow: granularity === g ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                                    }}>
                                        {g === 'month' ? 'Month' : 'Day'}
                                    </button>
                                ))}
                            </div>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <span style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                                {sliderLabels[rangeStart]}
                                {rangeStart !== rangeEnd && <> &rarr; {sliderLabels[rangeEnd]}</>}
                                {' '}·{' '}
                                <strong style={{ color: 'var(--text-primary)' }}>
                                    {periodCount} {periodUnit}{periodCount !== 1 ? 's' : ''}
                                </strong>
                            </span>
                            {(rangeStart !== 0 || rangeEnd !== sliderMax) && (
                                <button onClick={() => { setRangeStart(0); setRangeEnd(sliderMax); setSelectedMonth(null); setExpandedRow(null); }}
                                    style={{ fontSize: '0.75rem', padding: '0.2rem 0.55rem', borderRadius: '6px', border: '1px solid var(--border-color)', background: 'var(--bg-tertiary)', color: 'var(--text-secondary)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                                    <X size={11} /> Reset
                                </button>
                            )}
                        </div>
                    </div>
                    <DualRangeSlider
                        min={0} max={sliderMax}
                        start={rangeStart} end={rangeEnd}
                        onStartChange={v => { setRangeStart(v); setSelectedMonth(null); setExpandedRow(null); }}
                        onEndChange={v => { setRangeEnd(v); setSelectedMonth(null); setExpandedRow(null); }}
                        labels={sliderLabels}
                    />
                </div>
            )}

            {/* ── Summary cards ───────────────────────────────────────────── */}
            {stats && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: '1rem', marginBottom: '1rem' }}>
                    <SummaryCard
                        label={selectedMonth ? `${selectedData?.label ?? ''}` : `Period Total (${periodMonths.length}mo)`}
                        value={fmt(displayTotal, currency)}
                        sub={selectedMonth ? `${fmt(periodTotal, currency)} for full period` : undefined}
                        color="var(--text-primary)" icon={<TrendingUp size={20} />}
                    />
                    <SummaryCard
                        label={stats.avgLabel}
                        value={fmt(stats.avg, currency)}
                        sub={`Over ${periodCount} ${periodUnit}${periodCount !== 1 ? 's' : ''}`}
                        icon={<Minus size={20} />}
                    />
                    <SummaryCard
                        label="MoM vs. Previous"
                        value={stats.mom != null ? `${stats.mom >= 0 ? '+' : ''}${stats.mom.toFixed(1)}%` : '—'}
                        sub="First month in period vs. prior"
                        color={stats.mom == null ? 'var(--text-secondary)' : stats.mom > 5 ? '#FE5000' : stats.mom < -5 ? '#10B981' : 'var(--text-primary)'}
                        icon={stats.mom == null ? <Minus size={20} /> : stats.mom >= 0 ? <TrendingUp size={20} /> : <TrendingDown size={20} />}
                    />
                    <SummaryCard
                        label="Peak Month"
                        value={fmt(stats.peak.total, currency)}
                        sub={stats.peak.label} color="#F59E0B" icon={<TrendingUp size={20} />}
                    />
                </div>
            )}

            {/* ── Chart (month = stacked bar / day = area) ─────────────────── */}
            <div style={{ background: 'var(--bg-secondary)', borderRadius: '12px', border: '1px solid var(--border-color)', padding: '1.25rem', marginBottom: '1rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                    <div>
                        <div style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '0.95rem' }}>
                            {granularity === 'month' ? 'Monthly Cost Breakdown' : 'Daily Cost Overview'}
                        </div>
                        <div style={{ fontSize: '0.78rem', color: 'var(--text-tertiary)', marginTop: '0.1rem' }}>
                            {granularity === 'month'
                                ? 'Months outside the period are dimmed · click a bar to drill in'
                                : `${periodDays.length} day${periodDays.length !== 1 ? 's' : ''} selected`}
                        </div>
                    </div>
                    {granularity === 'month' && (
                        <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                            {CATEGORIES.map(cat => (
                                <div key={cat} style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                                    <span style={{ width: 10, height: 10, borderRadius: '2px', background: CAT_COLORS[cat], display: 'inline-block' }} />
                                    {cat}
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {granularity === 'month' ? (
                    <ResponsiveContainer width="100%" height={260}>
                        <BarChart data={months} barCategoryGap="25%" onClick={e => {
                            if (e?.activeLabel) {
                                const m = months.find(x => x.label === e.activeLabel);
                                if (m) {
                                    const idx = months.indexOf(m);
                                    if (idx >= rangeStart && idx <= rangeEnd)
                                        setSelectedMonth(selectedMonth === m.month ? null : m.month);
                                }
                            }
                        }}>
                            <CartesianGrid {...gridStyle} />
                            <XAxis dataKey="label" tick={axisStyle} />
                            <YAxis tickFormatter={v => fmtShort(v)} tick={axisStyle} width={65} />
                            <Tooltip {...tooltipStyle} formatter={(v: any, name: any) => [fmt(v, currency), name]} />
                            {CATEGORIES.map(cat => (
                                <Bar key={cat} dataKey={cat} stackId="a" fill={CAT_COLORS[cat]}
                                    radius={cat === 'Other' ? [4, 4, 0, 0] : [0, 0, 0, 0]} cursor="pointer">
                                    {months.map((m, i) => {
                                        const inPeriod   = i >= rangeStart && i <= rangeEnd;
                                        const isSelected = selectedMonth === m.month;
                                        return <Cell key={i} fill={CAT_COLORS[cat]} opacity={!inPeriod ? 0.18 : (selectedMonth && !isSelected) ? 0.4 : 1} />;
                                    })}
                                </Bar>
                            ))}
                        </BarChart>
                    </ResponsiveContainer>
                ) : (
                    <ResponsiveContainer width="100%" height={260}>
                        <AreaChart data={dailyData}>
                            <defs>
                                <linearGradient id="dayGrad" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%"  stopColor="#00B5E2" stopOpacity={0.3} />
                                    <stop offset="95%" stopColor="#00B5E2" stopOpacity={0} />
                                </linearGradient>
                            </defs>
                            <CartesianGrid {...gridStyle} />
                            <XAxis dataKey="label" tick={{ ...axisStyle, fontSize: 10 }} interval="preserveStartEnd" />
                            <YAxis tickFormatter={v => fmtShort(v)} tick={axisStyle} width={65} />
                            <Tooltip {...tooltipStyle} formatter={(v: any) => [fmt(v, currency), 'Cost']} />
                            <Area type="monotone" dataKey="total" stroke="#00B5E2" strokeWidth={2} fill="url(#dayGrad)" dot={periodDays.length <= 31} activeDot={{ r: 4 }} />
                        </AreaChart>
                    </ResponsiveContainer>
                )}
            </div>

            {/* ── Category pills for period / drill-down ──────────────────── */}
            <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
                {CATEGORIES.filter(cat => (selectedData ? selectedData[cat] : periodCatTotals[cat]) > 0).map(cat => {
                    const val   = selectedData ? selectedData[cat] : periodCatTotals[cat];
                    const total = selectedData ? selectedData.total : periodTotal;
                    return (
                        <div key={cat} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.3rem 0.75rem', borderRadius: '20px', border: `1px solid ${CAT_COLORS[cat]}44`, background: `${CAT_COLORS[cat]}11`, fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                            <span style={{ width: 8, height: 8, borderRadius: '50%', background: CAT_COLORS[cat], display: 'inline-block' }} />
                            {cat}: <strong style={{ color: 'var(--text-primary)' }}>{fmt(val, currency)}</strong>
                            <span style={{ color: 'var(--text-tertiary)' }}>({total > 0 ? ((val / total) * 100).toFixed(0) : 0}%)</span>
                        </div>
                    );
                })}
            </div>

            {/* ── Drill-down header (month mode only) ─────────────────────── */}
            {granularity === 'month' && selectedMonth && selectedData && (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
                    <div>
                        <span style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--text-primary)' }}>{selectedData.label}</span>
                        <span style={{ marginLeft: '0.75rem', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                            {fmt(selectedData.total, currency)} · {(recordsByMonth.get(selectedMonth) ?? []).length} records
                        </span>
                    </div>
                    <button onClick={() => { setSelectedMonth(null); setExpandedRow(null); }}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-tertiary)', display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.82rem' }}>
                        <X size={14} /> Show full period
                    </button>
                </div>
            )}

            {/* ── Daily chart (month drill-down only) + top customers ─────── */}
            <div style={{ display: 'grid', gridTemplateColumns: (granularity === 'month' && hasDailyData) ? '1fr 320px' : '1fr', gap: '1rem', marginBottom: '1rem' }}>
                {granularity === 'month' && hasDailyData && (
                    <div style={{ background: 'var(--bg-secondary)', borderRadius: '12px', border: '1px solid var(--border-color)', padding: '1.25rem' }}>
                        <div style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '0.9rem', marginBottom: '1rem' }}>
                            Daily Costs — {selectedData?.label}
                        </div>
                        <ResponsiveContainer width="100%" height={180}>
                            <AreaChart data={dailyData}>
                                <defs>
                                    <linearGradient id="dailyGrad" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%"  stopColor="#00B5E2" stopOpacity={0.25} />
                                        <stop offset="95%" stopColor="#00B5E2" stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid {...gridStyle} />
                                <XAxis dataKey="label" tick={{ ...axisStyle, fontSize: 10 }} interval="preserveStartEnd" />
                                <YAxis tickFormatter={v => fmtShort(v)} tick={axisStyle} width={65} />
                                <Tooltip {...tooltipStyle} formatter={(v: any) => [fmt(v, currency), 'Cost']} />
                                <Area type="monotone" dataKey="total" stroke="#00B5E2" strokeWidth={2} fill="url(#dailyGrad)" dot={false} />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                )}
                {topCustomers.length > 0 && (
                    <div style={{ background: 'var(--bg-secondary)', borderRadius: '12px', border: '1px solid var(--border-color)', padding: '1.25rem' }}>
                        <div style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '0.9rem', marginBottom: '0.85rem' }}>
                            Top Customers {selectedMonth ? '' : '— Period'}
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                            {topCustomers.map((c, i) => {
                                const base = selectedMonth ? (selectedData?.total ?? 1) : periodTotal;
                                const pct = base > 0 ? (c.value / base) * 100 : 0;
                                return (
                                    <div key={c.name}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem', marginBottom: '0.2rem' }}>
                                            <span style={{ color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '60%' }}>{c.name}</span>
                                            <span style={{ color: 'var(--text-secondary)', flexShrink: 0 }}>{fmt(c.value, currency)}</span>
                                        </div>
                                        <div style={{ height: 4, borderRadius: 2, background: 'var(--bg-tertiary)', overflow: 'hidden' }}>
                                            <div style={{ height: '100%', width: `${pct}%`, background: `hsl(${(i * 47) % 360},65%,55%)`, borderRadius: 2, transition: 'width 0.4s ease' }} />
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}
            </div>

            {/* ── Records table ────────────────────────────────────────────── */}
            <div style={{ background: 'var(--bg-secondary)', borderRadius: '12px', border: '1px solid var(--border-color)', overflow: 'hidden' }}>
                {/* Toolbar */}
                <div style={{ padding: '0.65rem 1rem', borderBottom: '1px solid var(--border-color)', display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                    <input type="text" placeholder="Filter customer or product…" value={search}
                        onChange={e => setSearch(e.target.value)}
                        style={{ flex: 1, padding: '0.35rem 0.7rem', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'var(--bg-tertiary)', color: 'var(--text-primary)', fontSize: '0.83rem' }}
                    />
                    <span style={{ fontSize: '0.78rem', color: 'var(--text-tertiary)', whiteSpace: 'nowrap' }}>
                        {tableRows.length} record{tableRows.length !== 1 ? 's' : ''}
                        {granularity === 'month'
                            ? (selectedMonth ? ` · ${selectedData?.label}` : ` · ${periodMonths.length} months`)
                            : ` · ${periodDays.length} day${periodDays.length !== 1 ? 's' : ''}`}
                    </span>
                    {expandedRow && (
                        <button onClick={() => setExpandedRow(null)}
                            style={{ fontSize: '0.75rem', padding: '0.2rem 0.55rem', borderRadius: '6px', border: '1px solid var(--border-color)', background: 'var(--bg-tertiary)', color: 'var(--text-secondary)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.25rem', whiteSpace: 'nowrap' }}>
                            <X size={11} /> Close detail
                        </button>
                    )}
                </div>

                {/* Header */}
                <div style={{ display: 'grid', gridTemplateColumns: '24px 1fr 1fr 110px 110px 110px', gap: '0.5rem', padding: '0.45rem 0.75rem', background: 'var(--bg-tertiary)', borderBottom: '1px solid var(--border-color)', fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-tertiary)', letterSpacing: '0.04em', userSelect: 'none' }}>
                    <div />
                    {([['CustomerName','Customer'],['ProductName','Product'],['ChargeType','Type'],['ChargeStartDate','Date'],['value','Amount']] as const).map(([key, label]) => (
                        <div key={key} onClick={() => toggleSort(key)}
                            style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.2rem',
                                justifyContent: key === 'value' || key === 'ChargeType' || key === 'ChargeStartDate' ? 'flex-end' : 'flex-start' }}>
                            {label} <SortIcon col={key} />
                        </div>
                    ))}
                </div>

                {/* Body */}
                <div style={{ maxHeight: '480px', overflowY: 'auto' }}>
                    {tableRows.slice(0, 300).map((row, i) => {
                        const key = `${row.SubscriptionId ?? ''}-${row.ChargeStartDate ?? ''}-${i}`;
                        const isExpanded = expandedRow === key;
                        return (
                            <React.Fragment key={key}>
                                <div onClick={() => setExpandedRow(isExpanded ? null : key)}
                                    style={{ display: 'grid', gridTemplateColumns: '24px 1fr 1fr 110px 110px 110px', gap: '0.5rem', padding: '0.45rem 0.75rem', borderBottom: '1px solid var(--border-color)', fontSize: '0.82rem', cursor: 'pointer', background: isExpanded ? 'rgba(99,102,241,0.07)' : i % 2 === 0 ? 'transparent' : 'var(--bg-tertiary)', transition: 'background 0.1s' }}
                                    onMouseEnter={e => { if (!isExpanded) (e.currentTarget as HTMLElement).style.background = 'var(--bg-tertiary)'; }}
                                    onMouseLeave={e => { if (!isExpanded) (e.currentTarget as HTMLElement).style.background = i % 2 === 0 ? 'transparent' : 'var(--bg-tertiary)'; }}
                                >
                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-tertiary)' }}>
                                        {isExpanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                                    </div>
                                    <div style={{ color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{row.CustomerName}</div>
                                    <div style={{ color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{row.ProductName}</div>
                                    <div style={{ color: 'var(--text-tertiary)', textAlign: 'right', fontSize: '0.75rem', whiteSpace: 'nowrap' }}>{row.ChargeType ?? '—'}</div>
                                    <div style={{ color: 'var(--text-tertiary)', textAlign: 'right', fontSize: '0.75rem', whiteSpace: 'nowrap' }}>
                                        {row.ChargeStartDate ? new Date(row.ChargeStartDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }) : '—'}
                                    </div>
                                    <div style={{ color: 'var(--text-primary)', fontWeight: 600, textAlign: 'right', whiteSpace: 'nowrap' }}>{fmt(rowValue(row), currency)}</div>
                                </div>
                                {isExpanded && <RecordDetail row={row} currency={currency} />}
                            </React.Fragment>
                        );
                    })}
                    {tableRows.length > 300 && (
                        <div style={{ padding: '0.75rem', textAlign: 'center', fontSize: '0.78rem', color: 'var(--text-tertiary)' }}>
                            Showing first 300 of {tableRows.length} records — use the filter to narrow down
                        </div>
                    )}
                    {tableRows.length === 0 && (
                        <div style={{ padding: '2.5rem', textAlign: 'center', color: 'var(--text-tertiary)', fontSize: '0.85rem' }}>
                            No records match the current filter.
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
