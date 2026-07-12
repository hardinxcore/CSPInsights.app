// ── Types ──────────────────────────────────────────────────────────────────────

export type TermCategory =
    | 'Monthly (Flex)'
    | 'Annual (Monthly Pay)'
    | 'Annual (Prepaid)'
    | '3 Year (Commit)'
    | 'Trial'
    | 'Other';

export type ViewMode = 'calendar' | 'list';

export interface RenewalEntry {
    subscriptionId: string;
    customerName: string;
    productName: string;
    termCategory: TermCategory;
    term: string;
    endDate: Date;
    startDate: Date | null;
    quantity: number;
    value: number;
    currency: string;
    daysUntil: number;
    isCancellable: boolean;
    orderId?: string;
}

/** A record from the Partner Center AI Assist EST export CSV */
export interface ESTUploadRecord {
    customerTenantId: string;
    resellerPartnerId: string;
    subscriptionId: string;
    subscriptionName: string;
    offerId: string;
    quantity: number;
    termDuration: string;
    billingCycle: string;
    termEndDate: Date | null;
    errorMessage: string;
    evaluationTime: Date | null;
    /** Customer name resolved from billing data via SubscriptionId */
    resolvedCustomerName?: string;
    /** Days until this subscription enters EST (termEndDate − today) */
    daysUntilEST: number;
}
