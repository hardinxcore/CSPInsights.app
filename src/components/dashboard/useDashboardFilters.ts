import React, { useMemo, useState } from 'react';
import type { BillingRecord } from '../../types/BillingData';
import { calculateSellPrice } from '../../utils/pricing';

/**
 * Encapsulates the Dashboard's filtering pipeline: invoice/tag/anomaly/search/column
 * filters plus the derived unique values, invoices, tags, filtered rows and stats.
 * Logic moved verbatim from Dashboard.tsx to preserve behaviour exactly.
 */
export function useDashboardFilters(
    rows: BillingRecord[],
    customerTags: Record<string, string[]>,
    searchQuery: string,
    globalMargin: number,
    marginRules: Record<string, number>
) {
    const [showAnomaliesOnly, setShowAnomaliesOnly] = useState(false); // New state for anomaly filter
    const [filters, setFilters] = useState<Record<string, string>>({});
    const [activeInvoices, setActiveInvoices] = useState<Set<string>>(new Set());
    const [selectedTags, setSelectedTags] = useState<Set<string>>(new Set()); // Tag Filter State

    // 1. Compute Unique Values for Filters
    const uniqueValues = useMemo(() => {
        const map: Record<string, Set<string>> = {};
        rows.forEach(row => {
            Object.keys(row).forEach(key => {
                const val = (row as any)[key];
                if (val && typeof val === 'string') {
                    if (!map[key]) map[key] = new Set();
                    if (map[key].size < 100) map[key].add(val); // Limit unique values
                }
            });
            // Virtual columns
            if (!map['TotalAmount']) map['TotalAmount'] = new Set();
        });

        const result: Record<string, string[]> = {};
        Object.entries(map).forEach(([k, set]) => {
            result[k] = Array.from(set).sort();
        });
        return result;
    }, [rows]);
    // 2. Compute Unique Invoices specifically
    // 2. Compute Unique Invoices specifically
    const { uniqueInvoices, invoiceDates } = useMemo(() => {
        const set = new Set<string>();
        const dates: Record<string, string> = {};
        let hasUnbilled = false;

        rows.forEach(r => {
            if (r.InvoiceNumber) {
                set.add(r.InvoiceNumber);
                if (!dates[r.InvoiceNumber] && r.ChargeStartDate) {
                    try {
                        const d = new Date(r.ChargeStartDate);
                        if (!isNaN(d.getTime())) {
                            dates[r.InvoiceNumber] = d.toLocaleDateString('nl-NL', { month: 'short', year: 'numeric' });
                        }
                    } catch { /* Ignore invalid display dates. */ }
                }
            }
            else hasUnbilled = true;
        });
        const list = Array.from(set).sort().reverse(); // Show newest first
        if (hasUnbilled) list.push('Unbilled');
        return { uniqueInvoices: list, invoiceDates: dates };
    }, [rows]);

    // 3. Compute Available Tags based on current rows
    const availableTags = useMemo(() => {
        const tags = new Set<string>();
        rows.forEach(r => {
            const cTags = customerTags[r.CustomerName];
            if (cTags) cTags.forEach(t => tags.add(t));
        });
        return Array.from(tags).sort();
    }, [rows, customerTags]);

    // Initialize activeInvoices when data loads
    // Initialize activeInvoices when data loads
    const uniqueInvoicesKey = uniqueInvoices.join(',');
    React.useEffect(() => {
        if (uniqueInvoices.length > 0) {
            setActiveInvoices(new Set(uniqueInvoices));
        }
    }, [uniqueInvoices, uniqueInvoicesKey]);


    // 3. Filter
    const filteredRows = useMemo(() => {
        let result = rows;

        // Invoice Filter
        if (uniqueInvoices.length > 0) {
            result = result.filter(r => {
                const inv = r.InvoiceNumber;
                if (inv) return activeInvoices.has(inv);
                return activeInvoices.has('Unbilled');
            });
        }

        // Tag Filter
        if (selectedTags.size > 0) {
            result = result.filter(r => {
                const tags = customerTags[r.CustomerName] || [];
                return tags.some(t => selectedTags.has(t));
            });
        }

        // Anomaly Filter
        if (showAnomaliesOnly) {
            result = result.filter(row => {
                const amount = row.Total || row.Subtotal || 0;
                const typeLower = (row.ChargeType || '').toLowerCase();
                return amount < 0 || typeLower.includes('refund') || typeLower.includes('cancel') || typeLower.includes('remove');
            });
        }

        // Global Search Filter
        if (searchQuery && searchQuery.trim() !== '') {
            const lowerQuery = searchQuery.toLowerCase();
            result = result.filter(row =>
                (row.CustomerName && row.CustomerName.toLowerCase().includes(lowerQuery)) ||
                (row.ProductName && row.ProductName.toLowerCase().includes(lowerQuery)) ||
                (row.InvoiceNumber && row.InvoiceNumber.toLowerCase().includes(lowerQuery)) ||
                (row.SubscriptionDescription && row.SubscriptionDescription.toLowerCase().includes(lowerQuery)) ||
                (row.SkuName && row.SkuName.toLowerCase().includes(lowerQuery))
            );
        }

        // Column Filters
        if (Object.keys(filters).length > 0) {
            result = result.filter(row => {
                return Object.entries(filters).every(([key, value]) => {
                    if (!value) return true;
                    const filterLower = value.toLowerCase();

                    let cellValue: any;
                    if (key === 'TotalAmount') {
                        cellValue = (row.Total || row.Subtotal || 0);
                    } else {
                        cellValue = row[key as keyof BillingRecord];
                    }

                    if (cellValue === null || cellValue === undefined) return false;
                    return String(cellValue).toLowerCase().includes(filterLower);
                });
            });
        }

        return result;
        return result;
    }, [rows, filters, searchQuery, showAnomaliesOnly, activeInvoices, selectedTags, customerTags, uniqueInvoices.length]);

    // 3. Stats & Sell Prices
    const { filteredTotal, filteredSellPrice, filteredCustomers, auditStats } = useMemo(() => {
        let total = 0;
        let sellTotal = 0;
        const customers = new Set<string>();
        let refundsFound = 0;
        let refundTotal = 0;

        filteredRows.forEach(r => {
            const amount = r.Total || r.Subtotal || 0;
            const sell = calculateSellPrice(r, globalMargin, marginRules);

            total += amount;
            sellTotal += sell;
            customers.add(r.CustomerName);

            const typeLower = (r.ChargeType || '').toLowerCase();
            if (amount < 0 || typeLower.includes('refund') || typeLower.includes('cancel') || typeLower.includes('remove')) {
                refundsFound++;
                refundTotal += amount;
            }
        });

        return {
            filteredTotal: total,
            filteredSellPrice: sellTotal,
            filteredCustomers: customers.size,
            auditStats: { refundsFound, refundTotal }
        };
    }, [filteredRows, globalMargin, marginRules]);

    return {
        // filter state
        showAnomaliesOnly, setShowAnomaliesOnly,
        filters, setFilters,
        activeInvoices, setActiveInvoices,
        selectedTags, setSelectedTags,
        // derived data
        uniqueValues,
        uniqueInvoices, invoiceDates,
        availableTags,
        filteredRows,
        // stats
        filteredTotal, filteredSellPrice, filteredCustomers, auditStats
    };
}
