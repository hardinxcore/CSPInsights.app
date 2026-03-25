import React, { useMemo, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';
import type { BillingRecord } from '../types/BillingData';

// Brand Palette: Orange (#FE5000), Turquoise (#00B5E2), Grey (#5B6770), Light Grey (#AAB4BA)
const COLORS = ['#FE5000', '#00B5E2', '#5B6770', '#AAB4BA', '#F0F0F0', '#E5F6FD'];

interface DashboardChartsProps {
    data: BillingRecord[];
    onFilterChange: (column: string, value: string) => void;
}

type ChartMode = 'customers' | 'products';

export const DashboardCharts: React.FC<DashboardChartsProps> = ({ data, onFilterChange }) => {
    const [chartMode, setChartMode] = useState<ChartMode>('customers');

    const stats = useMemo(() => {
        // 1. Top 5 Customers by Spend
        const customerSpend: Record<string, number> = {};
        const productSpend: Record<string, number> = {};
        const productSplit: Record<string, number> = {};

        data.forEach(row => {
            const cost = row.Total || row.Subtotal || 0;
            const cust = row.CustomerName || 'Unknown';
            const prod = row.ProductName || 'Unknown';

            customerSpend[cust] = (customerSpend[cust] || 0) + cost;
            productSpend[prod] = (productSpend[prod] || 0) + cost;

            // Simplified product category logic
            let category = 'Other';
            if (prod.toLowerCase().includes('azure')) category = 'Azure';
            else if (prod.toLowerCase().includes('microsoft 365') || prod.toLowerCase().includes('office 365')) category = 'M365';
            else if (prod.toLowerCase().includes('dynamics')) category = 'Dynamics';

            productSplit[category] = (productSplit[category] || 0) + cost;
        });

        const topCustomers = Object.entries(customerSpend)
            .map(([name, value]) => ({ name, value }))
            .sort((a, b) => b.value - a.value)
            .slice(0, 5);

        const topProducts = Object.entries(productSpend)
            .map(([name, value]) => ({ name, value }))
            .sort((a, b) => b.value - a.value)
            .slice(0, 5);

        const productData = Object.entries(productSplit)
            .map(([name, value]) => ({ name, value }))
            .sort((a, b) => b.value - a.value);

        return { topCustomers, topProducts, productData };
    }, [data]);

    if (data.length === 0) return null;

    return (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '1.5rem', marginBottom: '2rem' }}>
            <div className="glass-panel" style={{ padding: '1.5rem', minHeight: '300px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                    <h3 style={{ fontSize: '1rem', color: 'var(--text-secondary)', margin: 0 }}>
                        {chartMode === 'customers' ? 'Top 5 Customers' : 'Top 5 Products'}
                    </h3>
                    <div style={{ background: 'var(--brand-bg-grey)', borderRadius: '20px', padding: '2px', display: 'flex' }}>
                        <button
                            onClick={() => setChartMode('customers')}
                            style={{
                                padding: '4px 12px',
                                borderRadius: '16px',
                                fontSize: '0.75rem',
                                fontWeight: 500,
                                background: chartMode === 'customers' ? '#fff' : 'transparent',
                                color: chartMode === 'customers' ? 'var(--brand-orange)' : 'var(--text-secondary)',
                                boxShadow: chartMode === 'customers' ? '0 2px 4px rgba(0,0,0,0.1)' : 'none',
                                transition: 'all 0.2s ease'
                            }}
                        >
                            Customers
                        </button>
                        <button
                            onClick={() => setChartMode('products')}
                            style={{
                                padding: '4px 12px',
                                borderRadius: '16px',
                                fontSize: '0.75rem',
                                fontWeight: 500,
                                background: chartMode === 'products' ? '#fff' : 'transparent',
                                color: chartMode === 'products' ? 'var(--brand-orange)' : 'var(--text-secondary)',
                                boxShadow: chartMode === 'products' ? '0 2px 4px rgba(0,0,0,0.1)' : 'none',
                                transition: 'all 0.2s ease'
                            }}
                        >
                            Products
                        </button>
                    </div>
                </div>
                <ResponsiveContainer width="100%" height={250}>
                    <BarChart
                        data={chartMode === 'customers' ? stats.topCustomers : stats.topProducts}
                        layout="vertical"
                        margin={{ top: 5, right: 30, left: 40, bottom: 5 }}
                    >
                        <XAxis type="number" hide />
                        <YAxis type="category" dataKey="name" width={120} tick={{ fontSize: 11 }} />
                        <Tooltip
                            formatter={(val: any) => new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR' }).format(Number(val))}
                            contentStyle={{ background: 'rgba(255,255,255,0.9)', borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px rgba(0,0,0,0.1)' }}
                        />
                        <Bar
                            dataKey="value"
                            fill={chartMode === 'customers' ? "var(--brand-turquoise)" : "var(--brand-orange)"}
                            radius={[0, 4, 4, 0]}
                            style={{ cursor: 'pointer' }}
                            onClick={(data: any) => {
                                if (data && data.name) {
                                    const field = chartMode === 'customers' ? 'CustomerName' : 'ProductName';
                                    onFilterChange(field, data.name);
                                }
                            }}
                        />
                    </BarChart>
                </ResponsiveContainer>
            </div>

            <div className="glass-panel" style={{ padding: '1.5rem', minHeight: '300px' }}>
                <h3 style={{ marginBottom: '1rem', fontSize: '1rem', color: 'var(--text-secondary)' }}>Cost Distribution</h3>
                <ResponsiveContainer width="100%" height={250}>
                    <PieChart>
                        <Pie
                            data={stats.productData}
                            cx="50%"
                            cy="50%"
                            innerRadius={60}
                            outerRadius={80}
                            paddingAngle={5}
                            dataKey="value"
                            onClick={(data: any) => {
                                if (data && data.name) {
                                    let filterValue = data.name;
                                    // Improve matching for M365 category
                                    if (data.name === 'M365') filterValue = '365';
                                    onFilterChange('ProductName', filterValue);
                                }
                            }}
                            style={{ cursor: 'pointer' }}
                        >
                            {stats.productData.map((_, index) => (
                                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                            ))}
                        </Pie>
                        <Tooltip
                            formatter={(val: any) => new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR' }).format(Number(val))}
                            contentStyle={{ background: 'rgba(255,255,255,0.9)', borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px rgba(0,0,0,0.1)' }}
                        />
                        <Legend verticalAlign="bottom" height={36} />
                    </PieChart>
                </ResponsiveContainer>
            </div>
        </div>
    );
};
