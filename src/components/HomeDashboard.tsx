import React, { useEffect, useState } from 'react';
import { BarChart3, Tag, ArrowRight, Clock, RotateCcw } from 'lucide-react';
import { useBillingStore } from '../store/billingStore';
import { useSnapshotStore } from '../store/snapshotStore';
import { usePricingStore } from '../store/pricingStore';

interface HomeDashboardProps {
    onNavigate: (view: 'billing' | 'pricing') => void;
}

export const HomeDashboard: React.FC<HomeDashboardProps> = ({ onNavigate }) => {
    // Stores
    const { meta: billingMeta, data: billingData } = useBillingStore();
    const { snapshots: billingSnapshots, loadSnapshots: loadBillingSnapshots, restoreSnapshot: restoreBillingSnapshot } = useSnapshotStore();
    const { snapshots: pricingSnapshots, loadSnapshots: loadPricingSnapshots, restoreSnapshot: restorePricingSnapshot } = usePricingStore();

    const [isRestoring, setIsRestoring] = useState(false);

    useEffect(() => {
        loadBillingSnapshots();
        loadPricingSnapshots();
    }, []);

    // Combine and sort snapshots
    const recentActivity = [
        ...billingSnapshots.map(s => ({ ...s, type: 'billing' as const })),
        ...pricingSnapshots.map(s => ({ ...s, type: 'pricing' as const }))
    ].sort((a, b) => b.updatedAt - a.updatedAt).slice(0, 3);

    const hasActiveSession = billingData && billingData.length > 0;

    const handleRestore = async (snap: typeof recentActivity[0]) => {
        if (confirm(`Restore "${snap.name || 'Untitled'}"? This will overwrite active data.`)) {
            setIsRestoring(true);
            if (snap.type === 'billing') {
                await restoreBillingSnapshot(snap.id);
                onNavigate('billing');
            } else {
                await restorePricingSnapshot(snap.id);
                onNavigate('pricing');
            }
            setIsRestoring(false);
        }
    };

    return (
        <div className="container animate-fade-in">
            <div style={{ textAlign: 'center', marginBottom: hasActiveSession ? '2rem' : '4rem', marginTop: '2rem' }}>
                <h1 style={{ fontSize: '2.5rem', fontWeight: 800, marginBottom: '1rem' }} className="text-gradient">
                    CSP Insights
                </h1>
                <p style={{ fontSize: '1.2rem', color: 'var(--text-secondary)', maxWidth: '600px', margin: '0 auto' }}>
                    Simplify your Microsoft CSP operations. Analyze billing data or manage your pricing catalog with ease.
                </p>
            </div>

            {/* Main Cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '2rem', maxWidth: '900px', margin: '0 auto' }}>
                {/* Billing Card */}
                <div
                    className="glass-panel"
                    onClick={() => onNavigate('billing')}
                    style={{
                        padding: '2rem',
                        cursor: 'pointer',
                        transition: 'transform 0.2s ease, box-shadow 0.2s ease',
                        display: 'flex', flexDirection: 'column', gap: '1rem',
                        border: '1px solid var(--border-color)',
                        position: 'relative', overflow: 'hidden'
                    }}
                    onMouseEnter={e => {
                        e.currentTarget.style.transform = 'translateY(-5px)';
                        e.currentTarget.style.boxShadow = '0 10px 30px rgba(0,0,0,0.1)';
                    }}
                    onMouseLeave={e => {
                        e.currentTarget.style.transform = 'none';
                        e.currentTarget.style.boxShadow = 'none';
                    }}
                >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <div style={{
                            width: '50px', height: '50px', borderRadius: '12px',
                            background: 'rgba(0, 181, 226, 0.1)', color: 'var(--brand-turquoise)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center'
                        }}>
                            <BarChart3 size={24} />
                        </div>
                        {hasActiveSession && (
                            <span style={{ fontSize: '0.75rem', padding: '0.25rem 0.5rem', borderRadius: '1rem', background: 'rgba(16, 185, 129, 0.1)', color: 'var(--success)', fontWeight: 600 }}>
                                Active Session
                            </span>
                        )}
                    </div>

                    <div>
                        <h2 style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>Billing Analysis</h2>
                        <p style={{ color: 'var(--text-tertiary)', lineHeight: '1.5', fontSize: '0.95rem' }}>
                            Upload reconciliation files to analyze costs, margins, and discrepancies.
                        </p>
                    </div>

                    {/* Mini Stats for Active Session */}
                    {hasActiveSession && billingMeta && (
                        <div style={{ marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid var(--border-color)', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                            <div>
                                <div style={{ fontSize: '0.8rem', color: 'var(--text-tertiary)' }}>Revenue</div>
                                <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                                    {new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(billingMeta.totalAmount)}
                                </div>
                            </div>
                            <div>
                                <div style={{ fontSize: '0.8rem', color: 'var(--text-tertiary)' }}>Customers</div>
                                <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{billingMeta.customersCount}</div>
                            </div>
                        </div>
                    )}

                    <div style={{ marginTop: 'auto', paddingTop: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--brand-turquoise)', fontWeight: 600 }}>
                        {hasActiveSession ? 'Continue Analysis' : 'Start Analysis'} <ArrowRight size={18} />
                    </div>
                </div>

                {/* Pricing Card */}
                <div
                    className="glass-panel"
                    onClick={() => onNavigate('pricing')}
                    style={{
                        padding: '2rem',
                        cursor: 'pointer',
                        transition: 'transform 0.2s ease, box-shadow 0.2s ease',
                        display: 'flex', flexDirection: 'column', gap: '1rem',
                        border: '1px solid var(--border-color)'
                    }}
                    onMouseEnter={e => {
                        e.currentTarget.style.transform = 'translateY(-5px)';
                        e.currentTarget.style.boxShadow = '0 10px 30px rgba(0,0,0,0.1)';
                    }}
                    onMouseLeave={e => {
                        e.currentTarget.style.transform = 'none';
                        e.currentTarget.style.boxShadow = 'none';
                    }}
                >
                    <div style={{
                        width: '50px', height: '50px', borderRadius: '12px',
                        background: 'rgba(254, 80, 0, 0.1)', color: 'var(--brand-orange)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center'
                    }}>
                        <Tag size={24} />
                    </div>
                    <div>
                        <h2 style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>Pricing Catalog</h2>
                        <p style={{ color: 'var(--text-tertiary)', lineHeight: '1.5', fontSize: '0.95rem' }}>
                            Browse CSP prices, calculate margins, and create PDF quotes.
                        </p>
                    </div>
                    <div style={{ marginTop: 'auto', paddingTop: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--brand-orange)', fontWeight: 600 }}>
                        Open Catalog <ArrowRight size={18} />
                    </div>
                </div>
            </div>

            {/* Recent Activity Widget */}
            {recentActivity.length > 0 && (
                <div style={{ maxWidth: '900px', margin: '3rem auto 0' }}>
                    <h3 style={{ fontSize: '1.1rem', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-secondary)' }}>
                        <Clock size={18} /> Recent Snapshots
                    </h3>
                    <div className="glass-panel" style={{ border: '1px solid var(--border-color)', padding: '0.5rem' }}>
                        {recentActivity.map(snap => (
                            <div key={`${snap.type}-${snap.id}`} style={{
                                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                padding: '1rem',
                                borderBottom: '1px solid var(--border-color)',
                                transition: 'background 0.2s'
                            }}
                                onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-tertiary)'}
                                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                            >
                                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                                    <div style={{
                                        padding: '0.25rem 0.5rem', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 600,
                                        background: snap.type === 'billing' ? 'rgba(0, 181, 226, 0.1)' : 'rgba(254, 80, 0, 0.1)',
                                        color: snap.type === 'billing' ? 'var(--brand-turquoise)' : 'var(--brand-orange)',
                                        textTransform: 'uppercase'
                                    }}>
                                        {snap.type}
                                    </div>
                                    <div>
                                        <div style={{ fontWeight: 500, color: 'var(--text-primary)' }}>{snap.name || 'Untitled Snapshot'}</div>
                                        <div style={{ fontSize: '0.8rem', color: 'var(--text-tertiary)' }}>
                                            {new Date(snap.updatedAt).toLocaleDateString('nl-NL', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                                            {' • '}
                                            {snap.meta?.totalRows || 0} items
                                        </div>
                                    </div>
                                </div>
                                <button
                                    onClick={(e) => { e.stopPropagation(); handleRestore(snap); }}
                                    disabled={isRestoring}
                                    style={{
                                        display: 'flex', alignItems: 'center', gap: '0.5rem',
                                        background: 'none', border: '1px solid var(--border-color)',
                                        padding: '0.5rem 1rem', borderRadius: '2rem',
                                        fontSize: '0.85rem', cursor: 'pointer',
                                        color: 'var(--text-secondary)'
                                    }}
                                    className="hover-btn"
                                >
                                    <RotateCcw size={14} /> Restore
                                </button>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};
