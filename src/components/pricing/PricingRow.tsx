import React from 'react';
import { Star, Copy, Check } from 'lucide-react';
import type { VirtualItem } from '@tanstack/react-virtual';
import type { PriceRow } from '../../types/PricingData';
import { formatCurrency } from '../../utils/format';

interface PricingRowProps {
    row: PriceRow;
    virtualRow: VirtualItem;
    measureElement: (node: Element | null) => void;
    qty: number;
    isComparing: boolean;
    comparisonMap: Map<string, PriceRow>;
    cheapestPriceMap: Map<string, number>;
    favorites: string[];
    toggleFavorite: (compositeKey: string) => void;
    expandedRows: Set<string>;
    toggleRowExpansion: (id: string, e: React.MouseEvent) => void;
    handleQuantityChange: (id: string, qty: string) => void;
    handleCopy: (text: string, id: string) => void;
    copiedId: string | null;
}

export const PricingRow: React.FC<PricingRowProps> = ({
    row,
    virtualRow,
    measureElement,
    qty,
    isComparing,
    comparisonMap,
    cheapestPriceMap,
    favorites,
    toggleFavorite,
    expandedRows,
    toggleRowExpansion,
    handleQuantityChange,
    handleCopy,
    copiedId,
}) => {
    const rowId = `${row.ProductId}-${row.SkuId}-${row.TermDuration}-${row.BillingPlan}-${row.Currency}`;
    // Logic: Always use ERP Price for the line total display, as that is the primary "Sales Price".
    const lineTotal = qty * row.ERPPrice;

    // Comparison Logic
    // Comparison Logic
    const compRow = isComparing ? comparisonMap.get(rowId) : null;

    // Only the ERP (retail/sell) price is ever shown; the purchase price is hidden.
    const currentPrice = row.ERPPrice;
    const compPrice = compRow ? compRow.ERPPrice : 0;

    const priceDiff = compRow ? compPrice - currentPrice : 0;
    const isNew = isComparing && !compRow;
    const hasChange = isComparing && (isNew || Math.abs(priceDiff) > 0.001);
    const diffPercent = (currentPrice > 0) ? (priceDiff / currentPrice) * 100 : 0;

    return (
        <div
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
            ref={measureElement}
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

                {/* STANDARD VIEW COLUMNS (ERP / sell price only) */}
                <>
                        {isComparing && (
                            <div style={{ width: '100px', textAlign: 'right', opacity: 1 }}>
                                <div style={{ fontSize: '0.8rem', color: 'var(--brand-turquoise)' }}>Comparison Price</div>
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
};
