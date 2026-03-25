import React, { useEffect, useState } from 'react';
import { useSettingsStore } from '../store/settingsStore';
import { useBillingStore } from '../store/billingStore';
import { Save, Building, CreditCard, Percent, Trash2, AlertTriangle } from 'lucide-react';

export const SettingsPage: React.FC<{ onBack: () => void }> = ({ onBack }) => {
    const { companyDetails, defaultMargin, setCompanyDetails, setDefaultMargin, loadSettings } = useSettingsStore();

    // Local state for form to avoid excessive writes
    const [formState, setFormState] = useState(companyDetails);
    const [marginState, setMarginState] = useState(defaultMargin);
    const [saved, setSaved] = useState(false);

    useEffect(() => {
        loadSettings();
    }, []);

    useEffect(() => {
        setFormState(companyDetails);
        setMarginState(defaultMargin);
    }, [companyDetails, defaultMargin]);

    const handleSave = () => {
        setCompanyDetails(formState);
        setDefaultMargin(marginState);
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
    };

    const { reset } = useBillingStore();

    const handleClearData = async () => {
        if (window.confirm('Are you sure you want to clear ALL current billing data? This cannot be undone (unless you saved a snapshot).')) {
            await reset();
            onBack(); // Go back to dashboard (which will now show upload screen)
        }
    };

    return (
        <div className="container animate-fade-in" style={{ maxWidth: '800px', margin: '2rem auto' }}>
            <div className="flex-center" style={{ justifyContent: 'space-between', marginBottom: '2rem' }}>
                <h2 className="text-gradient">Settings</h2>
                <button onClick={onBack} className="secondary-btn">Back to Dashboard</button>
            </div>

            <div className="glass-panel" style={{ padding: '2rem' }}>
                <div style={{ marginBottom: '2rem' }}>
                    <h3 className="flex-center" style={{ gap: '0.5rem', marginBottom: '1rem', color: 'var(--brand-turquoise)' }}>
                        <Building size={20} /> Company Details
                    </h3>
                    <div style={{ display: 'grid', gap: '1rem' }}>
                        <div>
                            <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>Company Name</label>
                            <input
                                type="text"
                                className="filter-input"
                                value={formState.name}
                                onChange={e => setFormState({ ...formState, name: e.target.value })}
                                style={{ padding: '0.75rem' }}
                            />
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                            <div>
                                <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>Address Line 1</label>
                                <input
                                    type="text"
                                    className="filter-input"
                                    value={formState.addressLine1}
                                    onChange={e => setFormState({ ...formState, addressLine1: e.target.value })}
                                    style={{ padding: '0.75rem' }}
                                />
                            </div>
                            <div>
                                <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>Address Line 2 (City/Zip)</label>
                                <input
                                    type="text"
                                    className="filter-input"
                                    value={formState.addressLine2}
                                    onChange={e => setFormState({ ...formState, addressLine2: e.target.value })}
                                    style={{ padding: '0.75rem' }}
                                />
                            </div>
                        </div>
                    </div>
                </div>

                <div style={{ marginBottom: '2rem' }}>
                    <h3 className="flex-center" style={{ gap: '0.5rem', marginBottom: '1rem', color: 'var(--brand-turquoise)' }}>
                        <CreditCard size={20} /> Invoicing & Branding
                    </h3>
                    <div style={{ display: 'grid', gap: '1rem' }}>
                        <div>
                            <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>IBAN</label>
                            <input
                                type="text"
                                className="filter-input"
                                value={formState.iban}
                                onChange={e => setFormState({ ...formState, iban: e.target.value })}
                                style={{ padding: '0.75rem', fontFamily: 'monospace' }}
                            />
                        </div>
                        <div>
                            <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>Company Logo (Optional)</label>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                                {formState.logoUrl && (
                                    <img src={formState.logoUrl} alt="Logo Preview" style={{ height: '40px', border: '1px solid var(--border-color)', borderRadius: '4px' }} />
                                )}
                                <input
                                    type="file"
                                    accept="image/*"
                                    onChange={e => {
                                        const file = e.target.files?.[0];
                                        if (file) {
                                            const reader = new FileReader();
                                            reader.onloadend = () => {
                                                setFormState({ ...formState, logoUrl: reader.result as string });
                                            };
                                            reader.readAsDataURL(file);
                                        }
                                    }}
                                    style={{ fontSize: '0.9rem' }}
                                />
                                {formState.logoUrl && (
                                    <button
                                        onClick={() => setFormState({ ...formState, logoUrl: undefined })}
                                        className="secondary-btn"
                                        style={{ padding: '0.25rem 0.5rem', fontSize: '0.8rem' }}
                                    >
                                        Remove
                                    </button>
                                )}
                            </div>
                            <p style={{ fontSize: '0.8rem', color: 'var(--text-tertiary)', marginTop: '0.25rem' }}>
                                Upload a small PNG or JPG (max 500kb recommended).
                            </p>
                        </div>
                        <div>
                            <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>Invoice Footer Text</label>
                            <textarea
                                className="filter-input"
                                rows={3}
                                value={formState.invoiceFooter || ''}
                                onChange={e => setFormState({ ...formState, invoiceFooter: e.target.value })}
                                style={{ padding: '0.75rem', fontFamily: 'sans-serif' }}
                                placeholder="Thank you for your business!..."
                            />
                        </div>
                    </div>
                </div>

                <div style={{ marginBottom: '2rem' }}>
                    <h3 className="flex-center" style={{ gap: '0.5rem', marginBottom: '1rem', color: 'var(--brand-turquoise)' }}>
                        <Percent size={20} /> Defaults
                    </h3>
                    <div>
                        <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>Default Global Margin (%)</label>
                        <input
                            type="number"
                            className="filter-input"
                            value={marginState}
                            onChange={e => setMarginState(Number(e.target.value))}
                            style={{ padding: '0.75rem', width: '150px' }}
                        />
                        <p style={{ fontSize: '0.8rem', color: 'var(--text-tertiary)', marginTop: '0.5rem' }}>
                            This margin will be applied automatically when loading new files.
                        </p>
                    </div>
                </div>

                <div style={{ marginBottom: '2rem' }}>
                    <h3 className="flex-center" style={{ gap: '0.5rem', marginBottom: '1rem', color: 'var(--brand-turquoise)' }}>
                        <Save size={20} /> Backup & Restore
                    </h3>
                    <div className="flex-center" style={{ gap: '1rem', flexWrap: 'wrap' }}>
                        <div style={{ flex: 1, minWidth: '250px', padding: '1rem', border: '1px solid var(--border-color)', borderRadius: '8px' }}>
                            <h4 style={{ marginTop: 0 }}>Export Backup</h4>
                            <p style={{ fontSize: '0.8rem', color: 'var(--text-tertiary)' }}>
                                Save a complete copy of your current data and settings to a JSON file.
                            </p>
                            <button
                                onClick={async () => {
                                    const { createBackup } = await import('../utils/backup');
                                    const blob = await createBackup();
                                    const url = URL.createObjectURL(blob);
                                    const a = document.createElement('a');
                                    a.href = url;
                                    a.download = `backup_${new Date().toISOString().slice(0, 10)}.json`;
                                    a.click();
                                }}
                                className="secondary-btn"
                                style={{ width: '100%', marginTop: '0.5rem' }}
                            >
                                Download Backup
                            </button>
                        </div>
                        <div style={{ flex: 1, minWidth: '250px', padding: '1rem', border: '1px solid var(--border-color)', borderRadius: '8px' }}>
                            <h4 style={{ marginTop: 0 }}>Restore Backup</h4>
                            <p style={{ fontSize: '0.8rem', color: 'var(--text-tertiary)' }}>
                                Restore from a previously saved JSON file. <strong>Warning: Overwrites current data.</strong>
                            </p>
                            <input
                                type="file"
                                accept=".json"
                                onChange={async (e) => {
                                    if (e.target.files?.[0]) {
                                        if (confirm('Restoring will overwrite all current data. Continue?')) {
                                            try {
                                                const { restoreBackup } = await import('../utils/backup');
                                                const result = await restoreBackup(e.target.files[0]);
                                                alert(result);
                                                onBack();
                                            } catch (err) {
                                                alert('Restore failed. See console for details.');
                                                console.error(err);
                                            }
                                        }
                                        // Reset input
                                        e.target.value = '';
                                    }
                                }}
                                style={{ width: '100%', marginTop: '0.5rem', fontSize: '0.9rem' }}
                            />
                        </div>
                    </div>
                </div>

                <div style={{ marginBottom: '2rem' }}>
                    <h3 className="flex-center" style={{ gap: '0.5rem', marginBottom: '1rem', color: '#ef4444' }}>
                        <AlertTriangle size={20} /> Danger Zone
                    </h3>
                    <div style={{ padding: '1rem', border: '1px solid #fecaca', borderRadius: '8px', background: '#fef2f2' }}>
                        <p style={{ fontSize: '0.9rem', color: '#b91c1c', marginBottom: '1rem' }}>
                            Clearing data will remove all currently imported invoices and line items.
                            Metrics and charts will be reset. Saved snapshots are not affected.
                        </p>
                        <button
                            onClick={handleClearData}
                            className="primary-btn"
                            style={{ background: '#ef4444', border: 'none', padding: '0.5rem 1rem', fontSize: '0.9rem' }}
                        >
                            <Trash2 size={16} style={{ marginRight: '6px' }} /> Clear All Data
                        </button>
                    </div>
                </div>

                <div style={{ paddingTop: '2rem', borderTop: '1px solid var(--border-color)', display: 'flex', justifyContent: 'flex-end' }}>
                    <button
                        onClick={handleSave}
                        className="primary-btn"
                        style={{ padding: '0.75rem 2rem', gap: '0.5rem' }}
                    >
                        <Save size={18} /> {saved ? 'Saved!' : 'Save Settings'}
                    </button>
                </div>
            </div>
        </div>
    );
};
