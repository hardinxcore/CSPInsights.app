import React, { useState, useMemo } from 'react';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, Legend,
} from 'recharts';
import {
    TrendingUp, Download, Plus, Trash2, ShieldCheck,
    CreditCard, Banknote, Receipt,
} from 'lucide-react';
import { useEarningsStore } from '../../store/earningsStore';
import { cancelPaymentsParse, parsePaymentsCSV } from '../../utils/paymentsParser';
import { FileDropZone } from '../FileDropZone';
import { exportToXlsx } from '../../utils/exportXlsx';
import type { PaymentRecord } from '../../types/EarningsData';
import {
    CHART_COLORS, axisStyle, gridStyle, tooltipStyle, fmt, fmtShort, thStyle, tdStyle,
} from './shared';

// ── Payments tab (upload + dashboard) ─────────────────────────────────────────
export const PaymentsView: React.FC = () => {
    const {
        payments, paymentsMeta, setPayments, appendPayments, resetPayments,
    } = useEarningsStore();

    // Payments upload state
    const [isUploadingPayments, setIsUploadingPayments] = useState(false);
    const [isParsingPayments, setIsParsingPayments] = useState(false);

    // ── Payments derived data ──────────────────────────────────────────────────

    const paymentsCurrency = paymentsMeta.currency === 'MIXED' ? 'EUR' : (paymentsMeta.currency || payments[0]?.earnedCurrencyCode || 'EUR');

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

    // Memoized: this used to be copied + sorted inline in the table JSX on
    // every render (including row hovers)
    const paymentsSorted = useMemo(
        () => [...payments].sort((a, b) => new Date(b.paymentDate).getTime() - new Date(a.paymentDate).getTime()),
        [payments]
    );

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

    // ── Handlers ──────────────────────────────────────────────────────────────

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
        exportToXlsx(rows, 'Payments', `payments-${new Date().toISOString().slice(0, 10)}.xlsx`);
    };

    return (
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
                        onCancel={cancelPaymentsParse}
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
                            { icon: <Receipt size={18} color="#F59E0B" />, label: 'Total Tax', value: paymentsMeta.currency === 'MIXED' ? 'Multiple currencies' : fmtShort(paymentsMeta.totalTax, paymentsCurrency), sub: 'sales + withheld + service fee', color: '#F59E0B' },
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
                                {paymentsSorted.map((r: PaymentRecord) => (
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
    );
};
