import type { BillingRecord } from '../../types/BillingData';

export type SortKey = keyof BillingRecord | 'TotalAmount' | 'SellPrice';
export type SortDirection = 'asc' | 'desc';
export type ViewMode = 'detail' | 'rebill' | 'comparison' | 'azure';

export interface SortConfig {
    key: SortKey;
    direction: SortDirection;
}

export interface InvoiceData {
    customerName: string;
    customerId: string;
    items: any[];
    totalAmount: number;
    currency: string;
}

export const ALL_COLUMNS = [
    'CustomerName', 'ProductName', 'ChargeType',
    'Quantity', 'UnitPrice', 'TotalAmount', 'PublisherName',
    'SubscriptionDescription', 'InvoiceNumber', 'TermAndBillingCycle',
    'ChargeStartDate', 'ChargeEndDate', 'BillableDays'
];
