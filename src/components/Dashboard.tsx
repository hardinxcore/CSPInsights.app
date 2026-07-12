import React, { lazy, Suspense, useMemo, useState, useRef } from 'react';
import type { ParseResult } from '../types/BillingData';
import { useVirtualizer } from '@tanstack/react-virtual';
import { ArrowUpDown, Download, Layers, Table as TableIcon, Settings, Trash2 } from 'lucide-react';
import { DashboardCharts } from './DashboardCharts';
import { RebillingTable } from './RebillingTable';
import { FilterPanel } from './FilterPanel';
import { MarginManager } from './MarginManager';
import { ComparisonView } from './ComparisonView';
import { CustomerDetail } from './CustomerDetail';
const AzureAnalyzer = lazy(() => import('./AzureAnalyzer').then(m => ({ default: m.AzureAnalyzer })));
// Lazy: keeps @react-pdf/renderer out of the initial bundle
const InvoicePreview = lazy(() => import('./InvoicePreview').then(m => ({ default: m.InvoicePreview })));

import { useBillingStore } from '../store/billingStore';

import { calculateSellPrice } from '../utils/pricing';
import { exportToXlsx } from '../utils/exportXlsx';
import { formatCurrency } from '../utils/format';
import './Dashboard.css';

import { ALL_COLUMNS } from './dashboard/types';
import type { SortKey, SortConfig, ViewMode, InvoiceData } from './dashboard/types';
import { useColumnWidths } from './dashboard/useColumnWidths';
import { useDashboardFilters } from './dashboard/useDashboardFilters';
import { InvoiceToggles } from './dashboard/InvoiceToggles';
import { TagFilter } from './dashboard/TagFilter';
import { VirtualizedTable } from './dashboard/VirtualizedTable';
import { BulkActionsBar } from './dashboard/BulkActionsBar';

interface DashboardProps {
    data: ParseResult;
    onReset: () => void;
    onClearData: () => void;
}

export const Dashboard: React.FC<DashboardProps> = ({ data, onReset, onClearData }) => {
    const { meta, data: rows } = data;
    const { globalMargin, marginRules, customerTags, searchQuery, setCustomerMargin } = useBillingStore(); // Add setCustomerMargin

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
    const [visibleColumns, setVisibleColumns] = useState<Set<string>>(new Set([
        'CustomerName', 'ProductName', 'ChargeType', 'Quantity', 'UnitPrice', 'TotalAmount'
    ]));

    // Invoice State
    const [invoiceData, setInvoiceData] = useState<InvoiceData | null>(null);

    // Customer Detail State
    const [selectedCustomer, setSelectedCustomer] = useState<string | null>(null);

    // Selection State
    // Selection State
    const [selectedCustomers, setSelectedCustomers] = useState<Set<string>>(new Set());

    // Filtering pipeline (filters, invoices, tags, anomalies, derived data + stats)
    const {
        showAnomaliesOnly, setShowAnomaliesOnly,
        filters, setFilters,
        activeInvoices, setActiveInvoices,
        selectedTags, setSelectedTags,
        uniqueValues,
        uniqueInvoices, invoiceDates,
        availableTags,
        filteredRows,
        filteredTotal, filteredSellPrice, filteredCustomers, auditStats
    } = useDashboardFilters(rows, customerTags, searchQuery, globalMargin, marginRules);

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

        exportToXlsx(selectedData, "Selected Data", `Bulk_Export_${new Date().toISOString().slice(0, 10)}.xlsx`);
    };

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
                aValue = a[sortConfig.key as keyof typeof a];
                bValue = b[sortConfig.key as keyof typeof b];
            }

            if (typeof aValue === 'string') {
                aValue = aValue.toLowerCase();
                bValue = bValue.toLowerCase();
            }

            if (aValue < bValue) return sortConfig.direction === 'asc' ? -1 : 1;
            if (aValue > bValue) return sortConfig.direction === 'asc' ? 1 : -1;
            return 0;
        });
    }, [filteredRows, sortConfig, globalMargin, marginRules]);

    // 5. Dynamic Column Sizing
    const columnWidths = useColumnWidths(sortedRows, visibleColumns, globalMargin, marginRules);

    // 5. Virtualization
    const parentRef = useRef<HTMLDivElement>(null);

    // TanStack Virtual intentionally returns imperative measurement functions;
    // React Compiler must not memoize this third-party hook result.
    // eslint-disable-next-line react-hooks/incompatible-library
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

        exportToXlsx(dataToExport, "Billing Data", `PartnerCenter_Export_${new Date().toISOString().slice(0, 10)}.xlsx`);
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
                <Suspense fallback={null}>
                    <InvoicePreview
                        customerName={invoiceData.customerName}
                        customerId={invoiceData.customerId}
                        items={invoiceData.items}
                        totalAmount={invoiceData.totalAmount}
                        currency={invoiceData.currency}
                        onClose={() => setInvoiceData(null)}
                    />
                </Suspense>
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
            <InvoiceToggles
                uniqueInvoices={uniqueInvoices}
                invoiceDates={invoiceDates}
                activeInvoices={activeInvoices}
                setActiveInvoices={setActiveInvoices}
            />

            {/* Tag Filter */}
            <TagFilter
                availableTags={availableTags}
                selectedTags={selectedTags}
                setSelectedTags={setSelectedTags}
            />

            {/* View Switching Logic */}
            {selectedCustomer ? (
                <CustomerDetail
                    customerName={selectedCustomer}
                    rows={rows.filter(r => r.CustomerName === selectedCustomer)}
                    onBack={() => setSelectedCustomer(null)}
                />
            ) : viewMode === 'azure' ? (
                <Suspense fallback={<div className="flex-center" style={{ minHeight: '300px' }}>Loading Azure analysis…</div>}><AzureAnalyzer /></Suspense>
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
                        <VirtualizedTable
                            parentRef={parentRef}
                            rowVirtualizer={rowVirtualizer}
                            sortedRows={sortedRows}
                            visibleColumns={visibleColumns}
                            columnWidths={columnWidths}
                            globalMargin={globalMargin}
                            marginRules={marginRules}
                            selectedCustomers={selectedCustomers}
                            expandedRows={expandedRows}
                            filteredCustomers={filteredCustomers}
                            sortConfig={sortConfig}
                            onSelectAll={handleSelectAll}
                            onSort={handleSort}
                            onToggleCustomer={toggleCustomer}
                            onGenerateInvoice={handleGenerateInvoice}
                            onToggleRowExpand={toggleRowExpand}
                            onSelectCustomer={setSelectedCustomer}
                        />
                    </>
                )
            }

            {
                viewMode === 'rebill' && (
                    <RebillingTable rows={filteredRows} marginPercent={globalMargin} marginRules={marginRules} />
                )
            }
            {/* Bulk Actions Bar */}
            <BulkActionsBar
                selectedCount={selectedCustomers.size}
                onBulkMarginUpdate={handleBulkMarginUpdate}
                onBulkExport={handleBulkExport}
                onCancel={() => setSelectedCustomers(new Set())}
            />
        </div >
    );
};
