import React, { useMemo, useState, useRef } from 'react';
import type { ParseResult, BillingRecord } from '../types/BillingData';
import { useVirtualizer } from '@tanstack/react-virtual';
import { ArrowUpDown, ArrowUp, ArrowDown, Download, Layers, Table as TableIcon, Settings, Printer, Percent, Check, Tag, Trash2 } from 'lucide-react';
import { DashboardCharts } from './DashboardCharts';
import { RebillingTable } from './RebillingTable';
import { FilterPanel } from './FilterPanel';
import { MarginManager } from './MarginManager';
import { ComparisonView } from './ComparisonView';
import { InvoicePreview } from './InvoicePreview';
import { CustomerDetail } from './CustomerDetail';
import { AzureAnalyzer } from './AzureAnalyzer';

import { useBillingStore } from '../store/billingStore';

import { calculateSellPrice } from '../utils/pricing';
import * as XLSX from 'xlsx'; // Assuming we will install this, or use Papa for now. Plan said install xlsx.
import './Dashboard.css';

interface DashboardProps {
    data: ParseResult;
    onReset: () => void;
    onClearData: () => void;
}

type SortKey = keyof BillingRecord | 'TotalAmount' | 'SellPrice';
type SortDirection = 'asc' | 'desc';
type ViewMode = 'detail' | 'rebill' | 'comparison' | 'azure';

interface SortConfig {
    key: SortKey;
    direction: SortDirection;
}

interface InvoiceData {
    customerName: string;
    customerId: string;
    items: any[];
    totalAmount: number;
    currency: string;
}

const ALL_COLUMNS = [
    'CustomerName', 'ProductName', 'ChargeType',
    'Quantity', 'UnitPrice', 'TotalAmount', 'PublisherName',
    'SubscriptionDescription', 'InvoiceNumber', 'TermAndBillingCycle',
    'ChargeStartDate', 'ChargeEndDate', 'BillableDays'
];

export const Dashboard: React.FC<DashboardProps> = ({ data, onReset, onClearData }) => {
    const { meta, data: rows } = data;
    const { globalMargin, marginRules, customerTags, searchQuery, setCustomerMargin } = useBillingStore(); // Add setCustomerMargin

    const [showAnomaliesOnly, setShowAnomaliesOnly] = useState(false); // New state for anomaly filter
    const [viewMode, setViewMode] = useState<ViewMode>('detail');
    const [showMarginManager, setShowMarginManager] = useState(false);
    const [sortConfig, setSortConfig] = useState<SortConfig | null>({ key: 'TotalAmount', direction: 'desc' });
    const [expandedRows, setExpandedRows] = useState<Set<number>>(new Set());

    // Helper to shorten term display


    const toggleRowExpand = (index: number) => {
        const newSet = new Set(expandedRows);
        if (newSet.has(index)) newSet.delete(index);
        else newSet.add(index);
        setExpandedRows(newSet);
    };
    const [filters, setFilters] = useState<Record<string, string>>({});
    const [visibleColumns, setVisibleColumns] = useState<Set<string>>(new Set([
        'CustomerName', 'ProductName', 'ChargeType', 'Quantity', 'UnitPrice', 'TotalAmount'
    ]));

    // Invoice State
    const [invoiceData, setInvoiceData] = useState<InvoiceData | null>(null);
    const [activeInvoices, setActiveInvoices] = useState<Set<string>>(new Set());
    const [selectedTags, setSelectedTags] = useState<Set<string>>(new Set()); // Tag Filter State

    // Customer Detail State
    const [selectedCustomer, setSelectedCustomer] = useState<string | null>(null);

    // Selection State
    // Selection State
    const [selectedCustomers, setSelectedCustomers] = useState<Set<string>>(new Set());

    const toggleCustomer = (customerName: string) => {
        const newSet = new Set(selectedCustomers);
        if (newSet.has(customerName)) newSet.delete(customerName);
        else newSet.add(customerName);
        setSelectedCustomers(newSet);
    };

    const handleSelectAll = () => {
        if (selectedCustomers.size === filteredCustomers) {
            setSelectedCustomers(new Set());
        } else {
            const allCustomers = new Set<string>();
            filteredRows.forEach(r => allCustomers.add(r.CustomerName));
            setSelectedCustomers(allCustomers);
        }
    };

    const handleBulkMarginUpdate = () => {
        const marginStr = prompt(`Enter new margin % for ${selectedCustomers.size} customers:`, '20');
        if (marginStr !== null) {
            const margin = parseFloat(marginStr);
            if (!isNaN(margin)) {
                selectedCustomers.forEach(cust => setCustomerMargin(cust, margin));
                alert(`Updated margin for ${selectedCustomers.size} customers to ${margin}%`);
                setSelectedCustomers(new Set());
            }
        }
    };

    const handleBulkExport = () => {
        const selectedData = sortedRows.filter(r => selectedCustomers.has(r.CustomerName)).map(r => ({
            ...r,
            CalculatedSellPrice: calculateSellPrice(r, globalMargin, marginRules)
        }));

        const ws = XLSX.utils.json_to_sheet(selectedData);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Selected Data");
        XLSX.writeFile(wb, `Bulk_Export_${new Date().toISOString().slice(0, 10)}.xlsx`);
    };


    // 1. Compute Unique Values for Filters
    const uniqueValues = useMemo(() => {
        const map: Record<string, Set<string>> = {};
        rows.forEach(row => {
            Object.keys(row).forEach(key => {
                const val = (row as any)[key];
                if (val && typeof val === 'string') {
                    if (!map[key]) map[key] = new Set();
                    if (map[key].size < 100) map[key].add(val); // Limit unique values
                }
            });
            // Virtual columns
            if (!map['TotalAmount']) map['TotalAmount'] = new Set();
        });

        const result: Record<string, string[]> = {};
        Object.entries(map).forEach(([k, set]) => {
            result[k] = Array.from(set).sort();
        });
        return result;
    }, [rows]);
    // 2. Compute Unique Invoices specifically
    // 2. Compute Unique Invoices specifically
    const { uniqueInvoices, invoiceDates } = useMemo(() => {
        const set = new Set<string>();
        const dates: Record<string, string> = {};
        let hasUnbilled = false;

        rows.forEach(r => {
            if (r.InvoiceNumber) {
                set.add(r.InvoiceNumber);
                if (!dates[r.InvoiceNumber] && r.ChargeStartDate) {
                    try {
                        const d = new Date(r.ChargeStartDate);
                        if (!isNaN(d.getTime())) {
                            dates[r.InvoiceNumber] = d.toLocaleDateString('nl-NL', { month: 'short', year: 'numeric' });
                        }
                    } catch (e) { }
                }
            }
            else hasUnbilled = true;
        });
        const list = Array.from(set).sort().reverse(); // Show newest first
        if (hasUnbilled) list.push('Unbilled');
        return { uniqueInvoices: list, invoiceDates: dates };
    }, [rows]);

    // 3. Compute Available Tags based on current rows
    const availableTags = useMemo(() => {
        const tags = new Set<string>();
        rows.forEach(r => {
            const cTags = customerTags[r.CustomerName];
            if (cTags) cTags.forEach(t => tags.add(t));
        });
        return Array.from(tags).sort();
    }, [rows, customerTags]);

    // Initialize activeInvoices when data loads
    // Initialize activeInvoices when data loads
    const uniqueInvoicesKey = uniqueInvoices.join(',');
    React.useEffect(() => {
        if (uniqueInvoices.length > 0) {
            setActiveInvoices(new Set(uniqueInvoices));
        }
    }, [uniqueInvoicesKey]);


    // 3. Filter
    const filteredRows = useMemo(() => {
        let result = rows;

        // Invoice Filter
        if (uniqueInvoices.length > 0) {
            result = result.filter(r => {
                const inv = r.InvoiceNumber;
                if (inv) return activeInvoices.has(inv);
                return activeInvoices.has('Unbilled');
            });
        }

        // Tag Filter
        if (selectedTags.size > 0) {
            result = result.filter(r => {
                const tags = customerTags[r.CustomerName] || [];
                return tags.some(t => selectedTags.has(t));
            });
        }

        // Anomaly Filter
        if (showAnomaliesOnly) {
            result = result.filter(row => {
                const amount = row.Total || row.Subtotal || 0;
                const typeLower = (row.ChargeType || '').toLowerCase();
                return amount < 0 || typeLower.includes('refund') || typeLower.includes('cancel') || typeLower.includes('remove');
            });
        }

        // Global Search Filter
        if (searchQuery && searchQuery.trim() !== '') {
            const lowerQuery = searchQuery.toLowerCase();
            result = result.filter(row =>
                (row.CustomerName && row.CustomerName.toLowerCase().includes(lowerQuery)) ||
                (row.ProductName && row.ProductName.toLowerCase().includes(lowerQuery)) ||
                (row.InvoiceNumber && row.InvoiceNumber.toLowerCase().includes(lowerQuery)) ||
                (row.SubscriptionDescription && row.SubscriptionDescription.toLowerCase().includes(lowerQuery)) ||
                (row.SkuName && row.SkuName.toLowerCase().includes(lowerQuery))
            );
        }

        // Column Filters
        if (Object.keys(filters).length > 0) {
            result = result.filter(row => {
                return Object.entries(filters).every(([key, value]) => {
                    if (!value) return true;
                    const filterLower = value.toLowerCase();

                    let cellValue: any;
                    if (key === 'TotalAmount') {
                        cellValue = (row.Total || row.Subtotal || 0);
                    } else {
                        cellValue = row[key as keyof BillingRecord];
                    }

                    if (cellValue === null || cellValue === undefined) return false;
                    return String(cellValue).toLowerCase().includes(filterLower);
                });
            });
        }

        return result;
        return result;
    }, [rows, filters, searchQuery, showAnomaliesOnly, activeInvoices, selectedTags, customerTags]);

    // 3. Stats & Sell Prices
    const { filteredTotal, filteredSellPrice, filteredCustomers, auditStats } = useMemo(() => {
        let total = 0;
        let sellTotal = 0;
        const customers = new Set<string>();
        let refundsFound = 0;
        let refundTotal = 0;

        filteredRows.forEach(r => {
            const amount = r.Total || r.Subtotal || 0;
            const sell = calculateSellPrice(r, globalMargin, marginRules);

            total += amount;
            sellTotal += sell;
            customers.add(r.CustomerName);

            const typeLower = (r.ChargeType || '').toLowerCase();
            if (amount < 0 || typeLower.includes('refund') || typeLower.includes('cancel') || typeLower.includes('remove')) {
                refundsFound++;
                refundTotal += amount;
            }
        });

        return {
            filteredTotal: total,
            filteredSellPrice: sellTotal,
            filteredCustomers: customers.size,
            auditStats: { refundsFound, refundTotal }
        };
    }, [filteredRows, globalMargin, marginRules]);

    // 4. Sort
    const sortedRows = useMemo(() => {
        if (!sortConfig) return filteredRows;

        return [...filteredRows].sort((a, b) => {

            let aValue: any;
            let bValue: any;

            if (sortConfig.key === 'TotalAmount') {
                aValue = (a.Total || a.Subtotal || 0);
                bValue = (b.Total || b.Subtotal || 0);
            } else if (sortConfig.key === 'SellPrice') {
                aValue = calculateSellPrice(a, globalMargin, marginRules);
                bValue = calculateSellPrice(b, globalMargin, marginRules);
            } else {
                aValue = a[sortConfig.key as keyof BillingRecord];
                bValue = b[sortConfig.key as keyof BillingRecord];
            }

            if (typeof aValue === 'string') {
                aValue = aValue.toLowerCase();
                bValue = bValue.toLowerCase();
            }

            if (aValue < bValue) return sortConfig.direction === 'asc' ? -1 : 1;
            if (aValue > bValue) return sortConfig.direction === 'asc' ? 1 : -1;
            return 0;
        });
    }, [filteredRows, sortConfig]);

    // 5. Dynamic Column Sizing
    const columnWidths = useMemo(() => {
        const widths: Record<string, string> = {};
        if (sortedRows.length === 0) return widths;

        const context = document.createElement('canvas').getContext('2d');
        if (context) context.font = '0.875rem Inter'; // Match CSS font

        // Default constraints
        const config: Record<string, { min: number, max: number }> = {
            CustomerName: { min: 200, max: 400 },
            ProductName: { min: 150, max: 350 },
            Quantity: { min: 60, max: 100 },
            TotalAmount: { min: 120, max: 160 },
            UnitPrice: { min: 80, max: 120 },
            SellPrice: { min: 120, max: 160 },
            ChargeType: { min: 100, max: 150 },
            PublisherName: { min: 120, max: 250 }
        };

        // Columns to scan
        const colsToScan = Array.from(visibleColumns);

        colsToScan.forEach(col => {
            let maxPx = config[col]?.min || 120;
            const maxLimit = config[col]?.max || 300;

            // Scan subset for performance
            const limit = Math.min(sortedRows.length, 200);

            for (let i = 0; i < limit; i++) {
                const row = sortedRows[i];
                let val = '';

                if (col === 'TotalAmount') val = (row.Total || row.Subtotal || 0).toFixed(2);
                else if (col === 'SellPrice') val = calculateSellPrice(row, globalMargin, marginRules).toFixed(2);
                else val = String(row[col as keyof BillingRecord] || '');

                let w = 0;
                if (context) {
                    w = context.measureText(val).width + 32; // text + padding
                } else {
                    w = val.length * 8 + 32;
                }
                if (w > maxPx) maxPx = w;
            }

            if (maxPx > maxLimit) maxPx = maxLimit;
            widths[col] = `${Math.ceil(maxPx)}px`;
        });

        return widths;
    }, [sortedRows, visibleColumns, globalMargin, marginRules]);

    // 5. Virtualization
    const parentRef = useRef<HTMLDivElement>(null);

    const rowVirtualizer = useVirtualizer({
        count: sortedRows.length,
        getScrollElement: () => parentRef.current,
        estimateSize: (i) => expandedRows.has(i) ? 200 : 40, // Dynamic size estimation
        overscan: 10,
    });

    // Handlers
    const handleSort = (key: SortKey) => {
        setSortConfig(current => {
            if (current?.key === key) {
                // Tri-state sort: asc -> desc -> null (default)
                if (current.direction === 'desc') return null;
                return { key, direction: 'desc' };
            }
            return { key, direction: 'asc' };
        });
    };

    const handleExport = () => {
        const dataToExport = sortedRows.map(r => ({
            ...r,
            CalculatedSellPrice: calculateSellPrice(r, globalMargin, marginRules)
        }));

        // Excel Export
        const ws = XLSX.utils.json_to_sheet(dataToExport);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Billing Data");
        XLSX.writeFile(wb, `PartnerCenter_Export_${new Date().toISOString().slice(0, 10)}.xlsx`);
    };

    const formatCurrency = (val: number) => {
        return new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR' }).format(val);
    };

    const SortIcon = ({ column }: { column: SortKey }) => {
        if (sortConfig?.key !== column) return <ArrowUpDown size={14} style={{ marginLeft: 6, opacity: 0.3 }} />;
        return sortConfig.direction === 'asc'
            ? <ArrowUp size={14} style={{ marginLeft: 6 }} />
            : <ArrowDown size={14} style={{ marginLeft: 6 }} />;
    };

    const toggleColumn = (col: string) => {
        const newSet = new Set(visibleColumns);
        if (newSet.has(col)) newSet.delete(col);
        else newSet.add(col);
        setVisibleColumns(newSet);
    };

    const handleGenerateInvoice = (customerName: string) => {
        // 1. Filter data for this customer
        const customerRows = rows.filter(r => r.CustomerName === customerName);
        if (customerRows.length === 0) return;

        // 2. Aggregate items (optional: consolidate similar items?)
        // For now, list them all, but maybe map to InvoiceItem format
        const items = customerRows.map(r => ({
            description: r.ProductName || r.SubscriptionDescription || 'Service',
            quantity: r.Quantity || 1,
            unitPrice: calculateSellPrice(r, globalMargin, marginRules) / (r.Quantity || 1), // Approx unit price with margin
            amount: calculateSellPrice(r, globalMargin, marginRules),
            period: r.TermAndBillingCycle
        }));

        const totalAmount = items.reduce((sum, item) => sum + item.amount, 0);
        const customerId = customerRows[0].CustomerId || 'UNKNOWN';
        const currency = customerRows[0].Currency || 'EUR';

        setInvoiceData({
            customerName,
            customerId,
            items,
            totalAmount,
            currency
        });
    };

    // Selection Handlers


    return (
        <div className="dashboard animate-fade-in" style={{ position: 'relative' }}>
            {/* Margin Manager Modal */}
            {showMarginManager && <MarginManager onClose={() => setShowMarginManager(false)} />}

            {/* Invoice Preview Modal */}
            {invoiceData && (
                <InvoicePreview
                    customerName={invoiceData.customerName}
                    customerId={invoiceData.customerId}
                    items={invoiceData.items}
                    totalAmount={invoiceData.totalAmount}
                    currency={invoiceData.currency}
                    onClose={() => setInvoiceData(null)}
                />
            )}

            {/* Header Controls */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <h2 className="section-title" style={{ border: 'none', margin: 0 }}>Overview</h2>
                <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>

                    {/* View Switcher */}
                    <div className="glass-panel" style={{ display: 'flex', padding: '2px', gap: '2px' }}>
                        <button
                            onClick={() => setViewMode('detail')}
                            className={`pagination-btn ${viewMode === 'detail' ? 'active' : ''}`}
                            title="Detail List"
                        >
                            <TableIcon size={18} />
                        </button>
                        <button
                            onClick={() => setViewMode('rebill')}
                            className={`pagination-btn ${viewMode === 'rebill' ? 'active' : ''}`}
                            title="Re-billing View"
                        >
                            <Layers size={18} />
                        </button>
                        <button
                            onClick={() => setViewMode('comparison')}
                            className={`pagination-btn ${viewMode === 'comparison' ? 'active' : ''}`}
                            title="Comparison Tool"
                        >
                            <ArrowUpDown size={18} style={{ transform: 'rotate(90deg)' }} />
                        </button>
                    </div>



                    <button
                        onClick={() => setShowMarginManager(!showMarginManager)}
                        style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: showMarginManager ? 'var(--accent-primary)' : 'var(--text-primary)', fontWeight: 500 }}
                    >
                        <Settings size={16} /> Margins
                    </button>

                    <button
                        onClick={handleExport}
                        style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-primary)', fontWeight: 500 }}
                    >
                        <Download size={16} /> Excel Export
                    </button>

                    <button
                        onClick={onClearData}
                        style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--danger)', fontWeight: 500 }}
                        title="Delete all billing data"
                    >
                        <Trash2 size={16} /> Data
                    </button>

                    <button onClick={onReset} style={{ color: 'var(--accent-secondary)', textDecoration: 'underline' }}>
                        Upload New File
                    </button>
                </div>
            </div>

            {/* Invoice Toggles */}
            {uniqueInvoices.length > 0 && (
                <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem', flexWrap: 'wrap', alignItems: 'center' }}>
                    <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-tertiary)', marginRight: '0.5rem' }}>
                        Active Invoices:
                    </span>
                    {uniqueInvoices.map(inv => (
                        <button
                            key={inv}
                            onClick={() => {
                                const newSet = new Set(activeInvoices);
                                if (newSet.has(inv)) newSet.delete(inv);
                                else newSet.add(inv);
                                setActiveInvoices(newSet);
                            }}
                            style={{
                                padding: '4px 10px',
                                borderRadius: '12px',
                                border: '1px solid',
                                fontSize: '0.8rem',
                                cursor: 'pointer',
                                background: activeInvoices.has(inv) ? 'var(--brand-turquoise)' : 'transparent',
                                color: activeInvoices.has(inv) ? 'white' : 'var(--text-secondary)',
                                borderColor: activeInvoices.has(inv) ? 'var(--brand-turquoise)' : 'var(--border-color)',
                                transition: 'all 0.2s',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '6px'
                            }}
                        >
                            {inv}
                            {invoiceDates[inv] && <span style={{ opacity: 0.8, fontSize: '0.75em' }}>({invoiceDates[inv]})</span>}
                            {activeInvoices.has(inv) && <Check size={12} />}
                        </button>
                    ))}
                    {activeInvoices.size < uniqueInvoices.length && (
                        <button
                            onClick={() => setActiveInvoices(new Set(uniqueInvoices))}
                            style={{ fontSize: '0.8rem', color: 'var(--accent-primary)', textDecoration: 'underline', border: 'none', background: 'none', cursor: 'pointer' }}
                        >
                            Select All
                        </button>
                    )}
                    {activeInvoices.size > 0 && (
                        <button
                            onClick={() => setActiveInvoices(new Set())}
                            style={{ fontSize: '0.8rem', color: 'var(--text-tertiary)', textDecoration: 'underline', border: 'none', background: 'none', cursor: 'pointer', marginLeft: '0.5rem' }}
                        >
                            Deselect All
                        </button>
                    )}
                </div>
            )}

            {/* Tag Filter */}
            {availableTags.length > 0 && (
                <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem', flexWrap: 'wrap', alignItems: 'center' }}>
                    <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-tertiary)', marginRight: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                        <Tag size={12} /> Filter by Tags:
                    </span>
                    {availableTags.map(tag => (
                        <button
                            key={tag}
                            onClick={() => {
                                const newSet = new Set(selectedTags);
                                if (newSet.has(tag)) newSet.delete(tag);
                                else newSet.add(tag);
                                setSelectedTags(newSet);
                            }}
                            style={{
                                padding: '4px 10px',
                                borderRadius: '12px',
                                border: '1px solid',
                                fontSize: '0.8rem',
                                cursor: 'pointer',
                                background: selectedTags.has(tag) ? 'var(--brand-turquoise)' : 'transparent',
                                color: selectedTags.has(tag) ? 'white' : 'var(--text-secondary)',
                                borderColor: selectedTags.has(tag) ? 'var(--brand-turquoise)' : 'var(--border-color)',
                                transition: 'all 0.2s',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '6px'
                            }}
                        >
                            {tag}
                            {selectedTags.has(tag) && <Check size={12} />}
                        </button>
                    ))}
                    {selectedTags.size > 0 && (
                        <button
                            onClick={() => setSelectedTags(new Set())}
                            style={{ fontSize: '0.8rem', color: 'var(--text-tertiary)', border: 'none', background: 'none', cursor: 'pointer' }}
                        >
                            Clear
                        </button>
                    )}
                </div>
            )}

            {/* View Switching Logic */}
            {selectedCustomer ? (
                <CustomerDetail
                    customerName={selectedCustomer}
                    rows={rows.filter(r => r.CustomerName === selectedCustomer)}
                    onBack={() => setSelectedCustomer(null)}
                />
            ) : viewMode === 'azure' ? (
                <AzureAnalyzer />
            ) : viewMode === 'comparison' ? (
                <ComparisonView currentData={filteredRows} />

            ) : (
                <>
                    {/* Stats Cards */}
                    <div className="dashboard-grid">
                        <div className="stat-card">
                            <div className="stat-label">Total Cost</div>
                            <div className="stat-value">{formatCurrency(filteredTotal)}</div>
                            {filteredTotal !== meta.totalAmount && !showAnomaliesOnly && (
                                <div style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>
                                    filtered from {formatCurrency(meta.totalAmount)}
                                </div>
                            )}
                        </div>

                        <div className="stat-card">
                            <div className="stat-label">Active Customers</div>
                            <div className="stat-value">{filteredCustomers}</div>
                        </div>

                        <div className="stat-card" style={{ borderLeftColor: 'var(--success)' }}>
                            <div className="stat-label">Total Revenue (Est.)</div>
                            <div className="stat-value" style={{ color: 'var(--success)' }}>
                                {formatCurrency(filteredSellPrice)}
                            </div>
                        </div>

                        <div
                            className="stat-card hover-card"
                            style={{
                                borderLeftColor: '#ef4444',
                                background: showAnomaliesOnly ? '#fee2e2' : '#fef2f2',
                                cursor: 'pointer',
                                border: showAnomaliesOnly ? '2px solid #ef4444' : undefined,
                                transition: 'all 0.2s ease'
                            }}
                            onClick={() => setShowAnomaliesOnly(!showAnomaliesOnly)}
                            title={showAnomaliesOnly ? "Click to show all records" : "Click to show only refunds and potential errors"}
                        >
                            <div className="stat-label" style={{ color: '#ef4444', display: 'flex', justifyContent: 'space-between' }}>
                                Audit Anomalies
                                {showAnomaliesOnly && <span style={{ fontSize: '0.7em', border: '1px solid currentColor', borderRadius: '4px', padding: '0 4px' }}>ACTIVE</span>}
                            </div>
                            {showAnomaliesOnly ? (
                                <>
                                    <div className="stat-value" style={{ color: '#ef4444' }}>{filteredRows.length}</div>
                                    <div style={{ fontSize: '0.75rem', color: '#b91c1c' }}>Suspicious Records Found</div>
                                </>
                            ) : (
                                <>
                                    <div className="stat-value" style={{ color: '#ef4444' }}>{auditStats.refundsFound}</div>
                                    <div style={{ fontSize: '0.75rem', color: '#b91c1c' }}>Total: {formatCurrency(auditStats.refundTotal)}</div>
                                </>
                            )}
                        </div>
                    </div>{/* End dashboard-grid */}

                    {viewMode === 'detail' && rows.length > 0 && (
                        <DashboardCharts
                            data={filteredRows}
                            onFilterChange={(key, value) => {
                                setFilters(prev => ({ ...prev, [key]: value }));
                                // Optional: scroll to table
                                if (parentRef.current) {
                                    parentRef.current.scrollIntoView({ behavior: 'smooth' });
                                }
                            }}
                        />
                    )}
                </>
            )}

            {/* Main Content Area */}
            {
                viewMode === 'detail' && (
                    <>
                        <FilterPanel
                            availableColumns={ALL_COLUMNS}
                            visibleColumns={visibleColumns}
                            onToggleColumn={toggleColumn}
                            filters={filters}
                            onFilterChange={(k, v) => setFilters(prev => ({ ...prev, [k]: v }))}
                            uniqueValues={uniqueValues}
                        />


                        {/* Virtualized Grid Table */}
                        <div className="data-table-container glass-panel" style={{ height: '600px', overflow: 'auto' }} ref={parentRef}>
                            {/* Header - Moved outside relative container to prevent overlap with absolute rows */}
                            <div style={{
                                position: 'sticky',
                                top: 0,
                                zIndex: 10,
                                background: 'var(--bg-secondary)',
                                boxShadow: '0 2px 4px rgba(0,0,0,0.05)',
                                display: 'grid',
                                gridTemplateColumns: `40px 40px ${ALL_COLUMNS.filter(c => visibleColumns.has(c)).map(c => {
                                    if (c === 'ProductName') return 'minmax(300px, 3fr)';
                                    if (c === 'SubscriptionDescription') return 'minmax(250px, 2fr)';
                                    if (c === 'CustomerName') return 'minmax(200px, 1.5fr)';
                                    return columnWidths[c] || 'minmax(120px, auto)';
                                }).join(' ')} ${globalMargin > 0 ? '100px' : ''}`,
                                fontWeight: 600,
                                fontSize: '0.875rem'
                            }}>
                                <div style={{ padding: '1rem', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'center' }}>
                                    <input
                                        type="checkbox"
                                        onChange={handleSelectAll}
                                        checked={selectedCustomers.size > 0 && selectedCustomers.size === filteredCustomers}
                                    />
                                </div>
                                <div style={{ padding: '1rem', borderBottom: '1px solid var(--border-color)' }}></div> {/* Action Column Header */}
                                {ALL_COLUMNS.filter(c => visibleColumns.has(c)).map(col => {
                                    const isNumeric = ['Quantity', 'UnitPrice', 'TotalAmount', 'BillableDays'].includes(col);
                                    return (
                                        <div
                                            key={col}
                                            onClick={() => handleSort(col as SortKey)}
                                            style={{
                                                cursor: 'pointer',
                                                padding: '1rem',
                                                borderBottom: '1px solid var(--border-color)',
                                                userSelect: 'none',
                                                display: 'flex',
                                                justifyContent: isNumeric ? 'flex-end' : 'flex-start'
                                            }}
                                        >
                                            <div className="header-content" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexDirection: isNumeric ? 'row-reverse' : 'row' }}>
                                                {col.replace(/([A-Z])/g, ' $1').trim()}
                                                <SortIcon column={col as SortKey} />
                                            </div>
                                        </div>
                                    );
                                })}
                                {globalMargin > 0 && (
                                    <div
                                        onClick={() => handleSort('SellPrice')}
                                        style={{
                                            color: 'var(--success)',
                                            padding: '1rem',
                                            borderBottom: '1px solid var(--border-color)',
                                            cursor: 'pointer',
                                            userSelect: 'none',
                                            display: 'flex',
                                            justifyContent: 'flex-end'
                                        }}
                                    >
                                        <div className="header-content" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexDirection: 'row-reverse' }}>
                                            Sell Price
                                            <SortIcon column="SellPrice" />
                                        </div>
                                    </div>
                                )}
                            </div>

                            <div style={{ height: `${rowVirtualizer.getTotalSize()}px`, width: '100%', position: 'relative' }}>
                                {/* Rows */}
                                {rowVirtualizer.getVirtualItems().map((virtualRow) => {
                                    const row = sortedRows[virtualRow.index];
                                    const total = row.Total || row.Subtotal || 0;
                                    const sell = calculateSellPrice(row, globalMargin, marginRules);

                                    return (
                                        <div
                                            key={virtualRow.index}
                                            className="table-row-hover"
                                            ref={rowVirtualizer.measureElement}
                                            data-index={virtualRow.index}
                                            onClick={(e) => {
                                                if (['INPUT', 'BUTTON', 'svg', 'path'].includes((e.target as HTMLElement).tagName)) return;
                                                toggleRowExpand(virtualRow.index);
                                            }}
                                            style={{
                                                ...((virtualRow.start !== undefined && virtualRow.size !== undefined) ? {
                                                    position: 'absolute',
                                                    top: 0,
                                                    left: 0,
                                                    width: '100%',
                                                    transform: `translateY(${virtualRow.start}px)`,
                                                } : {})
                                            }}
                                        >
                                            <div style={{
                                                display: 'grid',
                                                gridTemplateColumns: `40px 40px ${ALL_COLUMNS.filter(c => visibleColumns.has(c)).map(c => {
                                                    if (c === 'ProductName') return 'minmax(300px, 3fr)';
                                                    if (c === 'SubscriptionDescription') return 'minmax(250px, 2fr)';
                                                    if (c === 'CustomerName') return 'minmax(200px, 1.5fr)';
                                                    return columnWidths[c] || 'minmax(120px, auto)';
                                                }).join(' ')} ${globalMargin > 0 ? '100px' : ''}`,
                                                alignItems: 'center',
                                                height: '40px',
                                                borderBottom: expandedRows.has(virtualRow.index) ? 'none' : '1px solid var(--border-color)',
                                                background: selectedCustomers.has(row.CustomerName) ? 'rgba(0, 181, 226, 0.1)' : (virtualRow.index % 2 === 0 ? 'rgba(255,255,255,0.3)' : 'transparent'),
                                                cursor: 'pointer'
                                            }}>
                                                <div style={{ padding: '0.5rem', display: 'flex', justifyContent: 'center' }}>
                                                    <input
                                                        type="checkbox"
                                                        checked={selectedCustomers.has(row.CustomerName)}
                                                        onChange={() => toggleCustomer(row.CustomerName)}
                                                    />
                                                </div>
                                                <div style={{ padding: '0.5rem', display: 'flex', justifyContent: 'center' }}>
                                                    <button
                                                        className="icon-btn"
                                                        title="Generate Invoice for this Customer"
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            handleGenerateInvoice(row.CustomerName);
                                                        }}
                                                    >
                                                        <Printer size={16} />
                                                    </button>
                                                </div>
                                                {ALL_COLUMNS.filter(c => visibleColumns.has(c)).map(col => {
                                                    let val: any = row[col as keyof BillingRecord];
                                                    if (col === 'TotalAmount') val = total.toFixed(2);

                                                    if (['ChargeStartDate', 'ChargeEndDate'].includes(col) && val) {
                                                        const d = new Date(val);
                                                        if (!isNaN(d.getTime())) val = d.toLocaleDateString('nl-NL');
                                                    }
                                                    if (typeof val === 'number') {
                                                        if (col === 'Quantity' || col === 'BillableQuantity') {
                                                            val = Math.round(val);
                                                        } else {
                                                            val = val.toFixed(2);
                                                        }
                                                    }

                                                    const isNumeric = ['Quantity', 'UnitPrice', 'TotalAmount', 'BillableDays'].includes(col);
                                                    const style = isNumeric ? { textAlign: 'right', fontFamily: 'monospace' } : {};

                                                    const content = col === 'CustomerName' ? (
                                                        <span
                                                            onClick={(e) => { e.stopPropagation(); setSelectedCustomer(String(val)); }}
                                                            style={{ color: 'var(--brand-turquoise)', cursor: 'pointer', textDecoration: 'underline', fontWeight: 500 }}
                                                        >
                                                            {val}
                                                        </span>
                                                    ) : val;

                                                    return (
                                                        <div key={col} className="truncate" title={String(val)} style={{ padding: '0.5rem 1rem', ...style } as any}>
                                                            {content}
                                                        </div>
                                                    );
                                                })}
                                                {globalMargin > 0 && (
                                                    <div style={{ fontWeight: 600, padding: '0.5rem 1rem', fontFamily: 'monospace', textAlign: 'right' }}>{sell.toFixed(2)}</div>
                                                )}
                                            </div>
                                            {expandedRows.has(virtualRow.index) && (
                                                <div style={{
                                                    background: 'var(--bg-tertiary)',
                                                    borderBottom: '1px solid var(--border-color)',
                                                    padding: '1rem',
                                                    fontSize: '0.85rem',
                                                    display: 'grid',
                                                    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                                                    gap: '1rem'
                                                }}>
                                                    <div>
                                                        <strong>IDs</strong>
                                                        <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '4px 8px', marginTop: '4px' }}>
                                                            <span style={{ color: 'var(--text-tertiary)' }}>Subscription:</span> <span className="truncate" title={row.SubscriptionId} style={{ fontFamily: 'monospace' }}>{row.SubscriptionId}</span>
                                                            <span style={{ color: 'var(--text-tertiary)' }}>Order:</span> <span className="truncate" title={row.OrderId} style={{ fontFamily: 'monospace' }}>{row.OrderId || '-'}</span>
                                                            <span style={{ color: 'var(--text-tertiary)' }}>Sku:</span> <span className="truncate" title={row.SkuId} style={{ fontFamily: 'monospace' }}>{row.SkuId}</span>
                                                            <span style={{ color: 'var(--text-tertiary)' }}>Invoice:</span> <span style={{ fontFamily: 'monospace' }}>{row.InvoiceNumber || 'Unbilled'}</span>
                                                        </div>
                                                    </div>
                                                    <div>
                                                        <strong>Details</strong>
                                                        <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '4px 8px', marginTop: '4px' }}>
                                                            <span style={{ color: 'var(--text-tertiary)' }}>Publisher:</span> <span>{row.PublisherName || '-'}</span>
                                                            <span style={{ color: 'var(--text-tertiary)' }}>Term:</span> <span>{row.TermAndBillingCycle || '-'}</span>
                                                            <span style={{ color: 'var(--text-tertiary)' }}>Start Date:</span> <span>{row.SubscriptionStartDate ? new Date(row.SubscriptionStartDate).toLocaleDateString() : '-'}</span>
                                                            <span style={{ color: 'var(--text-tertiary)' }}>End Date:</span> <span>{row.SubscriptionEndDate ? new Date(row.SubscriptionEndDate).toLocaleDateString() : '-'}</span>
                                                        </div>
                                                    </div>
                                                    <div>
                                                        <strong>Financials</strong>
                                                        <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '4px 8px', marginTop: '4px' }}>
                                                            <span style={{ color: 'var(--text-tertiary)' }}>Unit Price:</span> <span style={{ fontFamily: 'monospace' }}>{formatCurrency(row.UnitPrice)}</span>
                                                            <span style={{ color: 'var(--text-tertiary)' }}>Quantity:</span> <span>{row.Quantity}</span>
                                                            <span style={{ color: 'var(--text-tertiary)' }}>Billing Type:</span> <span>{row.ChargeType || '-'}</span>
                                                            {row.PricingCurrency && row.PricingCurrency !== row.Currency && (
                                                                <>
                                                                    <span style={{ color: 'var(--text-tertiary)' }}>Orig Currency:</span> <span>{row.PricingCurrency}</span>
                                                                </>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>

                            <div style={{ marginTop: '0.5rem', fontSize: '0.8rem', color: 'var(--text-tertiary)', textAlign: 'right' }}>
                                Showing {sortedRows.length} records
                            </div>
                        </div>
                    </>
                )
            }

            {
                viewMode === 'rebill' && (
                    <RebillingTable rows={filteredRows} marginPercent={globalMargin} marginRules={marginRules} />
                )
            }
            {/* Bulk Actions Bar */}
            {
                selectedCustomers.size > 0 && (
                    <div style={{
                        position: 'fixed',
                        bottom: '2rem',
                        left: '50%',
                        transform: 'translateX(-50%)',
                        background: 'var(--bg-secondary)',
                        padding: '1rem 2rem',
                        borderRadius: '2rem',
                        boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                        display: 'flex',
                        gap: '1rem',
                        alignItems: 'center',
                        zIndex: 100,
                        border: '1px solid var(--accent-primary)'
                    }}>
                        <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                            {selectedCustomers.size} customers selected
                        </div>
                        <div style={{ height: '20px', width: '1px', background: 'var(--border-color)' }}></div>
                        <div style={{ height: '20px', width: '1px', background: 'var(--border-color)' }}></div>
                        <button
                            onClick={handleBulkMarginUpdate}
                            className="primary-btn"
                            style={{ fontSize: '0.9rem', padding: '0.5rem 1rem', background: 'var(--accent-secondary)' }}
                            title="Update margin for selected customers"
                        >
                            <Percent size={16} style={{ marginRight: 6 }} /> Set Margin
                        </button>
                        <button
                            onClick={handleBulkExport}
                            className="primary-btn"
                            style={{ fontSize: '0.9rem', padding: '0.5rem 1rem' }}
                        >
                            <Download size={16} style={{ marginRight: 6 }} /> Export Selection
                        </button>
                        <button
                            onClick={() => setSelectedCustomers(new Set())}
                            className="secondary-btn"
                            style={{ fontSize: '0.9rem', padding: '0.5rem' }}
                        >
                            Cancel
                        </button>
                    </div>
                )
            }
        </div >
    );
};
