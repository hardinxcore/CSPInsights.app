import React from 'react';
import { Search, Filter, RefreshCw, Star, FileUp, FileMinus, Calculator, History, Download, ShoppingCart, X } from 'lucide-react';
import type { PriceRow, PricingMeta, SnapshotItem } from '../../types/PricingData';
import { exportPricingToExcel } from '../../utils/excelExport';
import { formatCurrency } from '../../utils/format';
import type { PriceListCatalogItem } from '../../types/PriceListCatalog';

interface PricingToolbarProps {
    searchQuery: string;
    setSearchQuery: React.Dispatch<React.SetStateAction<string>>;
    showFavoritesOnly: boolean;
    setShowFavoritesOnly: React.Dispatch<React.SetStateAction<boolean>>;
    showMargins: boolean;
    setShowMargins: React.Dispatch<React.SetStateAction<boolean>>;
    isComparing: boolean;
    comparisonInputRef: React.RefObject<HTMLInputElement | null>;
    showSnapshotSelector: boolean;
    setShowSnapshotSelector: React.Dispatch<React.SetStateAction<boolean>>;
    snapshots: SnapshotItem[];
    loadComparisonFromSnapshot: (id: string) => Promise<boolean>;
    priceLists: PriceListCatalogItem[];
    loadComparisonPriceList: (item: PriceListCatalogItem) => Promise<void>;
    comparisonLabel: string | null;
    showChangesOnly: boolean;
    setShowChangesOnly: React.Dispatch<React.SetStateAction<boolean>>;
    clearComparison: () => void;
    selectedCurrency: string;
    setSelectedCurrency: React.Dispatch<React.SetStateAction<string>>;
    currencies: string[];
    selectedTerm: string;
    setSelectedTerm: React.Dispatch<React.SetStateAction<string>>;
    terms: string[];
    selectedType: string;
    setSelectedType: React.Dispatch<React.SetStateAction<string>>;
    segments: string[];
    cartTotal: { total: number; count: number };
    setIsCartOpen: React.Dispatch<React.SetStateAction<boolean>>;
    clearStoreCart: () => void;
    filteredRows: PriceRow[];
    meta: PricingMeta | null;
    clearPricing: () => Promise<void>;
}

export const PricingToolbar: React.FC<PricingToolbarProps> = ({
    searchQuery,
    setSearchQuery,
    showFavoritesOnly,
    setShowFavoritesOnly,
    showMargins,
    setShowMargins,
    isComparing,
    comparisonInputRef,
    showSnapshotSelector,
    setShowSnapshotSelector,
    snapshots,
    loadComparisonFromSnapshot,
    priceLists,
    loadComparisonPriceList,
    comparisonLabel,
    showChangesOnly,
    setShowChangesOnly,
    clearComparison,
    selectedCurrency,
    setSelectedCurrency,
    currencies,
    selectedTerm,
    setSelectedTerm,
    terms,
    selectedType,
    setSelectedType,
    segments,
    cartTotal,
    setIsCartOpen,
    clearStoreCart,
    filteredRows,
    meta,
    clearPricing,
}) => {
    return (
        <div className="glass-panel" style={{ padding: '1rem', marginBottom: '1rem', display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap', position: 'relative', zIndex: 100 }}>
            {meta && (
                <div
                    title={meta.sourceFileName || 'Current pricing catalog'}
                    style={{
                        flexBasis: '100%', display: 'flex', alignItems: 'center', gap: '0.45rem',
                        color: 'var(--text-secondary)', fontSize: '0.85rem',
                    }}
                >
                    <span style={{ color: 'var(--brand-turquoise)', fontWeight: 700 }}>Active price list:</span>
                    <strong style={{ color: 'var(--text-primary)' }}>{meta.sourceLabel || 'Imported CSV'}</strong>
                </div>
            )}
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

                        <select
                            className="input-field"
                            aria-label="Compare with monthly price list"
                            value=""
                            onChange={(event) => {
                                const item = priceLists.find(priceList => priceList.id === event.target.value);
                                if (item) void loadComparisonPriceList(item);
                            }}
                            style={{ padding: '0.5rem', maxWidth: '220px' }}
                        >
                            <option value="">Compare month…</option>
                            {priceLists.map(item => <option key={item.id} value={item.id}>{item.label}</option>)}
                        </select>

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
                        {comparisonLabel && (
                            <span style={{ alignSelf: 'center', color: 'var(--text-secondary)', fontSize: '0.8rem' }}>
                                Comparing: <strong>{comparisonLabel}</strong>
                            </span>
                        )}
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
                                <span style={{ fontSize: '1rem' }}>{formatCurrency(cartTotal.total)}</span>
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
                    {meta && ` • ${meta.sourceLabel ? `Catalog: ${meta.sourceLabel} • ` : ''}Updated: ${new Date(meta.lastUpdated).toLocaleDateString()}`}
                </div>
                <button onClick={clearPricing} style={{ color: 'var(--accent-secondary)', textDecoration: 'underline', cursor: 'pointer', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                    <RefreshCw size={14} /> Clear and update New File
                </button>
            </div>
        </div>
    );
};
