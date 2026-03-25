import React, { useMemo } from 'react';
import type { BillingRecord } from '../types/BillingData';
import { ArrowUpRight, TrendingUp, AlertTriangle } from 'lucide-react';

interface SeatRadarProps {
    currentData: BillingRecord[];
    previousData: BillingRecord[];
    datasetName: string;
}

interface ChangeItem {
    name: string;      // Customer Name
    product: string;
    oldQty: number;
    newQty: number;
    diff: number;
    valueImpact: number; // Estimated revenue impact
}

export const SeatRadar: React.FC<SeatRadarProps> = ({ currentData, previousData, datasetName }) => {

    const analysis = useMemo(() => {
        // Map: Customer|Product -> Quantity
        const currentMap = new Map<string, { qty: number, cost: number, cust: string, prod: string }>();
        const prevMap = new Map<string, { qty: number, cost: number, cust: string, prod: string }>();

        // Helper to generate key
        const getKey = (r: BillingRecord) => `${r.CustomerName}|${r.ProductId}`; // ProductId is safer than Name

        // Populate Current
        currentData.forEach(r => {
            const key = getKey(r);
            const existing = currentMap.get(key) || { qty: 0, cost: 0, cust: r.CustomerName, prod: r.ProductName };
            existing.qty += r.Quantity;
            existing.cost += (r.Total || r.Subtotal || 0);
            currentMap.set(key, existing);
        });

        // Populate Previous
        previousData.forEach(r => {
            const key = getKey(r);
            const existing = prevMap.get(key) || { qty: 0, cost: 0, cust: r.CustomerName, prod: r.ProductName };
            existing.qty += r.Quantity;
            existing.cost += (r.Total || r.Subtotal || 0);
            prevMap.set(key, existing);
        });

        const upsells: ChangeItem[] = [];
        const churns: ChangeItem[] = [];
        const reductions: ChangeItem[] = []; // Same product, fewer seats
        const newSales: ChangeItem[] = []; // New product

        // Analyze Changes based on Current Keys
        currentMap.forEach((curr, key) => {
            const prev = prevMap.get(key);
            if (!prev) {
                // NEW SALE
                newSales.push({
                    name: curr.cust,
                    product: curr.prod,
                    oldQty: 0,
                    newQty: curr.qty,
                    diff: curr.qty,
                    valueImpact: curr.cost
                });
            } else if (curr.qty > prev.qty) {
                // UPSELL (More Seats)
                upsells.push({
                    name: curr.cust,
                    product: curr.prod,
                    oldQty: prev.qty,
                    newQty: curr.qty,
                    diff: curr.qty - prev.qty,
                    valueImpact: curr.cost - prev.cost
                });
            } else if (curr.qty < prev.qty) {
                // REDUCTION (Fewer Seats)
                reductions.push({
                    name: curr.cust,
                    product: curr.prod,
                    oldQty: prev.qty,
                    newQty: curr.qty,
                    diff: curr.qty - prev.qty,
                    valueImpact: curr.cost - prev.cost
                });
            }
        });

        // Analyze Churn (Keys in Prev but NOT in Current)
        prevMap.forEach((prev, key) => {
            if (!currentMap.has(key)) {
                // FULL CHURN (Product removed)
                churns.push({
                    name: prev.cust,
                    product: prev.prod,
                    oldQty: prev.qty,
                    newQty: 0,
                    diff: -prev.qty,
                    valueImpact: -prev.cost
                });
            }
        });

        // Sort by impact
        const sortFn = (a: ChangeItem, b: ChangeItem) => Math.abs(b.valueImpact) - Math.abs(a.valueImpact);

        return {
            newSales: newSales.sort(sortFn).slice(0, 5),
            upsells: upsells.sort(sortFn).slice(0, 5),
            reductions: reductions.sort(sortFn).slice(0, 5),
            churns: churns.sort(sortFn).slice(0, 5),
            totalGrowth: newSales.length + upsells.length,
            totalRisk: reductions.length + churns.length
        };

    }, [currentData, previousData]);

    const formatCurrency = (val: number) => new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR' }).format(val);

    return (
        <div className="animate-fade-in" style={{ marginBottom: '2rem' }}>
            <h3 className="section-title" style={{ marginTop: 0, marginBottom: '1rem', border: 'none', display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <TrendingUp size={20} /> Seat Change Radar
                </span>
                <span style={{ fontSize: '0.85rem', fontWeight: 400, color: 'var(--text-tertiary)' }}>
                    Comparing vs {datasetName}
                </span>
            </h3>

            <div className="dashboard-grid" style={{ gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>

                {/* GROWTH COLUMN */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    <div style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--success)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <ArrowUpRight size={18} /> Opportunity (Growth)
                    </div>

                    {/* New Sales */}
                    <div className="glass-panel" style={{ padding: '0', overflow: 'hidden', borderLeft: '4px solid var(--success)' }}>
                        <div style={{ padding: '0.75rem 1rem', background: 'var(--bg-secondary)', fontWeight: 600, fontSize: '0.85rem' }}>
                            New Products Added
                        </div>
                        {analysis.newSales.length > 0 ? (
                            <table style={{ width: '100%', fontSize: '0.85rem' }}>
                                <tbody>
                                    {analysis.newSales.map((item, i) => (
                                        <tr key={i} style={{ borderBottom: '1px solid var(--border-color)' }}>
                                            <td style={{ padding: '0.5rem 1rem' }}>
                                                <div style={{ fontWeight: 500 }}>{item.name}</div>
                                                <div style={{ color: 'var(--text-tertiary)', fontSize: '0.75rem' }} className="truncate" title={item.product}>{item.product}</div>
                                            </td>
                                            <td style={{ padding: '0.5rem 1rem', textAlign: 'right' }}>
                                                <div style={{ fontWeight: 600, color: 'var(--success)' }}>+{item.newQty}</div>
                                                <div style={{ fontSize: '0.75rem', color: 'var(--success)' }}>+{formatCurrency(item.valueImpact)}</div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        ) : (
                            <div style={{ padding: '1rem', textAlign: 'center', color: 'var(--text-tertiary)', fontSize: '0.8rem' }}>No new products found.</div>
                        )}
                    </div>

                    {/* Upsells */}
                    <div className="glass-panel" style={{ padding: '0', overflow: 'hidden', borderLeft: '4px solid var(--brand-turquoise)' }}>
                        <div style={{ padding: '0.75rem 1rem', background: 'var(--bg-secondary)', fontWeight: 600, fontSize: '0.85rem' }}>
                            Seat Increases
                        </div>
                        {analysis.upsells.length > 0 ? (
                            <table style={{ width: '100%', fontSize: '0.85rem' }}>
                                <tbody>
                                    {analysis.upsells.map((item, i) => (
                                        <tr key={i} style={{ borderBottom: '1px solid var(--border-color)' }}>
                                            <td style={{ padding: '0.5rem 1rem' }}>
                                                <div style={{ fontWeight: 500 }}>{item.name}</div>
                                                <div style={{ color: 'var(--text-tertiary)', fontSize: '0.75rem' }} className="truncate" title={item.product}>{item.product}</div>
                                            </td>
                                            <td style={{ padding: '0.5rem 1rem', textAlign: 'right' }}>
                                                <div style={{ fontWeight: 600, color: 'var(--brand-turquoise)' }}>
                                                    {item.oldQty} → {item.newQty} <span style={{ fontSize: '0.75rem' }}>(+{item.diff})</span>
                                                </div>
                                                <div style={{ fontSize: '0.75rem', color: 'var(--success)' }}>+{formatCurrency(item.valueImpact)}</div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        ) : (
                            <div style={{ padding: '1rem', textAlign: 'center', color: 'var(--text-tertiary)', fontSize: '0.8rem' }}>No seat increases found.</div>
                        )}
                    </div>
                </div>

                {/* RISK COLUMN */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    <div style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--danger)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <AlertTriangle size={18} /> Risk (Churn)
                    </div>

                    {/* Churns */}
                    <div className="glass-panel" style={{ padding: '0', overflow: 'hidden', borderLeft: '4px solid var(--danger)' }}>
                        <div style={{ padding: '0.75rem 1rem', background: 'var(--bg-secondary)', fontWeight: 600, fontSize: '0.85rem' }}>
                            Products Removed
                        </div>
                        {analysis.churns.length > 0 ? (
                            <table style={{ width: '100%', fontSize: '0.85rem' }}>
                                <tbody>
                                    {analysis.churns.map((item, i) => (
                                        <tr key={i} style={{ borderBottom: '1px solid var(--border-color)' }}>
                                            <td style={{ padding: '0.5rem 1rem' }}>
                                                <div style={{ fontWeight: 500 }}>{item.name}</div>
                                                <div style={{ color: 'var(--text-tertiary)', fontSize: '0.75rem' }} className="truncate" title={item.product}>{item.product}</div>
                                            </td>
                                            <td style={{ padding: '0.5rem 1rem', textAlign: 'right' }}>
                                                <div style={{ fontWeight: 600, color: 'var(--danger)' }}>Removed ({item.oldQty})</div>
                                                <div style={{ fontSize: '0.75rem', color: 'var(--danger)' }}>{formatCurrency(item.valueImpact)}</div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        ) : (
                            <div style={{ padding: '1rem', textAlign: 'center', color: 'var(--text-tertiary)', fontSize: '0.8rem' }}>No cancellations found.</div>
                        )}
                    </div>

                    {/* Reductions */}
                    <div className="glass-panel" style={{ padding: '0', overflow: 'hidden', borderLeft: '4px solid var(--brand-orange)' }}>
                        <div style={{ padding: '0.75rem 1rem', background: 'var(--bg-secondary)', fontWeight: 600, fontSize: '0.85rem' }}>
                            Seat Reductions
                        </div>
                        {analysis.reductions.length > 0 ? (
                            <table style={{ width: '100%', fontSize: '0.85rem' }}>
                                <tbody>
                                    {analysis.reductions.map((item, i) => (
                                        <tr key={i} style={{ borderBottom: '1px solid var(--border-color)' }}>
                                            <td style={{ padding: '0.5rem 1rem' }}>
                                                <div style={{ fontWeight: 500 }}>{item.name}</div>
                                                <div style={{ color: 'var(--text-tertiary)', fontSize: '0.75rem' }} className="truncate" title={item.product}>{item.product}</div>
                                            </td>
                                            <td style={{ padding: '0.5rem 1rem', textAlign: 'right' }}>
                                                <div style={{ fontWeight: 600, color: 'var(--brand-orange)' }}>
                                                    {item.oldQty} → {item.newQty} <span style={{ fontSize: '0.75rem' }}>({item.diff})</span>
                                                </div>
                                                <div style={{ fontSize: '0.75rem', color: 'var(--danger)' }}>{formatCurrency(item.valueImpact)}</div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        ) : (
                            <div style={{ padding: '1rem', textAlign: 'center', color: 'var(--text-tertiary)', fontSize: '0.8rem' }}>No seat reductions found.</div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};
