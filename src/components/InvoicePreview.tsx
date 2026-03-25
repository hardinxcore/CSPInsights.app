import React from 'react';
import { createPortal } from 'react-dom';
import { X, Printer, Download } from 'lucide-react';
import { useSettingsStore } from '../store/settingsStore';
import { PDFDownloadLink } from '@react-pdf/renderer';
import { PdfInvoice } from './PdfInvoice';
import './InvoicePreview.css';

interface InvoiceItem {
    description: string;
    quantity: number;
    unitPrice: number;
    amount: number;
    period?: string;
}

interface InvoicePreviewProps {
    customerName: string;
    customerId: string;
    items: InvoiceItem[];
    totalAmount: number;
    currency: string;
    onClose: () => void;
}

export const InvoicePreview: React.FC<InvoicePreviewProps> = ({
    customerName,
    customerId,
    items,
    totalAmount,
    currency,
    onClose
}) => {
    const { companyDetails } = useSettingsStore();

    const handlePrint = () => {
        window.print();
    };

    const formatCurrency = (val: number) => {
        return new Intl.NumberFormat('nl-NL', { style: 'currency', currency }).format(val);
    };

    const today = new Date().toLocaleDateString('nl-NL', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });

    return createPortal(
        <div className="invoice-overlay">
            <div className="invoice-modal">
                {/* Controls - Hidden on Print */}
                <div className="invoice-controls no-print">
                    <button onClick={handlePrint} className="secondary-btn" style={{ background: '#fff', border: '1px solid var(--border-color)', color: 'var(--text-primary)' }}>
                        <Printer size={16} />
                    </button>

                    <PDFDownloadLink
                        document={<PdfInvoice
                            customerName={customerName}
                            customerId={customerId}
                            items={items}
                            totalAmount={totalAmount}
                            currency={currency}
                            companyDetails={companyDetails}
                        />}
                        fileName={`Invoice_${customerName.replace(/[^a-z0-9]/gi, '_')}.pdf`}
                    >
                        {({ loading }) => (
                            <button className="primary-btn" disabled={loading}>
                                <Download size={16} style={{ marginRight: 8 }} />
                                {loading ? 'Generating...' : 'Download PDF'}
                            </button>
                        )}
                    </PDFDownloadLink>

                    <button onClick={onClose} className="close-btn" style={{ marginLeft: '1rem' }}>
                        <X size={20} />
                    </button>
                </div>

                {/* Defines the print area */}
                <div className="invoice-paper" id="invoice-print-area">
                    {/* Header */}
                    <div className="invoice-header">
                        <div className="invoice-brand">
                            {companyDetails.logoUrl ? (
                                <img src={companyDetails.logoUrl} alt={companyDetails.name} className="invoice-logo" />
                            ) : (
                                <h2 style={{ color: 'var(--brand-orange)', margin: 0 }}>{companyDetails.name}</h2>
                            )}
                            <div className="company-details">
                                <p>{companyDetails.addressLine1}</p>
                                <p>{companyDetails.addressLine2}</p>
                            </div>
                        </div>
                        {/* ... */}
                        <div className="invoice-meta">
                            <h1>INVOICE</h1>
                            <table>
                                <tbody>
                                    <tr>
                                        <td>Date:</td>
                                        <td>{today}</td>
                                    </tr>
                                    <tr>
                                        <td>Invoice #:</td>
                                        <td>DRAFT-{Math.floor(Math.random() * 10000)}</td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* Bill To */}
                    <div className="invoice-bill-to">
                        <h4>Bill To:</h4>
                        <p className="bill-name">{customerName}</p>
                        <p className="bill-id">ID: {customerId}</p>
                    </div>

                    {/* Table */}
                    <table className="invoice-table">
                        <thead>
                            <tr>
                                <th>Description</th>
                                <th style={{ textAlign: 'center' }}>Qty</th>
                                <th style={{ textAlign: 'right' }}>Unit Price</th>
                                <th style={{ textAlign: 'right' }}>Amount</th>
                            </tr>
                        </thead>
                        <tbody>
                            {items.map((item, idx) => (
                                <tr key={idx}>
                                    <td>
                                        <div className="item-desc">{item.description}</div>
                                        {item.period && <div className="item-period">{item.period}</div>}
                                    </td>
                                    <td style={{ textAlign: 'center' }}>{item.quantity}</td>
                                    <td style={{ textAlign: 'right' }}>{formatCurrency(item.unitPrice)}</td>
                                    <td style={{ textAlign: 'right' }}>{formatCurrency(item.amount)}</td>
                                </tr>
                            ))}
                        </tbody>
                        <tfoot>
                            <tr>
                                <td colSpan={3} className="total-label">Subtotal</td>
                                <td className="total-value">{formatCurrency(totalAmount)}</td>
                            </tr>
                            <tr>
                                <td colSpan={3} className="total-label">Tax (21%)</td>
                                <td className="total-value">{formatCurrency(totalAmount * 0.21)}</td>
                            </tr>
                            <tr className="grand-total-row">
                                <td colSpan={3} className="total-label">Total</td>
                                <td className="total-value">{formatCurrency(totalAmount * 1.21)}</td>
                            </tr>
                        </tfoot>
                    </table>

                    {/* Footer */}
                    <div className="invoice-footer">
                        <p>{companyDetails.invoiceFooter || 'Thank you for your business!'}</p>
                        <p>IBAN: {companyDetails.iban}</p>
                    </div>
                </div>
            </div>
        </div>,
        document.body
    );
};
