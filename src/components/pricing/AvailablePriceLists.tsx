import React, { useEffect, useState } from 'react';
import { Calendar, Loader2, PackageOpen } from 'lucide-react';
import type { PriceListCatalogItem } from '../../types/PriceListCatalog';
import { getPriceListCatalog } from '../../utils/priceListCatalog';
import { fetchPriceListArchive } from '../../utils/priceListLoader';
import { usePricingStore } from '../../store/pricingStore';

export const AvailablePriceLists: React.FC = () => {
    const [items, setItems] = useState<PriceListCatalogItem[]>([]);
    const [catalogError, setCatalogError] = useState<string | null>(null);
    const [loadingId, setLoadingId] = useState<string | null>(null);
    const { importPricingArchive } = usePricingStore();

    useEffect(() => {
        getPriceListCatalog()
            .then(setItems)
            .catch(error => setCatalogError(error instanceof Error ? error.message : 'Prijslijsten konden niet worden geladen.'));
    }, []);

    const handleLoad = async (item: PriceListCatalogItem) => {
        setLoadingId(item.id);
        setCatalogError(null);
        try {
            const archive = await fetchPriceListArchive(item);
            await importPricingArchive(archive, { label: item.label, fileName: item.fileName });
        } catch (error) {
            setCatalogError(error instanceof Error ? error.message : `${item.label} kon niet worden ingeladen.`);
        } finally {
            setLoadingId(null);
        }
    };

    if (items.length === 0 && !catalogError) return null;

    return (
        <section style={{ marginBottom: '2rem' }} aria-labelledby="available-price-lists-heading">
            <h3 id="available-price-lists-heading" style={{ color: 'var(--text-secondary)', marginBottom: '0.75rem' }}>
                Beschikbare maandprijslijsten
            </h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.75rem' }}>
                {items.map(item => (
                    <button
                        key={item.id}
                        type="button"
                        onClick={() => void handleLoad(item)}
                        disabled={loadingId !== null}
                        className="glass-panel hover-row"
                        style={{
                            padding: '0.85rem 1rem', display: 'flex', alignItems: 'center', gap: '0.65rem',
                            cursor: loadingId === null ? 'pointer' : 'wait', textAlign: 'left',
                            border: '1px solid var(--border-color)', color: 'var(--text-primary)',
                            opacity: loadingId !== null && loadingId !== item.id ? 0.6 : 1,
                        }}
                    >
                        {loadingId === item.id ? <Loader2 size={18} className="spin" /> : <Calendar size={18} style={{ color: 'var(--brand-turquoise)' }} />}
                        <span style={{ fontWeight: 600 }}>{item.label}</span>
                    </button>
                ))}
            </div>
            {catalogError && (
                <div role="alert" style={{ marginTop: '0.75rem', padding: '0.75rem', background: 'rgba(239, 68, 68, 0.1)', color: 'var(--danger)', borderRadius: '8px' }}>
                    {catalogError}
                </div>
            )}
            <p style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', color: 'var(--text-tertiary)', fontSize: '0.8rem', marginTop: '0.65rem' }}>
                <PackageOpen size={14} /> De gekozen ZIP wordt direct verwerkt; er wordt geen downloadbestand aangeboden.
            </p>
        </section>
    );
};
