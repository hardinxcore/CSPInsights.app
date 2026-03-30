import React, { useState, useMemo } from 'react';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
    LineChart, Line, Cell, Legend
} from 'recharts';
import {
    TrendingUp, Users, FileText, Clock, ShieldCheck,
    Download, Search, X, ChevronUp, ChevronDown, Plus, Trash2, ArrowLeft, User, Package,
    CreditCard, Banknote, Receipt
} from 'lucide-react';
import { useEarningsStore } from '../store/earningsStore';
import { parseEarningsCSVs } from '../utils/earningsParser';
import { parsePaymentsCSV } from '../utils/paymentsParser';
import { FileDropZone } from './FileDropZone';
import * as XLSX from 'xlsx';
import type { EarningRecord, PaymentRecord } from '../types/EarningsData';

type TabType = 'overview' | 'customers' | 'products' | 'records' | 'payments';
type SortDir = 'asc' | 'desc';

// Brand palette matching the app
const CHART_COLORS = ['#10B981', '#00B5E2', '#FE5000', '#8B5CF6', '#F59E0B', '#0078D4', '#EC4899'];
const PAYMENT_STATUS_COLORS: Record<string, string> = {
    UNPROCESSED: '#F59E0B',
    SENT: '#00B5E2',
    PAID: '#10B981',
};

// ── Shared chart theme helpers ────────────────────────────────────────────────
const axisStyle = { fontSize: 11, fill: 'var(--text-tertiary)' };
const gridStyle = { stroke: 'var(--border-color)', strokeDasharray: '3 3' };
const tooltipStyle = {
    contentStyle: {
        background: 'var(--bg-secondary)',
        border: '1px solid var(--border-color)',
        borderRadius: '8px',
        fontSize: '0.85rem',
        color: 'var(--text-primary)',
    },
    labelStyle: { color: 'var(--text-primary)', fontWeight: 600 },
    itemStyle: { color: 'var(--text-secondary)' },
    cursor: { fill: 'var(--bg-tertiary)' },
};

const fmt = (amount: number, currency: string) =>
    new Intl.NumberFormat('nl-NL', { style: 'currency', currency, minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(amount);
const fmtShort = (amount: number, currency: string) =>
    new Intl.NumberFormat('nl-NL', { style: 'currency', currency, maximumFractionDigits: 0 }).format(amount);
const truncate = (str: string, max: number) =>
    str && str.length > max ? str.slice(0, max) + '…' : (str || '');

const PaymentBadge: React.FC<{ status: string }> = ({ status }) => {
    const color = PAYMENT_STATUS_COLORS[status] || 'var(--text-tertiary)';
    return (
        <span style={{
            fontSize: '0.72rem', fontWeight: 600, padding: '0.2rem 0.55rem',
            borderRadius: '1rem', background: `${color}22`, color,
            textTransform: 'uppercase', letterSpacing: '0.04em', whiteSpace: 'nowrap',
        }}>
            {status || '—'}
        </span>
    );
};

const thStyle: React.CSSProperties = {
    padding: '0.75rem 1rem', textAlign: 'left', fontSize: '0.8rem',
    color: 'var(--text-tertiary)', fontWeight: 600, textTransform: 'uppercase',
    letterSpacing: '0.05em', whiteSpace: 'nowrap', cursor: 'pointer', userSelect: 'none',
};
const tdStyle: React.CSSProperties = {
    padding: '0.75rem 1rem', fontSize: '0.88rem', color: 'var(--text-primary)',
    borderTop: '1px solid var(--border-color)', whiteSpace: 'nowrap',
};

const SortIcon: React.FC<{ col: string; current: { key: string; dir: SortDir } }> = ({ col, current }) => {
    if (current.key !== col) return <ChevronDown size={14} style={{ opacity: 0.3, flexShrink: 0 }} />;
    return current.dir === 'asc'
        ? <ChevronUp size={14} style={{ flexShrink: 0 }} />
        : <ChevronDown size={14} style={{ flexShrink: 0 }} />;
};

// ── Records table with sort + filter (reused in detail views) ────────────────
const RecordsTable: React.FC<{ records: EarningRecord[]; currency: string }> = ({ records, currency }) => {
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

// ── Customer detail view ──────────────────────────────────────────────────────
const CustomerDetail: React.FC<{
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

// ── Product detail view ───────────────────────────────────────────────────────
const ProductDetail: React.FC<{
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

// ── Main EarningsView ─────────────────────────────────────────────────────────
export const EarningsView: React.FC = () => {
    const {
        data, meta, isLoading, setData, appendData, reset,
        payments, paymentsMeta, setPayments, appendPayments, resetPayments,
    } = useEarningsStore();

    const [activeTab, setActiveTab] = useState<TabType>('overview');
    const [isUploading, setIsUploading] = useState(false);
    const [isParsing, setIsParsing] = useState(false);

    // Drill-down state
    const [drillCustomer, setDrillCustomer] = useState<string | null>(null);
    const [drillProduct, setDrillProduct] = useState<string | null>(null);

    // Records tab filters
    const [search, setSearch] = useState('');
    const [filterLever, setFilterLever] = useState('');
    const [filterStatus, setFilterStatus] = useState('');

    // Table sorting
    const [custSort, setCustSort] = useState<{ key: string; dir: SortDir }>({ key: 'amount', dir: 'desc' });
    const [prodSort, setProdSort] = useState<{ key: string; dir: SortDir }>({ key: 'amount', dir: 'desc' });

    // Payments upload state
    const [isUploadingPayments, setIsUploadingPayments] = useState(false);
    const [isParsingPayments, setIsParsingPayments] = useState(false);

    const showDashboard = data.length > 0 && !isUploading;
    const currency = data[0]?.transactionCurrency || meta.currency || 'EUR';

    // ── Derived aggregations ───────────────────────────────────────────────────

    const earningsByLever = useMemo(() => {
        const map = new Map<string, number>();
        data.forEach(r => { if (r.lever) map.set(r.lever, (map.get(r.lever) || 0) + r.earningAmount); });
        return Array.from(map.entries())
            .map(([lever, amount]) => ({ lever, shortLever: truncate(lever, 32), amount }))
            .sort((a, b) => b.amount - a.amount);
    }, [data]);

    const earningsByMonth = useMemo(() => {
        const map = new Map<string, number>();
        data.forEach(r => {
            if (!r.earningDate) return;
            const d = new Date(r.earningDate);
            if (isNaN(d.getTime())) return;
            const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
            map.set(key, (map.get(key) || 0) + r.earningAmount);
        });
        return Array.from(map.entries())
            .map(([month, amount]) => ({ month, amount }))
            .sort((a, b) => a.month.localeCompare(b.month));
    }, [data]);

    const earningsByCustomer = useMemo(() => {
        const map = new Map<string, { amount: number; records: number; levers: Set<string> }>();
        data.forEach(r => {
            if (!r.customerName) return;
            const e = map.get(r.customerName) || { amount: 0, records: 0, levers: new Set<string>() };
            e.amount += r.earningAmount;
            e.records++;
            if (r.lever) e.levers.add(r.lever);
            map.set(r.customerName, e);
        });
        return Array.from(map.entries()).map(([customerName, s]) => ({
            customerName,
            amount: s.amount,
            records: s.records,
            levers: Array.from(s.levers).join(', '),
        }));
    }, [data]);

    const sortedCustomers = useMemo(() => {
        return [...earningsByCustomer].sort((a, b) => {
            const av = (a as any)[custSort.key];
            const bv = (b as any)[custSort.key];
            if (typeof av === 'number') return custSort.dir === 'asc' ? av - bv : bv - av;
            return custSort.dir === 'asc' ? String(av).localeCompare(String(bv)) : String(bv).localeCompare(String(av));
        });
    }, [earningsByCustomer, custSort]);

    const earningsByProduct = useMemo(() => {
        const map = new Map<string, { amount: number; records: number; lever: string; customers: Set<string> }>();
        data.forEach(r => {
            if (!r.productName) return;
            const e = map.get(r.productName) || { amount: 0, records: 0, lever: r.lever, customers: new Set<string>() };
            e.amount += r.earningAmount;
            e.records++;
            if (r.customerName) e.customers.add(r.customerName);
            map.set(r.productName, e);
        });
        return Array.from(map.entries()).map(([productName, s]) => ({
            productName, amount: s.amount, records: s.records, lever: s.lever, customersCount: s.customers.size,
        }));
    }, [data]);

    const sortedProducts = useMemo(() => {
        return [...earningsByProduct].sort((a, b) => {
            const av = (a as any)[prodSort.key];
            const bv = (b as any)[prodSort.key];
            if (typeof av === 'number') return prodSort.dir === 'asc' ? av - bv : bv - av;
            return prodSort.dir === 'asc' ? String(av).localeCompare(String(bv)) : String(bv).localeCompare(String(av));
        });
    }, [earningsByProduct, prodSort]);

    const filteredRecords = useMemo(() => {
        let f = data;
        if (search) {
            const q = search.toLowerCase();
            f = f.filter(r =>
                r.customerName?.toLowerCase().includes(q) ||
                r.productName?.toLowerCase().includes(q) ||
                r.lever?.toLowerCase().includes(q) ||
                r.earningId?.toLowerCase().includes(q)
            );
        }
        if (filterLever) f = f.filter(r => r.lever === filterLever);
        if (filterStatus) f = f.filter(r => r.paymentStatus === filterStatus);
        return f;
    }, [data, search, filterLever, filterStatus]);

    const uniqueLevers = useMemo(() => [...new Set(data.map(r => r.lever).filter(Boolean))], [data]);
    const uniqueStatuses = useMemo(() => [...new Set(data.map(r => r.paymentStatus).filter(Boolean))], [data]);
    const unprocessedAmount = useMemo(
        () => data.filter(r => r.paymentStatus === 'UNPROCESSED').reduce((s, r) => s + r.earningAmount, 0),
        [data]
    );
    const nextPayment = useMemo(() => {
        const months = [...new Set(data.map(r => r.estimatedPaymentMonth).filter(Boolean))];
        return months[0] || null;
    }, [data]);

    // ── Handlers ──────────────────────────────────────────────────────────────

    const handleFileSelect = async (files: File[]) => {
        setIsParsing(true);
        try {
            const result = await parseEarningsCSVs(files);
            if (result.errors.length > 0) {
                alert(`Warning: Some rows were skipped.\n${result.errors.slice(0, 3).join('\n')}`);
            }
            if (result.data.length === 0) {
                alert('No valid earnings records found.\n\nExpected: Earnings Report (Default) CSV from Partner Center → Incentives → Earnings → Export.');
                return;
            }
            if (data.length > 0 && !isUploading) {
                appendData(result.data, result.meta);
                alert(`Added ${result.data.length} earnings records.`);
            } else {
                setData(result.data, result.meta);
            }
            setIsUploading(false);
            setDrillCustomer(null);
            setDrillProduct(null);
        } catch (err: any) {
            alert(err.message || 'Failed to parse earnings CSV');
        } finally {
            setIsParsing(false);
        }
    };

    const handleClear = () => {
        if (confirm('Clear all earnings data? This cannot be undone.')) {
            reset();
            setIsUploading(false);
            setDrillCustomer(null);
            setDrillProduct(null);
        }
    };

    const handlePaymentsFileSelect = async (files: File[]) => {
        setIsParsingPayments(true);
        try {
            const result = await parsePaymentsCSV(files);
            if (result.errors.length > 0) {
                alert(`Warning: Some rows were skipped.\n${result.errors.slice(0, 3).join('\n')}`);
            }
            if (result.data.length === 0) {
                alert('No valid payment records found.\n\nExpected: Payments CSV from Partner Center → Incentives → Payments → Export.');
                return;
            }
            if (payments.length > 0 && !isUploadingPayments) {
                appendPayments(result.data, result.meta);
                alert(`Added ${result.data.length} payment records.`);
            } else {
                setPayments(result.data, result.meta);
            }
            setIsUploadingPayments(false);
        } catch (err: any) {
            alert(err.message || 'Failed to parse payments CSV');
        } finally {
            setIsParsingPayments(false);
        }
    };

    const handleClearPayments = () => {
        if (confirm('Clear all payments data? This cannot be undone.')) {
            resetPayments();
            setIsUploadingPayments(false);
        }
    };

    const handleExportPaymentsExcel = () => {
        const rows = payments.map(r => ({
            'Payment ID': r.paymentId,
            'Participant': r.participantName,
            'Program': r.programName,
            [`Earned (${paymentsCurrency})`]: r.earned,
            'Earned (USD)': r.earnedUSD,
            'Withheld Tax': r.withheldTax,
            'Sales Tax': r.salesTax,
            'Service Fee Tax': r.serviceFeeTax,
            [`Total Payment (${paymentsCurrency})`]: r.totalPayment,
            'Payment Method': formatPaymentMethod(r.paymentMethod),
            'Payment Status': r.paymentStatus,
            'Payment Date': r.paymentDate ? new Date(r.paymentDate).toLocaleDateString('nl-NL') : '',
            'Reference': r.ciReferenceNumber || '',
        }));
        const ws = XLSX.utils.json_to_sheet(rows);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Payments');
        XLSX.writeFile(wb, `payments-${new Date().toISOString().slice(0, 10)}.xlsx`);
    };

    const handleExportExcel = () => {
        const source = (drillCustomer
            ? data.filter(r => r.customerName === drillCustomer)
            : drillProduct
                ? data.filter(r => r.productName === drillProduct)
                : filteredRecords
        );
        const rows = source.map(r => ({
            'Earning ID': r.earningId,
            'Customer': r.customerName,
            'Product': r.productName,
            'Lever': r.lever,
            'Solution Area': r.solutionArea,
            'Earning Type': r.earningType,
            'Earning Rate %': r.earningRate,
            'Quantity': r.quantity,
            [`Earning (${currency})`]: r.earningAmount,
            'Earning (USD)': r.earningAmountUSD,
            'Payment Status': r.paymentStatus,
            'Est. Payment Month': r.estimatedPaymentMonth,
            'Transaction Date': r.transactionDate,
            'Earning Date': r.earningDate,
            'Program': r.programName,
            'Engagement': r.engagementName,
        }));
        const ws = XLSX.utils.json_to_sheet(rows);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Earnings');
        XLSX.writeFile(wb, `earnings-${new Date().toISOString().slice(0, 10)}.xlsx`);
    };

    const handleLeverBarClick = (entry: any) => {
        if (!entry?.lever) return;
        setFilterLever(entry.lever === filterLever ? '' : entry.lever);
        setActiveTab('records');
    };

    const handleCustomerBarClick = (entry: any) => {
        if (!entry?.name) return;
        setDrillCustomer(entry.name);
    };

    const toggleCustSort = (key: string) =>
        setCustSort(s => ({ key, dir: s.key === key && s.dir === 'desc' ? 'asc' : 'desc' }));
    const toggleProdSort = (key: string) =>
        setProdSort(s => ({ key, dir: s.key === key && s.dir === 'desc' ? 'asc' : 'desc' }));

    // ── Payments derived data ──────────────────────────────────────────────────

    const paymentsCurrency = payments[0]?.earnedCurrencyCode || paymentsMeta.currency || 'EUR';

    const formatPaymentMethod = (method: string) => {
        if (!method) return '—';
        if (method.toLowerCase().includes('electronicbank')) return 'Bank Transfer';
        if (method.toLowerCase().includes('lrdcredit')) return 'Credit Memo';
        return method;
    };

    const paymentMethodIcon = (method: string) => {
        if (method.toLowerCase().includes('electronicbank')) return <Banknote size={14} style={{ flexShrink: 0 }} />;
        if (method.toLowerCase().includes('lrdcredit')) return <Receipt size={14} style={{ flexShrink: 0 }} />;
        return <CreditCard size={14} style={{ flexShrink: 0 }} />;
    };

    const paymentsByMonth = useMemo(() => {
        const map = new Map<string, { earned: number; totalPayment: number; tax: number }>();
        payments.forEach(r => {
            if (!r.paymentDate) return;
            const d = new Date(r.paymentDate);
            if (isNaN(d.getTime())) return;
            const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
            const e = map.get(key) || { earned: 0, totalPayment: 0, tax: 0 };
            e.earned += r.earned;
            e.totalPayment += r.totalPayment;
            e.tax += r.salesTax + r.withheldTax;
            map.set(key, e);
        });
        return Array.from(map.entries())
            .map(([month, v]) => ({ month, ...v }))
            .sort((a, b) => a.month.localeCompare(b.month));
    }, [payments]);

    const paymentsByMethod = useMemo(() => {
        const map = new Map<string, number>();
        payments.forEach(r => {
            const m = formatPaymentMethod(r.paymentMethod);
            map.set(m, (map.get(m) || 0) + r.totalPayment);
        });
        return Array.from(map.entries()).map(([method, amount]) => ({ method, amount })).sort((a, b) => b.amount - a.amount);
    }, [payments]);

    const lastPaymentDate = useMemo(() => {
        if (!payments.length) return null;
        const sorted = [...payments].filter(r => r.paymentDate).sort((a, b) =>
            new Date(b.paymentDate).getTime() - new Date(a.paymentDate).getTime()
        );
        return sorted[0]?.paymentDate ? new Date(sorted[0].paymentDate) : null;
    }, [payments]);

    const showPaymentsDashboard = payments.length > 0 && !isUploadingPayments;

    // ── Upload / empty state ───────────────────────────────────────────────────

    if (isLoading) return (
        <div className="flex-center" style={{ minHeight: '400px', flexDirection: 'column', gap: '1rem' }}>
            <TrendingUp size={48} color="#10B981" />
            <p style={{ color: 'var(--text-secondary)' }}>Loading earnings data...</p>
        </div>
    );

    if (!showDashboard) return (
        <div style={{ marginTop: '2rem' }}>
            {isUploading && data.length > 0 && (
                <button onClick={() => setIsUploading(false)}
                    style={{ marginBottom: '1rem', color: 'var(--text-tertiary)', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}>
                    &larr; Cancel &amp; Back to Dashboard
                </button>
            )}
            <FileDropZone
                onFileSelect={handleFileSelect}
                isLoading={isParsing}
                accept=".csv"
                title="Upload Earnings Report"
                description="Drop your Earnings Report (Default) CSV here"
                loadingText="Parsing earnings data..."
                icon={<TrendingUp size={24} style={{ marginRight: '10px', color: '#10B981' }} />}
            />
            <div style={{ maxWidth: '600px', margin: '1.5rem auto', padding: '1rem 1.5rem', background: 'var(--bg-secondary)', borderRadius: '8px', fontSize: '0.88rem', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                <strong style={{ color: 'var(--text-primary)' }}>How to export from Partner Center:</strong>
                <ol style={{ marginTop: '0.5rem', paddingLeft: '1.2rem' }}>
                    <li>Go to <strong>Partner Center</strong> → <strong>Incentives</strong> → <strong>Earnings</strong></li>
                    <li>Apply any date filters you need</li>
                    <li>Click <strong>Export</strong> and select <strong>Default</strong></li>
                    <li>Upload the downloaded CSV here</li>
                </ol>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', color: 'var(--success)', fontWeight: 500, fontSize: '0.9rem' }}>
                <ShieldCheck size={16} />
                <span>Processed locally in your browser. No data is uploaded.</span>
            </div>
        </div>
    );

    // ── Drill-down views ───────────────────────────────────────────────────────

    if (drillCustomer) return (
        <div className="animate-fade-in">
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '1rem' }}>
                <button onClick={handleExportExcel} className="secondary-btn" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.85rem' }}>
                    <Download size={15} /> Export Excel
                </button>
            </div>
            <CustomerDetail
                customerName={drillCustomer}
                records={data.filter(r => r.customerName === drillCustomer)}
                currency={currency}
                onBack={() => setDrillCustomer(null)}
            />
        </div>
    );

    if (drillProduct) return (
        <div className="animate-fade-in">
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '1rem' }}>
                <button onClick={handleExportExcel} className="secondary-btn" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.85rem' }}>
                    <Download size={15} /> Export Excel
                </button>
            </div>
            <ProductDetail
                productName={drillProduct}
                records={data.filter(r => r.productName === drillProduct)}
                currency={currency}
                onBack={() => setDrillProduct(null)}
            />
        </div>
    );

    // ── Main dashboard ─────────────────────────────────────────────────────────

    return (
        <div className="animate-fade-in">
            {/* Action bar */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '0.75rem' }}>
                <div>
                    <h2 style={{ margin: 0, fontSize: '1.4rem', fontWeight: 700, color: 'var(--text-primary)' }}>Incentives &amp; Earnings</h2>
                    <p style={{ margin: '0.25rem 0 0', fontSize: '0.85rem', color: 'var(--text-tertiary)' }}>
                        {meta.totalRows.toLocaleString('nl-NL')} records · {meta.customersCount} customers
                        {nextPayment && <> · Est. payment: <strong style={{ color: 'var(--text-primary)' }}>{nextPayment}</strong></>}
                    </p>
                </div>
                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                    <button onClick={() => setIsUploading(true)} className="secondary-btn" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.85rem' }}>
                        <Plus size={15} /> Add File
                    </button>
                    <button onClick={handleExportExcel} className="secondary-btn" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.85rem' }}>
                        <Download size={15} /> Export Excel
                    </button>
                    <button onClick={handleClear} className="secondary-btn" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.85rem', color: 'var(--danger)' }}>
                        <Trash2 size={15} /> Clear
                    </button>
                </div>
            </div>

            {/* Summary Cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem', marginBottom: '2rem' }}>
                {[
                    { icon: <TrendingUp size={18} color="#10B981" />, label: 'Total Earnings', value: fmtShort(meta.totalEarningAmount, currency), sub: currency, color: '#10B981' },
                    { icon: <Clock size={18} color="#F59E0B" />, label: 'Unprocessed', value: fmtShort(unprocessedAmount, currency), sub: 'pending payment', color: '#F59E0B' },
                    { icon: <Users size={18} color="var(--brand-turquoise)" />, label: 'Customers', value: String(meta.customersCount), sub: 'with earnings', color: 'var(--text-primary)' },
                    { icon: <FileText size={18} color="var(--brand-orange)" />, label: 'Records', value: meta.totalRows.toLocaleString('nl-NL'), sub: `${uniqueLevers.length} levers`, color: 'var(--text-primary)' },
                ].map(card => (
                    <div key={card.label} className="glass-panel" style={{ padding: '1.25rem', border: '1px solid var(--border-color)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.5rem' }}>
                            {card.icon}
                            <span style={{ fontSize: '0.78rem', color: 'var(--text-tertiary)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{card.label}</span>
                        </div>
                        <div style={{ fontSize: '1.5rem', fontWeight: 700, color: card.color }}>{card.value}</div>
                        <div style={{ fontSize: '0.78rem', color: 'var(--text-tertiary)', marginTop: '0.2rem' }}>{card.sub}</div>
                    </div>
                ))}
            </div>

            {/* Tab Navigation */}
            <div style={{ display: 'flex', borderBottom: '1px solid var(--border-color)', marginBottom: '1.5rem' }}>
                {(['overview', 'customers', 'products', 'records'] as TabType[]).map(tab => (
                    <button key={tab} onClick={() => setActiveTab(tab)} style={{
                        padding: '0.6rem 1.25rem', background: 'none', border: 'none',
                        borderBottom: activeTab === tab ? '2px solid #10B981' : '2px solid transparent',
                        color: activeTab === tab ? 'var(--text-primary)' : 'var(--text-tertiary)',
                        fontWeight: 500, cursor: 'pointer', fontSize: '0.9rem',
                        textTransform: 'capitalize', transition: 'all 0.15s ease',
                    }}>
                        {tab}
                    </button>
                ))}
                <button onClick={() => setActiveTab('payments')} style={{
                    padding: '0.6rem 1.25rem', background: 'none', border: 'none',
                    borderBottom: activeTab === 'payments' ? '2px solid #00B5E2' : '2px solid transparent',
                    color: activeTab === 'payments' ? 'var(--text-primary)' : 'var(--text-tertiary)',
                    fontWeight: 500, cursor: 'pointer', fontSize: '0.9rem',
                    transition: 'all 0.15s ease',
                    display: 'flex', alignItems: 'center', gap: '0.4rem',
                }}>
                    <CreditCard size={15} /> Payments
                    {payments.length > 0 && (
                        <span style={{ fontSize: '0.72rem', padding: '0.1rem 0.4rem', borderRadius: '1rem', background: 'rgba(0,181,226,0.15)', color: 'var(--brand-turquoise)', fontWeight: 600 }}>
                            {payments.length}
                        </span>
                    )}
                </button>
            </div>

            {/* ── Overview Tab ────────────────────────────────────────────────── */}
            {activeTab === 'overview' && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '1.5rem' }}>
                    {/* Earnings by Lever */}
                    <div className="glass-panel" style={{ padding: '1.5rem', border: '1px solid var(--border-color)' }}>
                        <h3 style={{ margin: '0 0 0.25rem', fontSize: '1rem', fontWeight: 600, color: 'var(--text-primary)' }}>Earnings by Lever</h3>
                        <p style={{ margin: '0 0 1.25rem', fontSize: '0.8rem', color: 'var(--text-tertiary)' }}>Click a bar to filter by lever</p>
                        <ResponsiveContainer width="100%" height={Math.max(200, earningsByLever.length * 44)}>
                            <BarChart data={earningsByLever} layout="vertical" margin={{ left: 0, right: 20, top: 4, bottom: 4 }}>
                                <CartesianGrid {...gridStyle} horizontal={false} />
                                <XAxis type="number" tickFormatter={v => fmtShort(v, currency)} tick={axisStyle} />
                                <YAxis type="category" dataKey="shortLever" width={200} tick={axisStyle} />
                                <Tooltip formatter={(v: any) => [fmt(v, currency), 'Earnings']} {...tooltipStyle} />
                                <Bar dataKey="amount" radius={[0, 4, 4, 0]} cursor="pointer" onClick={handleLeverBarClick}>
                                    {earningsByLever.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    </div>

                    {/* Monthly Trend */}
                    <div className="glass-panel" style={{ padding: '1.5rem', border: '1px solid var(--border-color)' }}>
                        <h3 style={{ margin: '0 0 1.25rem', fontSize: '1rem', fontWeight: 600, color: 'var(--text-primary)' }}>Monthly Trend</h3>
                        <ResponsiveContainer width="100%" height={250}>
                            <LineChart data={earningsByMonth} margin={{ left: 10, right: 20, top: 4, bottom: 4 }}>
                                <CartesianGrid {...gridStyle} />
                                <XAxis dataKey="month" tick={axisStyle} />
                                <YAxis tickFormatter={v => fmtShort(v, currency)} tick={axisStyle} width={70} />
                                <Tooltip formatter={(v: any) => [fmt(v, currency), 'Earnings']} {...tooltipStyle} />
                                <Legend wrapperStyle={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }} />
                                <Line type="monotone" dataKey="amount" stroke="#10B981" strokeWidth={2.5}
                                    dot={{ r: 4, fill: '#10B981', stroke: 'var(--bg-primary)', strokeWidth: 2 }}
                                    name={`Earnings (${currency})`} />
                            </LineChart>
                        </ResponsiveContainer>
                    </div>

                    {/* Top 10 Customers — clickable */}
                    {earningsByCustomer.length > 0 && (
                        <div className="glass-panel" style={{ padding: '1.5rem', border: '1px solid var(--border-color)', gridColumn: '1 / -1' }}>
                            <h3 style={{ margin: '0 0 0.25rem', fontSize: '1rem', fontWeight: 600, color: 'var(--text-primary)' }}>Top 10 Customers</h3>
                            <p style={{ margin: '0 0 1.25rem', fontSize: '0.8rem', color: 'var(--text-tertiary)' }}>Click a bar for customer details</p>
                            <ResponsiveContainer width="100%" height={230}>
                                <BarChart
                                    data={[...earningsByCustomer].sort((a, b) => b.amount - a.amount).slice(0, 10)}
                                    margin={{ left: 10, right: 20, top: 4, bottom: 65 }}
                                >
                                    <CartesianGrid {...gridStyle} />
                                    <XAxis dataKey="customerName" tick={{ ...axisStyle, textAnchor: 'end' }} angle={-35} interval={0} />
                                    <YAxis tickFormatter={v => fmtShort(v, currency)} tick={axisStyle} width={70} />
                                    <Tooltip formatter={(v: any) => [fmt(v, currency), 'Earnings']} {...tooltipStyle} />
                                    <Bar dataKey="amount" radius={[4, 4, 0, 0]} cursor="pointer" onClick={handleCustomerBarClick}>
                                        {earningsByCustomer.slice(0, 10).map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                                    </Bar>
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    )}
                </div>
            )}

            {/* ── Customers Tab ──────────────────────────────────────────────── */}
            {activeTab === 'customers' && (
                <div className="glass-panel" style={{ border: '1px solid var(--border-color)', overflow: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead>
                            <tr style={{ background: 'var(--bg-secondary)' }}>
                                <th style={thStyle} onClick={() => toggleCustSort('customerName')}>
                                    <span style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>Customer <SortIcon col="customerName" current={custSort} /></span>
                                </th>
                                <th style={{ ...thStyle, textAlign: 'right' }} onClick={() => toggleCustSort('amount')}>
                                    <span style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', justifyContent: 'flex-end' }}>Earnings <SortIcon col="amount" current={custSort} /></span>
                                </th>
                                <th style={{ ...thStyle, textAlign: 'right' }} onClick={() => toggleCustSort('records')}>
                                    <span style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', justifyContent: 'flex-end' }}>Records <SortIcon col="records" current={custSort} /></span>
                                </th>
                                <th style={thStyle}>Levers</th>
                                <th style={{ ...thStyle, width: 80 }}></th>
                            </tr>
                        </thead>
                        <tbody>
                            {sortedCustomers.map(row => (
                                <tr key={row.customerName}
                                    onClick={() => setDrillCustomer(row.customerName)}
                                    style={{ cursor: 'pointer', transition: 'background 0.12s' }}
                                    onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-tertiary)')}
                                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                                >
                                    <td style={tdStyle}><strong>{row.customerName}</strong></td>
                                    <td style={{ ...tdStyle, textAlign: 'right', fontWeight: 600, color: '#10B981' }}>{fmt(row.amount, currency)}</td>
                                    <td style={{ ...tdStyle, textAlign: 'right', color: 'var(--text-secondary)' }}>{row.records}</td>
                                    <td style={{ ...tdStyle, color: 'var(--text-secondary)', maxWidth: 280, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                        <span title={row.levers}>{truncate(row.levers, 55)}</span>
                                    </td>
                                    <td style={{ ...tdStyle, color: 'var(--text-tertiary)', fontSize: '0.8rem' }}>Details →</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {/* ── Products Tab ───────────────────────────────────────────────── */}
            {activeTab === 'products' && (
                <div className="glass-panel" style={{ border: '1px solid var(--border-color)', overflow: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead>
                            <tr style={{ background: 'var(--bg-secondary)' }}>
                                <th style={thStyle} onClick={() => toggleProdSort('productName')}>
                                    <span style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>Product <SortIcon col="productName" current={prodSort} /></span>
                                </th>
                                <th style={{ ...thStyle, textAlign: 'right' }} onClick={() => toggleProdSort('amount')}>
                                    <span style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', justifyContent: 'flex-end' }}>Earnings <SortIcon col="amount" current={prodSort} /></span>
                                </th>
                                <th style={{ ...thStyle, textAlign: 'right' }} onClick={() => toggleProdSort('customersCount')}>
                                    <span style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', justifyContent: 'flex-end' }}>Customers <SortIcon col="customersCount" current={prodSort} /></span>
                                </th>
                                <th style={thStyle} onClick={() => toggleProdSort('lever')}>
                                    <span style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>Lever <SortIcon col="lever" current={prodSort} /></span>
                                </th>
                                <th style={{ ...thStyle, width: 80 }}></th>
                            </tr>
                        </thead>
                        <tbody>
                            {sortedProducts.map(row => (
                                <tr key={row.productName}
                                    onClick={() => setDrillProduct(row.productName)}
                                    style={{ cursor: 'pointer', transition: 'background 0.12s' }}
                                    onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-tertiary)')}
                                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                                >
                                    <td style={tdStyle}><strong>{row.productName}</strong></td>
                                    <td style={{ ...tdStyle, textAlign: 'right', fontWeight: 600, color: '#10B981' }}>{fmt(row.amount, currency)}</td>
                                    <td style={{ ...tdStyle, textAlign: 'right', color: 'var(--text-secondary)' }}>{row.customersCount}</td>
                                    <td style={{ ...tdStyle, color: 'var(--text-secondary)', maxWidth: 240, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                        <span title={row.lever}>{truncate(row.lever, 45)}</span>
                                    </td>
                                    <td style={{ ...tdStyle, color: 'var(--text-tertiary)', fontSize: '0.8rem' }}>Details →</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {/* ── Records Tab ────────────────────────────────────────────────── */}
            {activeTab === 'records' && (
                <div>
                    <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1rem', flexWrap: 'wrap', alignItems: 'center' }}>
                        <div style={{ position: 'relative', flex: '1 1 220px' }}>
                            <Search size={15} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-tertiary)' }} />
                            <input type="text" placeholder="Search customer, product, lever, ID..."
                                value={search} onChange={e => setSearch(e.target.value)}
                                style={{ width: '100%', padding: '0.55rem 2.2rem', border: '1px solid var(--border-color)', borderRadius: '2rem', background: 'var(--bg-primary)', color: 'var(--text-primary)', fontSize: '0.88rem', outline: 'none' }}
                            />
                            {search && (
                                <button onClick={() => setSearch('')} style={{ position: 'absolute', right: '0.75rem', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-tertiary)', padding: 0 }}>
                                    <X size={14} />
                                </button>
                            )}
                        </div>
                        <select value={filterLever} onChange={e => setFilterLever(e.target.value)}
                            style={{ padding: '0.55rem 0.75rem', border: '1px solid var(--border-color)', borderRadius: '2rem', background: 'var(--bg-primary)', color: 'var(--text-primary)', fontSize: '0.85rem', cursor: 'pointer' }}>
                            <option value="">All Levers</option>
                            {uniqueLevers.map(l => <option key={l} value={l}>{truncate(l, 50)}</option>)}
                        </select>
                        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
                            style={{ padding: '0.55rem 0.75rem', border: '1px solid var(--border-color)', borderRadius: '2rem', background: 'var(--bg-primary)', color: 'var(--text-primary)', fontSize: '0.85rem', cursor: 'pointer' }}>
                            <option value="">All Statuses</option>
                            {uniqueStatuses.map(s => <option key={s} value={s}>{s}</option>)}
                        </select>
                        {filterLever && (
                            <button onClick={() => setFilterLever('')} className="secondary-btn" style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.82rem' }}>
                                <X size={13} /> {truncate(filterLever, 25)}
                            </button>
                        )}
                        <span style={{ fontSize: '0.85rem', color: 'var(--text-tertiary)', whiteSpace: 'nowrap' }}>
                            {filteredRecords.length.toLocaleString('nl-NL')} records
                        </span>
                    </div>

                    <div className="glass-panel" style={{ border: '1px solid var(--border-color)', overflow: 'auto', maxHeight: '60vh' }}>
                        <RecordsTable records={filteredRecords} currency={currency} />
                        {filteredRecords.length > 300 && (
                            <div style={{ padding: '0.75rem 1rem', fontSize: '0.85rem', color: 'var(--text-tertiary)', borderTop: '1px solid var(--border-color)', textAlign: 'center' }}>
                                Showing first 300 of {filteredRecords.length.toLocaleString('nl-NL')}. Use Export Excel for the full dataset.
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* ── Payments Tab ───────────────────────────────────────────────── */}
            {activeTab === 'payments' && (
                <div className="animate-fade-in">
                    {!showPaymentsDashboard ? (
                        /* Payments upload / empty state */
                        <div style={{ marginTop: '1rem' }}>
                            {isUploadingPayments && payments.length > 0 && (
                                <button onClick={() => setIsUploadingPayments(false)}
                                    style={{ marginBottom: '1rem', color: 'var(--text-tertiary)', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}>
                                    &larr; Cancel &amp; Back
                                </button>
                            )}
                            <FileDropZone
                                onFileSelect={handlePaymentsFileSelect}
                                isLoading={isParsingPayments}
                                accept=".csv"
                                title="Upload Payments Report"
                                description="Drop your Payments CSV here"
                                loadingText="Parsing payments data..."
                                icon={<CreditCard size={24} style={{ marginRight: '10px', color: 'var(--brand-turquoise)' }} />}
                            />
                            <div style={{ maxWidth: '600px', margin: '1.5rem auto', padding: '1rem 1.5rem', background: 'var(--bg-secondary)', borderRadius: '8px', fontSize: '0.88rem', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                                <strong style={{ color: 'var(--text-primary)' }}>How to export from Partner Center:</strong>
                                <ol style={{ marginTop: '0.5rem', paddingLeft: '1.2rem' }}>
                                    <li>Go to <strong>Partner Center</strong> → <strong>Incentives</strong> → <strong>Payments</strong></li>
                                    <li>Apply any date filters you need</li>
                                    <li>Click <strong>Export</strong></li>
                                    <li>Upload the downloaded CSV here</li>
                                </ol>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', color: 'var(--success)', fontWeight: 500, fontSize: '0.9rem' }}>
                                <ShieldCheck size={16} />
                                <span>Processed locally in your browser. No data is uploaded.</span>
                            </div>
                        </div>
                    ) : (
                        /* Payments dashboard */
                        <div>
                            {/* Action bar */}
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '0.75rem' }}>
                                <div>
                                    <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-tertiary)' }}>
                                        {paymentsMeta.totalRows} payments
                                        {lastPaymentDate && <> · Last payment: <strong style={{ color: 'var(--text-primary)' }}>{lastPaymentDate.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}</strong></>}
                                    </p>
                                </div>
                                <div style={{ display: 'flex', gap: '0.5rem' }}>
                                    <button onClick={() => setIsUploadingPayments(true)} className="secondary-btn" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.85rem' }}>
                                        <Plus size={15} /> Add File
                                    </button>
                                    <button onClick={handleExportPaymentsExcel} className="secondary-btn" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.85rem' }}>
                                        <Download size={15} /> Export Excel
                                    </button>
                                    <button onClick={handleClearPayments} className="secondary-btn" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.85rem', color: 'var(--danger)' }}>
                                        <Trash2 size={15} /> Clear
                                    </button>
                                </div>
                            </div>

                            {/* Summary Cards */}
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem', marginBottom: '2rem' }}>
                                {[
                                    { icon: <TrendingUp size={18} color="#10B981" />, label: 'Total Earned', value: fmtShort(paymentsMeta.totalEarned, paymentsCurrency), sub: paymentsCurrency, color: '#10B981' },
                                    { icon: <Banknote size={18} color="var(--brand-turquoise)" />, label: 'Total Paid Out', value: fmtShort(paymentsMeta.totalPaid, paymentsCurrency), sub: 'incl. tax', color: 'var(--brand-turquoise)' },
                                    { icon: <Receipt size={18} color="#F59E0B" />, label: 'Total Tax', value: fmtShort(paymentsMeta.totalTax, paymentsCurrency), sub: 'sales + withheld', color: '#F59E0B' },
                                    { icon: <CreditCard size={18} color="var(--brand-orange)" />, label: 'Payments', value: String(paymentsMeta.totalRows), sub: `${paymentsByMethod.length} method(s)`, color: 'var(--text-primary)' },
                                ].map(card => (
                                    <div key={card.label} className="glass-panel" style={{ padding: '1.25rem', border: '1px solid var(--border-color)' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.5rem' }}>
                                            {card.icon}
                                            <span style={{ fontSize: '0.78rem', color: 'var(--text-tertiary)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{card.label}</span>
                                        </div>
                                        <div style={{ fontSize: '1.5rem', fontWeight: 700, color: card.color }}>{card.value}</div>
                                        <div style={{ fontSize: '0.78rem', color: 'var(--text-tertiary)', marginTop: '0.2rem' }}>{card.sub}</div>
                                    </div>
                                ))}
                            </div>

                            {/* Charts */}
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '1.5rem', marginBottom: '1.5rem' }}>
                                {/* Monthly payments */}
                                <div className="glass-panel" style={{ padding: '1.5rem', border: '1px solid var(--border-color)' }}>
                                    <h3 style={{ margin: '0 0 1.25rem', fontSize: '1rem', fontWeight: 600, color: 'var(--text-primary)' }}>Payments by Month</h3>
                                    <ResponsiveContainer width="100%" height={250}>
                                        <BarChart data={paymentsByMonth} margin={{ left: 10, right: 20, top: 4, bottom: 4 }}>
                                            <CartesianGrid {...gridStyle} />
                                            <XAxis dataKey="month" tick={axisStyle} />
                                            <YAxis tickFormatter={v => fmtShort(v, paymentsCurrency)} tick={axisStyle} width={75} />
                                            <Tooltip
                                                formatter={(v: any, name: any) => [fmt(v, paymentsCurrency), name]}
                                                {...tooltipStyle}
                                            />
                                            <Legend wrapperStyle={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }} />
                                            <Bar dataKey="earned" name={`Earned (${paymentsCurrency})`} fill="#10B981" radius={[3, 3, 0, 0]} />
                                            <Bar dataKey="tax" name="Tax" fill="#F59E0B" radius={[3, 3, 0, 0]} />
                                        </BarChart>
                                    </ResponsiveContainer>
                                </div>

                                {/* By payment method */}
                                <div className="glass-panel" style={{ padding: '1.5rem', border: '1px solid var(--border-color)' }}>
                                    <h3 style={{ margin: '0 0 1.25rem', fontSize: '1rem', fontWeight: 600, color: 'var(--text-primary)' }}>By Payment Method</h3>
                                    <ResponsiveContainer width="100%" height={180}>
                                        <BarChart data={paymentsByMethod} layout="vertical" margin={{ left: 0, right: 20, top: 4, bottom: 4 }}>
                                            <CartesianGrid {...gridStyle} horizontal={false} />
                                            <XAxis type="number" tickFormatter={v => fmtShort(v, paymentsCurrency)} tick={axisStyle} />
                                            <YAxis type="category" dataKey="method" width={130} tick={axisStyle} />
                                            <Tooltip formatter={(v: any) => [fmt(v, paymentsCurrency), 'Total Paid']} {...tooltipStyle} />
                                            <Bar dataKey="amount" radius={[0, 4, 4, 0]}>
                                                {paymentsByMethod.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                                            </Bar>
                                        </BarChart>
                                    </ResponsiveContainer>

                                    {/* Method legend with totals */}
                                    <div style={{ marginTop: '1rem', display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                                        {paymentsByMethod.map((m, i) => (
                                            <div key={m.method} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.5rem 0.75rem', borderRadius: '6px', background: 'var(--bg-tertiary)' }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-secondary)', fontSize: '0.88rem' }}>
                                                    <div style={{ width: 10, height: 10, borderRadius: '50%', background: CHART_COLORS[i % CHART_COLORS.length], flexShrink: 0 }} />
                                                    {m.method}
                                                </div>
                                                <strong style={{ fontSize: '0.88rem', color: 'var(--text-primary)' }}>{fmt(m.amount, paymentsCurrency)}</strong>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>

                            {/* Payments Table */}
                            <div className="glass-panel" style={{ border: '1px solid var(--border-color)', overflow: 'auto' }}>
                                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                    <thead style={{ position: 'sticky', top: 0, zIndex: 2, background: 'var(--bg-secondary)' }}>
                                        <tr>
                                            {['Date', 'Payment ID', 'Method', 'Earned', 'Sales Tax', 'Total Paid', 'Status'].map(h => (
                                                <th key={h} style={thStyle}>{h}</th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {[...payments]
                                            .sort((a, b) => new Date(b.paymentDate).getTime() - new Date(a.paymentDate).getTime())
                                            .map((r: PaymentRecord) => (
                                                <tr key={r.paymentId}
                                                    onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-tertiary)')}
                                                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                                                    style={{ transition: 'background 0.12s' }}
                                                >
                                                    <td style={{ ...tdStyle, color: 'var(--text-secondary)' }}>
                                                        {r.paymentDate ? new Date(r.paymentDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'}
                                                    </td>
                                                    <td style={{ ...tdStyle, fontFamily: 'monospace', fontSize: '0.82rem', color: 'var(--text-tertiary)' }}>{r.paymentId}</td>
                                                    <td style={tdStyle}>
                                                        <span style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: 'var(--text-secondary)' }}>
                                                            {paymentMethodIcon(r.paymentMethod)}
                                                            {formatPaymentMethod(r.paymentMethod)}
                                                        </span>
                                                    </td>
                                                    <td style={{ ...tdStyle, textAlign: 'right', fontWeight: 600, color: '#10B981' }}>{fmt(r.earned, paymentsCurrency)}</td>
                                                    <td style={{ ...tdStyle, textAlign: 'right', color: '#F59E0B' }}>
                                                        {r.salesTax > 0 ? fmt(r.salesTax, paymentsCurrency) : <span style={{ color: 'var(--text-tertiary)' }}>—</span>}
                                                    </td>
                                                    <td style={{ ...tdStyle, textAlign: 'right', fontWeight: 700, color: 'var(--brand-turquoise)' }}>{fmt(r.totalPayment, paymentsCurrency)}</td>
                                                    <td style={tdStyle}>
                                                        <span style={{
                                                            fontSize: '0.72rem', fontWeight: 600, padding: '0.2rem 0.55rem',
                                                            borderRadius: '1rem', background: 'rgba(0,181,226,0.12)', color: 'var(--brand-turquoise)',
                                                            textTransform: 'uppercase', letterSpacing: '0.04em',
                                                        }}>
                                                            {r.paymentStatus}
                                                        </span>
                                                    </td>
                                                </tr>
                                            ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};
