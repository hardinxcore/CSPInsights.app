import React, { useMemo, useState } from 'react';
import { ArrowLeft, PieChart, TrendingUp, Globe, MapPin, Tag, Plus, X, Search, FileDown, Printer, ArrowUpDown } from 'lucide-react';
import { InvoicePreview } from './InvoicePreview';
import * as XLSX from 'xlsx';
import type { BillingRecord } from '../types/BillingData';
import { useBillingStore } from '../store/billingStore';
import { calculateSellPrice } from '../utils/pricing';

interface CustomerDetailProps {
    customerName: string;
    rows: BillingRecord[];
    onBack: () => void;
}

export const CustomerDetail: React.FC<CustomerDetailProps> = ({ customerName, rows, onBack }) => {
    const { globalMargin, marginRules, customerTags, addTag, removeTag } = useBillingStore();
    const [newTag, setNewTag] = useState('');
    const [isAddingTag, setIsAddingTag] = useState(false);

    // Detailed List State
    const [searchTerm, setSearchTerm] = useState('');
    const [invoiceData, setInvoiceData] = useState<any>(null);
    const [sortConfig, setSortConfig] = useState<{ key: keyof BillingRecord | 'SellPrice'; direction: 'asc' | 'desc' } | null>({ key: 'TotalAmount' as any, direction: 'desc' });

    const tags = customerTags[customerName] || [];

    const handleAddTag = () => {
        if (newTag.trim()) {
            addTag(customerName, newTag.trim());
            setNewTag('');
            setIsAddingTag(false);
        }
    };

    // Aggregations
    const stats = useMemo(() => {
        let totalCost = 0;
        let totalRevenue = 0;
        const products: Record<string, { cost: number; revenue: number; quantity: number }> = {};
        const categories: Record<string, number> = {};

        rows.forEach(r => {
            const cost = r.Total || r.Subtotal || 0;
            const revenue = calculateSellPrice(r, globalMargin, marginRules);

            totalCost += cost;
            totalRevenue += revenue;

            // Product Aggregation
            const prodName = r.ProductName || 'Unknown';
            if (!products[prodName]) products[prodName] = { cost: 0, revenue: 0, quantity: 0 };
            products[prodName].cost += cost;
            products[prodName].revenue += revenue;
            products[prodName].quantity += (r.Quantity || 0);

            // Category (Publisher)
            const cat = r.PublisherName || 'Other';
            categories[cat] = (categories[cat] || 0) + cost;
        });

        // Sort Top Products
        const topProducts = Object.entries(products)
            .map(([name, data]) => ({ name, ...data }))
            .sort((a, b) => b.cost - a.cost)
            .slice(0, 10); // Top 10

        return { totalCost, totalRevenue, topProducts, categories };
    }, [rows, globalMargin, marginRules]);

    // Extract Profile Info from first row (assuming consistent)
    const profile = useMemo(() => {
        if (rows.length === 0) return {};
        const r = rows[0];
        return {
            domain: r.CustomerDomainName,
            country: r.CustomerCountry,
        };
    }, [rows]);

    // Transaction List Logic
    const filteredTransactions = useMemo(() => {
        let result = rows;
        if (searchTerm) {
            const lower = searchTerm.toLowerCase();
            result = result.filter(r =>
                (r.ProductName && r.ProductName.toLowerCase().includes(lower)) ||
                (r.SubscriptionId && r.SubscriptionId.toLowerCase().includes(lower)) ||
                (r.OrderId && r.OrderId.toLowerCase().includes(lower))
            );
        }
        return result;
    }, [rows, searchTerm]);

    const sortedTransactions = useMemo(() => {
        if (!sortConfig) return filteredTransactions;
        return [...filteredTransactions].sort((a, b) => {
            let aVal: any = a[sortConfig.key as keyof BillingRecord];
            let bVal: any = b[sortConfig.key as keyof BillingRecord];

            if (sortConfig.key === 'SellPrice') {
                aVal = calculateSellPrice(a, globalMargin, marginRules);
                bVal = calculateSellPrice(b, globalMargin, marginRules);
            }

            if (typeof aVal === 'string') {
                aVal = aVal.toLowerCase();
                bVal = bVal.toLowerCase();
            }

            if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
            if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1;
            return 0;
        });
    }, [filteredTransactions, sortConfig, globalMargin, marginRules]);

    const handleSort = (key: any) => {
        setSortConfig(current => ({
            key,
            direction: current?.key === key && current?.direction === 'asc' ? 'desc' : 'asc'
        }));
    };

    const handleExport = () => {
        const data = sortedTransactions.map(r => ({
            ...r,
            CalculatedSellPrice: calculateSellPrice(r, globalMargin, marginRules)
        }));
        const ws = XLSX.utils.json_to_sheet(data);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Transactions");
        XLSX.writeFile(wb, `${customerName}_Transactions.xlsx`);
    };

    const handleGenerateInvoice = () => {
        const items = rows.map(r => ({
            description: r.ProductName || r.SubscriptionDescription || 'Service',
            quantity: r.Quantity || 1,
            unitPrice: calculateSellPrice(r, globalMargin, marginRules) / (r.Quantity || 1),
            amount: calculateSellPrice(r, globalMargin, marginRules),
            period: r.TermAndBillingCycle
        }));

        setInvoiceData({
            customerName,
            customerId: rows[0]?.CustomerId || 'UNKNOWN',
            items,
            totalAmount: items.reduce((sum, i) => sum + i.amount, 0),
            currency: rows[0]?.Currency || 'EUR'
        });
    };

    const marginAmt = stats.totalRevenue - stats.totalCost;
    const marginPct = stats.totalRevenue > 0 ? (marginAmt / stats.totalRevenue) * 100 : 0;

    return (
        <div className="animate-fade-in" style={{ padding: '1rem' }}>
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '2rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    <button onClick={onBack} className="secondary-btn" style={{ borderRadius: '50%', width: 40, height: 40, padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <ArrowLeft size={20} />
                    </button>
                    <div>
                        <h1 style={{ margin: 0, fontSize: '1.75rem' }} className="text-gradient">{customerName}</h1>
                        <div style={{ color: 'var(--text-tertiary)', display: 'flex', gap: '1rem', alignItems: 'center', marginTop: '0.25rem' }}>
                            <span>Customer Detail View • {rows.length} records</span>
                            {profile.domain && (
                                <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', padding: '0.1rem 0.5rem', background: 'var(--bg-tertiary)', borderRadius: 4 }}>
                                    <Globe size={12} /> {profile.domain}
                                </span>
                            )}
                            {profile.country && (
                                <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', padding: '0.1rem 0.5rem', background: 'var(--bg-tertiary)', borderRadius: 4 }}>
                                    <MapPin size={12} /> {profile.country}
                                </span>
                            )}
                        </div>

                        {/* Tags Section */}
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginTop: '1rem' }}>
                            {tags.map((tag, i) => (
                                <span key={i} style={{
                                    display: 'flex', alignItems: 'center', gap: '0.25rem',
                                    padding: '2px 8px', borderRadius: '12px',
                                    background: 'var(--brand-turquoise)', color: 'white', fontSize: '0.85rem'
                                }}>
                                    <Tag size={12} /> {tag}
                                    <button
                                        onClick={() => removeTag(customerName, tag)}
                                        style={{ background: 'none', border: 'none', color: 'white', padding: 0, cursor: 'pointer', display: 'flex', alignItems: 'center' }}
                                    >
                                        <X size={12} />
                                    </button>
                                </span>
                            ))}

                            {isAddingTag ? (
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                    <input
                                        type="text"
                                        value={newTag}
                                        onChange={(e) => setNewTag(e.target.value)}
                                        onKeyDown={(e) => e.key === 'Enter' && handleAddTag()}
                                        placeholder="New tag..."
                                        autoFocus
                                        style={{
                                            padding: '2px 8px', borderRadius: '12px', border: '1px solid var(--border-color)',
                                            fontSize: '0.85rem', width: '100px', outline: 'none'
                                        }}
                                        onBlur={() => { if (!newTag) setIsAddingTag(false) }}
                                    />
                                    <button onClick={handleAddTag} className="primary-btn" style={{ padding: '2px 6px', fontSize: '0.8rem', minWidth: 'auto' }}>Add</button>
                                </div>
                            ) : (
                                <button
                                    onClick={() => setIsAddingTag(true)}
                                    style={{
                                        display: 'flex', alignItems: 'center', gap: '0.25rem',
                                        padding: '2px 8px', borderRadius: '12px',
                                        border: '1px dashed var(--text-tertiary)', color: 'var(--text-tertiary)',
                                        background: 'transparent', fontSize: '0.85rem', cursor: 'pointer'
                                    }}
                                >
                                    <Plus size={12} /> Add Tag
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* KPI Cards */}
            <div className="dashboard-grid" style={{ marginBottom: '2rem' }}>
                <div className="stat-card">
                    <div className="stat-label">Total Cost</div>
                    <div className="stat-value">{new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR' }).format(stats.totalCost)}</div>
                </div>
                <div className="stat-card" style={{ borderLeftColor: 'var(--success)' }}>
                    <div className="stat-label">Total Revenue</div>
                    <div className="stat-value" style={{ color: 'var(--success)' }}>
                        {new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR' }).format(stats.totalRevenue)}
                    </div>
                </div>
                <div className="stat-card" style={{ borderLeftColor: 'var(--accent-secondary)' }}>
                    <div className="stat-label">Total Margin</div>
                    <div className="stat-value" style={{ color: 'var(--accent-secondary)' }}>
                        {new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR' }).format(marginAmt)}
                        <span style={{ fontSize: '1rem', marginLeft: '0.5rem', color: 'var(--text-tertiary)' }}>({marginPct.toFixed(1)}%)</span>
                    </div>
                </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '2rem' }}>
                {/* Top Products */}
                <div className="glass-panel" style={{ padding: '2rem' }}>
                    <h3 style={{ marginTop: 0, marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <TrendingUp size={20} className="text-gradient" /> Top Spend Products
                    </h3>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                        {stats.topProducts.map((prod, i) => (
                            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                                <div style={{ flex: 1 }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.25rem', fontSize: '0.9rem' }}>
                                        <span style={{ fontWeight: 500 }}>{prod.name}</span>
                                        <span>{new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR' }).format(prod.cost)}</span>
                                    </div>
                                    <div style={{ width: '100%', height: '8px', background: 'var(--bg-tertiary)', borderRadius: '4px', overflow: 'hidden' }}>
                                        <div style={{
                                            width: `${(prod.cost / stats.totalCost) * 100}%`,
                                            height: '100%',
                                            background: i < 3 ? 'var(--brand-turquoise)' : 'var(--brand-orange)',
                                            opacity: 1 - (i * 0.05)
                                        }}></div>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Categories */}
                <div className="glass-panel" style={{ padding: '2rem' }}>
                    <h3 style={{ marginTop: 0, marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <PieChart size={20} className="text-gradient" /> Publisher Split
                    </h3>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                        {Object.entries(stats.categories)
                            .sort((a, b) => b[1] - a[1])
                            .map(([cat, amount], i) => (
                                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.75rem', borderBottom: '1px solid var(--border-color)' }}>
                                    <span style={{ fontWeight: 500 }}>{cat}</span>
                                    <span style={{ fontFamily: 'monospace' }}>{new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR' }).format(amount)}</span>
                                </div>
                            ))}
                    </div>
                </div>
            </div>


            {/* Detailed Transaction List */}
            <div className="glass-panel" style={{ marginTop: '2rem', padding: '1.5rem', overflow: 'hidden' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                    <h3 style={{ margin: 0 }}>Detailed Transactions</h3>
                    <div style={{ display: 'flex', gap: '1rem' }}>
                        <div style={{ position: 'relative' }}>
                            <Search size={16} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-tertiary)' }} />
                            <input
                                type="text"
                                placeholder="Search products..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                style={{
                                    padding: '0.5rem 1rem 0.5rem 2.25rem',
                                    borderRadius: '20px',
                                    border: '1px solid var(--border-color)',
                                    fontSize: '0.85rem',
                                    width: '250px'
                                }}
                            />
                        </div>
                        <button onClick={handleGenerateInvoice} className="secondary-btn" style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                            <Printer size={16} /> Invoice
                        </button>
                        <button onClick={handleExport} className="secondary-btn" style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                            <FileDown size={16} /> Export
                        </button>
                    </div>
                </div>

                <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                        <thead>
                            <tr style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-secondary)' }}>
                                <th onClick={() => handleSort('ProductName')} style={{ textAlign: 'left', padding: '0.75rem', cursor: 'pointer' }}>Product <ArrowUpDown size={12} /></th>
                                <th onClick={() => handleSort('Quantity')} style={{ textAlign: 'right', padding: '0.75rem', cursor: 'pointer' }}>Qty <ArrowUpDown size={12} /></th>
                                <th onClick={() => handleSort('UnitPrice')} style={{ textAlign: 'right', padding: '0.75rem', cursor: 'pointer' }}>Unit Cost <ArrowUpDown size={12} /></th>
                                <th onClick={() => handleSort('SellPrice')} style={{ textAlign: 'right', padding: '0.75rem', cursor: 'pointer', color: 'var(--brand-turquoise)' }}>Sell Price <ArrowUpDown size={12} /></th>
                                <th onClick={() => handleSort('TermAndBillingCycle')} style={{ textAlign: 'left', padding: '0.75rem', cursor: 'pointer' }}>Term <ArrowUpDown size={12} /></th>
                                <th style={{ textAlign: 'left', padding: '0.75rem' }}>Dates</th>
                            </tr>
                        </thead>
                        <tbody>
                            {sortedTransactions.slice(0, 100).map((r, i) => (
                                <tr key={i} style={{ borderBottom: '1px solid rgba(0,0,0,0.05)' }}>
                                    <td style={{ padding: '0.75rem', maxWidth: '300px' }} className="truncate" title={r.ProductName}>{r.ProductName}</td>
                                    <td style={{ padding: '0.75rem', textAlign: 'right' }}>{r.Quantity}</td>
                                    <td style={{ padding: '0.75rem', textAlign: 'right', fontFamily: 'monospace' }}>
                                        {new Intl.NumberFormat('nl-NL', { style: 'currency', currency: r.Currency || 'EUR' }).format(r.UnitPrice)}
                                    </td>
                                    <td style={{ padding: '0.75rem', textAlign: 'right', fontFamily: 'monospace', fontWeight: 600 }}>
                                        {new Intl.NumberFormat('nl-NL', { style: 'currency', currency: r.Currency || 'EUR' }).format(calculateSellPrice(r, globalMargin, marginRules))}
                                    </td>
                                    <td style={{ padding: '0.75rem' }}>{r.TermAndBillingCycle || '-'}</td>
                                    <td style={{ padding: '0.75rem', fontSize: '0.8rem', color: 'var(--text-tertiary)' }}>
                                        {r.ChargeStartDate ? new Date(r.ChargeStartDate).toLocaleDateString() : '-'} - {r.ChargeEndDate ? new Date(r.ChargeEndDate).toLocaleDateString() : '-'}
                                    </td>
                                </tr>
                            ))}
                            {sortedTransactions.length > 100 && (
                                <tr>
                                    <td colSpan={6} style={{ textAlign: 'center', padding: '1rem', color: 'var(--text-tertiary)' }}>
                                        ...and {sortedTransactions.length - 100} more records. Use Export to see all.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {
                invoiceData && (
                    <InvoicePreview
                        {...invoiceData}
                        onClose={() => setInvoiceData(null)}
                    />
                )
            }
        </div >
    );
};
