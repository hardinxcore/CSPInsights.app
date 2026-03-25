import { z } from 'zod';

const numberPreprocess = (val: unknown) => {
    if (typeof val === 'number') return val;
    if (typeof val === 'string') {
        const clean = val.replace(/[^0-9.-]/g, '');
        const num = parseFloat(clean);
        return isNaN(num) ? 0 : num;
    }
    return 0;
};

export const BillingRecordSchema = z.object({
    PartnerId: z.string().optional(),
    CustomerId: z.string().optional(),
    CustomerName: z.string().default('Unknown'),
    CustomerDomainName: z.string().optional().default(''),
    CustomerCountry: z.string().optional(),
    InvoiceNumber: z.string().optional(),
    OrderId: z.string().optional(),
    OrderDate: z.string().optional(),
    ProductId: z.string().optional().default(''),
    SkuId: z.string().optional().default(''),
    SkuName: z.string().optional().default(''),
    ProductName: z.string().optional().default(''),
    PublisherName: z.string().optional(),
    PublisherId: z.string().optional(),
    SubscriptionDescription: z.string().optional().default(''),
    SubscriptionId: z.string().optional().default(''),
    ChargeStartDate: z.string().optional(),
    ChargeEndDate: z.string().optional(),
    TermAndBillingCycle: z.string().optional().default(''),
    EffectiveUnitPrice: z.preprocess(numberPreprocess, z.number().default(0)),
    UnitPrice: z.preprocess(numberPreprocess, z.number().default(0)),
    Quantity: z.preprocess(numberPreprocess, z.number().default(0)),
    BillableQuantity: z.preprocess(numberPreprocess, z.number().default(0)),
    Subtotal: z.preprocess(numberPreprocess, z.number().default(0)),
    TaxTotal: z.preprocess(numberPreprocess, z.number().default(0)),
    Total: z.preprocess(numberPreprocess, z.number().default(0)),
    Currency: z.string().optional(),
    ChargeType: z.string().optional(),
    ConsumedQuantity: z.preprocess(numberPreprocess, z.number().default(0)),
    MeterId: z.string().optional(),
    MeterName: z.string().optional(),
    MeterCategory: z.string().optional(),
    ServiceInfo1: z.string().optional(), // Resource Name

    // Expanded Fields
    MpnId: z.string().optional(),
    Tier2MpnId: z.string().optional(),
    AvailabilityId: z.string().optional(),
    PriceAdjustmentDescription: z.string().optional(),
    UnitType: z.string().optional(),
    AlternateId: z.string().optional(),
    BillingFrequency: z.string().optional(),
    PCToBCExchangeRate: z.preprocess(numberPreprocess, z.number().default(0)),
    PCToBCExchangeRateDate: z.string().optional(),
    MeterDescription: z.string().optional(),
    BillableDays: z.preprocess(numberPreprocess, z.number().default(0)),
    ReservationOrderId: z.string().optional(),
    SubscriptionStartDate: z.string().optional(),
    SubscriptionEndDate: z.string().optional(),
    ReferenceId: z.string().optional(),
    ProductQualifiers: z.string().optional(),
    PromotionId: z.string().optional(),
    ProductCategory: z.string().optional(),

    BillingPreTaxTotal: z.preprocess(numberPreprocess, z.number().default(0)),
    PricingCurrency: z.string().optional(),
    IsUnbilled: z.boolean().optional(),
    SourceFile: z.string().optional()
});

export type BillingRecord = z.infer<typeof BillingRecordSchema>;
