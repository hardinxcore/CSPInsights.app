import React, { useMemo, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import type { BillingRecord } from '../types/BillingData';
import './CostChart.css';

interface CostChartProps {
    data: BillingRecord[];
}

type GroupBy = 'CustomerName' | 'ProductName';

export const CostChart: React.FC<CostChartProps> = ({ data }) => {
    const [groupBy, setGroupBy] = useState<GroupBy>('CustomerName');

    const chartData = useMemo(() => {
        const stats: Record<string, number> = {};
        data.forEach(r => {
            const key = r[groupBy] || 'Unknown';
            stats[key] = (stats[key] || 0) + (r.Total || r.Subtotal || 0);
        });

        return Object.entries(stats)
            .map(([name, value]) => ({ name, value }))
            .sort((a, b) => b.value - a.value)
            .slice(0, 10); // Top 10
    }, [data, groupBy]);

    const formatCurrency = (val: number) => {
        return new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR', minimumFractionDigits: 0 }).format(val);
    };

    return (
        <div className="chart-container glass-panel">
            <div className="chart-header">
                <h3 className="section-title" style={{ border: 'none', margin: 0 }}>
                    Cost Distribution
                </h3>
                <div className="chart-controls">
                    <button
                        className={`chart-btn ${groupBy === 'CustomerName' ? 'active' : ''}`}
                        onClick={() => setGroupBy('CustomerName')}
                    >
                        By Customer
                    </button>
                    <button
                        className={`chart-btn ${groupBy === 'ProductName' ? 'active' : ''}`}
                        onClick={() => setGroupBy('ProductName')}
                    >
                        By Product
                    </button>
                </div>
            </div>

            <div style={{ width: '100%', height: 300 }}>
                <ResponsiveContainer>
                    <BarChart data={chartData} layout="vertical" margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" horizontal={false} />
                        <XAxis type="number" stroke="var(--text-secondary)" tickFormatter={(val) => `€${val}`} />
                        <YAxis
                            type="category"
                            dataKey="name"
                            stroke="var(--text-secondary)"
                            width={150}
                            tick={{ fontSize: 12, fill: 'var(--text-secondary)' }}
                        />
                        <Tooltip
                            cursor={{ fill: 'var(--bg-tertiary)' }}
                            contentStyle={{
                                backgroundColor: 'var(--bg-secondary)',
                                borderColor: 'var(--border-color)',
                                color: 'var(--text-primary)',
                                borderRadius: 'var(--radius-md)',
                                boxShadow: '0 4px 6px rgba(0,0,0,0.1)'
                            } as React.CSSProperties}
                            formatter={(value: any) => [formatCurrency(value as number), 'Total Cost']}
                        />
                        <Bar dataKey="value" fill="var(--accent-primary)" radius={[0, 4, 4, 0]} />
                    </BarChart>
                </ResponsiveContainer>
            </div>
        </div>
    );
};
