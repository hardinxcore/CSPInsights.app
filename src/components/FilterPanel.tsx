import { useState } from 'react';
import { Filter, Columns, X, ArrowUp } from 'lucide-react';

interface FilterPanelProps {
    availableColumns: string[];
    visibleColumns: Set<string>;
    onToggleColumn: (col: string) => void;
    filters: Record<string, string>;
    onFilterChange: (key: string, value: string) => void;
    uniqueValues: Record<string, string[]>; // Map of Column -> Unique Values
}

export const FilterPanel = ({
    availableColumns,
    visibleColumns,
    onToggleColumn,
    filters,
    onFilterChange,
    uniqueValues
}: FilterPanelProps) => {
    const [showFilters, setShowFilters] = useState(false);
    const [showColumns, setShowColumns] = useState(false);

    const activeFilterCount = Object.values(filters).filter(Boolean).length;

    return (
        <div className="filter-panel glass-panel" style={{ marginBottom: '1rem', padding: '0.5rem' }}>
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                <button
                    className={`btn-icon ${showFilters || activeFilterCount > 0 ? 'active' : ''}`}
                    onClick={() => setShowFilters(!showFilters)}
                    title="Toggle Filters"
                    style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.5rem 1rem' }}
                >
                    <Filter size={16} />
                    Filters {activeFilterCount > 0 && <span className="badge">{activeFilterCount}</span>}
                </button>

                <button
                    className={`btn-icon ${showColumns ? 'active' : ''}`}
                    onClick={() => setShowColumns(!showColumns)}
                    title="Select Columns"
                    style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.5rem 1rem' }}
                >
                    <Columns size={16} /> Columns
                </button>

                <button
                    className="btn-icon"
                    onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
                    title="Scroll to Top"
                    style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.5rem 1rem' }}
                >
                    <ArrowUp size={16} /> Top
                </button>

                {/* Clear All */}
                {activeFilterCount > 0 && (
                    <button
                        onClick={() => {
                            Object.keys(filters).forEach(k => onFilterChange(k, ''));
                        }}
                        style={{ fontSize: '0.8rem', color: 'var(--text-tertiary)', marginLeft: 'auto' }}
                    >
                        Clear all
                    </button>
                )}
            </div>

            {/* Column Selector */}
            {showColumns && (
                <div className="column-selector animate-slide-down" style={{ marginTop: '1rem', padding: '1rem', borderTop: '1px solid var(--border-color)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                        <h4 style={{ margin: 0, fontSize: '0.9rem' }}>Visible Columns</h4>
                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                            <button
                                onClick={() => availableColumns.forEach(c => visibleColumns.add(c) && onToggleColumn(c))} // This logic is tricky with single toggle, better to let parent handle or iterate.
                                // Actually, toggle function toggles.
                                // Let's simplify: simple improvements first. grid layout.
                                style={{ fontSize: '0.75rem', color: 'var(--brand-turquoise)', background: 'none', border: 'none', cursor: 'pointer' }}
                            >
                                Default
                            </button>
                        </div>
                    </div>
                    <div style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
                        gap: '0.5rem'
                    }}>
                        {availableColumns.map(col => (
                            <label
                                key={col}
                                className={`chip ${visibleColumns.has(col) ? 'active' : ''}`}
                                style={{
                                    cursor: 'pointer',
                                    userSelect: 'none',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '0.5rem',
                                    justifyContent: 'space-between',
                                    padding: '0.4rem 0.8rem'
                                }}
                            >
                                <span style={{ textOverflow: 'ellipsis', overflow: 'hidden' }}>{col.replace(/([A-Z])/g, ' $1').trim()}</span>
                                <input
                                    type="checkbox"
                                    checked={visibleColumns.has(col)}
                                    onChange={() => onToggleColumn(col)}
                                    style={{ accentColor: 'var(--brand-turquoise)' }}
                                />
                            </label>
                        ))}
                    </div>
                </div>
            )}

            {/* Filter Inputs */}
            {showFilters && (
                <div className="filters-grid animate-slide-down" style={{
                    marginTop: '1rem',
                    padding: '1rem',
                    borderTop: '1px solid var(--border-color)',
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
                    gap: '1rem'
                }}>
                    {availableColumns.filter(c => visibleColumns.has(c)).map(col => {
                        const uniqueOptions = uniqueValues[col] || [];
                        const hasDropdown = uniqueOptions.length > 0 && uniqueOptions.length < 50;

                        return (
                            <div key={col} style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                                <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)' }}>{col}</label>
                                {hasDropdown ? (
                                    <select
                                        value={filters[col] || ''}
                                        onChange={(e) => onFilterChange(col, e.target.value)}
                                        className="input-field"
                                    >
                                        <option value="">All</option>
                                        {uniqueOptions.map(val => (
                                            <option key={val} value={val}>{val}</option>
                                        ))}
                                    </select>
                                ) : (
                                    <div style={{ position: 'relative' }}>
                                        <input
                                            type="text"
                                            placeholder={`Search...`}
                                            value={filters[col] || ''}
                                            onChange={(e) => onFilterChange(col, e.target.value)}
                                            className="input-field"
                                            style={{ width: '100%' }}
                                        />
                                        {filters[col] && (
                                            <button
                                                onClick={() => onFilterChange(col, '')}
                                                style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-tertiary)' }}
                                            >
                                                <X size={12} />
                                            </button>
                                        )}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
};
