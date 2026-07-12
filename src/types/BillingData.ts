// Single source of truth is the Zod schema in schemas.ts; re-exported here
// so the many existing imports from types/BillingData keep working. This
// removes the earlier drift between a hand-written interface and z.infer.
import type { BillingRecord } from './schemas';
export type { BillingRecord };

export interface ParseResult {
    data: BillingRecord[];
    errors: string[];
    meta: {
        totalRows: number;
        customersCount: number;
        totalAmount: number;
        currency?: string;
        totalsByCurrency?: Record<string, number>;
    };
}

export interface BillingMeta {
    totalRows: number;
    customersCount: number;
    totalAmount: number;
    currency?: string;
    totalsByCurrency?: Record<string, number>;
}
