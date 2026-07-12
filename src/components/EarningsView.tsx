import React, { useState, useMemo } from 'react';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
    LineChart, Line, Cell, Legend
} from 'recharts';
import {
    TrendingUp, Users, FileText, Clock, ShieldCheck,
    Download, Search, X, Plus, Trash2, CreditCard,
} from 'lucide-react';
import { useEarningsStore } from '../store/earningsStore';
import { cancelEarningsParse, parseEarningsCSVs } from '../utils/earningsParser';
import { FileDropZone } from './FileDropZone';
import { exportToXlsx } from '../utils/exportXlsx';
import { useSortableData } from '../hooks/useSortableData';
import {
    type TabType, type SortDir,
    CHART_COLORS, axisStyle, gridStyle, tooltipStyle, fmt, fmtShort, truncate,
    thStyle, tdStyle,
} from './earnings/shared';
import { SortIcon } from './earnings/sharedComponents';
import { RecordsTable } from './earnings/RecordsTable';
import { CustomerDetail } from './earnings/CustomerDetail';
import { ProductDetail } from './earnings/ProductDetail';
import { PaymentsView } from './earnings/PaymentsView';
import { useEarningsAggregations } from './earnings/useEarningsAggregations';

// ── Main EarningsView ─────────────────────────────────────────────────────────
export const EarningsView: React.FC = () => {
    const {
        data, meta, isLoading, setData, appendData, reset, payments,
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

    // Products table sorting
    const [prodSort, setProdSort] = useState<{ key: string; dir: SortDir }>({ key: 'amount', dir: 'desc' });

    const showDashboard = data.length > 0 && !isUploading;
    const currency = meta.currency === 'MIXED' ? 'EUR' : (meta.currency || data[0]?.transactionCurrency || 'EUR');

    // ── Derived aggregations ───────────────────────────────────────────────────

    const {
        earningsByLever,
        earningsByMonth,
        earningsByCustomer,
        topCustomers,
        earningsByProduct,
        uniqueLevers,
        uniqueStatuses,
        unprocessedAmount,
        nextPayment,
    } = useEarningsAggregations(data);

    // Customers table sorting via the shared hook (tri-state toggle, desc-first).
    const { sorted: sortedCustomers, sortConfig: custSort, toggleSort: toggleCustSort } =
        useSortableData(earningsByCustomer, { key: 'amount', direction: 'desc' }, 'desc');

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
        exportToXlsx(rows, 'Earnings', `earnings-${new Date().toISOString().slice(0, 10)}.xlsx`);
    };

    const handleLeverBarClick = (entry: any) => {
        if (!entry?.lever) return;
        setFilterLever(entry.lever === filterLever ? '' : entry.lever);
        setActiveTab('records');
    };

    const handleCustomerBarClick = (entry: any) => {
        const customerName = entry?.customerName ?? entry?.activePayload?.[0]?.payload?.customerName;
        if (!customerName) return;
        setDrillCustomer(customerName);
    };

    const toggleProdSort = (key: string) =>
        setProdSort(s => ({ key, dir: s.key === key && s.dir === 'desc' ? 'asc' : 'desc' }));

    const custSortIcon = { key: custSort?.key ?? 'amount', dir: (custSort?.direction ?? 'desc') as SortDir };

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
                        onCancel={cancelEarningsParse}
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
                    { icon: <TrendingUp size={18} color="#10B981" />, label: 'Total Earnings', value: meta.currency === 'MIXED' ? 'Multiple currencies' : fmtShort(meta.totalEarningAmount, currency), sub: meta.currency, color: '#10B981' },
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
                                    data={topCustomers}
                                    margin={{ left: 10, right: 20, top: 4, bottom: 65 }}
                                >
                                    <CartesianGrid {...gridStyle} />
                                    <XAxis dataKey="customerName" tick={{ ...axisStyle, textAnchor: 'end' }} angle={-35} interval={0} />
                                    <YAxis tickFormatter={v => fmtShort(v, currency)} tick={axisStyle} width={70} />
                                    <Tooltip formatter={(v: any) => [fmt(v, currency), 'Earnings']} {...tooltipStyle} />
                                    <Bar dataKey="amount" radius={[4, 4, 0, 0]} cursor="pointer" onClick={handleCustomerBarClick}>
                                        {topCustomers.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
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
                                    <span style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>Customer <SortIcon col="customerName" current={custSortIcon} /></span>
                                </th>
                                <th style={{ ...thStyle, textAlign: 'right' }} onClick={() => toggleCustSort('amount')}>
                                    <span style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', justifyContent: 'flex-end' }}>Earnings <SortIcon col="amount" current={custSortIcon} /></span>
                                </th>
                                <th style={{ ...thStyle, textAlign: 'right' }} onClick={() => toggleCustSort('records')}>
                                    <span style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', justifyContent: 'flex-end' }}>Records <SortIcon col="records" current={custSortIcon} /></span>
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
                        {filteredRecords.length > 500 && (
                            <div style={{ padding: '0.75rem 1rem', fontSize: '0.85rem', color: 'var(--text-tertiary)', borderTop: '1px solid var(--border-color)', textAlign: 'center' }}>
                                Showing first 500 of {filteredRecords.length.toLocaleString('nl-NL')}. Use Export Excel for the full dataset.
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* ── Payments Tab ───────────────────────────────────────────────── */}
            {activeTab === 'payments' && <PaymentsView />}
        </div>
    );
};
