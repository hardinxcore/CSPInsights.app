import React, { useEffect, useState, useMemo, useRef } from 'react';
import { usePricingStore } from '../store/pricingStore';
import { useCartStore } from '../store/cartStore';
import { PricingUpload } from './PricingUpload';
import { CartModal } from './CartModal';
import { Search, Filter, RefreshCw, Star, FileUp, FileMinus, Calculator, History, Download, ShoppingCart, Copy, Check, X } from 'lucide-react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { exportPricingToExcel } from '../utils/excelExport';

export const PricingView: React.FC = () => {
    const {
        rows, meta, isLoading, loadPricing, clearPricing,
        favorites, toggleFavorite,
        comparisonRows, isComparing, loadComparison, loadComparisonFromSnapshot, clearComparison,
        snapshots
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
    }, [loadPricing]);

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

    const cartTotal = useMemo(() => {
        let total = 0;
        let count = 0;
        const rowMap = new Map(rows.map(r => [`${r.ProductId}-${r.SkuId}-${r.TermDuration}-${r.BillingPlan}-${r.Currency}`, r]));

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
    }, [quantities, rows, showMargins]);


    // Virtualizer
    const parentRef = React.useRef<HTMLDivElement>(null);
    const rowVirtualizer = useVirtualizer({
        count: filteredRows.length,
        getScrollElement: () => parentRef.current,
        estimateSize: () => 60,
        overscan: 20,
        measureElement: (element) => element?.getBoundingClientRect().height
    });

    const formatCurrency = (val: number, curr: string) => {
        try {
            return new Intl.NumberFormat('nl-NL', { style: 'currency', currency: curr || 'EUR' }).format(val);
        } catch {
            return `${val} ${curr}`;
        }
    };

    const handleCompareUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files.length > 0) {
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
            <div className="glass-panel" style={{ padding: '1rem', marginBottom: '1rem', display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap', position: 'relative', zIndex: 100 }}>
                <div
                    className="search-bar input-group"
                    style={{
                        flex: 1,
                        minWidth: '300px',
                        display: 'flex',
                        alignItems: 'center',
                        background: 'var(--bg-secondary)',
                        border: '1px solid var(--border-color)',
                        borderRadius: 'var(--radius-md)',
                        padding: '0.5rem 0.75rem',
                        gap: '0.5rem',
                        transition: 'border-color 0.2s, box-shadow 0.2s'
                    }}
                    onFocus={(e) => {
                        e.currentTarget.style.borderColor = 'var(--brand-turquoise)';
                        e.currentTarget.style.boxShadow = '0 0 0 2px rgba(0, 181, 226, 0.2)';
                    }}
                    onBlur={(e) => {
                        e.currentTarget.style.borderColor = 'var(--border-color)';
                        e.currentTarget.style.boxShadow = 'none';
                    }}
                    // Note: Focus events bubble, so focusing input triggers this on div
                    tabIndex={-1}
                >
                    <Search size={18} style={{ color: 'var(--text-tertiary)' }} />
                    <input
                        type="text"
                        placeholder="Search Product, SKU, ID..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        style={{
                            border: 'none',
                            background: 'transparent',
                            outline: 'none',
                            color: 'var(--text-primary)',
                            flex: 1,
                            fontSize: '0.9rem',
                            minWidth: 0
                        }}
                    />
                    {searchQuery && (
                        <button
                            onClick={() => setSearchQuery('')}
                            style={{
                                background: 'var(--bg-tertiary)',
                                border: 'none',
                                borderRadius: '50%',
                                cursor: 'pointer',
                                padding: '2px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                color: 'var(--text-secondary)',
                                width: '20px',
                                height: '20px'
                            }}
                            title="Clear search"
                        >
                            <X size={12} />
                        </button>
                    )}
                </div>

                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                    <Filter size={18} style={{ color: 'var(--text-tertiary)' }} />

                    <button
                        onClick={() => setShowFavoritesOnly(!showFavoritesOnly)}
                        className={`input-field ${showFavoritesOnly ? 'active' : ''}`}
                        style={{
                            padding: '0.5rem',
                            background: showFavoritesOnly ? 'var(--brand-turquoise)' : 'transparent',
                            color: showFavoritesOnly ? 'white' : 'var(--text-primary)',
                            border: showFavoritesOnly ? 'none' : '1px solid var(--border-color)',
                            cursor: 'pointer',
                            display: 'flex', alignItems: 'center', gap: '0.5rem'
                        }}
                        title="Show Favorites Only"
                    >
                        <Star size={16} fill={showFavoritesOnly ? 'white' : 'none'} />
                        {showFavoritesOnly && <span>Favorites</span>}
                    </button>

                    {/* Margin/Sales View Toggle */}
                    <button
                        onClick={() => setShowMargins(!showMargins)}
                        className={`input-field ${showMargins ? 'active' : ''}`}
                        style={{
                            padding: '0.5rem',
                            background: showMargins ? 'var(--brand-orange)' : 'transparent',
                            color: showMargins ? 'white' : 'var(--text-primary)',
                            border: showMargins ? 'none' : '1px solid var(--border-color)',
                            cursor: 'pointer',
                            display: 'flex', alignItems: 'center', gap: '0.5rem',
                            boxShadow: showMargins ? '0 2px 4px rgba(0,0,0,0.1)' : 'none'
                        }}
                        title={showMargins ? "Disable Margins View" : "Enable Margins View"}
                    >
                        {showMargins ? <FileMinus size={16} /> : <Calculator size={16} />}
                        <span>Margins</span>
                    </button>

                    {/* Comparison Controls */}
                    {!isComparing ? (
                        <div style={{ position: 'relative', display: 'flex', gap: '0.5rem' }}>
                            <button
                                onClick={() => comparisonInputRef.current?.click()}
                                className="input-field"
                                style={{ padding: '0.5rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem' }}
                                title="Compare with another price list file"
                            >
                                <FileUp size={16} />
                                <span>Compare File</span>
                            </button>

                            <button
                                onClick={() => setShowSnapshotSelector(!showSnapshotSelector)}
                                className="input-field"
                                style={{ padding: '0.5rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem' }}
                                title="Compare with a saved snapshot"
                            >
                                <History size={16} />
                                <span>Compare Snapshot</span>
                            </button>

                            {/* Snapshot Selector Dropdown */}
                            {showSnapshotSelector && (
                                <div className="glass-panel" style={{
                                    position: 'absolute', top: '100%', left: 0, marginTop: '0.5rem',
                                    zIndex: 100, minWidth: '250px', padding: '0.5rem',
                                    boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
                                    display: 'flex', flexDirection: 'column', gap: '0.25rem'
                                }}>
                                    <div style={{ fontSize: '0.8rem', fontWeight: 600, padding: '0.5rem', color: 'var(--text-tertiary)' }}>
                                        Select Snapshot to Compare
                                    </div>
                                    {snapshots.length === 0 ? (
                                        <div style={{ padding: '0.5rem', color: 'var(--text-tertiary)', fontSize: '0.9rem' }}>
                                            No snapshots saved.
                                        </div>
                                    ) : (
                                        snapshots.map(snap => (
                                            <button
                                                key={snap.id}
                                                className="hover-row"
                                                onClick={() => {
                                                    loadComparisonFromSnapshot(snap.id);
                                                    setShowSnapshotSelector(false);
                                                }}
                                                style={{
                                                    background: 'none', border: 'none', textAlign: 'left',
                                                    padding: '0.5rem', borderRadius: '4px', cursor: 'pointer',
                                                    display: 'flex', flexDirection: 'column',
                                                    color: 'var(--text-primary)'
                                                }}
                                            >
                                                <span style={{ fontWeight: 500 }}>{snap.name || 'Untitled'}</span>
                                                <span style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>
                                                    {new Date(snap.updatedAt).toLocaleDateString()}
                                                </span>
                                            </button>
                                        ))
                                    )}
                                </div>
                            )}
                        </div>
                    ) : (
                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                            <button
                                onClick={() => setShowChangesOnly(!showChangesOnly)}
                                className={`input-field ${showChangesOnly ? 'active' : ''}`}
                                style={{
                                    padding: '0.5rem',
                                    background: showChangesOnly ? 'var(--brand-turquoise)' : 'transparent',
                                    color: showChangesOnly ? 'white' : 'var(--text-primary)',
                                    cursor: 'pointer',
                                    fontSize: '0.85rem'
                                }}
                            >
                                Changes Only
                            </button>
                            <button
                                onClick={clearComparison}
                                className="input-field"
                                style={{ padding: '0.5rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--error-color)', borderColor: 'var(--error-color)' }}
                                title="Stop Comparison"
                            >
                                <FileMinus size={16} />
                            </button>
                        </div>
                    )}

                    <select
                        className="input-field"
                        value={selectedCurrency}
                        onChange={(e) => setSelectedCurrency(e.target.value)}
                        style={{ padding: '0.5rem' }}
                    >
                        <option value="All">All Currencies</option>
                        {currencies.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>

                    <select
                        className="input-field"
                        value={selectedTerm}
                        onChange={(e) => setSelectedTerm(e.target.value)}
                        style={{ padding: '0.5rem' }}
                    >
                        <option value="All">All Terms</option>
                        {terms.map(t => <option key={t} value={t}>{t}</option>)}
                    </select>

                    <select
                        className="input-field"
                        value={selectedType}
                        onChange={(e) => setSelectedType(e.target.value)}
                        style={{ padding: '0.5rem' }}
                    >
                        <option value="All">All Segments</option>
                        {segments.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                </div>

                <div style={{ marginLeft: 'auto', display: 'flex', gap: '1rem', alignItems: 'center' }}>
                    {cartTotal.count > 0 && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <button
                                className="btn-primary"
                                style={{
                                    background: 'var(--brand-turquoise)',
                                    color: 'white',
                                    fontWeight: 700,
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '0.75rem',
                                    padding: '0.75rem 1.25rem',
                                    borderRadius: '8px',
                                    border: 'none',
                                    boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
                                    transition: 'transform 0.1s ease, box-shadow 0.1s ease'
                                }}
                                onClick={() => setIsCartOpen(true)}
                                title="View Shopping Cart"
                                onMouseEnter={(e) => {
                                    e.currentTarget.style.transform = 'translateY(-1px)';
                                    e.currentTarget.style.boxShadow = '0 6px 8px rgba(0,0,0,0.15)';
                                }}
                                onMouseLeave={(e) => {
                                    e.currentTarget.style.transform = 'none';
                                    e.currentTarget.style.boxShadow = '0 4px 6px rgba(0,0,0,0.1)';
                                }}
                            >
                                <ShoppingCart size={20} />
                                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', lineHeight: 1 }}>
                                    <span style={{ fontSize: '0.75rem', fontWeight: 500, opacity: 0.9 }}>{showMargins ? "Sales Total" : "Total"}</span>
                                    <span style={{ fontSize: '1rem' }}>{new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR' }).format(cartTotal.total)}</span>
                                </div>
                            </button>
                            <button
                                onClick={clearStoreCart}
                                className="text-btn"
                                style={{ fontSize: '0.8rem', color: 'var(--text-tertiary)', textDecoration: 'underline', cursor: 'pointer', background: 'none', border: 'none' }}
                                title="Clear all quantities"
                            >
                                Clear
                            </button>
                        </div>
                    )}

                    <button
                        onClick={() => exportPricingToExcel(filteredRows, showMargins)}
                        className="input-field"
                        style={{ padding: '0.5rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem' }}
                        title="Download current filtered list to Excel"
                    >
                        <Download size={16} />
                        <span>Export</span>
                    </button>

                    <div style={{ fontSize: '0.85rem', color: 'var(--text-tertiary)' }}>
                        {filteredRows.length} items
                        {meta && ` • Updated: ${new Date(meta.lastUpdated).toLocaleDateString()}`}
                    </div>
                    <button onClick={clearPricing} style={{ color: 'var(--accent-secondary)', textDecoration: 'underline', cursor: 'pointer', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                        <RefreshCw size={14} /> Clear and update New File
                    </button>
                </div>
            </div>

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
                        // Logic: Always use ERP Price for the line total display, as that is the primary "Sales Price".
                        const lineTotal = qty * row.ERPPrice;

                        // Comparison Logic
                        // Comparison Logic
                        const compRow = isComparing ? comparisonMap.get(rowId) : null;

                        // If showing margins, we care about UnitPrice (Cost) changes.
                        // If standard view (requested by user), we assume they want to see ERP Price changes.
                        const currentPrice = showMargins ? row.UnitPrice : row.ERPPrice;
                        const compPrice = compRow ? (showMargins ? compRow.UnitPrice : compRow.ERPPrice) : 0;

                        const priceDiff = compRow ? compPrice - currentPrice : 0;
                        const isNew = isComparing && !compRow;
                        const hasChange = isComparing && (isNew || Math.abs(priceDiff) > 0.001);
                        const diffPercent = (currentPrice > 0) ? (priceDiff / currentPrice) * 100 : 0;

                        // Margin Logic
                        const margin = row.ERPPrice - row.UnitPrice;
                        const marginPercent = row.ERPPrice > 0 ? (margin / row.ERPPrice) * 100 : 0;

                        return (
                            <div
                                key={virtualRow.key}
                                style={{
                                    position: 'absolute',
                                    top: 0,
                                    left: 0,
                                    width: '100%',

                                    transform: `translateY(${virtualRow.start}px)`,
                                    padding: '0.75rem 1rem',
                                    borderBottom: '1px solid var(--border-color)',
                                    display: 'flex',

                                    gap: '1rem',
                                    fontSize: '0.9rem',
                                    background: hasChange ? 'rgba(255, 165, 0, 0.05)' : (qty > 0 ? 'rgba(0, 120, 212, 0.03)' : 'transparent'),
                                    flexDirection: 'column',
                                    alignItems: 'stretch',
                                    height: 'auto',
                                    minHeight: '60px',
                                    cursor: 'pointer'
                                }}
                                className="hover-row"
                                ref={rowVirtualizer.measureElement}
                                data-index={virtualRow.index}
                                onClick={(e) => toggleRowExpansion(rowId, e)}
                            >
                                <div style={{ display: 'flex', width: '100%', alignItems: 'center', gap: '1rem' }}>
                                    <div style={{ flex: 2, minWidth: 0, display: 'flex', gap: '1rem', alignItems: 'center' }}>
                                        <button
                                            onClick={() => toggleFavorite(rowId)}
                                            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--brand-turquoise)' }}
                                        >
                                            <Star size={18} fill={favorites.includes(rowId) ? 'var(--brand-turquoise)' : 'none'} color={favorites.includes(rowId) ? 'var(--brand-turquoise)' : 'var(--text-tertiary)'} />
                                        </button>

                                        <div>
                                            <div style={{ fontWeight: 600, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                                {row.ProductTitle}
                                                {row.Segment && <span className="chip" style={{ fontSize: '0.7rem' }}>{row.Segment}</span>}
                                                {isNew && <span className="chip" style={{ background: 'var(--brand-turquoise)', color: 'white' }}>NEW</span>}
                                            </div>
                                            <div style={{ fontSize: '0.8rem', color: 'var(--text-tertiary)' }} className="truncate">
                                                {row.SkuTitle} • {row.SkuId}
                                            </div>
                                        </div>
                                    </div>

                                    <div style={{ width: '120px' }}>
                                        <div style={{ fontSize: '0.8rem', color: 'var(--text-tertiary)' }}>Term</div>
                                        <div style={{ fontWeight: 500 }}>{row.TermDuration} ({row.BillingPlan})</div>
                                    </div>

                                    {/* MARGIN VIEW COLUMNS */}
                                    {showMargins ? (
                                        <>
                                            {/* Inkoop */}
                                            <div style={{ width: '100px', textAlign: 'right' }}>
                                                <div style={{ fontSize: '0.8rem', color: 'var(--text-tertiary)' }}>Unit Price</div>
                                                <div style={{ fontWeight: 500 }}>{formatCurrency(row.UnitPrice, row.Currency)}</div>
                                            </div>

                                            {/* Verkoop (Advies) */}
                                            <div style={{ width: '100px', textAlign: 'right' }}>
                                                <div style={{ fontSize: '0.8rem', color: 'var(--text-tertiary)' }}>ERP Price</div>
                                                <div style={{ fontWeight: 500 }}>{formatCurrency(row.ERPPrice, row.Currency)}</div>
                                            </div>

                                            {/* Margin */}
                                            <div style={{ width: '100px', textAlign: 'right' }}>
                                                <div style={{ fontSize: '0.8rem', color: 'var(--text-tertiary)' }}>Margin</div>
                                                <div style={{
                                                    fontWeight: 600,
                                                    color: margin > 0 ? 'var(--success-color)' : 'var(--error-color)'
                                                }}>
                                                    {formatCurrency(margin, row.Currency)} ({marginPercent.toFixed(1)}%)
                                                </div>
                                            </div>
                                        </>
                                    ) : (
                                        <>
                                            {/* STANDARD VIEW COLUMNS */}
                                            {isComparing && (
                                                <div style={{ width: '100px', textAlign: 'right', opacity: 1 }}>
                                                    <div style={{ fontSize: '0.8rem', color: 'var(--brand-turquoise)' }}>New Price</div>
                                                    <div style={{ fontSize: '0.85rem', fontWeight: 600 }}>
                                                        {compRow ? formatCurrency(compRow.ERPPrice, compRow.Currency) : '-'}
                                                    </div>
                                                </div>
                                            )}

                                            <div style={{ width: '100px', textAlign: 'right', position: 'relative' }}>
                                                <div style={{ fontSize: '0.8rem', color: 'var(--text-tertiary)' }}>ERP Price</div>
                                                <div style={{ fontWeight: 600, color: hasChange ? (priceDiff > 0 ? 'var(--error-color)' : 'var(--success-color)') : 'var(--brand-turquoise)' }}>
                                                    {formatCurrency(row.ERPPrice, row.Currency)}
                                                </div>

                                                {/* (Existing Monthly Equivalent logic) */}
                                                {row.TermDuration === 'P1Y' && (
                                                    <div style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>
                                                        {formatCurrency(row.ERPPrice / 12, row.Currency)} /mo
                                                    </div>
                                                )}

                                                {/* Price Premium / Best Value Indicator */}
                                                {/* Using an IIFE or inline logic to keep clean */}
                                                {(() => {
                                                    const key = `${row.ProductTitle}|${row.SkuTitle}|${row.Segment || 'Unknown'}|${row.Currency}`;
                                                    // @ts-ignore - access useMemo map
                                                    const minPrice = cheapestPriceMap.get(key);

                                                    if (minPrice && minPrice > 0) {
                                                        let myMonthly = row.ERPPrice;
                                                        if (row.TermDuration === 'P1Y') myMonthly /= 12;
                                                        else if (row.TermDuration === 'P3Y') myMonthly /= 36;

                                                        // Check if significantly more expensive (> 1%)
                                                        if (myMonthly > (minPrice * 1.01)) {
                                                            const pct = ((myMonthly - minPrice) / minPrice) * 100;
                                                            return (
                                                                <div className="chip" style={{
                                                                    position: 'absolute',
                                                                    top: '-4px',
                                                                    right: '0',
                                                                    background: 'rgba(234, 179, 8, 0.1)',
                                                                    color: '#b45309',
                                                                    fontSize: '0.65rem',
                                                                    fontWeight: 600,
                                                                    padding: '0 4px',
                                                                    borderRadius: '4px',
                                                                    lineHeight: '1.2'
                                                                }}>
                                                                    +{pct.toFixed(0)}%
                                                                </div>
                                                            );
                                                        }
                                                    }
                                                    return null;
                                                })()}
                                            </div>


                                            {isComparing && (
                                                <div style={{ width: '80px', textAlign: 'right', fontSize: '0.85rem' }}>
                                                    <div style={{ fontSize: '0.8rem', color: 'var(--text-tertiary)' }}>Diff</div>
                                                    {Math.abs(priceDiff) > 0.001 ? (
                                                        <div style={{ color: priceDiff > 0 ? 'var(--error-color)' : 'var(--success-color)', fontWeight: 600 }}>
                                                            {priceDiff > 0 ? '+' : ''}{diffPercent.toFixed(1)}%
                                                        </div>
                                                    ) : (
                                                        <div style={{ color: 'var(--text-tertiary)' }}>-</div>
                                                    )}
                                                </div>
                                            )}
                                        </>
                                    )
                                    }

                                    {/* Calculator Inputs */}
                                    <div style={{ width: '200px', display: 'flex', alignItems: 'center', gap: '0.5rem', justifyContent: 'flex-end' }}>
                                        <div style={{ textAlign: 'right', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.25rem' }}>
                                            <div style={{ fontSize: '0.8rem', color: 'var(--text-tertiary)' }}>Qty</div>
                                            <div style={{ display: 'flex', alignItems: 'center', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)', overflow: 'hidden' }}>
                                                <button
                                                    onClick={() => handleQuantityChange(rowId, (qty - 1).toString())}
                                                    style={{ padding: '0.25rem 0.5rem', cursor: 'pointer', background: 'var(--bg-secondary)', border: 'none', borderRight: '1px solid var(--border-color)', color: 'var(--text-primary)' }}
                                                    disabled={qty <= 0}
                                                >
                                                    -
                                                </button>
                                                <input
                                                    type="number"
                                                    min="0"
                                                    value={qty || ''}
                                                    onChange={(e) => handleQuantityChange(rowId, e.target.value)}
                                                    placeholder="0"
                                                    style={{ width: '40px', padding: '0.25rem', textAlign: 'center', border: 'none', outline: 'none', background: 'transparent' }}
                                                />
                                                <button
                                                    onClick={() => handleQuantityChange(rowId, (qty + 1).toString())}
                                                    style={{ padding: '0.25rem 0.5rem', cursor: 'pointer', background: 'var(--brand-turquoise)', border: 'none', borderLeft: '1px solid var(--border-color)', color: 'white', fontWeight: 'bold' }}
                                                >
                                                    +
                                                </button>
                                            </div>
                                        </div>
                                        <div style={{ textAlign: 'right', minWidth: '80px' }}>
                                            <div style={{ fontSize: '0.8rem', color: 'var(--text-tertiary)' }}>Total</div>
                                            <div style={{ fontWeight: qty > 0 ? 700 : 400, color: qty > 0 ? 'var(--text-primary)' : 'var(--text-tertiary)' }}>
                                                {qty > 0 ? formatCurrency(lineTotal, row.Currency) : '-'}
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Expanded Detail Panel */}
                                {expandedRows.has(rowId) && (
                                    <div className="animate-fade-in" style={{
                                        marginTop: '1rem',
                                        padding: '1rem',
                                        background: 'var(--bg-secondary)',
                                        border: '1px solid var(--border-color)',
                                        borderRadius: 'var(--radius-md)',
                                        width: '100%',
                                        display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem',
                                        cursor: 'default'
                                    }}>
                                        <div style={{ gridColumn: '1 / -1' }}>
                                            <span style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>SKU Title</span>
                                            <span style={{ fontWeight: 600, fontSize: '1rem' }}>{row.SkuTitle}</span>
                                        </div>
                                        <div>
                                            <span style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>Product ID</span>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                                <span className="mono">{row.ProductId}</span>
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        handleCopy(row.ProductId, row.ProductId);
                                                    }}
                                                    className="icon-btn"
                                                    title="Copy Product ID"
                                                    style={{ padding: '2px', height: 'auto' }}
                                                >
                                                    {copiedId === row.ProductId ? <Check size={14} color="var(--success)" /> : <Copy size={14} />}
                                                </button>
                                            </div>
                                        </div>
                                        <div>
                                            <span style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>SKU ID</span>
                                            <span className="mono">{row.SkuId}</span>
                                        </div>
                                        <div style={{ gridColumn: '1 / -1' }}>
                                            <span style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>Description</span>
                                            <span>{row.SkuDescription}</span>
                                        </div>
                                        <div>
                                            <span style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>Segment</span>
                                            <span>{row.Segment}</span>
                                        </div>
                                        <div>
                                            <span style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>Unit Type</span>
                                            <span>{row.UnitOfMeasure}</span>
                                        </div>
                                        <div>
                                            <span style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>Currency</span>
                                            <span>{row.Currency}</span>
                                        </div>
                                        <div>
                                            <span style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>Effective Date</span>
                                            <span>{row.EffectiveStartDate ? new Date(row.EffectiveStartDate).toLocaleDateString() : '-'}</span>
                                        </div>
                                    </div>
                                )}
                            </div>
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
