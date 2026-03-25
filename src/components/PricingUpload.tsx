import React from 'react';
import { Upload, Download, FileSpreadsheet } from 'lucide-react';
import { usePricingStore } from '../store/pricingStore';
import { FileDropZone } from './FileDropZone';

export const PricingUpload: React.FC = () => {
    const { importPricing, isLoading, error, snapshots, loadSnapshots, restoreSnapshot } = usePricingStore();

    React.useEffect(() => {
        loadSnapshots();
    }, []);

    const handleFileSelect = async (files: File[]) => {
        if (files.length > 0) {
            try {
                // Pricing store currently only handles one file at a time
                await importPricing(files[0]);
            } catch (e) {
                // Error handled in store
            }
        }
    };

    return (
        <div style={{ width: '100%', maxWidth: '600px', margin: '0 auto' }}>
            <FileDropZone
                title="Upload Pricing Catalog"
                description="Drag & drop your Pricing CSV here"
                onFileSelect={handleFileSelect}
                isLoading={isLoading}
                loadingText="Processing Price List..."
                accept=".csv"
                icon={<Upload size={24} style={{ marginRight: '10px', color: 'var(--brand-turquoise)' }} />}
            />

            {error && (
                <div style={{ marginTop: '1rem', padding: '1rem', background: 'rgba(239, 68, 68, 0.1)', color: 'var(--danger)', borderRadius: '8px', textAlign: 'center' }}>
                    {error}
                </div>
            )}

            <div style={{ marginTop: '2rem', paddingTop: '2rem', borderTop: '1px solid var(--border-color)', textAlign: 'center' }}>
                <p style={{ color: 'var(--text-tertiary)', fontSize: '0.9rem', marginBottom: '1rem' }}>
                    Don't have the file? Download "License-based services" from Microsoft.
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', alignItems: 'center' }}>
                    <a
                        href="https://partner.microsoft.com/dashboard/v2/pricing/pricelist"
                        target="_blank"
                        rel="noreferrer"
                        className="action-btn secondary"
                        style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}
                    >
                        <Download size={16} /> Download from Partner Center
                    </a>

                    <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
                        <a
                            href="https://1drv.ms/x/c/8ca7131ed45ed6c2/IQA-bl4RbGRDQ7S7B4trL_ONAUDjcyTh-qbFasvFUMaQ8p4?download=1"
                            target="_blank"
                            rel="noreferrer"
                            style={{ fontSize: '0.85rem', color: 'var(--brand-turquoise)', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '0.25rem' }}
                        >
                            <FileSpreadsheet size={14} /> Example Jan 2026
                        </a>
                        <span style={{ color: 'var(--border-color)' }}>|</span>
                        <a
                            href="https://1drv.ms/x/c/8ca7131ed45ed6c2/IQDNJhIkaP3xRaHYFApo_mj-AezRxtFpJVepQXUh06GE_gY?download=1"
                            target="_blank"
                            rel="noreferrer"
                            style={{ fontSize: '0.85rem', color: 'var(--brand-turquoise)', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '0.25rem' }}
                        >
                            <FileSpreadsheet size={14} /> Example Feb 2026
                        </a>
                    </div>
                </div>
            </div>

            {/* Snapshot Selector Section */}
            <div style={{ marginTop: '2rem', paddingTop: '2rem', borderTop: '1px solid var(--border-color)', textAlign: 'center' }}>
                <h4 style={{ color: 'var(--text-secondary)', marginBottom: '1rem' }}>Or load from History</h4>

                {snapshots.length === 0 ? (
                    <p style={{ color: 'var(--text-tertiary)', fontSize: '0.9rem' }}>No saved snapshots found.</p>
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', maxWidth: '400px', margin: '0 auto' }}>
                        {snapshots.map(snap => (
                            <button
                                key={snap.id}
                                onClick={() => restoreSnapshot(snap.id)}
                                className="glass-panel hover-row"
                                style={{
                                    padding: '1rem',
                                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                    cursor: 'pointer',
                                    border: '1px solid var(--border-color)',
                                    background: 'var(--bg-primary)'
                                }}
                            >
                                <div style={{ textAlign: 'left' }}>
                                    <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{snap.name || 'Untitled Snapshot'}</div>
                                    <div style={{ fontSize: '0.8rem', color: 'var(--text-tertiary)' }}>
                                        {new Date(snap.updatedAt).toLocaleDateString()} • {new Date(snap.updatedAt).toLocaleTimeString()}
                                    </div>
                                </div>
                                <div style={{ color: 'var(--brand-turquoise)', fontSize: '0.9rem', fontWeight: 500 }}>
                                    Load
                                </div>
                            </button>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};
