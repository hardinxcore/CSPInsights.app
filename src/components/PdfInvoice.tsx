import React from 'react';
import { Page, Text, View, Document, StyleSheet, Image } from '@react-pdf/renderer';

const styles = StyleSheet.create({
    page: { padding: 40, fontFamily: 'Helvetica', fontSize: 10, color: '#5B6770' }, // Brand Grey
    header: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 20 },
    brandSection: { flexDirection: 'column', maxWidth: '50%' },
    logo: { height: 30, marginBottom: 10, objectFit: 'contain', alignSelf: 'flex-start' },
    companyName: { fontSize: 16, fontWeight: 'bold', marginBottom: 4, color: '#FE5000' }, // Brand Orange
    companyInfo: { color: '#5B6770', marginBottom: 2 },
    invoiceMeta: { alignItems: 'flex-end' },
    invoiceTitle: { fontSize: 24, fontWeight: 'bold', color: '#00B5E2', marginBottom: 10 }, // Brand Turquoise
    metaTable: { flexDirection: 'column' },
    metaRow: { flexDirection: 'row', marginBottom: 4 },
    metaLabel: { width: 80, fontWeight: 'bold', color: '#5B6770' },
    metaValue: { width: 100, textAlign: 'right', color: '#333' },

    billTo: { marginTop: 20, marginBottom: 20, padding: 10, backgroundColor: '#E5F6FD', borderRadius: 4 }, // Brand Light Blue BG
    billLabel: { fontSize: 10, fontWeight: 'bold', color: '#5B6770', marginBottom: 4 },
    billName: { fontSize: 12, fontWeight: 'bold', color: '#1F2937' },

    table: { marginTop: 10, marginBottom: 10 },
    tableHeader: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#AAB4BA', paddingBottom: 6, marginBottom: 6 }, // Brand Light Grey border
    tableRow: { flexDirection: 'row', borderBottomWidth: 0.5, borderBottomColor: '#F0F0F0', paddingBottom: 6, paddingTop: 6 }, // Brand BG Grey border

    colDesc: { flex: 2, color: '#1F2937' },
    colQty: { width: 60, textAlign: 'center', color: '#1F2937' },
    colPrice: { width: 80, textAlign: 'right', color: '#1F2937' },
    colAmount: { width: 80, textAlign: 'right', fontWeight: 'bold', color: '#1F2937' },

    footer: { marginTop: 20, paddingTop: 20, borderTopWidth: 1, borderTopColor: '#AAB4BA' },
    totals: { alignItems: 'flex-end', marginTop: 10 },
    totalRow: { flexDirection: 'row', marginBottom: 4 },
    grandTotal: { fontSize: 12, fontWeight: 'bold', marginTop: 4, color: '#FE5000' }, // Brand Orange

    thankYou: { textAlign: 'center', marginTop: 30, color: '#5B6770', fontSize: 9 },
    iban: { textAlign: 'center', marginTop: 4, fontWeight: 'bold', fontSize: 9, color: '#00B5E2' } // Brand Turquoise
});

interface PdfInvoiceProps {
    customerName: string;
    customerId: string;
    items: any[];
    totalAmount: number;
    currency: string;
    companyDetails: any;
}

export const PdfInvoice: React.FC<PdfInvoiceProps> = ({
    customerName, customerId, items, totalAmount, currency, companyDetails
}) => {
    const formatCurrency = (val: number) => {
        return new Intl.NumberFormat('nl-NL', { style: 'currency', currency }).format(val);
    };

    return (
        <Document>
            <Page size="A4" style={styles.page}>
                {/* Header */}
                <View style={styles.header}>
                    <View style={styles.brandSection}>
                        {companyDetails.logoUrl ? (
                            <Image style={styles.logo} src={companyDetails.logoUrl} />
                        ) : (
                            <Text style={styles.companyName}>{companyDetails.name}</Text>
                        )}
                        <Text style={styles.companyInfo}>{companyDetails.addressLine1}</Text>
                        <Text style={styles.companyInfo}>{companyDetails.addressLine2}</Text>
                    </View>
                    <View style={styles.invoiceMeta}>
                        <Text style={styles.invoiceTitle}>INVOICE</Text>
                        <View style={styles.metaTable}>
                            <View style={styles.metaRow}>
                                <Text style={styles.metaLabel}>Date:</Text>
                                <Text style={styles.metaValue}>{new Date().toLocaleDateString()}</Text>
                            </View>
                            <View style={styles.metaRow}>
                                <Text style={styles.metaLabel}>Invoice #:</Text>
                                <Text style={styles.metaValue}>DRAFT</Text>
                            </View>
                        </View>
                    </View>
                </View>

                {/* Bill To */}
                <View style={styles.billTo}>
                    <Text style={styles.billLabel}>Bill To:</Text>
                    <Text style={styles.billName}>{customerName}</Text>
                    <Text style={{ marginTop: 2 }}>ID: {customerId}</Text>
                </View>

                {/* Table */}
                <View style={styles.table}>
                    <View style={styles.tableHeader}>
                        <Text style={[styles.colDesc, { fontWeight: 'bold' }]}>Description</Text>
                        <Text style={[styles.colQty, { fontWeight: 'bold' }]}>Qty</Text>
                        <Text style={[styles.colPrice, { fontWeight: 'bold' }]}>Price</Text>
                        <Text style={[styles.colAmount, { fontWeight: 'bold' }]}>Amount</Text>
                    </View>
                    {items.map((item, idx) => (
                        <View key={idx} style={styles.tableRow}>
                            <View style={styles.colDesc}>
                                <Text>{item.description}</Text>
                                {item.period && <Text style={{ fontSize: 8, color: '#64748b' }}>{item.period}</Text>}
                            </View>
                            <Text style={styles.colQty}>{item.quantity}</Text>
                            <Text style={styles.colPrice}>{formatCurrency(item.unitPrice)}</Text>
                            <Text style={styles.colAmount}>{formatCurrency(item.amount)}</Text>
                        </View>
                    ))}
                </View>

                {/* Totals */}
                <View style={styles.totals}>
                    <View style={styles.totalRow}>
                        <Text style={[styles.metaLabel, { width: 100 }]}>Subtotal:</Text>
                        <Text style={styles.metaValue}>{formatCurrency(totalAmount)}</Text>
                    </View>
                    <View style={styles.totalRow}>
                        <Text style={[styles.metaLabel, { width: 100 }]}>Tax (21%):</Text>
                        <Text style={styles.metaValue}>{formatCurrency(totalAmount * 0.21)}</Text>
                    </View>
                    <View style={[styles.totalRow, styles.grandTotal]}>
                        <Text style={[styles.metaLabel, { width: 100, color: '#000' }]}>Total:</Text>
                        <Text style={[styles.metaValue, { color: '#000' }]}>{formatCurrency(totalAmount * 1.21)}</Text>
                    </View>
                </View>

                {/* Footer */}
                <View style={styles.footer}>
                    <Text style={styles.thankYou}>{companyDetails.invoiceFooter || 'Thank you for your business!'}</Text>
                    <Text style={styles.iban}>IBAN: {companyDetails.iban}</Text>
                </View>
            </Page>
        </Document>
    );
};
