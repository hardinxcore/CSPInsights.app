import React from 'react';
import { createPortal } from 'react-dom';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import { X, Download, ShoppingCart, FileSpreadsheet, FolderOpen, Save, Trash2 } from 'lucide-react';
import { useCartStore } from '../store/cartStore';
import { usePricingStore } from '../store/pricingStore';
import { useSettingsStore } from '../store/settingsStore';
import type { PriceRow } from '../types/PricingData';

interface CartModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export const CartModal: React.FC<CartModalProps> = ({ isOpen, onClose }) => {
    const { companyDetails } = useSettingsStore();
    const { quantities, updateQuantity, customerReference, setCustomerReference, savedQuotes, saveQuote, loadQuote, deleteQuote } = useCartStore();
    const { rows } = usePricingStore();

    const [view, setView] = React.useState<'cart' | 'saved'>('cart');
    const [newQuoteName, setNewQuoteName] = React.useState('');

    // derived state
    const cartItems = React.useMemo(() => {
        if (!isOpen) return [];

        const items: { row: PriceRow; qty: number; rowId: string }[] = [];
        const rowMap = new Map(rows.map(r => [`${r.ProductId}-${r.SkuId}-${r.TermDuration}-${r.BillingPlan}-${r.Currency}`, r]));

        Object.entries(quantities).forEach(([id, qty]) => {
            const row = rowMap.get(id);
            if (row && qty > 0) {
                items.push({ row, qty, rowId: id });
            } else if (qty > 0) {
                console.warn('CartModal: Row mismatch for ID:', id);
            }
        });
        return items;
    }, [quantities, rows, isOpen]);

    const total = cartItems.reduce((sum, item) => sum + (item.qty * item.row.ERPPrice), 0);

    const formatCurrency = (val: number, curr: string) => {
        try {
            return new Intl.NumberFormat('nl-NL', { style: 'currency', currency: curr || 'EUR' }).format(val);
        } catch {
            return `${val} ${curr}`;
        }
    };

    const handleExportPDF = async () => {
        const doc = new jsPDF();

        // --- Branding Colors ---
        const brandOrange = '#FE5000';
        const brandTurquoise = '#00B5E2';
        const brandGrey = '#5B6770';

        // --- Logo Handling ---
        let logoHeight = 0;
        if (companyDetails.logoUrl) {
            try {
                const img = new Image();
                img.src = companyDetails.logoUrl;
                await new Promise((resolve, reject) => {
                    img.onload = resolve;
                    img.onerror = reject;
                });

                const ratio = img.height / img.width;
                const width = 40;
                const height = width * ratio;
                doc.addImage(img, 'PNG', 14, 10, width, height);
                logoHeight = height + 5;
            } catch (err) {
                console.warn('Failed to load logo for PDF', err);
            }
        }

        // --- Header Info ---
        const startY = Math.max(logoHeight + 20, 40);

        doc.setFontSize(10);
        doc.setTextColor(brandGrey);
        doc.text(companyDetails.name, 195, 15, { align: 'right' });
        doc.text(companyDetails.addressLine1, 195, 20, { align: 'right' });
        doc.text(companyDetails.addressLine2, 195, 25, { align: 'right' });
        if (companyDetails.iban) {
            doc.setTextColor(brandTurquoise);
            doc.text(`IBAN: ${companyDetails.iban}`, 195, 30, { align: 'right' });
        }

        // Customer Reference
        if (customerReference) {
            doc.setFontSize(10);
            doc.setTextColor(brandGrey);
            doc.text(`Ref: ${customerReference}`, 195, 35, { align: 'right' });
        }

        // Title
        doc.setFontSize(18);
        doc.setTextColor(brandOrange);
        doc.text('Quote / Offerte', 14, startY);

        doc.setFontSize(10);
        doc.setTextColor(brandGrey);
        doc.text(`Date: ${new Date().toLocaleDateString()}`, 14, startY + 8);

        // --- Table ---
        const tableData = cartItems.map(item => [
            item.row.ProductTitle,
            item.row.SkuTitle,
            item.row.TermDuration,
            item.qty.toString(),
            formatCurrency(item.row.ERPPrice, item.row.Currency),
            formatCurrency(item.qty * item.row.ERPPrice, item.row.Currency)
        ]);

        autoTable(doc, {
            head: [['Product', 'SKU', 'Term', 'Qty', 'Unit Price (ERP)', 'Total']],
            body: tableData,
            startY: startY + 15,
            theme: 'grid',
            headStyles: {
                fillColor: brandTurquoise,
                fontStyle: 'bold'
            },
            styles: { fontSize: 8, cellPadding: 3 },
            columnStyles: {
                0: { cellWidth: 50 },
                1: { cellWidth: 50 },
                5: { halign: 'right', fontStyle: 'bold' },
                4: { halign: 'right' }
            }
        });

        const finalY = (doc as any).lastAutoTable.finalY + 10;

        // --- Totals ---
        const subtotal = total;
        const vat = subtotal * 0.21;
        const grandTotal = subtotal + vat;

        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(brandGrey);

        // Subtotal
        doc.text(`Subtotal:`, 160, finalY, { align: 'right' });
        doc.text(`${formatCurrency(subtotal, 'EUR')}`, 195, finalY, { align: 'right' });

        // VAT
        doc.text(`VAT (21%):`, 160, finalY + 5, { align: 'right' });
        doc.text(`${formatCurrency(vat, 'EUR')}`, 195, finalY + 5, { align: 'right' });

        // Grand Total
        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(brandOrange);
        doc.text(`Total:`, 160, finalY + 12, { align: 'right' });
        doc.text(`${formatCurrency(grandTotal, 'EUR')}`, 195, finalY + 12, { align: 'right' });

        // Footer
        if (companyDetails.invoiceFooter) {
            doc.setFontSize(8);
            doc.setFont('helvetica', 'normal');
            doc.setTextColor(brandGrey);
            doc.text(companyDetails.invoiceFooter, 105, 280, { align: 'center' });
        }

        doc.save('quote_export.pdf');
    };

    const handleExportExcel = () => {
        const data = cartItems.map(item => ({
            'Product': item.row.ProductTitle,
            'SKU': item.row.SkuTitle,
            'SKU ID': item.row.SkuId,
            'Term': item.row.TermDuration,
            'Billing Plan': item.row.BillingPlan,
            'Quantity': item.qty,
            'Unit Price (ERP)': item.row.ERPPrice,
            'Total': item.qty * item.row.ERPPrice,
            'Currency': item.row.Currency
        }));

        const ws = XLSX.utils.json_to_sheet(data);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Cart");
        XLSX.writeFile(wb, "quote_export.xlsx");
    };

    const handleSaveQuote = () => {
        if (!newQuoteName.trim()) return;
        saveQuote(newQuoteName, total);
        setNewQuoteName('');
        alert('Quote Saved!');
    };

    const handleLoadQuote = (id: string) => {
        if (confirm('Loading a quote will replace your current cart. Continue?')) {
            loadQuote(id);
            setView('cart');
        }
    };

    if (!isOpen) return null;

    return createPortal(
        <div style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            background: 'rgba(0,0,0,0.5)', zIndex: 1000,
            display: 'flex', alignItems: 'center', justifyContent: 'center'
        }}>
            <div className="glass-panel" style={{
                width: '800px', maxWidth: '95vw', maxHeight: '90vh',
                background: 'var(--bg-secondary)',
                display: 'flex', flexDirection: 'column',
                boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)'
            }}>
                <div style={{ padding: '1.5rem', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <h2 style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', fontSize: '1.25rem' }}>
                        {view === 'cart' ? <ShoppingCart className="text-gradient" /> : <FolderOpen className="text-gradient" />}
                        {view === 'cart' ? 'Shopping Cart' : 'Saved Quotes'}
                    </h2>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <button
                            onClick={() => setView(view === 'cart' ? 'saved' : 'cart')}
                            style={{
                                padding: '0.5rem 1rem',
                                background: view === 'saved' ? 'var(--brand-turquoise)' : 'transparent',
                                color: view === 'saved' ? 'white' : 'var(--text-primary)',
                                border: '1px solid var(--border-color)',
                                borderRadius: 'var(--radius-md)',
                                cursor: 'pointer',
                                display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem'
                            }}
                        >
                            <FolderOpen size={16} />
                            {view === 'cart' ? 'Open Saved' : 'Back to Cart'}
                        </button>
                        <button onClick={onClose} style={{ cursor: 'pointer', padding: '0.5rem' }}>
                            <X size={24} color="var(--text-tertiary)" />
                        </button>
                    </div>
                </div>

                {/* Customer Reference Input */}
                {cartItems.length > 0 && (
                    <div style={{ padding: '0 1.5rem', marginTop: '1rem', display: 'flex', justifyContent: 'flex-end' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <label style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>Reference:</label>
                            <input
                                type="text"
                                placeholder="Project Name / Client Ref..."
                                value={customerReference}
                                onChange={(e) => setCustomerReference(e.target.value)}
                                className="input-field"
                                style={{ width: '250px', padding: '0.5rem' }}
                            />
                        </div>
                    </div>
                )}

                <div style={{ flex: 1, overflowY: 'auto', padding: '1.5rem' }}>
                    {view === 'saved' ? (
                        /* SAVED QUOTES LIST */
                        savedQuotes.length === 0 ? (
                            <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-tertiary)' }}>
                                No saved quotes found.
                            </div>
                        ) : (
                            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
                                <thead>
                                    <tr style={{ borderBottom: '2px solid var(--border-color)', textAlign: 'left' }}>
                                        <th style={{ padding: '0.75rem' }}>Name</th>
                                        <th style={{ padding: '0.75rem' }}>Date</th>
                                        <th style={{ padding: '0.75rem' }}>Reference</th>
                                        <th style={{ padding: '0.75rem', textAlign: 'right' }}>Items</th>
                                        <th style={{ padding: '0.75rem', textAlign: 'right' }}>Total</th>
                                        <th style={{ padding: '0.75rem', textAlign: 'right' }}>Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {savedQuotes.map((quote) => (
                                        <tr key={quote.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                                            <td style={{ padding: '0.75rem', fontWeight: 600 }}>{quote.name}</td>
                                            <td style={{ padding: '0.75rem', color: 'var(--text-tertiary)' }}>{new Date(quote.date).toLocaleDateString()}</td>
                                            <td style={{ padding: '0.75rem', color: 'var(--text-tertiary)' }}>{quote.customerReference || '-'}</td>
                                            <td style={{ padding: '0.75rem', textAlign: 'right' }}>{quote.itemCount}</td>
                                            <td style={{ padding: '0.75rem', textAlign: 'right' }}>{formatCurrency(quote.totalAmount, 'EUR')}</td>
                                            <td style={{ padding: '0.75rem', textAlign: 'right', display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
                                                <button
                                                    onClick={() => handleLoadQuote(quote.id)}
                                                    style={{ padding: '0.25rem 0.5rem', cursor: 'pointer', background: 'var(--brand-turquoise)', color: 'white', border: 'none', borderRadius: '4px' }}
                                                    title="Load Quote"
                                                >
                                                    Load
                                                </button>
                                                <button
                                                    onClick={() => deleteQuote(quote.id)}
                                                    style={{ padding: '0.25rem', cursor: 'pointer', background: 'transparent', color: 'var(--error-color)', border: 'none' }}
                                                    title="Delete Quote"
                                                >
                                                    <Trash2 size={16} />
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        )
                    ) : (
                        /* CART LIST */
                        cartItems.length === 0 ? (
                            <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-tertiary)' }}>
                                Your cart is empty.
                            </div>
                        ) : (
                            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
                                <thead>
                                    <tr style={{ borderBottom: '2px solid var(--border-color)', textAlign: 'left' }}>
                                        <th style={{ padding: '0.75rem' }}>Product</th>
                                        <th style={{ padding: '0.75rem' }}>SKU</th>
                                        <th style={{ padding: '0.75rem' }}>Term</th>
                                        <th style={{ padding: '0.75rem', textAlign: 'right' }}>Qty</th>
                                        <th style={{ padding: '0.75rem', textAlign: 'right' }}>Price (ERP)</th>
                                        <th style={{ padding: '0.75rem', textAlign: 'right' }}>Total</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {cartItems.map((item, idx) => (
                                        <tr key={idx} style={{ borderBottom: '1px solid var(--border-color)' }}>
                                            <td style={{ padding: '0.75rem' }}>{item.row.ProductTitle}</td>
                                            <td style={{ padding: '0.75rem', color: 'var(--text-tertiary)' }}>{item.row.SkuTitle}</td>
                                            <td style={{ padding: '0.75rem' }}>{item.row.TermDuration}</td>
                                            <td style={{ padding: '0.75rem', textAlign: 'right' }}>
                                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '0.5rem' }}>
                                                    <div style={{ display: 'flex', alignItems: 'center', border: '1px solid var(--border-color)', borderRadius: '4px' }}>
                                                        <button
                                                            onClick={() => updateQuantity(item.rowId, item.qty - 1)}
                                                            className="hover-bg"
                                                            style={{ padding: '0.25rem 0.5rem', background: 'transparent', border: 'none', cursor: 'pointer', borderRight: '1px solid var(--border-color)' }}
                                                        >
                                                            -
                                                        </button>
                                                        <span style={{ width: '30px', textAlign: 'center', fontSize: '0.9rem', fontWeight: 600 }}>{item.qty}</span>
                                                        <button
                                                            onClick={() => updateQuantity(item.rowId, item.qty + 1)}
                                                            className="hover-bg"
                                                            style={{ padding: '0.25rem 0.5rem', background: 'transparent', border: 'none', cursor: 'pointer', borderLeft: '1px solid var(--border-color)' }}
                                                        >
                                                            +
                                                        </button>
                                                    </div>
                                                    <button
                                                        onClick={() => updateQuantity(item.rowId, 0)}
                                                        className="icon-btn hover-bg-red"
                                                        style={{ color: 'var(--text-tertiary)', padding: '0.4rem' }}
                                                        title="Remove item"
                                                    >
                                                        <Trash2 size={16} />
                                                    </button>
                                                </div>
                                            </td>
                                            <td style={{ padding: '0.75rem', textAlign: 'right' }}>
                                                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
                                                    <span style={{ fontWeight: 500 }}>{formatCurrency(item.row.ERPPrice, item.row.Currency)}</span>
                                                    {item.row.TermDuration === 'P1Y' && (
                                                        <span style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>
                                                            ({formatCurrency(item.row.ERPPrice / 12, item.row.Currency)}/mo)
                                                        </span>
                                                    )}
                                                    {item.row.TermDuration === 'P3Y' && (
                                                        <span style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>
                                                            ({formatCurrency(item.row.ERPPrice / 36, item.row.Currency)}/mo)
                                                        </span>
                                                    )}
                                                </div>
                                            </td>
                                            <td style={{ padding: '0.75rem', textAlign: 'right', fontWeight: 600 }}>
                                                {formatCurrency(item.qty * item.row.ERPPrice, item.row.Currency)}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        )
                    )}
                </div>

                <div style={{
                    padding: '1.5rem', borderTop: '1px solid var(--border-color)',
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    background: 'var(--brand-bg-grey)'
                }}>
                    {view === 'cart' ? (
                        /* CART FOOTER */
                        <>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                                <div style={{ fontSize: '1.25rem', fontWeight: 700 }}>
                                    Total: {formatCurrency(total, 'EUR')}
                                </div>
                                {/* Save Quote Inline */}
                                {cartItems.length > 0 && (
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', borderLeft: '1px solid var(--border-color)', paddingLeft: '1rem' }}>
                                        <input
                                            type="text"
                                            placeholder="Save as Quote Name..."
                                            value={newQuoteName}
                                            onChange={(e) => setNewQuoteName(e.target.value)}
                                            style={{ padding: '0.5rem', borderRadius: '4px', border: '1px solid var(--border-color)' }}
                                        />
                                        <button
                                            onClick={handleSaveQuote}
                                            disabled={!newQuoteName.trim()}
                                            style={{
                                                padding: '0.5rem',
                                                background: newQuoteName.trim() ? 'var(--text-secondary)' : 'var(--bg-secondary)',
                                                color: 'white',
                                                border: 'none',
                                                borderRadius: '4px',
                                                cursor: newQuoteName.trim() ? 'pointer' : 'default'
                                            }}
                                            title="Save Quote"
                                        >
                                            <Save size={18} />
                                        </button>
                                    </div>
                                )}
                            </div>

                            <div style={{ display: 'flex', gap: '1rem' }}>
                                <button
                                    onClick={onClose}
                                    style={{
                                        padding: '0.75rem 1.5rem',
                                        border: '1px solid var(--border-color)',
                                        borderRadius: 'var(--radius-md)',
                                        cursor: 'pointer'
                                    }}
                                >
                                    Close
                                </button>
                                <button
                                    onClick={handleExportExcel}
                                    disabled={cartItems.length === 0}
                                    style={{
                                        padding: '0.75rem 1.5rem',
                                        border: '1px solid var(--border-color)',
                                        background: 'white',
                                        color: 'var(--success-color)',
                                        borderRadius: 'var(--radius-md)',
                                        cursor: cartItems.length > 0 ? 'pointer' : 'not-allowed',
                                        display: 'flex', alignItems: 'center', gap: '0.5rem',
                                        fontWeight: 600
                                    }}
                                >
                                    <FileSpreadsheet size={18} />
                                    Excel
                                </button>
                                <button
                                    onClick={handleExportPDF}
                                    disabled={cartItems.length === 0}
                                    style={{
                                        padding: '0.75rem 1.5rem',
                                        background: cartItems.length > 0 ? 'var(--brand-turquoise)' : 'var(--brand-light-grey)',
                                        color: 'white',
                                        borderRadius: 'var(--radius-md)',
                                        cursor: cartItems.length > 0 ? 'pointer' : 'not-allowed',
                                        display: 'flex', alignItems: 'center', gap: '0.5rem',
                                        fontWeight: 600
                                    }}
                                >
                                    <Download size={18} />
                                    Export PDF
                                </button>
                            </div>
                        </>
                    ) : (
                        /* SAVED QUOTES FOOTER */
                        <div style={{ width: '100%', display: 'flex', justifyContent: 'flex-end' }}>
                            <button
                                onClick={onClose}
                                style={{
                                    padding: '0.75rem 1.5rem',
                                    border: '1px solid var(--border-color)',
                                    borderRadius: 'var(--radius-md)',
                                    cursor: 'pointer'
                                }}
                            >
                                Close
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>,
        document.body
    );
};
