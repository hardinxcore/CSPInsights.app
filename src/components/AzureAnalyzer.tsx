import React, { useMemo, useState } from 'react';
import { Cloud, Server, Activity, X, User, ChevronDown, ChevronRight, Filter, ArrowLeft, ExternalLink } from 'lucide-react';
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { useBillingStore } from '../store/billingStore';
import type { BillingRecord } from '../types/BillingData';

const COLORS = ['#0078D4', '#50E6FF', '#004578', '#B3B0AD', '#F2F2F2', '#0078D4', '#50E6FF', '#004578', '#B3B0AD'];

const AzureResourceDetail: React.FC<{
    resourceName: string;
    rows: BillingRecord[];
    onBack: () => void;
}> = ({ resourceName, rows, onBack }) => {
    const formatCurrency = (val: number) => new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR' }).format(val);

    const stats = useMemo(() => {
        const byCustomer: Record<string, number> = {};
        const byCategory: Record<string, number> = {};
        let totalCost = 0;

        rows.forEach(r => {
            const cost = r.Total || r.Subtotal || 0;
            totalCost += cost;

            const cust = r.CustomerName || 'Unknown';
            byCustomer[cust] = (byCustomer[cust] || 0) + cost;

            const cat = r.ProductName || r.MeterCategory || 'Uncategorized';
            byCategory[cat] = (byCategory[cat] || 0) + cost;
        });

        const customers = Object.entries(byCustomer)
            .map(([name, value]) => ({ name, value }))
            .sort((a, b) => b.value - a.value);

        const categories = Object.entries(byCategory)
            .map(([name, value]) => ({ name, value }))
            .sort((a, b) => b.value - a.value)
            .slice(0, 5);

        return { totalCost, customers, categories };
    }, [rows]);

    return (
        <div className="animate-fade-in" style={{ padding: '1rem' }}>
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '2rem' }}>
                <button
                    onClick={onBack}
                    className="secondary-btn"
                    style={{ borderRadius: '50%', width: 40, height: 40, padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}
                >
                    <ArrowLeft size={20} />
                </button>
                <div style={{ background: 'var(--brand-turquoise)', padding: '0.75rem', borderRadius: '12px', color: '#fff', flexShrink: 0 }}>
                    <Server size={24} />
                </div>
                <div style={{ minWidth: 0 }}>
                    <h1 style={{ margin: 0, fontSize: '1.5rem' }} className="text-gradient truncate" title={resourceName}>{resourceName}</h1>
                    <div style={{ color: 'var(--text-tertiary)', marginTop: '0.25rem' }}>
                        Azure Resource Detail · {rows.length} transactions
                    </div>
                </div>
            </div>

            {/* KPI Cards */}
            <div className="dashboard-grid" style={{ marginBottom: '2rem' }}>
                <div className="stat-card">
                    <div className="stat-label">Total Cost</div>
                    <div className="stat-value">{formatCurrency(stats.totalCost)}</div>
                </div>
                <div className="stat-card">
                    <div className="stat-label">Customers</div>
                    <div className="stat-value">{stats.customers.length}</div>
                </div>
                <div className="stat-card">
                    <div className="stat-label">Transactions</div>
                    <div className="stat-value">{rows.length}</div>
                </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '2rem', marginBottom: '2rem' }}>
                {/* Top Customers */}
                <div className="glass-panel" style={{ padding: '2rem' }}>
                    <h3 style={{ marginTop: 0, marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <User size={18} /> Top Customers
                    </h3>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                        {stats.customers.map((cust, i) => (
                            <div key={i}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.25rem', fontSize: '0.9rem' }}>
                                    <span style={{ fontWeight: 500 }} className="truncate" title={cust.name}>{cust.name}</span>
                                    <span style={{ fontFamily: 'monospace', flexShrink: 0, marginLeft: '1rem' }}>{formatCurrency(cust.value)}</span>
                                </div>
                                <div style={{ width: '100%', height: '8px', background: 'var(--bg-tertiary)', borderRadius: '4px', overflow: 'hidden' }}>
                                    <div style={{
                                        width: `${(cust.value / stats.totalCost) * 100}%`,
                                        height: '100%',
                                        background: i < 3 ? 'var(--brand-turquoise)' : 'var(--brand-orange)',
                                    }} />
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Service Categories */}
                <div className="glass-panel" style={{ padding: '2rem' }}>
                    <h3 style={{ marginTop: 0, marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <Activity size={18} /> Service Categories
                    </h3>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                        {stats.categories.map((cat, i) => (
                            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.75rem', borderBottom: '1px solid var(--border-color)' }}>
                                <span style={{ fontWeight: 500 }} className="truncate" title={cat.name}>{cat.name}</span>
                                <span style={{ fontFamily: 'monospace', flexShrink: 0, marginLeft: '1rem' }}>{formatCurrency(cat.value)}</span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Detailed Transactions */}
            <div className="glass-panel" style={{ padding: '1.5rem' }}>
                <h3 style={{ marginTop: 0, marginBottom: '1rem' }}>Transactions</h3>
                <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                        <thead>
                            <tr style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-secondary)' }}>
                                <th style={{ textAlign: 'left', padding: '0.75rem' }}>Customer</th>
                                <th style={{ textAlign: 'left', padding: '0.75rem' }}>Service Category</th>
                                <th style={{ textAlign: 'left', padding: '0.75rem' }}>Charge Type</th>
                                <th style={{ textAlign: 'right', padding: '0.75rem' }}>Quantity</th>
                                <th style={{ textAlign: 'right', padding: '0.75rem' }}>Unit Price</th>
                                <th style={{ textAlign: 'right', padding: '0.75rem' }}>Cost</th>
                                <th style={{ textAlign: 'left', padding: '0.75rem' }}>Period</th>
                            </tr>
                        </thead>
                        <tbody>
                            {rows.slice(0, 100).map((r, i) => (
                                <tr key={i} style={{ borderBottom: '1px solid rgba(0,0,0,0.05)' }}>
                                    <td style={{ padding: '0.75rem', maxWidth: '200px' }} className="truncate" title={r.CustomerName}>{r.CustomerName}</td>
                                    <td style={{ padding: '0.75rem', color: 'var(--text-tertiary)', maxWidth: '180px' }} className="truncate" title={r.ProductName}>{r.ProductName || '-'}</td>
                                    <td style={{ padding: '0.75rem' }}>{r.ChargeType || '-'}</td>
                                    <td style={{ padding: '0.75rem', textAlign: 'right' }}>{r.Quantity}</td>
                                    <td style={{ padding: '0.75rem', textAlign: 'right', fontFamily: 'monospace' }}>
                                        {formatCurrency(r.UnitPrice)}
                                    </td>
                                    <td style={{ padding: '0.75rem', textAlign: 'right', fontFamily: 'monospace', fontWeight: 600 }}>
                                        {formatCurrency(r.Total || r.Subtotal || 0)}
                                    </td>
                                    <td style={{ padding: '0.75rem', fontSize: '0.8rem', color: 'var(--text-tertiary)' }}>
                                        {r.ChargeStartDate ? new Date(r.ChargeStartDate).toLocaleDateString('nl-NL') : '-'} – {r.ChargeEndDate ? new Date(r.ChargeEndDate).toLocaleDateString('nl-NL') : '-'}
                                    </td>
                                </tr>
                            ))}
                            {rows.length > 100 && (
                                <tr>
                                    <td colSpan={7} style={{ textAlign: 'center', padding: '1rem', color: 'var(--text-tertiary)' }}>
                                        ...and {rows.length - 100} more records.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export const AzureAnalyzer: React.FC = () => {
    const { data } = useBillingStore();
    const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
    const [selectedCustomer, setSelectedCustomer] = useState<string | null>(null);
    const [selectedResource, setSelectedResource] = useState<string | null>(null);
    const [expandedCustomers, setExpandedCustomers] = useState<Set<string>>(new Set());
    const [selectedResourceDetail, setSelectedResourceDetail] = useState<string | null>(null);

    const toggleExpand = (customerName: string) => {
        const next = new Set(expandedCustomers);
        if (next.has(customerName)) {
            next.delete(customerName);
        } else {
            next.add(customerName);
        }
        setExpandedCustomers(next);
    };

    const getCustomerResources = (customerName: string) => {
        const resources: Record<string, { name: string, category: string, value: number }> = {};

        // Use filteredStats to respect other active filters (like Category)
        filteredStats.rows
            .filter(r => (r.CustomerName || 'Unknown') === customerName)
            .forEach(r => {
                const name = r.MeterDescription || r.SkuName || 'Unknown';
                if (!resources[name]) {
                    resources[name] = {
                        name,
                        category: r.ProductName || 'Uncategorized',
                        value: 0
                    };
                }
                resources[name].value += (r.Total || r.Subtotal || 0);
            });

        return Object.values(resources).sort((a, b) => b.value - a.value);
    };

    // 1. Filter for Azure Rows (Base Data)
    const azureRows = useMemo(() => {
        return data.filter(r =>
            r.ProductCategory === 'Azure' ||
            (r.ProductName && r.ProductName.includes('Azure'))
        );
    }, [data]);

    // 2. Filtered Stats (Applies ALL active filters)
    const filteredStats = useMemo(() => {
        let rows = azureRows;

        // Apply Category Filter
        if (selectedCategory) {
            rows = rows.filter(r => {
                let cat = r.ProductName || 'Uncategorized';
                if (cat.length > 20) cat = cat.substring(0, 20) + '...';
                return cat === selectedCategory;
            });
        }

        // Apply Customer Filter
        if (selectedCustomer) {
            rows = rows.filter(r => (r.CustomerName || 'Unknown') === selectedCustomer);
        }

        // Apply Resource Filter
        if (selectedResource) {
            rows = rows.filter(r => {
                let resName = r.MeterDescription || r.SkuName || 'Unknown';
                if (resName.length > 25) resName = resName.substring(0, 25) + '...';
                return resName === selectedResource;
            });
        }

        const totalCost = rows.reduce((sum, r) => sum + (r.Total || r.Subtotal || 0), 0);

        return { rows, totalCost };
    }, [azureRows, selectedCategory, selectedCustomer, selectedResource]);


    // 3. Aggregations (Computed from Filtered Data to show "What's in this view")
    //    EXCEPT for the dimension itself if we want to show context? 
    //    Actually, standard drill-down usually filters everything.
    const aggregations = useMemo(() => {
        const byCategory: Record<string, number> = {};
        const byResource: Record<string, number> = {};
        const byCustomer: Record<string, number> = {};

        filteredStats.rows.forEach(r => {
            const cost = r.Total || r.Subtotal || 0;

            // Category
            let cat = r.ProductName || 'Uncategorized';
            if (cat.length > 20) cat = cat.substring(0, 20) + '...';
            byCategory[cat] = (byCategory[cat] || 0) + cost;

            // Resource
            let resName = r.MeterDescription || r.SkuName || 'Unknown';
            if (resName.length > 25) resName = resName.substring(0, 25) + '...';
            byResource[resName] = (byResource[resName] || 0) + cost;

            // Customer
            const cust = r.CustomerName || 'Unknown';
            byCustomer[cust] = (byCustomer[cust] || 0) + cost;
        });

        // Categories (Top 10 + Other)
        let categories = Object.entries(byCategory)
            .map(([name, value]) => ({ name, value }))
            .sort((a, b) => b.value - a.value);

        if (categories.length > 10) {
            const top9 = categories.slice(0, 9);
            const otherValue = categories.slice(9).reduce((sum, item) => sum + item.value, 0);
            categories = [...top9, { name: 'Other', value: otherValue }];
        }

        // Resources (Top 10)
        const resources = Object.entries(byResource)
            .map(([name, value]) => ({ name, value }))
            .sort((a, b) => b.value - a.value)
            .slice(0, 10);

        // Customers (All, sorted)
        const customers = Object.entries(byCustomer)
            .map(([name, value]) => ({ name, value }))
            .sort((a, b) => b.value - a.value);

        return { categories, resources, customers };
    }, [filteredStats.rows]);


    const formatCurrency = (val: number) => new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR' }).format(val);

    // Helpers for Badge UI
    const FilterBadge = ({ label, value, onClear, icon: Icon }: any) => (
        <span
            onClick={onClear}
            style={{
                background: 'var(--brand-orange)',
                color: 'white',
                padding: '4px 10px',
                borderRadius: '16px',
                fontSize: '0.8rem',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                cursor: 'pointer',
                boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
            }}
            title="Click to remove filter"
        >
            <Icon size={12} />
            <span style={{ maxWidth: '150px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {label}: {value}
            </span>
            <X size={14} style={{ marginLeft: '2px' }} />
        </span>
    );

    if (azureRows.length === 0) {
        return (
            <div className="glass-panel text-center" style={{ padding: '3rem', color: 'var(--text-tertiary)' }}>
                <Cloud size={48} style={{ marginBottom: '1rem', opacity: 0.5 }} />
                <h3>No Azure Data Found</h3>
                <p>Upload a file containing Azure Plan usage (MeterId, Resource Info) to see analytics.</p>
            </div>
        );
    }

    if (selectedResourceDetail) {
        const resourceRows = azureRows.filter(r =>
            (r.MeterDescription || r.SkuName || 'Unknown') === selectedResourceDetail
        );
        return (
            <AzureResourceDetail
                resourceName={selectedResourceDetail}
                rows={resourceRows}
                onBack={() => setSelectedResourceDetail(null)}
            />
        );
    }

    return (
        <div className="animate-fade-in" style={{ paddingBottom: '3rem' }}>
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '2rem' }}>
                <div style={{ background: 'var(--brand-turquoise)', padding: '0.75rem', borderRadius: '12px', color: '#fff' }}>
                    <Cloud size={24} />
                </div>
                <div>
                    <h2 style={{ margin: 0 }}>Azure Cost Analyzer</h2>
                    <div style={{ color: 'var(--text-tertiary)', display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap', marginTop: '0.5rem' }}>

                        {/* Summary Text */}
                        {!selectedCategory && !selectedCustomer && !selectedResource && (
                            <span>Analysis of {azureRows.length} resources</span>
                        )}

                        {/* Active Filters */}
                        {selectedCategory && (
                            <FilterBadge
                                icon={Activity}
                                label="Category"
                                value={selectedCategory}
                                onClear={() => setSelectedCategory(null)}
                            />
                        )}
                        {selectedResource && (
                            <FilterBadge
                                icon={Server}
                                label="Resource"
                                value={selectedResource}
                                onClear={() => setSelectedResource(null)}
                            />
                        )}
                        {selectedCustomer && (
                            <FilterBadge
                                icon={User}
                                label="Customer"
                                value={selectedCustomer}
                                onClear={() => setSelectedCustomer(null)}
                            />
                        )}
                    </div>
                </div>
                <div style={{ marginLeft: 'auto', textAlign: 'right' }}>
                    <div style={{ fontSize: '0.85rem', color: 'var(--text-tertiary)' }}>
                        {(selectedCategory || selectedCustomer || selectedResource) ? 'Filtered Spend' : 'Total Azure Spend'}
                    </div>
                    <div style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                        {formatCurrency(filteredStats.totalCost)}
                    </div>
                </div>
            </div>

            {/* Main Grid */}
            <div className="dashboard-grid" style={{ gridTemplateColumns: '1fr 1fr', marginBottom: '2rem' }}>

                {/* 1. Category Split (Pie) */}
                <div className="glass-panel" style={{ padding: '1.5rem', minHeight: '350px', overflow: 'hidden' }}>
                    <h3 style={{ marginTop: 0, marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <Activity size={18} /> Spend by Service Category
                    </h3>
                    <ResponsiveContainer width="100%" height={250}>
                        <PieChart>
                            <Pie
                                data={aggregations.categories}
                                cx="50%"
                                cy="50%"
                                innerRadius={60}
                                outerRadius={80}
                                paddingAngle={5}
                                dataKey="value"
                                onClick={(data) => setSelectedCategory(data.name === 'Other' ? null : data.name)}
                                style={{ cursor: 'pointer' }}
                            >
                                {aggregations.categories.map((entry, index) => (
                                    <Cell
                                        key={`cell-${index}`}
                                        fill={COLORS[index % COLORS.length]}
                                        opacity={selectedCategory && selectedCategory !== entry.name ? 0.3 : 1}
                                        cursor="pointer"
                                    />
                                ))}
                            </Pie>
                            <Tooltip formatter={(val: any) => formatCurrency(Number(val))} />
                            <Legend
                                layout="vertical"
                                align="right"
                                verticalAlign="middle"
                                onClick={(data: any) => setSelectedCategory(data.value === 'Other' ? null : ((data.value === selectedCategory) ? null : data.value))}
                                wrapperStyle={{ maxWidth: '45%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', cursor: 'pointer' }}
                            />
                        </PieChart>
                    </ResponsiveContainer>
                </div>

                {/* 2. Top Resources (Bar) */}
                <div className="glass-panel" style={{ padding: '1.5rem', minHeight: '350px', overflow: 'hidden' }}>
                    <h3 style={{ marginTop: 0, marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <Server size={18} /> Top 10 Cost Drivers (Meters)
                    </h3>
                    <ResponsiveContainer width="100%" height={250}>
                        <BarChart
                            data={aggregations.resources}
                            layout="vertical"
                            margin={{ top: 5, right: 30, left: 40, bottom: 5 }}
                        >
                            <XAxis type="number" hide />
                            <XAxis type="number" hide />
                            <YAxis
                                type="category"
                                dataKey="name"
                                width={210}
                                interval={0}
                                tick={({ x, y, payload }) => (
                                    <g transform={`translate(${x},${y})`} style={{ cursor: 'pointer' }} onClick={() => setSelectedResource(payload.value === selectedResource ? null : payload.value)}>
                                        <text x={0} y={0} dy={4} textAnchor="end" fill={selectedResource === payload.value ? "var(--brand-orange)" : "#666"} fontSize={11} width={210}>
                                            {payload.value.length > 30 ? payload.value.substring(0, 30) + '...' : payload.value}
                                        </text>
                                    </g>
                                )}
                            />
                            <Tooltip
                                formatter={(val: any) => formatCurrency(Number(val))}
                                contentStyle={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-color)' }}
                            />
                            <Bar
                                dataKey="value"
                                radius={[0, 4, 4, 0]}
                                cursor="pointer"
                                onClick={(data: any) => {
                                    setSelectedResource(data.name === selectedResource ? null : data.name);
                                }}
                            >
                                {aggregations.resources.map((entry, index) => (
                                    <Cell
                                        key={`cell-${index}`}
                                        fill={selectedResource === entry.name ? "var(--brand-orange)" : "#0078D4"}
                                    />
                                ))}
                            </Bar>
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            </div>

            {/* 3. Top Spending Customers Table */}
            <div className="glass-panel" style={{ padding: '0 1.5rem 1.5rem' }}>
                <h3 style={{ paddingTop: '1.5rem', marginBottom: '1rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '1rem' }}>
                    Top Azure Customers
                </h3>
                <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
                    <thead>
                        <tr>
                            <th style={{ textAlign: 'left', padding: '0.75rem', color: 'var(--text-tertiary)', width: '50%' }}>Customer</th>
                            <th style={{ textAlign: 'right', padding: '0.75rem', color: 'var(--text-tertiary)' }}>Azure Spend</th>
                            <th style={{ textAlign: 'right', padding: '0.75rem', color: 'var(--text-tertiary)' }}>% of Total</th>
                        </tr>
                    </thead>
                    <tbody>
                        {aggregations.customers.length === 0 ? (
                            <tr><td colSpan={3} style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-tertiary)' }}>No customers match this filter</td></tr>
                        ) : (
                            aggregations.customers.slice(0, 20).map((cust, i) => (
                                <React.Fragment key={i}>
                                    <tr
                                        onClick={() => toggleExpand(cust.name)}
                                        style={{
                                            borderBottom: expandedCustomers.has(cust.name) ? 'none' : '1px solid var(--border-color)',
                                            cursor: 'pointer',
                                            backgroundColor: expandedCustomers.has(cust.name) ? 'var(--bg-tertiary)' : 'transparent',
                                            transition: 'background 0.2s'
                                        }}
                                        onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--bg-hover)'}
                                        onMouseLeave={(e) => e.currentTarget.style.backgroundColor = expandedCustomers.has(cust.name) ? 'var(--bg-tertiary)' : 'transparent'}
                                    >
                                        <td style={{ padding: '0.75rem', fontWeight: 500, display: 'flex', alignItems: 'center', gap: '0.5rem' }} className="truncate" title={cust.name}>
                                            {expandedCustomers.has(cust.name) ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                                            {cust.name}
                                        </td>
                                        <td style={{ padding: '0.75rem', textAlign: 'right', fontFamily: 'monospace' }}>{formatCurrency(cust.value)}</td>
                                        <td style={{ padding: '0.75rem', textAlign: 'right', color: 'var(--text-tertiary)', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '1rem' }}>
                                            <span>{((cust.value / filteredStats.totalCost) * 100).toFixed(1)}%</span>
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    setSelectedCustomer(selectedCustomer === cust.name ? null : cust.name);
                                                }}
                                                style={{
                                                    background: selectedCustomer === cust.name ? 'var(--brand-orange)' : 'transparent',
                                                    color: selectedCustomer === cust.name ? 'white' : 'var(--text-tertiary)',
                                                    border: '1px solid var(--border-color)',
                                                    borderRadius: '4px',
                                                    padding: '4px',
                                                    cursor: 'pointer',
                                                    display: 'flex',
                                                    alignItems: 'center'
                                                }}
                                                title="Filter by this customer"
                                            >
                                                <Filter size={14} />
                                            </button>
                                        </td>
                                    </tr>
                                    {expandedCustomers.has(cust.name) && (
                                        <tr>
                                            <td colSpan={3} style={{ padding: '0 0 1rem 0', background: 'var(--bg-tertiary)', borderBottom: '1px solid var(--border-color)' }}>
                                                <div style={{ maxHeight: '300px', overflowY: 'auto', padding: '0 1rem 0 2.5rem' }}>
                                                    <table style={{ width: '100%', fontSize: '0.85rem' }}>
                                                        <thead style={{ color: 'var(--text-tertiary)', borderBottom: '1px solid var(--border-color)' }}>
                                                            <tr>
                                                                <th style={{ textAlign: 'left', padding: '0.5rem' }}>Resource (Meter)</th>
                                                                <th style={{ textAlign: 'left', padding: '0.5rem' }}>Category</th>
                                                                <th style={{ textAlign: 'right', padding: '0.5rem' }}>Cost</th>
                                                                <th style={{ padding: '0.5rem' }}></th>
                                                            </tr>
                                                        </thead>
                                                        <tbody>
                                                            {getCustomerResources(cust.name).map((res, idx) => (
                                                                <tr key={idx} style={{ borderBottom: '1px solid rgba(0,0,0,0.05)' }}>
                                                                    <td
                                                                        style={{ padding: '0.5rem', color: 'var(--brand-turquoise)', cursor: 'pointer', textDecoration: 'underline', fontWeight: 500 }}
                                                                        className="truncate"
                                                                        title={res.name}
                                                                        onClick={() => setSelectedResourceDetail(res.name)}
                                                                    >
                                                                        {res.name}
                                                                    </td>
                                                                    <td style={{ padding: '0.5rem', color: 'var(--text-tertiary)' }}>{res.category}</td>
                                                                    <td style={{ padding: '0.5rem', textAlign: 'right', fontFamily: 'monospace' }}>{formatCurrency(res.value)}</td>
                                                                    <td style={{ padding: '0.5rem' }}>
                                                                        <button
                                                                            onClick={() => setSelectedResourceDetail(res.name)}
                                                                            style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-tertiary)', display: 'flex', alignItems: 'center', padding: '2px' }}
                                                                            title="View resource details"
                                                                        >
                                                                            <ExternalLink size={13} />
                                                                        </button>
                                                                    </td>
                                                                </tr>
                                                            ))}
                                                        </tbody>
                                                    </table>
                                                </div>
                                            </td>
                                        </tr>
                                    )}
                                </React.Fragment>
                            ))
                        )}
                    </tbody>
                </table>
            </div>

        </div>
    );
};
