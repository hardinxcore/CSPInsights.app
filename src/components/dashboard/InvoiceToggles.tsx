import React from 'react';
import { Check } from 'lucide-react';

interface InvoiceTogglesProps {
    uniqueInvoices: string[];
    invoiceDates: Record<string, string>;
    activeInvoices: Set<string>;
    setActiveInvoices: React.Dispatch<React.SetStateAction<Set<string>>>;
}

export const InvoiceToggles: React.FC<InvoiceTogglesProps> = ({
    uniqueInvoices,
    invoiceDates,
    activeInvoices,
    setActiveInvoices,
}) => {
    if (uniqueInvoices.length === 0) return null;

    return (
        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem', flexWrap: 'wrap', alignItems: 'center' }}>
            <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-tertiary)', marginRight: '0.5rem' }}>
                Active Invoices:
            </span>
            {uniqueInvoices.map(inv => (
                <button
                    key={inv}
                    onClick={() => {
                        const newSet = new Set(activeInvoices);
                        if (newSet.has(inv)) newSet.delete(inv);
                        else newSet.add(inv);
                        setActiveInvoices(newSet);
                    }}
                    style={{
                        padding: '4px 10px',
                        borderRadius: '12px',
                        border: '1px solid',
                        fontSize: '0.8rem',
                        cursor: 'pointer',
                        background: activeInvoices.has(inv) ? 'var(--brand-turquoise)' : 'transparent',
                        color: activeInvoices.has(inv) ? 'white' : 'var(--text-secondary)',
                        borderColor: activeInvoices.has(inv) ? 'var(--brand-turquoise)' : 'var(--border-color)',
                        transition: 'all 0.2s',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px'
                    }}
                >
                    {inv}
                    {invoiceDates[inv] && <span style={{ opacity: 0.8, fontSize: '0.75em' }}>({invoiceDates[inv]})</span>}
                    {activeInvoices.has(inv) && <Check size={12} />}
                </button>
            ))}
            {activeInvoices.size < uniqueInvoices.length && (
                <button
                    onClick={() => setActiveInvoices(new Set(uniqueInvoices))}
                    style={{ fontSize: '0.8rem', color: 'var(--accent-primary)', textDecoration: 'underline', border: 'none', background: 'none', cursor: 'pointer' }}
                >
                    Select All
                </button>
            )}
            {activeInvoices.size > 0 && (
                <button
                    onClick={() => setActiveInvoices(new Set())}
                    style={{ fontSize: '0.8rem', color: 'var(--text-tertiary)', textDecoration: 'underline', border: 'none', background: 'none', cursor: 'pointer', marginLeft: '0.5rem' }}
                >
                    Deselect All
                </button>
            )}
        </div>
    );
};
