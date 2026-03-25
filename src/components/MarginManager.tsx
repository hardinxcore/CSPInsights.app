import { useState } from 'react';
import { useBillingStore } from '../store/billingStore';
import { X, Plus } from 'lucide-react';

export const MarginManager = ({ onClose }: { onClose: () => void }) => {
    const { marginRules, setCustomerMargin, globalMargin, setGlobalMargin, data } = useBillingStore();
    const [selectedCustomer, setSelectedCustomer] = useState('');
    const [newMargin, setNewMargin] = useState(0);

    const customers = Array.from(new Set(data.map(r => r.CustomerName))).sort();

    const handleAddRule = () => {
        if (selectedCustomer) {
            setCustomerMargin(selectedCustomer, newMargin);
            setSelectedCustomer('');
            setNewMargin(0);
        }
    };

    return (
        <div className="glass-panel animate-slide-down" style={{ position: 'absolute', top: 60, right: 20, zIndex: 50, padding: 0, overflow: 'hidden', boxShadow: '0 10px 25px rgba(0,0,0,0.2)' }}>
            <div style={{ background: 'var(--bg-secondary)', padding: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)' }}>
                <h3 style={{ margin: 0, fontSize: '1rem' }}>Margin Settings</h3>
                <button onClick={onClose}><X size={16} /></button>
            </div>

            <div style={{ padding: '1rem' }}>
                {/* Global */}
                <div style={{ marginBottom: '1.5rem' }}>
                    <label style={{ display: 'block', fontSize: '0.8rem', marginBottom: '0.5rem', color: 'var(--text-secondary)' }}>Global Margin (%)</label>
                    <input
                        type="number"
                        value={globalMargin}
                        onChange={(e) => setGlobalMargin(Number(e.target.value))}
                        className="input-field"
                        style={{ width: '100%' }}
                    />
                </div>

                {/* Customer Rules */}
                <h4 style={{ fontSize: '0.9rem', marginBottom: '0.75rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem' }}>Customer Overrides</h4>

                <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
                    <select
                        value={selectedCustomer}
                        onChange={(e) => setSelectedCustomer(e.target.value)}
                        className="input-field"
                        style={{ flex: 1 }}
                    >
                        <option value="">Select Customer...</option>
                        {customers.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                    <input
                        type="number"
                        value={newMargin}
                        onChange={(e) => setNewMargin(Number(e.target.value))}
                        className="input-field"
                        style={{ width: 70 }}
                        placeholder="%"
                    />
                    <button onClick={handleAddRule} disabled={!selectedCustomer} className="btn-primary" style={{ padding: '0.5rem' }}>
                        <Plus size={16} />
                    </button>
                </div>

                <div style={{ maxHeight: 200, overflowY: 'auto' }}>
                    {Object.entries(marginRules).map(([customer, margin]) => (
                        <div key={customer} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.5rem', borderBottom: '1px solid var(--border-color)', fontSize: '0.85rem' }}>
                            <span className="truncate" style={{ maxWidth: 180 }} title={customer}>{customer}</span>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <span style={{ fontWeight: 600, color: 'var(--success)' }}>{margin}%</span>
                                <button onClick={() => setCustomerMargin(customer, undefined as any)} style={{ color: 'var(--text-tertiary)' }} title="Remove Rule">
                                    <X size={14} />
                                </button>
                            </div>
                        </div>
                    ))}
                    {Object.keys(marginRules).length === 0 && (
                        <p style={{ color: 'var(--text-tertiary)', fontSize: '0.8rem', textAlign: 'center' }}>No customer specific rules.</p>
                    )}
                </div>
            </div>
        </div>
    );
};
