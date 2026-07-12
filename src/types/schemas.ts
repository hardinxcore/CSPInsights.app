import { z } from 'zod';
import { parseMoney } from '../utils/parseNumber';

const numberPreprocess = (val: unknown) => parseMoney(val);

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

// Pricing catalog rows had no validation and used raw parseFloat; this
// schema is the single source of truth for the PriceRow shape.
export const PriceRowSchema = z.object({
    ProductTitle: z.string().default('Unknown Product'),
    ProductId: z.string(),
    SkuId: z.string(),
    SkuTitle: z.string().default(''),
    Publisher: z.string().default(''),
    SkuDescription: z.string().default(''),
    UnitOfMeasure: z.string().default(''),
    TermDuration: z.string().default(''),
    BillingPlan: z.string().default(''),
    Market: z.string().default(''),
    Currency: z.string().default(''),
    UnitPrice: z.preprocess(numberPreprocess, z.number().default(0)),
    ERPPrice: z.preprocess(numberPreprocess, z.number().default(0)),
    EffectiveStartDate: z.string().default(''),
    Segment: z.string().default(''),
    Tags: z.string().optional(),
});

export type PriceRow = z.infer<typeof PriceRowSchema>;

export const BackupSchema = z.object({
  version: z.string().min(1),
  timestamp: z.string().datetime(),
  billing: z.object({
    data: z.array(BillingRecordSchema),
    meta: z.unknown(),
    marginRules: z.record(z.string(), z.number()),
    customerTags: z.record(z.string(), z.array(z.string())),
    globalMargin: z.number().finite(),
    snapshots: z.array(z.unknown()).optional(),
  }),
  settings: z.object({
    companyDetails: z.object({
      name: z.string(),
      addressLine1: z.string(),
      addressLine2: z.string(),
      iban: z.string(),
    }).passthrough(),
    defaultMargin: z.number().finite(),
    theme: z.enum(['system', 'light', 'dark']),
  }),
  pricing: z.object({
    rows: z.array(z.unknown()),
    meta: z.unknown(),
    favorites: z.array(z.string()),
    snapshots: z.array(z.unknown()).optional(),
  }).optional(),
  cart: z.object({
    quantities: z.record(z.string(), z.number()),
    customerReference: z.string(),
    savedQuotes: z.array(z.unknown()),
  }).optional(),
}).passthrough();
