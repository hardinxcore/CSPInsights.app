import React from 'react';
import { Percent, Download } from 'lucide-react';

interface BulkActionsBarProps {
    selectedCount: number;
    onBulkMarginUpdate: () => void;
    onBulkExport: () => void;
    onCancel: () => void;
}

export const BulkActionsBar: React.FC<BulkActionsBarProps> = ({
    selectedCount,
    onBulkMarginUpdate,
    onBulkExport,
    onCancel,
}) => {
    if (selectedCount === 0) return null;

    return (
        <div style={{
            position: 'fixed',
            bottom: '2rem',
            left: '50%',
            transform: 'translateX(-50%)',
            background: 'var(--bg-secondary)',
            padding: '1rem 2rem',
            borderRadius: '2rem',
            boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
            display: 'flex',
            gap: '1rem',
            alignItems: 'center',
            zIndex: 100,
            border: '1px solid var(--accent-primary)'
        }}>
            <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                {selectedCount} customers selected
            </div>
            <div style={{ height: '20px', width: '1px', background: 'var(--border-color)' }}></div>
            <div style={{ height: '20px', width: '1px', background: 'var(--border-color)' }}></div>
            <button
                onClick={onBulkMarginUpdate}
                className="primary-btn"
                style={{ fontSize: '0.9rem', padding: '0.5rem 1rem', background: 'var(--accent-secondary)' }}
                title="Update margin for selected customers"
            >
                <Percent size={16} style={{ marginRight: 6 }} /> Set Margin
            </button>
            <button
                onClick={onBulkExport}
                className="primary-btn"
                style={{ fontSize: '0.9rem', padding: '0.5rem 1rem' }}
            >
                <Download size={16} style={{ marginRight: 6 }} /> Export Selection
            </button>
            <button
                onClick={onCancel}
                className="secondary-btn"
                style={{ fontSize: '0.9rem', padding: '0.5rem' }}
            >
                Cancel
            </button>
        </div>
    );
};
