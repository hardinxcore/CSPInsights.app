import React from 'react';
import type { Virtualizer } from '@tanstack/react-virtual';
import { ArrowUpDown, ArrowUp, ArrowDown, Printer } from 'lucide-react';
import type { BillingRecord } from '../../types/BillingData';
import { calculateSellPrice } from '../../utils/pricing';
import { formatCurrency } from '../../utils/format';
import { ALL_COLUMNS } from './types';
import type { SortKey, SortConfig } from './types';

interface VirtualizedTableProps {
    parentRef: React.RefObject<HTMLDivElement | null>;
    rowVirtualizer: Virtualizer<HTMLDivElement, Element>;
    sortedRows: BillingRecord[];
    visibleColumns: Set<string>;
    columnWidths: Record<string, string>;
    globalMargin: number;
    marginRules: Record<string, number>;
    selectedCustomers: Set<string>;
    expandedRows: Set<number>;
    filteredCustomers: number;
    sortConfig: SortConfig | null;
    onSelectAll: () => void;
    onSort: (key: SortKey) => void;
    onToggleCustomer: (customerName: string) => void;
    onGenerateInvoice: (customerName: string) => void;
    onToggleRowExpand: (index: number) => void;
    onSelectCustomer: (customerName: string) => void;
}

export const VirtualizedTable: React.FC<VirtualizedTableProps> = ({
    parentRef,
    rowVirtualizer,
    sortedRows,
    visibleColumns,
    columnWidths,
    globalMargin,
    marginRules,
    selectedCustomers,
    expandedRows,
    filteredCustomers,
    sortConfig,
    onSelectAll,
    onSort,
    onToggleCustomer,
    onGenerateInvoice,
    onToggleRowExpand,
    onSelectCustomer,
}) => {
    const SortIcon = ({ column }: { column: SortKey }) => {
        if (sortConfig?.key !== column) return <ArrowUpDown size={14} style={{ marginLeft: 6, opacity: 0.3 }} />;
        return sortConfig.direction === 'asc'
            ? <ArrowUp size={14} style={{ marginLeft: 6 }} />
            : <ArrowDown size={14} style={{ marginLeft: 6 }} />;
    };

    return (
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
                        onChange={onSelectAll}
                        checked={selectedCustomers.size > 0 && selectedCustomers.size === filteredCustomers}
                    />
                </div>
                <div style={{ padding: '1rem', borderBottom: '1px solid var(--border-color)' }}></div> {/* Action Column Header */}
                {ALL_COLUMNS.filter(c => visibleColumns.has(c)).map(col => {
                    const isNumeric = ['Quantity', 'UnitPrice', 'TotalAmount', 'BillableDays'].includes(col);
                    return (
                        <div
                            key={col}
                            onClick={() => onSort(col as SortKey)}
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
                        onClick={() => onSort('SellPrice')}
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
                                onToggleRowExpand(virtualRow.index);
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
                                        onChange={() => onToggleCustomer(row.CustomerName)}
                                    />
                                </div>
                                <div style={{ padding: '0.5rem', display: 'flex', justifyContent: 'center' }}>
                                    <button
                                        className="icon-btn"
                                        title="Generate Invoice for this Customer"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            onGenerateInvoice(row.CustomerName);
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
                                            onClick={(e) => { e.stopPropagation(); onSelectCustomer(String(val)); }}
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
    );
};
