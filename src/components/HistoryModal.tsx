import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { X, Save, Trash2, RotateCcw, Clock, Edit2, Check } from 'lucide-react';
import { useSnapshotStore } from '../store/snapshotStore'; // Billing Store
import { usePricingStore } from '../store/pricingStore'; // Pricing Store

interface HistoryModalProps {
    onClose: () => void;
    mode?: 'billing' | 'pricing';
}

export const HistoryModal: React.FC<HistoryModalProps> = ({ onClose, mode = 'billing' }) => {
    // Select the correct store based on mode
    const billingStore = useSnapshotStore();
    const pricingStore = usePricingStore();

    const { snapshots, loadSnapshots, saveCurrentAsSnapshot, restoreSnapshot, removeSnapshot, renameSnapshot, isLoading }
        = mode === 'billing' ? billingStore : pricingStore;

    const [newName, setNewName] = useState('');
    const [isSaving, setIsSaving] = useState(false);

    const [editingId, setEditingId] = useState<string | null>(null);
    const [editName, setEditName] = useState('');

    useEffect(() => {
        loadSnapshots();
    }, [mode]); // Reload if mode changes

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newName.trim()) return;
        setIsSaving(true);
        const success = await saveCurrentAsSnapshot(newName);
        setIsSaving(false);
        if (success) {
            setNewName('');
        } else {
            const err = mode === 'billing' ? billingStore.error : pricingStore.error;
            if (err) alert(err);
        }
    };

    const handleRestore = async (id: string) => {
        if (confirm('Carrying over this snapshot will overwrite your current view. Continue?')) {
            const success = await restoreSnapshot(id);
            if (success) onClose();
        }
    };

    const handleDelete = async (id: string) => {
        if (confirm('Are you sure you want to delete this snapshot?')) {
            await removeSnapshot(id);
        }
    };

    const startEditing = (id: string, currentName: string) => {
        setEditingId(id);
        setEditName(currentName || '');
    };

    const saveEdit = async () => {
        if (editingId && editName.trim()) {
            await renameSnapshot(editingId, editName);
            setEditingId(null);
        }
    };

    const formatDate = (ts: number) => {
        return new Date(ts).toLocaleDateString('nl-NL', {
            day: '2-digit', month: 'short', year: 'numeric',
            hour: '2-digit', minute: '2-digit'
        });
    };

    return createPortal(
        <div className="invoice-overlay" style={{ backdropFilter: 'blur(4px)' }}>
            <div className="glass-panel animate-fade-in" style={{
                width: '600px',
                maxWidth: '90vw',
                maxHeight: '80vh',
                display: 'flex',
                flexDirection: 'column',
                margin: 'auto',
                background: 'var(--bg-secondary)',
                position: 'relative'
            }}>
                {/* Header */}
                <div style={{ padding: '1.5rem', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <h2 style={{ fontSize: '1.25rem', margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <Clock size={20} className="text-gradient" /> {mode === 'billing' ? 'Billing History' : 'Price List Snapshots'}
                    </h2>
                    <button onClick={onClose} className="close-btn">
                        <X size={20} />
                    </button>
                </div>

                {/* Info Block */}
                <div style={{ padding: '1rem 1.5rem', background: 'rgba(0, 120, 212, 0.05)', borderBottom: '1px solid var(--border-color)', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: 'max-content 1fr', gap: '0.5rem 1rem', alignItems: 'baseline' }}>
                        <strong style={{ whiteSpace: 'nowrap' }}>❄️ Backup:</strong>
                        <span>"Freeze" your current {mode === 'billing' ? 'billing view' : 'pricing catalog'} to restore it later.</span>

                        <strong style={{ whiteSpace: 'nowrap' }}>⚖️ Compare:</strong>
                        <span>Save "{mode === 'billing' ? 'January Invoice' : 'January Pricelist'}" now to compare it later.</span>
                    </div>
                </div>

                {/* Save New Section */}
                <div style={{ padding: '1.5rem', background: 'var(--bg-tertiary)', borderBottom: '1px solid var(--border-color)' }}>
                    <form onSubmit={handleSave} style={{ display: 'flex', gap: '0.5rem' }}>
                        <input
                            type="text"
                            placeholder="Snapshot name (e.g. October 2023 Invoice Run)"
                            value={newName}
                            onChange={e => setNewName(e.target.value)}
                            style={{
                                flex: 1,
                                padding: '0.5rem 1rem',
                                borderRadius: 'var(--radius-md)',
                                border: '1px solid var(--border-color)',
                                fontSize: '0.9rem'
                            }}
                        />
                        <button
                            type="submit"
                            disabled={!newName.trim() || isSaving}
                            className="primary-btn"
                            style={{ borderRadius: 'var(--radius-md)', display: 'flex', alignItems: 'center', gap: '0.5rem', whiteSpace: 'nowrap' }}
                        >
                            <Save size={16} /> Save Current
                        </button>
                    </form>
                </div>

                {/* List */}
                <div style={{ flex: 1, overflowY: 'auto', padding: '1.5rem' }}>
                    {isLoading ? (
                        <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-tertiary)' }}>Loading...</div>
                    ) : snapshots.length === 0 ? (
                        <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-tertiary)' }}>
                            No saved snapshots found. Save your current work above to create a restore point.
                        </div>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                            {snapshots.map(snap => (
                                <div key={snap.id} style={{
                                    padding: '1rem',
                                    border: '1px solid var(--border-color)',
                                    borderRadius: 'var(--radius-md)',
                                    background: 'var(--bg-secondary)',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'space-between',
                                    transition: 'all 0.2s',
                                    boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
                                }}>
                                    {editingId === snap.id ? (
                                        <div style={{ flex: 1, display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                                            <input
                                                autoFocus
                                                value={editName}
                                                onChange={e => setEditName(e.target.value)}
                                                style={{
                                                    padding: '0.25rem 0.5rem',
                                                    borderRadius: '4px',
                                                    border: '1px solid var(--accent-primary)',
                                                    outline: 'none',
                                                    fontSize: '1rem',
                                                    width: '100%'
                                                }}
                                                onKeyDown={e => {
                                                    if (e.key === 'Enter') saveEdit();
                                                    if (e.key === 'Escape') setEditingId(null);
                                                }}
                                            />
                                            <button onClick={saveEdit} style={{ color: 'var(--success)', padding: 4 }}><Check size={18} /></button>
                                            <button onClick={() => setEditingId(null)} style={{ color: 'var(--danger)', padding: 4 }}><X size={18} /></button>
                                        </div>
                                    ) : (
                                        <div>
                                            <div style={{ fontWeight: 600, fontSize: '1rem', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                                {snap.name || 'Untitled Snapshot'}
                                                <button
                                                    onClick={() => startEditing(snap.id, snap.name || '')}
                                                    style={{ opacity: 0.3, cursor: 'pointer', border: 'none', background: 'none' }}
                                                    title="Rename"
                                                >
                                                    <Edit2 size={14} color="var(--text-primary)" />
                                                </button>
                                            </div>
                                            <div style={{ fontSize: '0.8rem', color: 'var(--text-tertiary)', marginTop: '0.25rem' }}>
                                                {formatDate(snap.updatedAt)} • {snap.meta?.totalRows || 0} rows {snap.meta?.totalAmount ? `• ${new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR' }).format(snap.meta.totalAmount)}` : ''}
                                            </div>
                                        </div>
                                    )}
                                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                                        <button
                                            onClick={() => handleRestore(snap.id)}
                                            title="Restore this version"
                                            style={{
                                                padding: '0.5rem',
                                                borderRadius: 'var(--radius-sm)',
                                                color: 'var(--brand-turquoise)',
                                                border: '1px solid currentColor',
                                                display: 'flex', alignItems: 'center', gap: '0.25rem'
                                            }}
                                        >
                                            <RotateCcw size={16} /> Load
                                        </button>
                                        <button
                                            onClick={() => handleDelete(snap.id)}
                                            title="Delete permanently"
                                            style={{
                                                padding: '0.5rem',
                                                borderRadius: 'var(--radius-sm)',
                                                color: 'var(--brand-light-grey)',
                                                border: '1px solid var(--border-color)'
                                            }}
                                        >
                                            <Trash2 size={16} />
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>,
        document.body
    );
};
