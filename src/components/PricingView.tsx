import React, { useEffect, useState, useMemo, useRef } from 'react';
import { usePricingStore } from '../store/pricingStore';
import { useCartStore } from '../store/cartStore';
import { PricingUpload } from './PricingUpload';
import { CartModal } from './CartModal';
import { useVirtualizer } from '@tanstack/react-virtual';
import { PricingToolbar } from './pricing/PricingToolbar';
import { PricingRow } from './pricing/PricingRow';
import type { PriceListCatalogItem } from '../types/PriceListCatalog';
import { getPriceListCatalog } from '../utils/priceListCatalog';
import { fetchPriceListArchive } from '../utils/priceListLoader';

export const PricingView: React.FC = () => {
    const {
        rows, meta, isLoading, loadPricing, clearPricing, importPricingArchive,
        favorites, toggleFavorite,
        comparisonRows, isComparing, loadComparison, loadComparisonFromSnapshot, clearComparison,
        loadComparisonArchive, snapshots
    } = usePricingStore();

    const [searchQuery, setSearchQuery] = useState('');
    const [selectedCurrency, setSelectedCurrency] = useState<string>('EUR');
    const [selectedTerm, setSelectedTerm] = useState<string>('All');
    const [selectedType, setSelectedType] = useState<string>('Commercial');
    const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);
    const [showChangesOnly, setShowChangesOnly] = useState(false);
    const [showMargins, setShowMargins] = useState(false); // New Margin Toggle
    const { quantities, updateQuantity, clearCart: clearStoreCart } = useCartStore();
    const [isCartOpen, setIsCartOpen] = useState(false);
    const [showSnapshotSelector, setShowSnapshotSelector] = useState(false);
    const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
    const [copiedId, setCopiedId] = useState<string | null>(null);
    const [priceLists, setPriceLists] = useState<PriceListCatalogItem[]>([]);
    const [comparisonLabel, setComparisonLabel] = useState<string | null>(null);

    const handleCopy = (text: string, id: string) => {
        navigator.clipboard.writeText(text);
        setCopiedId(id);
        setTimeout(() => setCopiedId(null), 2000);
    };

    const toggleRowExpansion = (id: string, e: React.MouseEvent) => {
        // Prevent toggling when clicking buttons/inputs
        if ((e.target as HTMLElement).closest('button, input, select')) return;

        setExpandedRows(current => {
            const next = new Set(current);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };



    const comparisonInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        loadPricing();
        getPriceListCatalog().then(setPriceLists).catch(() => setPriceLists([]));
    }, [loadPricing]);

    const handleLoadComparisonPriceList = async (item: PriceListCatalogItem) => {
        try {
            const archive = await fetchPriceListArchive(item);
            await loadComparisonArchive(archive);
            setComparisonLabel(item.label);
        } catch {
            setComparisonLabel(null);
        }
    };

    const handleLoadPriceList = async (item: PriceListCatalogItem) => {
        const archive = await fetchPriceListArchive(item);
        await importPricingArchive(archive, { label: item.label, fileName: item.fileName });
    };

    const activePriceListId = priceLists.find(item => item.fileName === meta?.sourceFileName)?.id || '';

    // Comparison Map: ProductId-SkuId-Term-Plan-Currency -> Row
    const comparisonMap = useMemo(() => {
        if (!isComparing) return new Map();
        return new Map(comparisonRows.map(r => [`${r.ProductId}-${r.SkuId}-${r.TermDuration}-${r.BillingPlan}-${r.Currency}`, r]));
    }, [comparisonRows, isComparing]);

    // Calculate cheapest monthly equivalent for each unique product+sku+segment+CURRENCY combination
    const cheapestPriceMap = useMemo(() => {
        const map = new Map<string, number>(); // Key: "ProductTitle|SkuTitle|Segment|Currency", Value: Lowest Normalized Monthly Price

        rows.forEach(row => {
            const key = `${row.ProductTitle}|${row.SkuTitle}|${row.Segment || 'Unknown'}|${row.Currency}`;

            let monthlyPrice = row.ERPPrice;
            // Simple Normalization Logic: P1Y is always annual price, P3Y is triennial.
            if (row.TermDuration === 'P1Y') monthlyPrice /= 12;
            else if (row.TermDuration === 'P3Y') monthlyPrice /= 36;
            // P1M is already monthly price

            // Validation: Ignore zero/invalid prices
            if (!monthlyPrice || monthlyPrice <= 0) return;

            if (!map.has(key) || monthlyPrice < map.get(key)!) {
                map.set(key, monthlyPrice);
            }
        });
        return map;
    }, [rows]);

    // Filtering
    const filteredRows = useMemo(() => {
        return rows.filter(row => {
            const rowId = `${row.ProductId}-${row.SkuId}-${row.TermDuration}-${row.BillingPlan}-${row.Currency}`;

            const matchesSearch = searchQuery === '' ||
                row.ProductTitle.toLowerCase().includes(searchQuery.toLowerCase()) ||
                row.SkuTitle.toLowerCase().includes(searchQuery.toLowerCase()) ||
                row.SkuId.toLowerCase().includes(searchQuery.toLowerCase()) ||
                row.ProductId.toLowerCase().includes(searchQuery.toLowerCase());

            const matchesCurrency = selectedCurrency === 'All' || row.Currency === selectedCurrency;
            const matchesTerm = selectedTerm === 'All' || `${row.TermDuration} (${row.BillingPlan})` === selectedTerm;
            const matchesType = selectedType === 'All' || row.Segment === selectedType;
            const matchesFav = !showFavoritesOnly || favorites.includes(rowId);

            let matchesChange = true;
            if (isComparing && showChangesOnly) {
                const compRow = comparisonMap.get(rowId);
                if (!compRow) matchesChange = true;
                else matchesChange = compRow.UnitPrice !== row.UnitPrice;
            }

            return matchesSearch && matchesCurrency && matchesTerm && matchesType && matchesFav && matchesChange;
        });
    }, [rows, searchQuery, selectedCurrency, selectedTerm, selectedType, showFavoritesOnly, favorites, isComparing, showChangesOnly, comparisonMap]);

    // Unique Select Options
    const currencies = useMemo(() => Array.from(new Set(rows.map(r => r.Currency))).filter(Boolean).sort(), [rows]);
    const terms = useMemo(() => Array.from(new Set(rows.map(r => `${r.TermDuration} (${r.BillingPlan})`))).filter(Boolean).sort(), [rows]);
    const segments = useMemo(() => Array.from(new Set(rows.map(r => r.Segment))).filter(Boolean).sort(), [rows]);

    // Calculator Logic
    const handleQuantityChange = (id: string, qty: string) => {
        const val = parseInt(qty);
        if (!isNaN(val)) {
            updateQuantity(id, val);
        } else {
            updateQuantity(id, 0);
        }
    };

    // Keyed lookup over all rows is O(n) — build it once per catalog change,
    // not on every keystroke in a quantity field
    const rowMap = useMemo(
        () => new Map(rows.map(r => [`${r.ProductId}-${r.SkuId}-${r.TermDuration}-${r.BillingPlan}-${r.Currency}`, r])),
        [rows]
    );

    const cartTotal = useMemo(() => {
        let total = 0;
        let count = 0;

        Object.entries(quantities).forEach(([id, qty]) => {
            const row = rowMap.get(id);
            if (row) {
                // Logic: Always use ERP Price for the total
                const price = row.ERPPrice;
                total += price * qty;
                count++;
            }
        });
        return { total, count };
    }, [quantities, rowMap]);


    // Virtualizer
    const parentRef = React.useRef<HTMLDivElement>(null);
    const rowVirtualizer = useVirtualizer({
        count: filteredRows.length,
        getScrollElement: () => parentRef.current,
        estimateSize: () => 60,
        overscan: 20,
        measureElement: (element) => element?.getBoundingClientRect().height
    });


    const handleCompareUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files.length > 0) {
            setComparisonLabel(null);
            loadComparison(e.target.files[0]);
        }
    };

    if (isLoading) {
        return <div className="flex-center" style={{ height: '50vh' }}>Loading Pricing Catalog...</div>;
    }

    if (!meta || rows.length === 0) {
        return <PricingUpload />;
    }

    return (
        <div className="animate-fade-in" style={{ height: 'calc(100vh - 120px)', display: 'flex', flexDirection: 'column' }}>
            <input
                type="file"
                ref={comparisonInputRef}
                style={{ display: 'none' }}
                accept=".csv"
                onChange={handleCompareUpload}
            />

            {/* Header / Toolbar */}
            <PricingToolbar
                searchQuery={searchQuery}
                setSearchQuery={setSearchQuery}
                showFavoritesOnly={showFavoritesOnly}
                setShowFavoritesOnly={setShowFavoritesOnly}
                showMargins={showMargins}
                setShowMargins={setShowMargins}
                isComparing={isComparing}
                comparisonInputRef={comparisonInputRef}
                showSnapshotSelector={showSnapshotSelector}
                setShowSnapshotSelector={setShowSnapshotSelector}
                snapshots={snapshots}
                loadComparisonFromSnapshot={loadComparisonFromSnapshot}
                priceLists={priceLists}
                activePriceListId={activePriceListId}
                loadPriceList={handleLoadPriceList}
                loadComparisonPriceList={handleLoadComparisonPriceList}
                comparisonLabel={comparisonLabel}
                showChangesOnly={showChangesOnly}
                setShowChangesOnly={setShowChangesOnly}
                clearComparison={clearComparison}
                selectedCurrency={selectedCurrency}
                setSelectedCurrency={setSelectedCurrency}
                currencies={currencies}
                selectedTerm={selectedTerm}
                setSelectedTerm={setSelectedTerm}
                terms={terms}
                selectedType={selectedType}
                setSelectedType={setSelectedType}
                segments={segments}
                cartTotal={cartTotal}
                setIsCartOpen={setIsCartOpen}
                clearStoreCart={clearStoreCart}
                filteredRows={filteredRows}
                meta={meta}
                clearPricing={clearPricing}
            />

            {/* Grid */}
            <div className="glass-panel" ref={parentRef} style={{ flex: 1, overflowY: 'auto', padding: 0, position: 'relative' }}>
                <div
                    style={{
                        height: `${rowVirtualizer.getTotalSize()}px`,
                        width: '100%',
                        position: 'relative',
                    }}
                >
                    {rowVirtualizer.getVirtualItems().map((virtualRow) => {
                        const row = filteredRows[virtualRow.index];
                        const rowId = `${row.ProductId}-${row.SkuId}-${row.TermDuration}-${row.BillingPlan}-${row.Currency}`;
                        const qty = quantities[rowId] || 0;

                        return (
                            <PricingRow
                                key={virtualRow.key}
                                row={row}
                                virtualRow={virtualRow}
                                measureElement={rowVirtualizer.measureElement}
                                qty={qty}
                                isComparing={isComparing}
                                comparisonMap={comparisonMap}
                                showMargins={showMargins}
                                cheapestPriceMap={cheapestPriceMap}
                                favorites={favorites}
                                toggleFavorite={toggleFavorite}
                                expandedRows={expandedRows}
                                toggleRowExpansion={toggleRowExpansion}
                                handleQuantityChange={handleQuantityChange}
                                handleCopy={handleCopy}
                                copiedId={copiedId}
                            />
                        );
                    })}
                </div>
                {
                    filteredRows.length === 0 && (
                        <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-tertiary)' }}>
                            No products found matching your search.
                        </div>
                    )
                }
            </div>

            <CartModal
                isOpen={isCartOpen}
                onClose={() => setIsCartOpen(false)}
            />
        </div>
    );
};
