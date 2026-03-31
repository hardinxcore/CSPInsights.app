import Papa from 'papaparse';

const EXPECTED_COLUMNS = ['earningId', 'earningAmount', 'customerName'];

const toNum = (val: any): number => {
    if (typeof val === 'number') return val;
    if (typeof val === 'string') {
        const n = parseFloat(val.replace(/[^0-9.-]/g, ''));
        return isNaN(n) ? 0 : n;
    }
    return 0;
};

const toStr = (val: any): string => (val != null ? String(val).trim() : '');

self.onmessage = async (e: MessageEvent) => {
    const { files } = e.data;
    const allData: any[] = [];
    const errors: string[] = [];

    try {
        for (const file of files) {
            await new Promise<void>((resolve) => {
                let headerRowIndex = 0;

                const preReader = new FileReader();
                preReader.onload = (evt) => {
                    const text = evt.target?.result as string;
                    if (!text) { resolve(); return; }

                    const lines = text.split(/\r\n|\n|\r/);
                    const foundIndex = lines.findIndex(line => {
                        const normalized = line.replace(/['"]/g, '').toLowerCase();
                        return EXPECTED_COLUMNS.filter(col => normalized.includes(col.toLowerCase())).length >= 2;
                    });
                    if (foundIndex > -1) headerRowIndex = foundIndex;

                    Papa.parse(file, {
                        header: true,
                        skipEmptyLines: 'greedy',
                        encoding: 'UTF-8',
                        beforeFirstChunk: (chunk) => {
                            const rows = chunk.split(/\r\n|\n|\r/);
                            if (headerRowIndex > 0 && rows.length > headerRowIndex) {
                                return rows.slice(headerRowIndex).join('\n');
                            }
                            return chunk;
                        },
                        complete: (results) => {
                            results.data.forEach((row: any) => {
                                // Skip rows without a valid earningId
                                if (!row.earningId || String(row.earningId).trim() === '') return;

                                const record = {
                                    earningId: toStr(row.earningId),
                                    participantId: toStr(row.participantId),
                                    participantName: toStr(row.participantName),
                                    partnerCountryCode: toStr(row.partnerCountryCode),
                                    programName: toStr(row.programName),
                                    transactionId: toStr(row.transactionId),
                                    transactionCurrency: toStr(row.transactionCurrency) || 'EUR',
                                    transactionDate: toStr(row.transactionDate),
                                    transactionExchangeRate: toNum(row.transactionExchangeRate) || 1,
                                    transactionAmount: toNum(row.transactionAmount),
                                    transactionAmountUSD: toNum(row.transactionAmountUSD),
                                    lever: toStr(row.lever),
                                    engagementName: toStr(row.engagementName),
                                    earningRate: toNum(row.earningRate),
                                    quantity: toNum(row.quantity),
                                    earningType: toStr(row.earningType),
                                    earningAmount: toNum(row.earningAmount),
                                    earningAmountUSD: toNum(row.earningAmountUSD),
                                    earningDate: toStr(row.earningDate),
                                    paymentStatus: toStr(row.paymentStatus),
                                    paymentStatusDescription: toStr(row.paymentStatusDescription),
                                    customerId: toStr(row.customerId),
                                    customerName: toStr(row.customerName),
                                    partNumber: toStr(row.partNumber),
                                    productName: toStr(row.productName),
                                    productId: toStr(row.productId),
                                    workload: toStr(row.workload),
                                    transactionType: toStr(row.transactionType),
                                    solutionArea: toStr(row.solutionArea),
                                    estimatedPaymentMonth: toStr(row.estimatedPaymentMonth),
                                    fundCategory: toStr(row.fundCategory),
                                    revenueClassification: toStr(row.revenueClassification),
                                    // Optional fields — only include if non-empty
                                    ...(row.invoiceNumber ? { invoiceNumber: toStr(row.invoiceNumber) } : {}),
                                    ...(row.subscriptionId ? { subscriptionId: toStr(row.subscriptionId) } : {}),
                                    ...(row.subscriptionStartDate ? { subscriptionStartDate: toStr(row.subscriptionStartDate) } : {}),
                                    ...(row.subscriptionEndDate ? { subscriptionEndDate: toStr(row.subscriptionEndDate) } : {}),
                                    ...(row.resellerId ? { resellerId: toStr(row.resellerId) } : {}),
                                    ...(row.resellerName ? { resellerName: toStr(row.resellerName) } : {}),
                                    ...(row.claimId ? { claimId: toStr(row.claimId) } : {}),
                                    ...(row.paymentId ? { paymentId: toStr(row.paymentId) } : {}),
                                    ...(row.taxRemitted ? { taxRemitted: toNum(row.taxRemitted) } : {}),
                                    ...(row.programCode ? { programCode: toStr(row.programCode) } : {}),
                                    ...(row.earningAmountInLastPaymentCurrency ? { earningAmountInLastPaymentCurrency: toNum(row.earningAmountInLastPaymentCurrency) } : {}),
                                    ...(row.lastPaymentCurrency ? { lastPaymentCurrency: toStr(row.lastPaymentCurrency) } : {}),
                                    ...(row.customerCountry ? { customerCountry: toStr(row.customerCountry) } : {}),
                                    ...(row.skuId ? { skuId: toStr(row.skuId) } : {}),
                                    ...(row.customerTenantId ? { customerTenantId: toStr(row.customerTenantId) } : {}),
                                    ...(row.categoryId ? { categoryId: toStr(row.categoryId) } : {}),
                                    ...(row.reasonCode ? { reasonCode: toStr(row.reasonCode) } : {}),
                                    ...(row.quantityType ? { quantityType: toStr(row.quantityType) } : {}),
                                    ...(row.milestone ? { milestone: toStr(row.milestone) } : {}),
                                };

                                allData.push(record);
                            });
                            resolve();
                        },
                        error: (err: any) => {
                            errors.push(`Error in file ${file.name}: ${err.message}`);
                            resolve();
                        }
                    });
                };

                preReader.readAsText(file.slice(0, 10240));
            });
        }

        self.postMessage({ type: 'SUCCESS', payload: { data: allData, errors } });
    } catch (err: any) {
        self.postMessage({ type: 'ERROR', payload: err.message });
    }
};
