import React, { useMemo, useState } from 'react';
import type { BillingRecord } from '../types/BillingData';
import { ChevronDown, ChevronRight, FileText, ArrowUp, ArrowDown } from 'lucide-react';
import { InvoicePreview } from './InvoicePreview';
import { calculateSellPrice } from '../utils/pricing';

interface RebillingTableProps {
    rows: BillingRecord[];
    marginPercent: number; // Global margin
    marginRules: Record<string, number>;
}

interface GroupedCustomer {
    customerName: string;
    customerId: string;
    totalCost: number;
    totalSell: number;
    currency: string;
    items: GroupedItem[];
}

interface GroupedItem {
    subscriptionId: string;
    productName: string;
    quantity: number;
    unitCost: number;
    totalCost: number;
    totalSell: number;
    chargeDate: string;
    description: string;
    originalRecord: BillingRecord;
}

export const RebillingTable: React.FC<RebillingTableProps> = ({ rows, marginPercent, marginRules }) => {
    const [expandedCustomers, setExpandedCustomers] = useState<Set<string>>(new Set());
    const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());
    const [selectedInvoice, setSelectedInvoice] = useState<GroupedCustomer | null>(null);
    const [customerSortConfig, setCustomerSortConfig] = useState<{ key: keyof GroupedCustomer, direction: 'asc' | 'desc' }>({ key: 'totalSell', direction: 'desc' });
    const [sortConfig, setSortConfig] = useState<{ key: keyof GroupedItem | null, direction: 'asc' | 'desc' }>({ key: 'totalCost', direction: 'desc' });

    const handleSort = (key: keyof GroupedItem) => {
        setSortConfig(current => ({
            key,
            direction: current.key === key && current.direction === 'desc' ? 'asc' : 'desc'
        }));
    };

    const handleCustomerSort = (key: keyof GroupedCustomer) => {
        setCustomerSortConfig(current => ({
            key,
            direction: current.key === key && current.direction === 'desc' ? 'asc' : 'desc'
        }));
    };

    const getSortedItems = (items: GroupedItem[]) => {
        if (!sortConfig.key) return items;

        return [...items].sort((a, b) => {
            const aVal = a[sortConfig.key!];
            const bVal = b[sortConfig.key!];

            if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
            if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1;
            return 0;
        });
    };

    // Helper to render sort arrow
    const SortIcon = ({ active, direction }: { active: boolean, direction: 'asc' | 'desc' }) => {
        if (!active) return <div style={{ width: '16px', display: 'inline-block' }} />;
        return direction === 'asc' ? <ArrowUp size={14} style={{ display: 'inline-block' }} /> : <ArrowDown size={14} style={{ display: 'inline-block' }} />;
    };

    const groupedData = useMemo(() => {
        const groups: Record<string, GroupedCustomer> = {};

        rows.forEach(row => {
            const custKey = row.CustomerName || 'Unknown';
            if (!groups[custKey]) {
                groups[custKey] = {
                    customerName: custKey,
                    customerId: row.CustomerId,
                    totalCost: 0,
                    totalSell: 0,
                    currency: row.Currency || 'EUR',
                    items: []
                };
            }

            const cost = row.Total || row.Subtotal || 0;
            // Use centralized pricing logic which respects customer rules
            const sell = calculateSellPrice(row, marginPercent, marginRules);

            groups[custKey].totalCost += cost;
            groups[custKey].totalSell += sell;

            const item: GroupedItem = {
                subscriptionId: row.SubscriptionId,
                productName: row.ProductName || row.SkuName,
                quantity: row.Quantity !== 0 ? row.Quantity : (row.ConsumedQuantity || 0),
                unitCost: row.UnitPrice,
                totalCost: cost,
                totalSell: sell,
                chargeDate: row.ChargeStartDate,
                description: `${row.ProductName}${row.ChargeType ? ` (${row.ChargeType})` : ''}`,
                originalRecord: row
            };

            groups[custKey].items.push(item);
        });

        return Object.values(groups).sort((a, b) => {
            const aVal = a[customerSortConfig.key];
            const bVal = b[customerSortConfig.key];

            if (aVal < bVal) return customerSortConfig.direction === 'asc' ? -1 : 1;
            if (aVal > bVal) return customerSortConfig.direction === 'asc' ? 1 : -1;
            return 0;
        });
    }, [rows, marginPercent, marginRules, customerSortConfig]);

    const toggleExpand = (customerName: string) => {
        const next = new Set(expandedCustomers);
        if (next.has(customerName)) {
            next.delete(customerName);
        } else {
            next.add(customerName);
        }
        setExpandedCustomers(next);
    };

    const toggleItemExpand = (id: string) => {
        const next = new Set(expandedItems);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        setExpandedItems(next);
    };

    const formatCurrency = (val: number, currency: string = 'EUR') => {
        return new Intl.NumberFormat('nl-NL', { style: 'currency', currency }).format(val);
    };

    return (
        <div className="glass-panel" style={{ overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                    <tr style={{ background: 'var(--bg-tertiary)', borderBottom: '2px solid var(--border-color)' }}>
                        <th
                            style={{ padding: '1rem', textAlign: 'left', cursor: 'pointer', userSelect: 'none' }}
                            onClick={() => handleCustomerSort('customerName')}
                        >
                            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                Customer
                                <SortIcon active={customerSortConfig.key === 'customerName'} direction={customerSortConfig.direction} />
                            </div>
                        </th>
                        <th
                            style={{ padding: '1rem', textAlign: 'right', cursor: 'pointer', userSelect: 'none' }}
                            onClick={() => handleCustomerSort('totalCost')}
                        >
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '4px' }}>
                                Total Cost
                                <SortIcon active={customerSortConfig.key === 'totalCost'} direction={customerSortConfig.direction} />
                            </div>
                        </th>
                        <th style={{ padding: '1rem', textAlign: 'right' }}>Margin</th>
                        <th
                            style={{ padding: '1rem', textAlign: 'right', cursor: 'pointer', userSelect: 'none' }}
                            onClick={() => handleCustomerSort('totalSell')}
                        >
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '4px' }}>
                                Sell Price ({marginPercent}%)
                                <SortIcon active={customerSortConfig.key === 'totalSell'} direction={customerSortConfig.direction} />
                            </div>
                        </th>
                        <th style={{ padding: '1rem', width: '50px' }}></th>
                    </tr>
                </thead>
                <tbody>
                    {groupedData.map(group => (
                        <React.Fragment key={group.customerName}>
                            <tr
                                onClick={() => toggleExpand(group.customerName)}
                                style={{
                                    cursor: 'pointer',
                                    borderBottom: '1px solid var(--border-color)',
                                    background: expandedCustomers.has(group.customerName) ? 'var(--bg-tertiary)' : 'transparent'
                                }}
                            >
                                <td style={{ padding: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 600 }}>
                                    {expandedCustomers.has(group.customerName) ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                                    {group.customerName}
                                </td>
                                <td className="numeric" style={{ padding: '1rem' }}>{formatCurrency(group.totalCost, group.currency)}</td>
                                <td className="numeric" style={{ padding: '1rem', color: 'var(--success)' }}>
                                    {formatCurrency(group.totalSell - group.totalCost, group.currency)}
                                </td>
                                <td className="numeric" style={{ padding: '1rem', fontWeight: 700 }}>
                                    {formatCurrency(group.totalSell, group.currency)}
                                </td>
                                <td style={{ padding: '0.5rem' }} onClick={e => e.stopPropagation()}>
                                    <button
                                        onClick={() => setSelectedInvoice(group)}
                                        style={{ border: 'none', background: 'transparent', color: 'var(--brand-orange)', cursor: 'pointer' }}
                                        title="Create Invoice"
                                    >
                                        <FileText size={18} />
                                    </button>
                                </td>
                            </tr>

                            {expandedCustomers.has(group.customerName) && (
                                <tr>
                                    <td colSpan={5} style={{ padding: 0 }}>
                                        <table style={{ width: '100%', background: 'rgba(255,255,255,0.5)' }}>
                                            <thead>
                                                <tr style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                                                    <th style={{ padding: '0.5rem 1rem 0.5rem 3rem' }}>Product / Subscription</th>
                                                    <th
                                                        style={{ textAlign: 'right', padding: '0.5rem', cursor: 'pointer', userSelect: 'none' }}
                                                        onClick={() => handleSort('quantity')}
                                                    >
                                                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '4px' }}>
                                                            Qty <SortIcon active={sortConfig.key === 'quantity'} direction={sortConfig.direction} />
                                                        </div>
                                                    </th>
                                                    <th
                                                        style={{ textAlign: 'right', padding: '0.5rem', cursor: 'pointer', userSelect: 'none' }}
                                                        onClick={() => handleSort('totalCost')}
                                                    >
                                                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '4px' }}>
                                                            Cost <SortIcon active={sortConfig.key === 'totalCost'} direction={sortConfig.direction} />
                                                        </div>
                                                    </th>
                                                    <th
                                                        style={{ textAlign: 'right', padding: '0.5rem 1rem', cursor: 'pointer', userSelect: 'none' }}
                                                        onClick={() => handleSort('totalSell')}
                                                    >
                                                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '4px' }}>
                                                            Sell <SortIcon active={sortConfig.key === 'totalSell'} direction={sortConfig.direction} />
                                                        </div>
                                                    </th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {getSortedItems(group.items).map((item, idx) => {
                                                    const uniqueKey = `${item.subscriptionId}-${idx}`;
                                                    return (
                                                        <React.Fragment key={uniqueKey}>
                                                            <tr
                                                                onClick={() => toggleItemExpand(uniqueKey)}
                                                                style={{
                                                                    borderBottom: expandedItems.has(uniqueKey) ? 'none' : '1px solid var(--border-color)',
                                                                    cursor: 'pointer',
                                                                    background: expandedItems.has(uniqueKey) ? 'rgba(0, 181, 226, 0.05)' : 'transparent'
                                                                }}
                                                            >
                                                                <td style={{ padding: '0.5rem 1rem 0.5rem 3rem', fontSize: '0.9rem' }}>
                                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                                                        {expandedItems.has(uniqueKey) ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                                                                        <div>
                                                                            {item.description}
                                                                            <div style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>{item.chargeDate}</div>
                                                                        </div>
                                                                    </div>
                                                                </td>
                                                                <td className="numeric" style={{ padding: '0.5rem' }}>{item.quantity.toFixed(1)}</td>
                                                                <td className="numeric" style={{ padding: '0.5rem' }}>{formatCurrency(item.totalCost, group.currency)}</td>
                                                                <td className="numeric" style={{ padding: '0.5rem 1rem' }}>{formatCurrency(item.totalSell, group.currency)}</td>
                                                            </tr>
                                                            {expandedItems.has(uniqueKey) && (
                                                                <tr>
                                                                    <td colSpan={4} style={{ padding: 0 }}>
                                                                        <div style={{
                                                                            background: 'var(--bg-tertiary)',
                                                                            borderBottom: '1px solid var(--border-color)',
                                                                            padding: '1rem 1rem 1rem 4rem',
                                                                            fontSize: '0.85rem',
                                                                            display: 'grid',
                                                                            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                                                                            gap: '1rem',
                                                                            boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.02)'
                                                                        }}>
                                                                            <div>
                                                                                <strong>IDs</strong>
                                                                                <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '4px 8px', marginTop: '4px' }}>
                                                                                    <span style={{ color: 'var(--text-tertiary)' }}>Subscription:</span> <span className="truncate" title={item.originalRecord.SubscriptionId} style={{ fontFamily: 'monospace' }}>{item.originalRecord.SubscriptionId}</span>
                                                                                    <span style={{ color: 'var(--text-tertiary)' }}>Order:</span> <span className="truncate" title={item.originalRecord.OrderId} style={{ fontFamily: 'monospace' }}>{item.originalRecord.OrderId || '-'}</span>
                                                                                    <span style={{ color: 'var(--text-tertiary)' }}>Sku:</span> <span className="truncate" title={item.originalRecord.SkuId} style={{ fontFamily: 'monospace' }}>{item.originalRecord.SkuId}</span>
                                                                                </div>
                                                                            </div>
                                                                            <div>
                                                                                <strong>Details</strong>
                                                                                <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '4px 8px', marginTop: '4px' }}>
                                                                                    <span style={{ color: 'var(--text-tertiary)' }}>Publisher:</span> <span>{item.originalRecord.PublisherName || '-'}</span>
                                                                                    <span style={{ color: 'var(--text-tertiary)' }}>Term:</span> <span>{item.originalRecord.TermAndBillingCycle || '-'}</span>
                                                                                    <span style={{ color: 'var(--text-tertiary)' }}>Dates:</span> <span>
                                                                                        {item.originalRecord.SubscriptionStartDate ? new Date(item.originalRecord.SubscriptionStartDate).toLocaleDateString() : '-'}
                                                                                        {' - '}
                                                                                        {item.originalRecord.SubscriptionEndDate ? new Date(item.originalRecord.SubscriptionEndDate).toLocaleDateString() : '-'}
                                                                                    </span>
                                                                                </div>
                                                                            </div>
                                                                            <div>
                                                                                <strong>Financials</strong>
                                                                                <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '4px 8px', marginTop: '4px' }}>
                                                                                    <span style={{ color: 'var(--text-tertiary)' }}>Unit Price:</span> <span style={{ fontFamily: 'monospace' }}>{formatCurrency(item.originalRecord.UnitPrice, group.currency)}</span>
                                                                                    <span style={{ color: 'var(--text-tertiary)' }}>Billing Type:</span> <span>{item.originalRecord.ChargeType || '-'}</span>
                                                                                    {item.originalRecord.PricingCurrency && item.originalRecord.PricingCurrency !== item.originalRecord.Currency && (
                                                                                        <>
                                                                                            <span style={{ color: 'var(--text-tertiary)' }}>Orig Currency:</span> <span>{item.originalRecord.PricingCurrency}</span>
                                                                                        </>
                                                                                    )}
                                                                                </div>
                                                                            </div>
                                                                        </div>
                                                                    </td>
                                                                </tr>
                                                            )}
                                                        </React.Fragment>
                                                    );
                                                })}
                                            </tbody>
                                        </table>
                                    </td>
                                </tr>
                            )}
                        </React.Fragment>
                    ))}
                </tbody>
            </table>

            {/* Print Modal */}
            {selectedInvoice && (
                <InvoicePreview
                    customerName={selectedInvoice.customerName}
                    customerId={selectedInvoice.customerId}
                    totalAmount={selectedInvoice.totalSell}
                    currency={selectedInvoice.currency}
                    items={selectedInvoice.items.map((item) => ({
                        description: item.description,
                        quantity: item.quantity,
                        unitPrice: item.totalSell / (item.quantity || 1), // Derived Unit Price
                        amount: item.totalSell,
                        period: item.chargeDate
                    }))}
                    onClose={() => setSelectedInvoice(null)}
                />
            )}
        </div>
    );
};
