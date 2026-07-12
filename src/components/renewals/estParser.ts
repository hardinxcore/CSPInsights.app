import type { ParseResult } from 'papaparse';
import type { ESTUploadRecord } from './types';
import { CSV_ROW_NUMBER_OFFSET } from './constants';
import { parseESTDate, toMidnight } from './helpers';

/** Outcome of parsing a Partner Center EST export CSV (pure, no React/side effects) */
export type ESTParseOutcome =
    | { kind: 'error'; message: string }
    | { kind: 'success'; records: ESTUploadRecord[]; warning: string | null };

/**
 * Transform PapaParse results from a Partner Center AI Assist EST export into
 * ESTUploadRecord entries. Pure: no React state, no DOM/ref access, no I/O.
 *
 * @param results                   PapaParse result object (header mode)
 * @param today                     Reference "today" (midnight) for daysUntilEST
 * @param subscriptionCustomerMap   SubscriptionId (lowercase) → customer name lookup
 */
export function parseESTResults(
    results: ParseResult<Record<string, string>>,
    today: Date,
    subscriptionCustomerMap: Map<string, string>,
): ESTParseOutcome {
    // Surface parse errors as a warning; Papa may still return partial data
    const parseErrors = results.errors;
    const parseWarning = parseErrors.length
        ? `${parseErrors.length} parse issue(s) — some rows may be missing: ${parseErrors
              .slice(0, 3)
              // +2 adjusts for 1-based row numbers plus the header row
              .map(e => `row ${e.row != null ? e.row + CSV_ROW_NUMBER_OFFSET : '?'}: ${e.message}`)
              .join('; ')}${parseErrors.length > 3 ? ` … and ${parseErrors.length - 3} more` : ''}`
        : null;

    const rows = results.data as Record<string, string>[];
    if (!rows.length) {
        return {
            kind: 'error',
            message: parseWarning
                ? `No data rows found in the uploaded file. ${parseWarning}`
                : 'No data rows found in the uploaded file.',
        };
    }
    // Validate that it looks like a PC EST export
    const first = rows[0];
    if (!('SubscriptionId' in first) && !('subscriptionId' in first)) {
        return {
            kind: 'error',
            message: parseWarning
                ? `Unrecognised file format. Expected a Partner Center EST export with a SubscriptionId column. ${parseWarning}`
                : 'Unrecognised file format. Expected a Partner Center EST export with a SubscriptionId column.',
        };
    }

    const parsed: ESTUploadRecord[] = [];
    for (const row of rows) {
        const subId = (row['SubscriptionId'] || row['subscriptionId'] || '').trim();
        if (!subId) continue;
        const termEndDate = parseESTDate(row['TermEndDate'] || row['termEndDate']);
        const evaluationTime = parseESTDate(row['EvaluationTime'] || row['evaluationTime']);
        const daysUntilEST = termEndDate
            ? Math.ceil((toMidnight(termEndDate).getTime() - today.getTime()) / 86_400_000)
            : Number.POSITIVE_INFINITY;
        const resolvedCustomerName = subscriptionCustomerMap.get(subId.toLowerCase());
        const record: ESTUploadRecord = {
            customerTenantId: (row['CustomerTenantId'] || row['customerTenantId'] || '').trim(),
            resellerPartnerId: (row['ResellerPartnerId'] || row['resellerPartnerId'] || '').trim(),
            subscriptionId: subId,
            subscriptionName: (row['SubscriptionName'] || row['subscriptionName'] || '').trim(),
            offerId: (row['OfferId'] || row['offerId'] || '').trim(),
            quantity: parseInt(row['Quantity'] || row['quantity'] || '0', 10) || 0,
            termDuration: (row['TermDuration'] || row['termDuration'] || '').trim(),
            billingCycle: (row['BillingCycle'] || row['billingCycle'] || '').trim(),
            termEndDate,
            errorMessage: (row['ErrorMessage'] || row['errorMessage'] || '').trim(),
            evaluationTime,
            resolvedCustomerName,
            daysUntilEST,
        };
        parsed.push(record);
    }

    return { kind: 'success', records: parsed, warning: parseWarning };
}
