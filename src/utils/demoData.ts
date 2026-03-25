import type { BillingRecord } from '../types/BillingData';

const CUSTOMERS = [
    { name: 'Contoso Corp', domain: 'contoso.onmicrosoft.com', id: 'Guid-Contoso' },
    { name: 'Fabrikam Inc', domain: 'fabrikam.onmicrosoft.com', id: 'Guid-Fabrikam' },
    { name: 'Litware Systems', domain: 'litware.onmicrosoft.com', id: 'Guid-Litware' }
];

const PRODUCTS = [
    { name: 'Microsoft 365 Business Standard', sku: 'M365-BS', unitPrice: 10.50, quantity: 50 },
    { name: 'Microsoft 365 E3', sku: 'M365-E3', unitPrice: 32.00, quantity: 20 },
    { name: 'Azure Plan', sku: 'Azure-Plan', unitPrice: 1, quantity: 0, isAzure: true },
    { name: 'Dynamics 365 Sales Professional', sku: 'D365-Sales', unitPrice: 55.00, quantity: 5 }
];

export const generateDemoData = (): BillingRecord[] => {
    const records: BillingRecord[] = [];
    const today = new Date();

    // Generate data for 2 months (Current and Previous)
    [0, 1].forEach(monthOffset => {
        const date = new Date(today.getFullYear(), today.getMonth() - monthOffset, 1);
        const invoiceNumber = `G00${123456 - monthOffset}`;
        // Realistic NCE Terms (Matches Screenshot)
        const terms = [
            'One-Year commitment for monthly billing',
            'One-Month commitment for monthly billing',
            'One-Year commitment for yearly billing',
            'Three-Year commitment for yearly billing'
        ];
        const term = terms[Math.floor(Math.random() * terms.length)];

        CUSTOMERS.forEach(cust => {
            PRODUCTS.forEach(prod => {
                // Skew data slightly per month/customer to make it interesting
                const variance = 1 + (Math.random() * 0.2 - 0.1); // +/- 10%
                let quantity = Math.floor(prod.quantity * variance);
                let total = quantity * prod.unitPrice;

                // Special handling for Azure
                if (prod.isAzure) {
                    quantity = 1;
                    total = Math.random() * 500 + 100; // Random Azure spend 100-600
                }

                // Skip random items to simulate churn
                if (Math.random() > 0.9) return;

                records.push({
                    PartnerId: 'Demo-Partner',
                    CustomerId: cust.id,
                    CustomerName: cust.name,
                    CustomerDomainName: cust.domain,
                    InvoiceNumber: invoiceNumber,
                    ProductId: prod.sku,
                    SkuId: prod.sku,
                    SkuName: prod.name,
                    ProductName: prod.name,
                    SubscriptionDescription: prod.name,
                    SubscriptionId: `Sub-${cust.name}-${prod.sku}`,
                    SubscriptionStartDate: Math.random() > 0.9
                        ? new Date().toISOString() // 10% chance New Order (Today)
                        : new Date(2023, 0, 1).toISOString(), // Old order
                    ChargeStartDate: new Date(date.getFullYear(), date.getMonth(), 1).toISOString(),
                    ChargeEndDate: new Date(date.getFullYear(), date.getMonth() + 1, 0).toISOString(),
                    TermAndBillingCycle: term,
                    UnitPrice: prod.unitPrice,
                    EffectiveUnitPrice: prod.unitPrice,
                    Quantity: quantity,
                    BillableQuantity: quantity,
                    Subtotal: total,
                    TaxTotal: total * 0.1,
                    Total: total * 1.1,
                    ChargeType: 'Purchase',
                    PublisherName: 'Microsoft Corporation',
                    PricingCurrency: 'EUR',
                    Currency: 'EUR',
                    SourceFile: `Demo_Invoice_${term}.csv`
                } as BillingRecord);
            });
        });
    });

    return records;
};
