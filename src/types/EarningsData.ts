/**
 * A single row from the Partner Center Incentives → Earnings → Export (Default) CSV.
 * Each record represents one incentive earning transaction tied to a customer and product.
 */
export interface EarningRecord {
    /** Unique identifier for this earning record (CSV: earningId) */
    earningId: string;
    /** Partner's MPN or program participant ID (CSV: participantId) */
    participantId: string;
    /** Partner organisation name (CSV: participantName) */
    participantName: string;
    /** ISO 2-letter country code of the partner (CSV: partnerCountryCode) */
    partnerCountryCode: string;
    /** Incentive program name, e.g. "CSP Direct Bill Partner" (CSV: programName) */
    programName: string;
    /** Source transaction ID from the billing or usage system (CSV: transactionId) */
    transactionId: string;
    /** ISO 4217 currency code of the source transaction (CSV: transactionCurrency) */
    transactionCurrency: string;
    /** Date of the underlying transaction (CSV: transactionDate) */
    transactionDate: string;
    /** FX rate used to convert transactionAmount to USD (CSV: transactionExchangeRate) */
    transactionExchangeRate: number;
    /** Transaction revenue amount in the transaction currency (CSV: transactionAmount) */
    transactionAmount: number;
    /** Transaction revenue amount in USD (CSV: transactionAmountUSD) */
    transactionAmountUSD: number;
    /** Incentive lever / earning rule that triggered this record (CSV: lever) */
    lever: string;
    /** Name of the incentive engagement (CSV: engagementName) */
    engagementName: string;
    /** Rate (percentage or fixed) applied to compute the earning (CSV: earningRate) */
    earningRate: number;
    /** Unit quantity used in the earning calculation, e.g. seat count (CSV: quantity) */
    quantity: number;
    /** Category of earning, e.g. "Rebate", "Co-op" (CSV: earningType) */
    earningType: string;
    /** Earning amount in the transaction currency (CSV: earningAmount) */
    earningAmount: number;
    /** Earning amount converted to USD (CSV: earningAmountUSD) */
    earningAmountUSD: number;
    /** Date the earning was accrued (CSV: earningDate) */
    earningDate: string;
    /** Payment status code, e.g. "Upcoming", "Sent" (CSV: paymentStatus) */
    paymentStatus: string;
    /** Human-readable description of the payment status (CSV: paymentStatusDescription) */
    paymentStatusDescription: string;
    /** Microsoft customer tenant ID (CSV: customerId) */
    customerId: string;
    /** Customer organisation name (CSV: customerName) */
    customerName: string;
    /** Microsoft product part number / SKU (CSV: partNumber) */
    partNumber: string;
    /** Friendly product name (CSV: productName) */
    productName: string;
    /** Internal Microsoft product ID (CSV: productId) */
    productId: string;
    /** Azure or M365 workload / service family (CSV: workload) */
    workload: string;
    /** Type of transaction, e.g. "New", "Renewal" (CSV: transactionType) */
    transactionType: string;
    /** Microsoft solution area, e.g. "Modern Work", "Azure" (CSV: solutionArea) */
    solutionArea: string;
    /** Expected payment month in YYYY-MM format (CSV: estimatedPaymentMonth) */
    estimatedPaymentMonth: string;
    /** Fund category used for co-op earnings (CSV: fundCategory) */
    fundCategory: string;
    /** Revenue classification label (CSV: revenueClassification) */
    revenueClassification: string;

    // Optional fields — present depending on program and earning type
    /** Invoice number if applicable (CSV: invoiceNumber) */
    invoiceNumber?: string;
    /** Azure subscription or NCE subscription ID (CSV: subscriptionId) */
    subscriptionId?: string;
    /** Subscription start date (CSV: subscriptionStartDate) */
    subscriptionStartDate?: string;
    /** Subscription end date (CSV: subscriptionEndDate) */
    subscriptionEndDate?: string;
    /** Reseller MPN ID when the sale went through an indirect reseller (CSV: resellerId) */
    resellerId?: string;
    /** Reseller organisation name (CSV: resellerName) */
    resellerName?: string;
    /** Co-op claim ID (CSV: claimId) */
    claimId?: string;
    /** Payment ID linking this earning to a Payments record (CSV: paymentId) */
    paymentId?: string;
    /** Tax amount remitted by Microsoft on behalf of the partner (CSV: taxRemitted) */
    taxRemitted?: number;
    /** Short program code used internally (CSV: programCode) */
    programCode?: string;
    /** Earning amount converted to the currency of the last payment (CSV: earningAmountInLastPaymentCurrency) */
    earningAmountInLastPaymentCurrency?: number;
    /** Currency code of the last payment batch (CSV: lastPaymentCurrency) */
    lastPaymentCurrency?: string;
    /** Customer country/region (CSV: customerCountry) */
    customerCountry?: string;
    /** Product SKU ID (CSV: skuId) */
    skuId?: string;
    /** Customer Azure AD tenant ID (CSV: customerTenantId) */
    customerTenantId?: string;
    /** Product category ID (CSV: categoryId) */
    categoryId?: string;
    /** Reason code for adjustments or reversals (CSV: reasonCode) */
    reasonCode?: string;
    /** Unit of measure for the quantity field (CSV: quantityType) */
    quantityType?: string;
    /** Milestone name for milestone-based incentives (CSV: milestone) */
    milestone?: string;
}

/**
 * Aggregated summary computed from a set of EarningRecord rows.
 * Stored alongside the data in IndexedDB and shown in dashboard cards.
 */
export interface EarningsMeta {
    /** Total number of earning rows loaded */
    totalRows: number;
    /** Number of distinct customer names across all records */
    customersCount: number;
    /** Sum of earningAmount across all records, in the primary transaction currency */
    totalEarningAmount: number;
    /** ISO 4217 currency code derived from the first record's transactionCurrency */
    currency: string;
}

/**
 * Result returned by the earnings Web Worker after parsing the CSV.
 */
export interface EarningsParseResult {
    /** Parsed earning records */
    data: EarningRecord[];
    /** Non-fatal parse warnings or skipped-row messages */
    errors: string[];
    /** Computed summary for the parsed dataset */
    meta: EarningsMeta;
}

/**
 * A single row from the Partner Center Incentives → Payments CSV export.
 * Each record represents one payment batch sent to the partner.
 */
export interface PaymentRecord {
    /** Partner's MPN or program participant ID (CSV: participantID) */
    participantId: string;
    /** Type of the participant ID, e.g. "MPN" (CSV: participantIDType) */
    participantIdType: string;
    /** Partner organisation name (CSV: participantName) */
    participantName: string;
    /** Incentive program name (CSV: programName) */
    programName: string;
    /** Total amount earned in this payment batch, in the earned currency (CSV: earned) */
    earned: number;
    /** Earned amount converted to USD (CSV: earnedUSD) */
    earnedUSD: number;
    /** Tax withheld by Microsoft before remitting payment (CSV: withheldTax) */
    withheldTax: number;
    /** Sales tax component of the payment (CSV: salesTax) */
    salesTax: number;
    /** Service fee tax applied by Microsoft (CSV: serviceFeeTax) */
    serviceFeeTax: number;
    /** Net amount actually paid to the partner (CSV: totalPayment) */
    totalPayment: number;
    /** ISO 4217 currency code of the earned amount (CSV: earnedCurrencyCode) */
    earnedCurrencyCode: string;
    /** ISO 4217 currency code in which payment was sent (CSV: paymentCurrencyCode) */
    paymentCurrencyCode: string;
    /** Payment method used, e.g. "Wire Transfer", "EFT" (CSV: paymentMethod) */
    paymentMethod: string;
    /** Unique identifier for this payment batch (CSV: paymentID) */
    paymentId: string;
    /** Payment status code, e.g. "Sent", "Upcoming" (CSV: paymentStatus) */
    paymentStatus: string;
    /** Human-readable description of the payment status (CSV: paymentStatusDescription) */
    paymentStatusDescription: string;
    /** Date the payment was sent or is scheduled (CSV: paymentDate) */
    paymentDate: string;
    /** CI (bank confirmation) reference number, if available (CSV: ciReferenceNumber) */
    ciReferenceNumber?: string;
}

/**
 * Aggregated summary computed from a set of PaymentRecord rows.
 */
export interface PaymentsMeta {
    /** Total number of payment rows loaded */
    totalRows: number;
    /** Sum of the earned field across all records */
    totalEarned: number;
    /** Sum of totalPayment across all records */
    totalPaid: number;
    /** Sum of withheldTax + salesTax across all records */
    totalTax: number;
    /** ISO 4217 currency code derived from the first record's earnedCurrencyCode */
    currency: string;
}

/**
 * Result returned by the payments Web Worker after parsing the CSV.
 */
export interface PaymentsParseResult {
    /** Parsed payment records */
    data: PaymentRecord[];
    /** Non-fatal parse warnings or skipped-row messages */
    errors: string[];
    /** Computed summary for the parsed dataset */
    meta: PaymentsMeta;
}
