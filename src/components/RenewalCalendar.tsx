import React, { useMemo, useRef, useState } from 'react';
import Papa from 'papaparse';
import { useBillingStore } from '../store/billingStore';
import type { BillingRecord } from '../types/BillingData';
import { Calendar, ChevronLeft, ChevronRight, List, Clock, AlertTriangle, TrendingUp, Download, Hourglass, Upload, X } from 'lucide-react';
import * as XLSX from 'xlsx';

// ── Types ──────────────────────────────────────────────────────────────────────

type TermCategory =
    | 'Monthly (Flex)'
    | 'Annual (Monthly Pay)'
    | 'Annual (Prepaid)'
    | '3 Year (Commit)'
    | 'Trial'
    | 'Other';

type ViewMode = 'calendar' | 'list';

interface RenewalEntry {
    subscriptionId: string;
    customerName: string;
    productName: string;
    termCategory: TermCategory;
    term: string;
    endDate: Date;
    startDate: Date | null;
    quantity: number;
    value: number;
    currency: string;
    daysUntil: number;
    isCancellable: boolean;
    orderId?: string;
}

/** A record from the Partner Center AI Assist EST export CSV */
interface ESTUploadRecord {
    customerTenantId: string;
    resellerPartnerId: string;
    subscriptionId: string;
    subscriptionName: string;
    offerId: string;
    quantity: number;
    termDuration: string;
    billingCycle: string;
    termEndDate: Date | null;
    errorMessage: string;
    evaluationTime: Date | null;
    /** Customer name resolved from billing data via SubscriptionId */
    resolvedCustomerName?: string;
    /** Days until this subscription enters EST (termEndDate − today) */
    daysUntilEST: number;
}

/** Indigo for subscriptions scheduled to enter EST (from PC upload) */
const EST_FUTURE_COLOR = '#818CF8';

// ── Constants ──────────────────────────────────────────────────────────────────

const TERM_COLORS: Record<TermCategory, string> = {
    'Monthly (Flex)':        '#F59E0B',
    'Annual (Monthly Pay)':  '#00B5E2',
    'Annual (Prepaid)':      '#10B981',
    '3 Year (Commit)':       '#8B5CF6',
    'Trial':                 '#6B7280',
    'Other':                 '#FE5000',
};

const TERM_LABELS: TermCategory[] = [
    'Monthly (Flex)', 'Annual (Monthly Pay)', 'Annual (Prepaid)', '3 Year (Commit)', 'Trial', 'Other',
];

const DAY_HEADERS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

// ── Helpers ────────────────────────────────────────────────────────────────────

function classifyTerm(raw: string): TermCategory {
    const t = (raw || '').toLowerCase();
    if (t.includes('trial')) return 'Trial';
    if (t.includes('three-year') || t.includes('3 year') || t.includes('triennial') || t.includes('p3y')) return '3 Year (Commit)';
    if (t.includes('one-year commitment for monthly')) return 'Annual (Monthly Pay)';
    if (t.includes('one-year commitment for yearly') || t.includes('one-year commitment for annual') || t === 'annual') return 'Annual (Prepaid)';
    if (t.includes('one-month commitment for monthly') || t === 'monthly' || t.includes('p1m')) return 'Monthly (Flex)';
    if (t.includes('annual') || t.includes('1 year')) return t.includes('monthly') ? 'Annual (Monthly Pay)' : 'Annual (Prepaid)';
    if (t.includes('month')) return 'Monthly (Flex)';
    return 'Other';
}

function parseDate(s: string | undefined): Date | null {
    if (!s) return null;
    const d = new Date(s);
    return isNaN(d.getTime()) ? null : d;
}

function toMidnight(d: Date): Date {
    const c = new Date(d);
    c.setHours(0, 0, 0, 0);
    return c;
}

function formatDate(d: Date): string {
    return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

function formatCurrency(v: number, currency: string): string {
    return v.toLocaleString('nl-NL', {
        style: 'currency', currency: currency || 'EUR',
        minimumFractionDigits: 0, maximumFractionDigits: 0,
    });
}

/** Parse Partner Center EST export date: MM/DD/YYYY HH:MM:SS */
function parseESTDate(s: string | undefined): Date | null {
    if (!s) return null;
    const m = s.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s+(\d{1,2}):(\d{2}):(\d{2}))?$/);
    if (!m) return null;
    const month = parseInt(m[1], 10) - 1;
    const day = parseInt(m[2], 10);
    const year = parseInt(m[3], 10);
    const hours = m[4] ? parseInt(m[4], 10) : 0;
    const minutes = m[5] ? parseInt(m[5], 10) : 0;
    const seconds = m[6] ? parseInt(m[6], 10) : 0;
    return new Date(year, month, day, hours, minutes, seconds);
}

/** Format a P-duration string to a readable label */
function formatDuration(d: string): string {
    if (!d) return d;
    if (d.toUpperCase() === 'P1Y') return '1 Year';
    if (d.toUpperCase() === 'P3Y') return '3 Year';
    if (d.toUpperCase() === 'P1M') return '1 Month';
    return d;
}

function isSameDay(a: Date, b: Date): boolean {
    return a.getFullYear() === b.getFullYear()
        && a.getMonth() === b.getMonth()
        && a.getDate() === b.getDate();
}

function dayKey(d: Date): string {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// ── Sub-components ─────────────────────────────────────────────────────────────

const SummaryCard: React.FC<{
    icon: React.ReactNode; color: string;
    label: string; value: string; sub: string; alert?: boolean;
}> = ({ icon, color, label, value, sub, alert }) => (
    <div style={{
        background: 'var(--bg-secondary)', borderRadius: '12px', padding: '1rem 1.25rem',
        border: `1px solid ${alert ? color + '55' : 'var(--border-color)'}`,
        display: 'flex', gap: '0.75rem', alignItems: 'flex-start',
    }}>
        <div style={{ color, marginTop: '0.1rem', flexShrink: 0 }}>{icon}</div>
        <div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', marginBottom: '0.25rem' }}>{label}</div>
            <div style={{ fontSize: '1.4rem', fontWeight: 700, color: alert ? color : 'var(--text-primary)', lineHeight: 1 }}>{value}</div>
            <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>{sub}</div>
        </div>
    </div>
);

const TermDot: React.FC<{ category: TermCategory; size?: number }> = ({ category, size = 8 }) => (
    <span style={{
        display: 'inline-block', width: size, height: size, borderRadius: '50%',
        background: TERM_COLORS[category], flexShrink: 0,
    }} />
);

const RenewalDetailRow: React.FC<{ renewal: RenewalEntry; isExpanded: boolean; onToggle: () => void }> = ({ renewal: r, isExpanded, onToggle }) => (
    <div style={{ borderRadius: '8px', border: '1px solid var(--border-color)', overflow: 'hidden' }}>
        <div onClick={onToggle} style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            padding: '0.55rem 0.75rem', background: isExpanded ? 'rgba(99,102,241,0.08)' : 'var(--bg-tertiary)',
            gap: '0.75rem', cursor: 'pointer',
        }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', flex: 1, minWidth: 0 }}>
                <TermDot category={r.termCategory} size={10} />
                <div style={{ minWidth: 0 }}>
                    <div style={{ fontWeight: 600, fontSize: '0.85rem', color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.customerName}</div>
                    <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.productName}</div>
                </div>
            </div>
            <div style={{ textAlign: 'right', flexShrink: 0 }}>
                <div style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary)' }}>{formatCurrency(r.value, r.currency)}</div>
                <div style={{ fontSize: '0.74rem', color: 'var(--text-tertiary)' }}>{r.termCategory}</div>
            </div>
        </div>
        {isExpanded && (
            <div style={{ padding: '0.75rem 1rem', background: 'rgba(99,102,241,0.04)', borderTop: '1px solid var(--border-color)', fontSize: '0.8rem' }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.5rem', color: 'var(--text-secondary)' }}>
                    <div><span style={{ color: 'var(--text-tertiary)' }}>Subscription ID</span><br /><code style={{ fontSize: '0.75rem' }}>{r.subscriptionId}</code></div>
                    {r.startDate && <div><span style={{ color: 'var(--text-tertiary)' }}>Start Date</span><br />{formatDate(r.startDate)}</div>}
                    <div><span style={{ color: 'var(--text-tertiary)' }}>Renewal Date</span><br />{formatDate(r.endDate)}</div>
                    <div><span style={{ color: 'var(--text-tertiary)' }}>Quantity</span><br />{r.quantity}</div>
                    {r.orderId && <div><span style={{ color: 'var(--text-tertiary)' }}>Order ID</span><br /><code style={{ fontSize: '0.75rem' }}>{r.orderId}</code></div>}
                    <div><span style={{ color: 'var(--text-tertiary)' }}>Full Term</span><br />{r.term}</div>
                    {r.isCancellable && (
                        <div style={{ gridColumn: '1 / -1', background: 'rgba(254,80,0,0.08)', border: '1px solid rgba(254,80,0,0.3)', borderRadius: '6px', padding: '0.4rem 0.65rem', color: '#FE5000', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                            <AlertTriangle size={14} /> NCE 7-day cancellation window active
                        </div>
                    )}
                </div>
            </div>
        )}
    </div>
);

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

        Papa.parse(file, {
            header: true,
            skipEmptyLines: 'greedy',
            encoding: 'UTF-8',
            complete: (results) => {
                // Surface parse errors as a warning; Papa may still return partial data
                const parseErrors = results.errors;
                const parseWarning = parseErrors.length
                    ? `${parseErrors.length} parse issue(s) — some rows may be missing: ${parseErrors
                          .slice(0, 3)
                          // +2 adjusts for 1-based row numbers plus the header row
                          .map(e => `row ${e.row != null ? e.row + 2 : '?'}: ${e.message}`)
                          .join('; ')}${parseErrors.length > 3 ? ` … and ${parseErrors.length - 3} more` : ''}`
                    : null;

                const rows = results.data as Record<string, string>[];
                if (!rows.length) {
                    setEstUploadError(
                        parseWarning
                            ? `No data rows found in the uploaded file. ${parseWarning}`
                            : 'No data rows found in the uploaded file.',
                    );
                    if (estFileInputRef.current) estFileInputRef.current.value = '';
                    return;
                }
                // Validate that it looks like a PC EST export
                const first = rows[0];
                if (!('SubscriptionId' in first) && !('subscriptionId' in first)) {
                    setEstUploadError(
                        parseWarning
                            ? `Unrecognised file format. Expected a Partner Center EST export with a SubscriptionId column. ${parseWarning}`
                            : 'Unrecognised file format. Expected a Partner Center EST export with a SubscriptionId column.',
                    );
                    if (estFileInputRef.current) estFileInputRef.current.value = '';
                    return;
                }

                // Set parse warning (if any) before processing records
                if (parseWarning) setEstUploadError(parseWarning);

                const parsed: ESTUploadRecord[] = [];
                for (const row of rows) {
                    const subId = (row['SubscriptionId'] || row['subscriptionId'] || '').trim();
                    if (!subId) continue;
                    const termEndDate = parseESTDate(row['TermEndDate'] || row['termEndDate']);
                    const evaluationTime = parseESTDate(row['EvaluationTime'] || row['evaluationTime']);
                    const daysUntilEST = termEndDate
                        ? Math.ceil((toMidnight(termEndDate).getTime() - today.getTime()) / 86_400_000)
                        : Number.POSITIVE_INFINITY;
                    const resolvedCustomerName = subscriptionCustomerMap.get(subId.toLowerCase());
                    const record: ESTUploadRecord = {
                        customerTenantId: (row['CustomerTenantId'] || row['customerTenantId'] || '').trim(),
                        resellerPartnerId: (row['ResellerPartnerId'] || row['resellerPartnerId'] || '').trim(),
                        subscriptionId: subId,
                        subscriptionName: (row['SubscriptionName'] || row['subscriptionName'] || '').trim(),
                        offerId: (row['OfferId'] || row['offerId'] || '').trim(),
                        quantity: parseInt(row['Quantity'] || row['quantity'] || '0', 10) || 0,
                        termDuration: (row['TermDuration'] || row['termDuration'] || '').trim(),
                        billingCycle: (row['BillingCycle'] || row['billingCycle'] || '').trim(),
                        termEndDate,
                        errorMessage: (row['ErrorMessage'] || row['errorMessage'] || '').trim(),
                        evaluationTime,
                        resolvedCustomerName,
                        daysUntilEST,
                    };
                    parsed.push(record);
                }

                setEstUploadRecords(parsed);
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
        const ws = XLSX.utils.json_to_sheet(rows);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Renewals');
        XLSX.writeFile(wb, `Renewal_Calendar_${dayKey(today)}.xlsx`);
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
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    {/* Month navigation */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <button onClick={() => setCurrentMonth(m => new Date(m.getFullYear(), m.getMonth() - 1, 1))}
                            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', padding: '0.3rem', display: 'flex' }}>
                            <ChevronLeft size={20} />
                        </button>
                        <span style={{ fontWeight: 600, fontSize: '1.05rem', color: 'var(--text-primary)', minWidth: '150px', textAlign: 'center' }}>
                            {currentMonth.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })}
                        </span>
                        <button onClick={() => setCurrentMonth(m => new Date(m.getFullYear(), m.getMonth() + 1, 1))}
                            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', padding: '0.3rem', display: 'flex' }}>
                            <ChevronRight size={20} />
                        </button>
                        <button onClick={() => { setCurrentMonth(new Date(today.getFullYear(), today.getMonth(), 1)); setSelectedDay(null); }}
                            style={{ fontSize: '0.8rem', padding: '0.25rem 0.65rem', borderRadius: '6px', border: '1px solid var(--border-color)', background: 'var(--bg-secondary)', color: 'var(--text-secondary)', cursor: 'pointer' }}>
                            Today
                        </button>
                    </div>

                    {/* Grid */}
                    <div style={{ background: 'var(--bg-secondary)', borderRadius: '12px', border: '1px solid var(--border-color)', overflow: 'hidden' }}>
                        {/* Day headers */}
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', borderBottom: '1px solid var(--border-color)' }}>
                            {DAY_HEADERS.map(h => (
                                <div key={h} style={{ padding: '0.5rem', textAlign: 'center', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-tertiary)', letterSpacing: '0.04em' }}>{h}</div>
                            ))}
                        </div>

                        {/* Day cells */}
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)' }}>
                            {calendarCells.map((day, i) => {
                                if (!day) return (
                                    <div key={`e${i}`} style={{ minHeight: '80px', borderRight: '1px solid var(--border-color)', borderBottom: '1px solid var(--border-color)', background: 'var(--bg-tertiary)', opacity: 0.4 }} />
                                );
                                const k = dayKey(day);
                                const dayRenewals = renewalsByDay.get(k) ?? [];
                                const isToday = isSameDay(day, today);
                                const isSelected = selectedDay ? isSameDay(day, selectedDay) : false;
                                const isPast = day < today && !isToday;
                                const hasItems = dayRenewals.length > 0;
                                return (
                                    <div key={k} onClick={() => hasItems ? setSelectedDay(isSelected ? null : day) : undefined}
                                        style={{
                                            minHeight: '80px', padding: '0.4rem',
                                            borderRight: '1px solid var(--border-color)', borderBottom: '1px solid var(--border-color)',
                                            background: isSelected ? 'rgba(99,102,241,0.1)' : isToday ? 'rgba(16,185,129,0.06)' : 'transparent',
                                            cursor: hasItems ? 'pointer' : 'default',
                                            opacity: isPast ? 0.45 : 1,
                                            transition: 'background 0.12s',
                                        }}>
                                        <div style={{
                                            width: 22, height: 22, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                                            fontSize: '0.8rem', fontWeight: isToday ? 700 : 400,
                                            color: isToday ? '#10B981' : isSelected ? 'var(--accent-primary)' : 'var(--text-secondary)',
                                            background: isToday ? 'rgba(16,185,129,0.15)' : 'transparent',
                                            marginBottom: '0.3rem',
                                        }}>
                                            {day.getDate()}
                                        </div>
                                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '2px', alignItems: 'center' }}>
                                            {dayRenewals.slice(0, 6).map((r, j) => (
                                                <TermDot key={j} category={r.termCategory} size={8} />
                                            ))}
                                            {dayRenewals.length > 6 && (
                                                <span style={{ fontSize: '0.65rem', color: 'var(--text-tertiary)', lineHeight: '8px' }}>+{dayRenewals.length - 6}</span>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {/* Selected day detail */}
                    {selectedDay && (
                        <div style={{ background: 'var(--bg-secondary)', borderRadius: '12px', border: '1px solid var(--border-color)', padding: '1rem' }}>
                            <div style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '0.75rem' }}>
                                {selectedDayRenewals.length > 0
                                    ? `${selectedDayRenewals.length} renewal${selectedDayRenewals.length > 1 ? 's' : ''} on ${formatDate(selectedDay)}`
                                    : `No renewals on ${formatDate(selectedDay)}`}
                            </div>
                            {selectedDayRenewals.length > 0 && (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>
                                    {selectedDayRenewals.map(r => (
                                        <RenewalDetailRow
                                            key={r.subscriptionId}
                                            renewal={r}
                                            isExpanded={expandedRow === r.subscriptionId}
                                            onToggle={() => setExpandedRow(expandedRow === r.subscriptionId ? null : r.subscriptionId)}
                                        />
                                    ))}
                                </div>
                            )}
                        </div>
                    )}
                </div>
            )}

            {/* ── List view ─────────────────────────────────────────────────── */}
            {viewMode === 'list' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>

                {/* Partner Center EST upload section */}
                {estUploadSorted.length > 0 && (
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
                )}

                <div style={{ background: 'var(--bg-secondary)', borderRadius: '12px', border: '1px solid var(--border-color)', overflow: 'hidden' }}>
                    {upcomingRenewals.length === 0 ? (
                        <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-tertiary)' }}>
                            No renewals found in the selected window.
                        </div>
                    ) : (() => {
                        // Group by month for section headers
                        const groups = new Map<string, RenewalEntry[]>();
                        for (const r of upcomingRenewals) {
                            const label = r.endDate.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
                            if (!groups.has(label)) groups.set(label, []);
                            groups.get(label)!.push(r);
                        }
                        return Array.from(groups.entries()).map(([month, items]) => (
                            <React.Fragment key={month}>
                                <div style={{ padding: '0.5rem 0.75rem', background: 'var(--bg-tertiary)', borderBottom: '1px solid var(--border-color)', fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-tertiary)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                                    {month} — {items.length} renewal{items.length > 1 ? 's' : ''}
                                </div>
                                {items.map((r, i) => {
                                    const isExpanded = expandedRow === r.subscriptionId;
                                    const urgencyColor = r.daysUntil <= 7 ? '#FE5000' : r.daysUntil <= 30 ? '#F59E0B' : 'var(--text-secondary)';
                                    return (
                                        <React.Fragment key={r.subscriptionId}>
                                            <div onClick={() => setExpandedRow(isExpanded ? null : r.subscriptionId)}
                                                style={{
                                                    display: 'grid', gridTemplateColumns: '1fr 1fr auto auto auto auto',
                                                    gap: '0.5rem', alignItems: 'center',
                                                    padding: '0.6rem 0.75rem', cursor: 'pointer',
                                                    borderBottom: '1px solid var(--border-color)',
                                                    background: i % 2 === 0 ? 'transparent' : 'var(--bg-tertiary)',
                                                    fontSize: '0.85rem',
                                                }}>
                                                <div style={{ color: 'var(--text-primary)', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.customerName}</div>
                                                <div style={{ color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.productName}</div>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', whiteSpace: 'nowrap' }}>
                                                    <TermDot category={r.termCategory} />
                                                    <span style={{ color: 'var(--text-tertiary)', fontSize: '0.78rem' }}>{r.termCategory}</span>
                                                </div>
                                                <div style={{ color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>{formatDate(r.endDate)}</div>
                                                <div style={{ fontWeight: 700, color: urgencyColor, whiteSpace: 'nowrap', textAlign: 'right' }}>
                                                    {r.daysUntil === 0 ? 'Today' : `${r.daysUntil}d`}
                                                </div>
                                                <div style={{ fontWeight: 600, color: 'var(--text-primary)', whiteSpace: 'nowrap', textAlign: 'right' }}>{formatCurrency(r.value, r.currency)}</div>
                                            </div>
                                            {isExpanded && (
                                                <div style={{ padding: '0.75rem 1rem', background: 'rgba(99,102,241,0.04)', borderBottom: '1px solid var(--border-color)', fontSize: '0.8rem' }}>
                                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.5rem', color: 'var(--text-secondary)' }}>
                                                        <div><span style={{ color: 'var(--text-tertiary)' }}>Subscription ID</span><br /><code style={{ fontSize: '0.75rem' }}>{r.subscriptionId}</code></div>
                                                        {r.startDate && <div><span style={{ color: 'var(--text-tertiary)' }}>Start Date</span><br />{formatDate(r.startDate)}</div>}
                                                        <div><span style={{ color: 'var(--text-tertiary)' }}>Renewal Date</span><br />{formatDate(r.endDate)}</div>
                                                        <div><span style={{ color: 'var(--text-tertiary)' }}>Quantity</span><br />{r.quantity}</div>
                                                        {r.orderId && <div><span style={{ color: 'var(--text-tertiary)' }}>Order ID</span><br /><code style={{ fontSize: '0.75rem' }}>{r.orderId}</code></div>}
                                                        <div><span style={{ color: 'var(--text-tertiary)' }}>Full Term</span><br />{r.term}</div>
                                                        {r.isCancellable && (
                                                            <div style={{ gridColumn: '1 / -1', background: 'rgba(254,80,0,0.08)', border: '1px solid rgba(254,80,0,0.3)', borderRadius: '6px', padding: '0.4rem 0.65rem', color: '#FE5000', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                                                <AlertTriangle size={14} /> NCE 7-day cancellation window active
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            )}
                                        </React.Fragment>
                                    );
                                })}
                            </React.Fragment>
                        ));
                    })()}
                </div>
                </div>
            )}

            {/* Partner Center EST panel — calendar view */}
            {estUploadSorted.length > 0 && viewMode === 'calendar' && (
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
