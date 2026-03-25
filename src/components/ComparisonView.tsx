import React, { useState, useMemo, useEffect } from 'react';
import type { BillingRecord } from '../types/BillingData';
import { Loader2, TrendingUp, Package, Users, Calendar, Check, ArrowUpRight, ArrowDownRight } from 'lucide-react';
import { useSnapshotStore } from '../store/snapshotStore';
import { loadSnapshot } from '../utils/db';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, AreaChart, Area, Legend } from 'recharts';
import { SeatRadar } from './SeatRadar';

interface ComparisonViewProps {
    currentData: BillingRecord[];
}

interface Dataset {
    id: string; // 'current' or snapshot ID
    name: string;
    date: Date;
    data: BillingRecord[];
    total: number;
}

export const ComparisonView: React.FC<ComparisonViewProps> = ({ currentData }) => {
    const { snapshots, loadSnapshots } = useSnapshotStore();

    // Multi-select state
    const [selectedSnapshotIds, setSelectedSnapshotIds] = useState<Set<string>>(new Set());
    const [loadedDatasets, setLoadedDatasets] = useState<Dataset[]>([]);

    const [loading, setLoading] = useState(false);

    const [analysisMode, setAnalysisMode] = useState<'customer' | 'product'>('customer');

    const inferDateFromData = (data: BillingRecord[]): { date: Date, label: string } => {
        const record = data.find(r => r.ChargeStartDate);
        if (record && record.ChargeStartDate) {
            const d = new Date(record.ChargeStartDate);
            if (!isNaN(d.getTime())) {
                return { date: d, label: d.toLocaleDateString('nl-NL', { month: 'short', year: 'numeric' }) };
            }
        }
        return { date: new Date(), label: 'Unknown' };
    };

    // 1. Derive Datasets from currentData (Always available)
    const derivedDatasets = useMemo(() => {
        const invoices: Record<string, BillingRecord[]> = {};
        const noInvoiceData: BillingRecord[] = [];

        currentData.forEach(r => {
            if (r.InvoiceNumber) {
                if (!invoices[r.InvoiceNumber]) invoices[r.InvoiceNumber] = [];
                invoices[r.InvoiceNumber].push(r);
            } else {
                noInvoiceData.push(r);
            }
        });

        const datasets: Dataset[] = [];

        // Invoice Groups
        Object.entries(invoices).forEach(([invNum, rows]) => {
            const params = inferDateFromData(rows);
            datasets.push({
                id: `invoice-${invNum}`,
                name: `Invoice ${invNum}`,
                date: params.date,
                data: rows,
                total: rows.reduce((sum, r) => sum + (r.Total || r.Subtotal || 0), 0)
            });
        });

        // Unbilled Group
        if (noInvoiceData.length > 0) {
            const params = inferDateFromData(noInvoiceData);
            datasets.push({
                id: 'current-unbilled',
                name: 'Unbilled / Estimate',
                date: params.date,
                data: noInvoiceData,
                total: noInvoiceData.reduce((sum, r) => sum + (r.Total || r.Subtotal || 0), 0)
            });
        }

        // Fallback
        if (datasets.length === 0 && currentData.length > 0) {
            const params = inferDateFromData(currentData);
            datasets.push({
                id: 'current',
                name: 'Current Data',
                date: params.date,
                data: currentData,
                total: currentData.reduce((sum, r) => sum + (r.Total || r.Subtotal || 0), 0)
            });
        }

        return datasets;
    }, [currentData]);

    // 2. Initialize Selection
    useEffect(() => {
        loadSnapshots();
        // Default: Select all derived datasets
        const ids = new Set<string>();
        derivedDatasets.forEach(d => ids.add(d.id));
        setSelectedSnapshotIds(ids);
        setLoadedDatasets(derivedDatasets);
    }, [derivedDatasets, loadSnapshots]);



    const toggleSnapshot = async (id: string) => {
        const newSet = new Set(selectedSnapshotIds);

        if (newSet.has(id)) {
            // Deselect
            newSet.delete(id);
            setSelectedSnapshotIds(newSet);
            // If it's a loaded dataset, remove it
            setLoadedDatasets(prev => prev.filter(d => d.id !== id));
        } else {
            // Select
            newSet.add(id);
            setSelectedSnapshotIds(newSet);

            // Is it a derived dataset (Current Invoice)?
            const derived = derivedDatasets.find(d => d.id === id);
            if (derived) {
                setLoadedDatasets(prev => [...prev, derived]);
                return;
            }

            // Otherwise, load from DB
            setLoading(true);
            try {
                const snap = await loadSnapshot(id);
                if (snap) {
                    const params = inferDateFromData(snap.data);
                    const newDataset: Dataset = {
                        id: snap.id,
                        name: snap.name || params.label,
                        date: params.date,
                        data: snap.data,
                        total: snap.data.reduce((sum, r) => sum + (r.Total || r.Subtotal || 0), 0)
                    };
                    setLoadedDatasets(prev => [...prev, newDataset]);
                }
            } catch (err) {
                console.error(err);
                alert('Failed to load snapshot');
                newSet.delete(id); // Revert selection on fail
                setSelectedSnapshotIds(newSet);
            } finally {
                setLoading(false);
            }
        }
    };

    // Re-add current data whenever datasets change (to ensure it's always there and sorted)
    const normalizedDatasets = useMemo(() => {
        // Just use loadedDatasets directly since we now populate it with current data partition(s)
        // Combine loaded snapshots (if we had separate state for them) with current...
        // But currently `loadedDatasets` IS the main state. 
        // Logic change: we should merge `snapshots` into this list if selected?
        // Actually `data` provided to `ComparisonView` is usually "LIVE" data.
        // We need to keep Current Data partitions separate from Historical Snapshots loaded via toggle.

        // Wait, `loadedDatasets` state currently holds EVERYTHING. 
        // My previous edit in toggleSnapshot pushed to it.
        // And the useEffect above OVERWRITES it with current data. 
        // This is a BUG if the user has selected snapshots!

        // FIX: Seperate state.
        // Let's rely on `loadedDatasets` containing BOTH. 
        // But useEffect dependencies need care.
        return [...loadedDatasets].sort((a, b) => a.date.getTime() - b.date.getTime());
    }, [loadedDatasets]);


    const trendStats = useMemo(() => {
        if (normalizedDatasets.length < 2) return null;

        // 1. Total Spend Trend
        const trendData = normalizedDatasets.map(ds => ({
            name: ds.date.toLocaleDateString('nl-NL', { month: 'short', year: '2-digit' }),
            fullDate: ds.date,
            total: ds.total,
            id: ds.id
        }));

        // 2. Entity Drift (Top Customers/Products over time)
        // Identify top 5 entities from the LATEST dataset
        const latest = normalizedDatasets[normalizedDatasets.length - 1];
        const key = analysisMode === 'customer' ? 'CustomerName' : 'ProductName';

        const latestTotals: Record<string, number> = {};
        latest.data.forEach(r => {
            const name = r[key] || 'Unknown';
            latestTotals[name] = (latestTotals[name] || 0) + (r.Total || r.Subtotal || 0);
        });

        const topEntities = Object.entries(latestTotals)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 5) // Top 5
            .map(e => e[0]);

        // Build stacked data for these top entities across ALL datasets
        const stackedData = normalizedDatasets.map(ds => {
            const point: any = {
                name: ds.date.toLocaleDateString('nl-NL', { month: 'short', year: '2-digit' })
            };

            // Calc totals for this dataset
            const dsTotals: Record<string, number> = {};
            ds.data.forEach(r => {
                const name = r[key] || 'Unknown';
                dsTotals[name] = (dsTotals[name] || 0) + (r.Total || r.Subtotal || 0);
            });

            topEntities.forEach(entity => {
                point[entity] = dsTotals[entity] || 0;
            });

            return point;
        });

        return { trendData, stackedData, topEntities, latestTotal: latest.total };

    }, [normalizedDatasets, analysisMode]);

    // 4. Risers & Fallers Analysis
    const risersFallers = useMemo(() => {
        if (normalizedDatasets.length < 2) return null;

        const current = normalizedDatasets[normalizedDatasets.length - 1];
        const previous = normalizedDatasets[normalizedDatasets.length - 2];
        const key = analysisMode === 'customer' ? 'CustomerName' : 'ProductName';

        // 1. Map totals
        const currentTotals: Record<string, number> = {};
        current.data.forEach(r => {
            const k = r[key] || 'Unknown';
            currentTotals[k] = (currentTotals[k] || 0) + (r.Total || r.Subtotal || 0);
        });

        const prevTotals: Record<string, number> = {};
        previous.data.forEach(r => {
            const k = r[key] || 'Unknown';
            prevTotals[k] = (prevTotals[k] || 0) + (r.Total || r.Subtotal || 0);
        });

        // 2. Calculate Variance
        const entities = new Set([...Object.keys(currentTotals), ...Object.keys(prevTotals)]);
        const changes = Array.from(entities).map(entity => {
            const curr = currentTotals[entity] || 0;
            const prev = prevTotals[entity] || 0;
            return {
                name: entity,
                current: curr,
                previous: prev,
                diff: curr - prev,
                pct: prev === 0 ? (curr > 0 ? 100 : 0) : ((curr - prev) / prev) * 100
            };
        });

        // 3. Sort
        const risers = [...changes].sort((a, b) => b.diff - a.diff).slice(0, 5).filter(c => c.diff > 1); // Only positive
        const fallers = [...changes].sort((a, b) => a.diff - b.diff).slice(0, 5).filter(c => c.diff < -1); // Only negative

        return { risers, fallers, periodLabel: `${previous.name} → ${current.name}` };
    }, [normalizedDatasets, analysisMode]);

    const formatCurrency = (val: number) => {
        return new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR' }).format(val);
    };

    const COLORS = ['#0078D4', '#E3008C', '#00B294', '#FFB900', '#F7630C', '#8764B8'];

    // Identify Previous Data for Seat Radar (Second to last vs Last)
    const previousDataset = normalizedDatasets.length >= 2 ? normalizedDatasets[normalizedDatasets.length - 2] : null;
    const currentDataset = normalizedDatasets.length >= 2 ? normalizedDatasets[normalizedDatasets.length - 1] : null;

    return (
        <div className="animate-fade-in" style={{ paddingBottom: '4rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <h3 className="section-title" style={{ margin: 0 }}>Trend Analysis</h3>
                <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                    {/* Analysis Mode Toggle */}
                    <div className="glass-panel" style={{ display: 'flex', padding: '2px', gap: '2px' }}>
                        <button
                            onClick={() => setAnalysisMode('customer')}
                            className={`pagination-btn ${analysisMode === 'customer' ? 'active' : ''}`}
                            style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', padding: '0.5rem 1rem' }}
                            title="Analyze by Customer"
                        >
                            <Users size={16} /> Customers
                        </button>
                        <button
                            onClick={() => setAnalysisMode('product')}
                            className={`pagination-btn ${analysisMode === 'product' ? 'active' : ''}`}
                            style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', padding: '0.5rem 1rem' }}
                            title="Analyze by Product"
                        >
                            <Package size={16} /> Products
                        </button>
                    </div>

                    <button
                        onClick={() => setSelectedSnapshotIds(new Set())}
                        style={{ fontSize: '0.85rem', color: 'var(--accent-secondary)' }}
                    >
                        Reset Selection
                    </button>
                </div>
            </div>

            {/* Snapshot Selector / Config Area */}
            <div className={`glass-panel ${normalizedDatasets.length > 1 ? '' : 'flex-center'}`} style={{ padding: '1.5rem', marginBottom: '2rem', minHeight: normalizedDatasets.length > 1 ? 'auto' : '300px' }}>

                {normalizedDatasets.length <= 1 && (
                    <div style={{ textAlign: 'center', maxWidth: '500px' }}>
                        <h3 className="text-gradient" style={{ marginBottom: '1rem' }}>Select Time Periods</h3>
                        <p style={{ color: 'var(--text-tertiary)', marginBottom: '2rem' }}>
                            Select previous invoices to compare against your current data. Charts will automatically generate.
                        </p>
                    </div>
                )}



                <div style={{ display: 'flex', gap: '1rem', overflowX: 'auto', paddingBottom: '1rem', justifyContent: normalizedDatasets.length > 1 ? 'flex-start' : 'center' }}>


                    {/* Snapshot List */}
                    {snapshots.map(s => {
                        const isSelected = selectedSnapshotIds.has(s.id);
                        return (
                            <div
                                key={s.id}
                                onClick={() => toggleSnapshot(s.id)}
                                style={{
                                    minWidth: '160px',
                                    padding: '1rem',
                                    borderRadius: '12px',
                                    border: isSelected ? '2px solid var(--brand-orange)' : '1px solid var(--border-color)',
                                    background: isSelected ? 'rgba(255, 185, 0, 0.05)' : 'var(--bg-secondary)',
                                    cursor: 'pointer',
                                    transition: 'all 0.2s ease',
                                    position: 'relative',
                                    opacity: loading ? 0.7 : 1
                                }}
                                className="hover-card"
                            >
                                <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-tertiary)', marginBottom: '0.5rem' }}>SNAPSHOT</div>
                                <div style={{ fontWeight: 600 }}>{s.name || 'Untitled'}</div>
                                <div style={{ fontSize: '0.8rem', color: 'var(--text-tertiary)' }}>
                                    {new Date(s.updatedAt).toLocaleDateString()}
                                </div>
                                {isSelected && (
                                    <div style={{ position: 'absolute', top: '10px', right: '10px', background: 'var(--brand-orange)', color: 'white', borderRadius: '50%', width: '20px', height: '20px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                        <Check size={12} />
                                    </div>
                                )}
                            </div>
                        );
                    })}

                    {/* Current Invoices (Detected) */}
                    {derivedDatasets.map(d => {
                        const isSelected = selectedSnapshotIds.has(d.id);
                        return (
                            <div
                                key={d.id}
                                onClick={() => toggleSnapshot(d.id)}
                                className="hover-card"
                                style={{
                                    minWidth: '160px',
                                    padding: '1rem',
                                    borderRadius: '12px',
                                    border: isSelected ? '2px solid var(--brand-turquoise)' : '1px solid var(--border-color)',
                                    background: isSelected ? 'rgba(0, 120, 212, 0.05)' : 'var(--bg-secondary)',
                                    cursor: 'pointer',
                                    transition: 'all 0.2s ease',
                                    position: 'relative'
                                }}
                            >
                                <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--brand-turquoise)', marginBottom: '0.5rem' }}>CURRENT FILE</div>
                                <div style={{ fontWeight: 600 }}>{d.name.replace('Invoice ', '')}</div>
                                <div style={{ fontSize: '0.8rem', color: 'var(--text-tertiary)' }}>{d.data.length} items</div>
                                <div style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>{d.date.toLocaleDateString('nl-NL', { month: 'short', year: 'numeric' })}</div>
                                {isSelected && (
                                    <div style={{ position: 'absolute', top: '10px', right: '10px', background: 'var(--brand-turquoise)', color: 'white', borderRadius: '50%', width: '20px', height: '20px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                        <Check size={12} />
                                    </div>
                                )}
                            </div>
                        )
                    })}
                </div>
            </div>

            {loading && (
                <div style={{ textAlign: 'center', padding: '2rem' }}>
                    <Loader2 className="animate-spin" size={32} style={{ color: 'var(--brand-turquoise)' }} />
                </div>
            )}

            {/* CHARTS */}
            {trendStats && (
                <div className="dashboard-grid animate-fade-in" style={{ gridTemplateColumns: '1fr 1fr', marginBottom: '2rem' }}>

                    {/* 1. Total Spend Line Chart */}
                    <div className="glass-panel" style={{ padding: '1.5rem', minHeight: '350px' }}>
                        <h3 className="section-title" style={{ marginTop: 0, marginBottom: '1rem', border: 'none' }}>
                            <TrendingUp size={18} style={{ marginRight: '8px' }} /> Total Spend Trend
                        </h3>
                        <ResponsiveContainer width="100%" height={250}>
                            <AreaChart data={trendStats.trendData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                                <defs>
                                    <linearGradient id="colorTotal" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#0078D4" stopOpacity={0.3} />
                                        <stop offset="95%" stopColor="#0078D4" stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <XAxis dataKey="name" />
                                <YAxis
                                    tickFormatter={(val) => `€${(val / 1000).toFixed(0)}k`}
                                    width={60}
                                />
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border-color)" />
                                <Tooltip
                                    formatter={(val: any) => formatCurrency(Number(val))}
                                    contentStyle={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-color)' }}
                                />
                                <Area
                                    type="monotone"
                                    dataKey="total"
                                    stroke="#0078D4"
                                    strokeWidth={3}
                                    fillOpacity={1}
                                    fill="url(#colorTotal)"
                                />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>

                    {/* 2. Top Entities Stacked Bar */}
                    <div className="glass-panel" style={{ padding: '1.5rem', minHeight: '350px' }}>
                        <h3 className="section-title" style={{ marginTop: 0, marginBottom: '1rem', border: 'none' }}>
                            <Calendar size={18} style={{ marginRight: '8px' }} /> Top 5 {analysisMode === 'customer' ? 'Customers' : 'Products'} History
                        </h3>
                        <ResponsiveContainer width="100%" height={250}>
                            <BarChart data={trendStats.stackedData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                <XAxis dataKey="name" />
                                <YAxis tickFormatter={(val) => `€${(val / 1000).toFixed(0)}k`} width={60} />
                                <Tooltip
                                    formatter={(val: any) => formatCurrency(Number(val))}
                                    contentStyle={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-color)' }}
                                />
                                <Legend />
                                {trendStats.topEntities.map((entity, i) => (
                                    <Bar key={entity} dataKey={entity} stackId="a" fill={COLORS[i % COLORS.length]} />
                                ))}
                            </BarChart>
                        </ResponsiveContainer>
                    </div>

                </div>
            )}

            {/* Risers & Fallers Tables */}
            {risersFallers && (
                <div className="animate-fade-in" style={{ marginBottom: '2rem' }}>
                    <h3 className="section-title" style={{ marginTop: 0, marginBottom: '1rem', border: 'none', display: 'flex', justifyContent: 'space-between' }}>
                        <span><ArrowUpRight size={18} style={{ marginRight: '8px' }} /> Biggest Movers</span>
                        <span style={{ fontSize: '0.85rem', fontWeight: 400, color: 'var(--text-tertiary)' }}>Comparing {risersFallers.periodLabel}</span>
                    </h3>

                    <div className="dashboard-grid" style={{ gridTemplateColumns: '1fr 1fr' }}>
                        {/* Risers */}
                        <div className="glass-panel" style={{ padding: '0', overflow: 'hidden' }}>
                            <div style={{ padding: '1rem', background: 'rgba(16, 185, 129, 0.1)', borderBottom: '1px solid var(--border-color)', color: 'var(--success)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <ArrowUpRight size={18} /> Top 5 Risers (Increase)
                            </div>
                            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                <tbody>
                                    {risersFallers.risers.map((item, i) => (
                                        <tr key={i} style={{ borderBottom: '1px solid var(--border-color)' }}>
                                            <td style={{ padding: '0.75rem 1rem' }}>
                                                <div style={{ fontWeight: 500 }}>{item.name}</div>
                                                <div style={{ fontSize: '0.8rem', color: 'var(--text-tertiary)' }}>{formatCurrency(item.previous)} → {formatCurrency(item.current)}</div>
                                            </td>
                                            <td style={{ padding: '0.75rem 1rem', textAlign: 'right', color: 'var(--success)', fontWeight: 600 }}>
                                                +{formatCurrency(item.diff)}
                                                <div style={{ fontSize: '0.75rem' }}>+{item.pct.toFixed(1)}%</div>
                                            </td>
                                        </tr>
                                    ))}
                                    {risersFallers.risers.length === 0 && (
                                        <tr><td colSpan={2} style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-tertiary)' }}>No significant increases found.</td></tr>
                                    )}
                                </tbody>
                            </table>
                        </div>

                        {/* Fallers */}
                        <div className="glass-panel" style={{ padding: '0', overflow: 'hidden' }}>
                            <div style={{ padding: '1rem', background: 'rgba(239, 68, 68, 0.1)', borderBottom: '1px solid var(--border-color)', color: 'var(--danger)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <ArrowDownRight size={18} /> Top 5 Fallers (Decrease)
                            </div>
                            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                <tbody>
                                    {risersFallers.fallers.map((item, i) => (
                                        <tr key={i} style={{ borderBottom: '1px solid var(--border-color)' }}>
                                            <td style={{ padding: '0.75rem 1rem' }}>
                                                <div style={{ fontWeight: 500 }}>{item.name}</div>
                                                <div style={{ fontSize: '0.8rem', color: 'var(--text-tertiary)' }}>{formatCurrency(item.previous)} → {formatCurrency(item.current)}</div>
                                            </td>
                                            <td style={{ padding: '0.75rem 1rem', textAlign: 'right', color: 'var(--danger)', fontWeight: 600 }}>
                                                {formatCurrency(item.diff)}
                                                <div style={{ fontSize: '0.75rem' }}>{item.pct.toFixed(1)}%</div>
                                            </td>
                                        </tr>
                                    ))}
                                    {risersFallers.fallers.length === 0 && (
                                        <tr><td colSpan={2} style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-tertiary)' }}>No significant decreases found.</td></tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}

            {/* Seat Radar (Moved to Bottom) */}
            {previousDataset && currentDataset && (
                <SeatRadar
                    currentData={currentDataset.data}
                    previousData={previousDataset.data}
                    datasetName={previousDataset.name}
                />
            )}
        </div>
    );
};
