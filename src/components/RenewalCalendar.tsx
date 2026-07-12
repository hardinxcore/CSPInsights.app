import React, { useMemo, useRef, useState } from 'react';
import Papa from 'papaparse';
import { useBillingStore } from '../store/billingStore';
import type { BillingRecord } from '../types/BillingData';
import { Calendar, List, Clock, AlertTriangle, TrendingUp, Download, Upload, X } from 'lucide-react';
import { exportToXlsx } from '../utils/exportXlsx';

import type { TermCategory, ViewMode, RenewalEntry, ESTUploadRecord } from './renewals/types';
import { EST_FUTURE_COLOR, TERM_COLORS, TERM_LABELS } from './renewals/constants';
import { classifyTerm, parseDate, toMidnight, formatDate, formatCurrency, dayKey } from './renewals/helpers';
import { parseESTResults } from './renewals/estParser';
import { SummaryCard } from './renewals/SummaryCard';
import { TermDot } from './renewals/TermDot';
import { CalendarGrid } from './renewals/CalendarGrid';
import { RenewalListView } from './renewals/RenewalListView';
import { ESTCalendarPanel } from './renewals/ESTUploadPanel';

// ── Main Component ─────────────────────────────────────────────────────────────

export const RenewalCalendar: React.FC = () => {
    const { data } = useBillingStore();

    const [viewMode, setViewMode] = useState<ViewMode>('calendar');
    const [currentMonth, setCurrentMonth] = useState<Date>(() => toMidnight(new Date(new Date().getFullYear(), new Date().getMonth(), 1)));
    const [selectedDay, setSelectedDay] = useState<Date | null>(null);
    const [filterTerm, setFilterTerm] = useState<TermCategory | null>(null);
    const [filterDays, setFilterDays] = useState<number>(90);
    const [search, setSearch] = useState('');
    const [expandedRow, setExpandedRow] = useState<string | null>(null);
    const [estUploadRecords, setEstUploadRecords] = useState<ESTUploadRecord[]>([]);
    const [estUploadError, setEstUploadError] = useState<string | null>(null);
    const estFileInputRef = useRef<HTMLInputElement>(null);

    const today = useMemo(() => toMidnight(new Date()), []);

    // ── Build deduplicated renewal entries ─────────────────────────────────────
    const allRenewals = useMemo<RenewalEntry[]>(() => {
        // Keep only the row with the latest SubscriptionEndDate per SubscriptionId
        const map = new Map<string, BillingRecord>();
        for (const row of data) {
            if (!row.SubscriptionEndDate || !row.SubscriptionId) continue;
            const existing = map.get(row.SubscriptionId);
            if (!existing || row.SubscriptionEndDate > (existing.SubscriptionEndDate ?? '')) {
                map.set(row.SubscriptionId, row);
            }
        }

        const entries: RenewalEntry[] = [];
        for (const row of map.values()) {
            const endDate = parseDate(row.SubscriptionEndDate);
            if (!endDate) continue;
            const end = toMidnight(endDate);

            const startDate = row.SubscriptionStartDate ? parseDate(row.SubscriptionStartDate) : null;
            if (startDate) startDate.setHours(0, 0, 0, 0);

            const daysUntil = Math.ceil((end.getTime() - today.getTime()) / 86_400_000);
            const daysSinceStart = startDate
                ? Math.floor((today.getTime() - startDate.getTime()) / 86_400_000)
                : 999;

            const termCategory = classifyTerm(row.TermAndBillingCycle);

            entries.push({
                subscriptionId: row.SubscriptionId,
                customerName: row.CustomerName,
                productName: row.ProductName,
                termCategory,
                term: row.TermAndBillingCycle,
                endDate: end,
                startDate,
                quantity: row.Quantity ?? 0,
                value: row.Total ?? row.Subtotal ?? 0,
                currency: row.Currency ?? row.PricingCurrency ?? 'EUR',
                daysUntil,
                isCancellable: daysSinceStart >= -1 && daysSinceStart <= 7,
                orderId: row.OrderId,
            });
        }
        return entries;
    }, [data, today]);

    // ── Subscription ID → customer name lookup from billing data ──────────────
    const subscriptionCustomerMap = useMemo(() => {
        const m = new Map<string, string>();
        for (const row of data) {
            if (row.SubscriptionId && row.CustomerName) {
                m.set(row.SubscriptionId.toLowerCase(), row.CustomerName);
            }
        }
        return m;
    }, [data]);

    // ── Parse Partner Center EST export CSV ───────────────────────────────────
    const handleESTFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setEstUploadError(null);

        Papa.parse<Record<string, string>>(file, {
            header: true,
            skipEmptyLines: 'greedy',
            encoding: 'UTF-8',
            complete: (results) => {
                const outcome = parseESTResults(results, today, subscriptionCustomerMap);
                if (outcome.kind === 'error') {
                    setEstUploadError(outcome.message);
                    if (estFileInputRef.current) estFileInputRef.current.value = '';
                    return;
                }
                // Set parse warning (if any) before showing records
                if (outcome.warning) setEstUploadError(outcome.warning);
                setEstUploadRecords(outcome.records);
                // Reset file input so re-uploading the same file triggers onChange
                if (estFileInputRef.current) estFileInputRef.current.value = '';
            },
            error: (err: any) => {
                setEstUploadError(`Parse error: ${err.message}`);
                if (estFileInputRef.current) estFileInputRef.current.value = '';
            },
        });
    };

    // Sorted by soonest TermEndDate first
    const estUploadSorted = useMemo(
        () => [...estUploadRecords].sort((a, b) => (a.daysUntilEST) - (b.daysUntilEST)),
        [estUploadRecords]
    );

    // ── Apply search + term filter ─────────────────────────────────────────────
    const filteredRenewals = useMemo(() => {
        const s = search.toLowerCase();
        return allRenewals.filter(r => {
            if (filterTerm && r.termCategory !== filterTerm) return false;
            if (s && !r.customerName.toLowerCase().includes(s) && !r.productName.toLowerCase().includes(s)) return false;
            return true;
        });
    }, [allRenewals, filterTerm, search]);

    // Renewals within the selected days window, ascending by date
    const upcomingRenewals = useMemo(() =>
        filteredRenewals
            .filter(r => r.daysUntil >= 0 && r.daysUntil <= filterDays)
            .sort((a, b) => a.daysUntil - b.daysUntil),
        [filteredRenewals, filterDays]);

    // ── Summary stats ──────────────────────────────────────────────────────────
    const stats = useMemo(() => {
        const monthEnd = new Date(today.getFullYear(), today.getMonth() + 1, 0);
        const thisMonth = filteredRenewals.filter(r => r.daysUntil >= 0 && r.endDate <= monthEnd);
        const next30 = filteredRenewals.filter(r => r.daysUntil >= 0 && r.daysUntil <= 30);
        const cancellable = allRenewals.filter(r => r.isCancellable);
        const windowValue = upcomingRenewals.reduce((s, r) => s + r.value, 0);
        const currency = filteredRenewals[0]?.currency ?? 'EUR';
        return { thisMonth, next30, cancellable, windowValue, currency };
    }, [filteredRenewals, upcomingRenewals, allRenewals, today]);

    // ── Calendar grid ──────────────────────────────────────────────────────────
    const calendarCells = useMemo<(Date | null)[]>(() => {
        const year = currentMonth.getFullYear();
        const month = currentMonth.getMonth();
        const firstDow = new Date(year, month, 1).getDay(); // 0 = Sun
        const startOffset = (firstDow + 6) % 7; // convert to Monday-first
        const daysInMonth = new Date(year, month + 1, 0).getDate();
        const cells: (Date | null)[] = Array(startOffset).fill(null);
        for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(year, month, d));
        return cells;
    }, [currentMonth]);

    const renewalsByDay = useMemo(() => {
        const map = new Map<string, RenewalEntry[]>();
        for (const r of filteredRenewals) {
            const k = dayKey(r.endDate);
            if (!map.has(k)) map.set(k, []);
            map.get(k)!.push(r);
        }
        return map;
    }, [filteredRenewals]);

    const selectedDayRenewals = useMemo(() => {
        if (!selectedDay) return [];
        return renewalsByDay.get(dayKey(selectedDay)) ?? [];
    }, [selectedDay, renewalsByDay]);

    // ── Export ─────────────────────────────────────────────────────────────────
    const handleExport = () => {
        const rows = upcomingRenewals.map(r => ({
            'Customer': r.customerName,
            'Product': r.productName,
            'Term': r.term,
            'Category': r.termCategory,
            'Original End Date': formatDate(r.endDate),
            'Days': r.daysUntil,
            'Quantity': r.quantity,
            'Value': r.value,
            'Currency': r.currency,
            'NCE Cancellable (7-day window)': r.isCancellable ? 'Yes' : 'No',
            'Subscription ID': r.subscriptionId,
            'Order ID': r.orderId ?? '',
        }));
        exportToXlsx(rows, 'Renewals', `Renewal_Calendar_${dayKey(today)}.xlsx`);
    };

    // ── Empty state ────────────────────────────────────────────────────────────
    if (!data.length) {
        return (
            <div style={{ padding: '4rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
                <Calendar size={48} style={{ margin: '0 auto 1rem', opacity: 0.3, display: 'block' }} />
                <p>Load billing data to view the renewal calendar.</p>
            </div>
        );
    }

    // ── Render ─────────────────────────────────────────────────────────────────
    return (
        <div style={{ padding: '1.5rem', maxWidth: '1400px', margin: '0 auto' }}>

            {/* Summary cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
                <SummaryCard icon={<Calendar size={20} />} color="#10B981" label="Renewals This Month"
                    value={stats.thisMonth.length.toString()}
                    sub={formatCurrency(stats.thisMonth.reduce((s, r) => s + r.value, 0), stats.currency)} />
                <SummaryCard icon={<Clock size={20} />} color="#00B5E2" label="Next 30 Days"
                    value={stats.next30.length.toString()}
                    sub={formatCurrency(stats.next30.reduce((s, r) => s + r.value, 0), stats.currency)} />
                <SummaryCard icon={<TrendingUp size={20} />} color="#8B5CF6" label={`Next ${filterDays} Days`}
                    value={upcomingRenewals.length.toString()}
                    sub={formatCurrency(stats.windowValue, stats.currency)} />
                <SummaryCard icon={<AlertTriangle size={20} />} color="#FE5000" label="NCE Cancellable Now"
                    value={stats.cancellable.length.toString()} sub="Within 7-day window"
                    alert={stats.cancellable.length > 0} />
                <SummaryCard icon={<Upload size={20} />} color={EST_FUTURE_COLOR} label="Entering EST (PC Upload)"
                    value={estUploadRecords.length.toString()}
                    sub={estUploadRecords.length > 0 ? `${estUploadRecords.filter(r => r.daysUntilEST >= 0 && r.daysUntilEST <= 90).length} within 90 days` : 'Upload PC EST export'}
                    alert={estUploadRecords.some(r => r.daysUntilEST >= 0 && r.daysUntilEST <= 30)} />
            </div>

            {/* Toolbar */}
            <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'center', marginBottom: '1rem' }}>
                {/* View toggle */}
                <div style={{ display: 'flex', background: 'var(--bg-secondary)', borderRadius: '8px', padding: '3px', border: '1px solid var(--border-color)' }}>
                    {(['calendar', 'list'] as ViewMode[]).map(m => (
                        <button key={m} onClick={() => setViewMode(m)} style={{
                            padding: '0.35rem 0.85rem', borderRadius: '6px', border: 'none', cursor: 'pointer',
                            fontSize: '0.85rem', fontWeight: 500,
                            background: viewMode === m ? 'var(--bg-tertiary)' : 'transparent',
                            color: viewMode === m ? 'var(--text-primary)' : 'var(--text-secondary)',
                            display: 'flex', alignItems: 'center', gap: '0.4rem',
                        }}>
                            {m === 'calendar' ? <Calendar size={14} /> : <List size={14} />}
                            {m === 'calendar' ? 'Calendar' : 'List'}
                        </button>
                    ))}
                </div>

                {/* Window filter */}
                <select value={filterDays} onChange={e => setFilterDays(Number(e.target.value))} style={{
                    padding: '0.4rem 0.75rem', borderRadius: '8px', border: '1px solid var(--border-color)',
                    background: 'var(--bg-secondary)', color: 'var(--text-primary)', fontSize: '0.85rem', cursor: 'pointer',
                }}>
                    {[30, 60, 90, 180, 365].map(d => <option key={d} value={d}>Next {d} days</option>)}
                </select>

                {/* Term filter */}
                <select value={filterTerm ?? ''} onChange={e => setFilterTerm((e.target.value as TermCategory) || null)} style={{
                    padding: '0.4rem 0.75rem', borderRadius: '8px', border: '1px solid var(--border-color)',
                    background: 'var(--bg-secondary)', color: 'var(--text-primary)', fontSize: '0.85rem', cursor: 'pointer',
                }}>
                    <option value="">All term types</option>
                    {TERM_LABELS.map(t => <option key={t} value={t}>{t}</option>)}
                </select>

                {/* Search */}
                <input type="text" placeholder="Search customer or product..." value={search}
                    onChange={e => setSearch(e.target.value)}
                    style={{
                        flex: 1, minWidth: '180px', padding: '0.4rem 0.75rem', borderRadius: '8px',
                        border: '1px solid var(--border-color)', background: 'var(--bg-secondary)',
                        color: 'var(--text-primary)', fontSize: '0.85rem',
                    }} />

                {/* Export */}
                <button onClick={handleExport} style={{
                    padding: '0.4rem 0.85rem', borderRadius: '8px', border: '1px solid var(--border-color)',
                    background: 'var(--bg-secondary)', color: 'var(--text-primary)', fontSize: '0.85rem',
                    cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.4rem',
                }}>
                    <Download size={14} /> Export
                </button>

                {/* EST Upload */}
                <label title="Upload Partner Center AI Assist EST export CSV" style={{
                    padding: '0.4rem 0.85rem', borderRadius: '8px',
                    border: `1px solid ${estUploadRecords.length > 0 ? EST_FUTURE_COLOR : 'var(--border-color)'}`,
                    background: estUploadRecords.length > 0 ? `${EST_FUTURE_COLOR}18` : 'var(--bg-secondary)',
                    color: estUploadRecords.length > 0 ? EST_FUTURE_COLOR : 'var(--text-primary)',
                    fontSize: '0.85rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.4rem',
                }}>
                    <Upload size={14} />
                    {estUploadRecords.length > 0 ? `EST: ${estUploadRecords.length} subs` : 'Upload EST'}
                    <input ref={estFileInputRef} type="file" accept=".csv" onChange={handleESTFileUpload} style={{ display: 'none' }} />
                </label>
                {estUploadRecords.length > 0 && (
                    <button onClick={() => { setEstUploadRecords([]); setEstUploadError(null); }} title="Clear uploaded EST data" style={{
                        padding: '0.4rem', borderRadius: '8px', border: '1px solid var(--border-color)',
                        background: 'var(--bg-secondary)', color: 'var(--text-tertiary)', fontSize: '0.85rem',
                        cursor: 'pointer', display: 'flex', alignItems: 'center',
                    }}>
                        <X size={14} />
                    </button>
                )}
            </div>
            {estUploadError && (
                <div style={{ marginBottom: '1rem', padding: '0.6rem 0.9rem', background: 'rgba(254,80,0,0.08)', border: '1px solid rgba(254,80,0,0.3)', borderRadius: '8px', color: '#FE5000', fontSize: '0.83rem' }}>
                    {estUploadError}
                </div>
            )}

            {/* Term legend */}
            <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap', marginBottom: '1.25rem' }}>
                {TERM_LABELS.map(t => (
                    <button key={t} onClick={() => setFilterTerm(filterTerm === t ? null : t)} style={{
                        display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.25rem 0.65rem',
                        borderRadius: '20px', border: `1px solid ${TERM_COLORS[t]}`,
                        background: filterTerm === t ? TERM_COLORS[t] + '33' : 'transparent',
                        color: 'var(--text-secondary)', fontSize: '0.78rem', cursor: 'pointer',
                    }}>
                        <TermDot category={t} />
                        {t}
                    </button>
                ))}
            </div>

            {/* ── Calendar view ─────────────────────────────────────────────── */}
            {viewMode === 'calendar' && (
                <CalendarGrid
                    currentMonth={currentMonth}
                    setCurrentMonth={setCurrentMonth}
                    today={today}
                    selectedDay={selectedDay}
                    setSelectedDay={setSelectedDay}
                    calendarCells={calendarCells}
                    renewalsByDay={renewalsByDay}
                    selectedDayRenewals={selectedDayRenewals}
                    expandedRow={expandedRow}
                    setExpandedRow={setExpandedRow}
                />
            )}

            {/* ── List view ─────────────────────────────────────────────────── */}
            {viewMode === 'list' && (
                <RenewalListView
                    estUploadSorted={estUploadSorted}
                    upcomingRenewals={upcomingRenewals}
                    expandedRow={expandedRow}
                    setExpandedRow={setExpandedRow}
                />
            )}

            {/* Partner Center EST panel — calendar view */}
            {estUploadSorted.length > 0 && viewMode === 'calendar' && (
                <ESTCalendarPanel estUploadSorted={estUploadSorted} />
            )}

            {/* NCE Cancellable alert panel */}
            {stats.cancellable.length > 0 && (
                <div style={{ marginTop: '1.5rem', background: 'rgba(254,80,0,0.05)', border: '1px solid rgba(254,80,0,0.25)', borderRadius: '12px', padding: '1rem' }}>
                    <div style={{ fontWeight: 600, fontSize: '0.9rem', color: '#FE5000', display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
                        <AlertTriangle size={16} />
                        {stats.cancellable.length} subscription{stats.cancellable.length > 1 ? 's' : ''} within NCE 7-day cancellation window
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                        {stats.cancellable.map(r => (
                            <div key={r.subscriptionId} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.83rem', color: 'var(--text-secondary)' }}>
                                <span><strong style={{ color: 'var(--text-primary)' }}>{r.customerName}</strong> — {r.productName}</span>
                                <span style={{ color: 'var(--text-tertiary)' }}>{r.startDate ? `started ${formatDate(r.startDate)}` : ''}</span>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};
