import { useMemo } from 'react';
import type { EarningRecord } from '../../types/EarningsData';
import { truncate } from './shared';

/**
 * Heavy earnings aggregations derived purely from the parsed records.
 * Extracted verbatim from EarningsView so the composition root stays lean.
 */
export function useEarningsAggregations(data: EarningRecord[]) {
    const earningsByLever = useMemo(() => {
        const map = new Map<string, number>();
        data.forEach(r => { if (r.lever) map.set(r.lever, (map.get(r.lever) || 0) + r.earningAmount); });
        return Array.from(map.entries())
            .map(([lever, amount]) => ({ lever, shortLever: truncate(lever, 32), amount }))
            .sort((a, b) => b.amount - a.amount);
    }, [data]);

    const earningsByMonth = useMemo(() => {
        const map = new Map<string, number>();
        data.forEach(r => {
            if (!r.earningDate) return;
            const d = new Date(r.earningDate);
            if (isNaN(d.getTime())) return;
            const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
            map.set(key, (map.get(key) || 0) + r.earningAmount);
        });
        return Array.from(map.entries())
            .map(([month, amount]) => ({ month, amount }))
            .sort((a, b) => a.month.localeCompare(b.month));
    }, [data]);

    const earningsByCustomer = useMemo(() => {
        const map = new Map<string, { amount: number; records: number; levers: Set<string> }>();
        data.forEach(r => {
            if (!r.customerName) return;
            const e = map.get(r.customerName) || { amount: 0, records: 0, levers: new Set<string>() };
            e.amount += r.earningAmount;
            e.records++;
            if (r.lever) e.levers.add(r.lever);
            map.set(r.customerName, e);
        });
        return Array.from(map.entries()).map(([customerName, s]) => ({
            customerName,
            amount: s.amount,
            records: s.records,
            levers: Array.from(s.levers).join(', '),
        }));
    }, [data]);

    // Memoized: this used to be sorted inline in the chart JSX on every render
    const topCustomers = useMemo(
        () => [...earningsByCustomer].sort((a, b) => b.amount - a.amount).slice(0, 10),
        [earningsByCustomer]
    );

    const earningsByProduct = useMemo(() => {
        const map = new Map<string, { amount: number; records: number; lever: string; customers: Set<string> }>();
        data.forEach(r => {
            if (!r.productName) return;
            const e = map.get(r.productName) || { amount: 0, records: 0, lever: r.lever, customers: new Set<string>() };
            e.amount += r.earningAmount;
            e.records++;
            if (r.customerName) e.customers.add(r.customerName);
            map.set(r.productName, e);
        });
        return Array.from(map.entries()).map(([productName, s]) => ({
            productName, amount: s.amount, records: s.records, lever: s.lever, customersCount: s.customers.size,
        }));
    }, [data]);

    const uniqueLevers = useMemo(() => [...new Set(data.map(r => r.lever).filter(Boolean))], [data]);
    const uniqueStatuses = useMemo(() => [...new Set(data.map(r => r.paymentStatus).filter(Boolean))], [data]);
    const unprocessedAmount = useMemo(
        () => data.filter(r => r.paymentStatus === 'UNPROCESSED').reduce((s, r) => s + r.earningAmount, 0),
        [data]
    );
    const nextPayment = useMemo(() => {
        const months = [...new Set(data.map(r => r.estimatedPaymentMonth).filter(Boolean))].sort((a, b) => String(a).localeCompare(String(b)));
        return months[0] || null;
    }, [data]);

    return {
        earningsByLever,
        earningsByMonth,
        earningsByCustomer,
        topCustomers,
        earningsByProduct,
        uniqueLevers,
        uniqueStatuses,
        unprocessedAmount,
        nextPayment,
    };
}
