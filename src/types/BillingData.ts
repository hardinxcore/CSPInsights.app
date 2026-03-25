export interface BillingRecord {
    PartnerId: string;
    CustomerId: string;
    CustomerName: string;
    CustomerDomainName: string;
    CustomerCountry?: string; // New
    InvoiceNumber?: string;
    OrderId?: string; // New
    OrderDate?: string; // New
    ProductId: string;
    SkuId: string;
    SkuName: string;
    ProductName: string;
    PublisherName?: string;
    PublisherId?: string;
    SubscriptionDescription: string;
    SubscriptionId: string;
    ChargeStartDate: string;
    ChargeEndDate: string;
    TermAndBillingCycle: string;
    EffectiveUnitPrice: number;
    UnitPrice: number;
    Quantity: number;
    BillableQuantity: number;
    Subtotal: number;
    TaxTotal?: number;
    Total?: number;
    ChargeType?: string;
    ConsumedQuantity?: number;
    MeterId?: string;
    MeterName?: string;
    MeterCategory?: string;
    BillingPreTaxTotal?: number;
    PricingCurrency?: string;
    IsUnbilled?: boolean;
    SourceFile?: string; // New field to track origin file
    Currency?: string;
    // Expanded Fields from User CSV
    MpnId?: string;
    Tier2MpnId?: string;
    AvailabilityId?: string;
    PriceAdjustmentDescription?: string;
    UnitType?: string;
    AlternateId?: string;
    BillingFrequency?: string;
    PCToBCExchangeRate?: number;
    PCToBCExchangeRateDate?: string;
    MeterDescription?: string;
    ReservationOrderId?: string;
    SubscriptionStartDate?: string;
    SubscriptionEndDate?: string;
    ReferenceId?: string;
    ProductQualifiers?: string;
    PromotionId?: string;
    ProductCategory?: string;

    // Existing Pro Fields
    BillableDays?: number;
    CreditReasonCode?: string;
    EntitlementId?: string;
    ServiceInfo1?: string; // Resource Name
}

export interface ParseResult {
    data: BillingRecord[];
    errors: string[];
    meta: {
        totalRows: number;
        customersCount: number;
        totalAmount: number;
    };
}
