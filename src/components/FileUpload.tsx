import React, { useEffect } from 'react';
import { Files, Clock, RotateCcw } from 'lucide-react';
import { FileDropZone } from './FileDropZone';
import { useSnapshotStore } from '../store/snapshotStore';

interface FileUploadProps {
    onFileSelect: (files: File[]) => void;
}

export const FileUpload: React.FC<FileUploadProps> = ({ onFileSelect }) => {
    const { snapshots, loadSnapshots, restoreSnapshot, isLoading } = useSnapshotStore();

    useEffect(() => {
        loadSnapshots();
    }, []);

    const handleSelect = (files: File[]) => {
        const validFiles = files.filter(file => file.name.toLowerCase().endsWith('.csv') || file.name.toLowerCase().endsWith('.csv.gz'));
        if (validFiles.length > 0) {
            onFileSelect(validFiles);
        } else {
            alert('Please upload valid CSV or CSV.GZ files.');
        }
    };

    const handleRestore = async (id: string) => {
        const success = await restoreSnapshot(id);
        if (success) {
            // App.tsx detects data change and switches view automatically
        }
    };

    const recentSnapshots = snapshots.slice(0, 3);

    return (
        <div style={{ width: '100%', maxWidth: '600px', margin: '0 auto' }}>
            <FileDropZone
                title="Upload Reconciliation Files"
                description="Drag & drop your Partner Center CSVs here"
                onFileSelect={handleSelect}
                isLoading={false}
                accept=".csv, .gz"
                multiple={true}
                icon={<Files size={24} style={{ marginRight: '10px', color: 'var(--brand-turquoise)' }} />}
            />

            {/* Recent Snapshots Section */}
            {recentSnapshots.length > 0 && (
                <div className="animate-fade-in" style={{ marginTop: '2rem', paddingTop: '2rem', borderTop: '1px solid var(--border-color)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem', color: 'var(--text-secondary)', fontSize: '0.9rem', justifyContent: 'center' }}>
                        <Clock size={16} /> or restore a recent snapshot
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                        {recentSnapshots.map(snap => (
                            <button
                                key={snap.id}
                                onClick={() => handleRestore(snap.id)}
                                className="glass-panel hover-scale"
                                style={{
                                    padding: '1rem',
                                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                    cursor: 'pointer', border: '1px solid var(--border-color)',
                                    background: 'var(--bg-secondary)', textAlign: 'left', width: '100%'
                                }}
                            >
                                <div>
                                    <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{snap.name || 'Untitled Snapshot'}</div>
                                    <div style={{ fontSize: '0.8rem', color: 'var(--text-tertiary)', marginTop: '0.25rem' }}>
                                        {new Date(snap.updatedAt).toLocaleDateString()} • {snap.meta?.totalRows || 0} rows
                                    </div>
                                </div>
                                <div style={{ color: 'var(--brand-turquoise)', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.9rem', fontWeight: 500 }}>
                                    {isLoading ? 'Loading...' : <><RotateCcw size={16} /> Restore</>}
                                </div>
                            </button>
                        ))}
                    </div>
                </div>
            )}

            <div style={{ textAlign: 'center', marginTop: '2rem' }}>
                <a
                    href="https://partner.microsoft.com/dashboard/billing/reconciliation"
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ color: 'var(--brand-turquoise)', textDecoration: 'none', fontSize: '0.9rem' }}
                >
                    Need files? Go to Partner Center →
                </a>
            </div>
        </div>
    );
};
