import React from 'react';
import { Tag, Check } from 'lucide-react';

interface TagFilterProps {
    availableTags: string[];
    selectedTags: Set<string>;
    setSelectedTags: React.Dispatch<React.SetStateAction<Set<string>>>;
}

export const TagFilter: React.FC<TagFilterProps> = ({
    availableTags,
    selectedTags,
    setSelectedTags,
}) => {
    if (availableTags.length === 0) return null;

    return (
        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem', flexWrap: 'wrap', alignItems: 'center' }}>
            <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-tertiary)', marginRight: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                <Tag size={12} /> Filter by Tags:
            </span>
            {availableTags.map(tag => (
                <button
                    key={tag}
                    onClick={() => {
                        const newSet = new Set(selectedTags);
                        if (newSet.has(tag)) newSet.delete(tag);
                        else newSet.add(tag);
                        setSelectedTags(newSet);
                    }}
                    style={{
                        padding: '4px 10px',
                        borderRadius: '12px',
                        border: '1px solid',
                        fontSize: '0.8rem',
                        cursor: 'pointer',
                        background: selectedTags.has(tag) ? 'var(--brand-turquoise)' : 'transparent',
                        color: selectedTags.has(tag) ? 'white' : 'var(--text-secondary)',
                        borderColor: selectedTags.has(tag) ? 'var(--brand-turquoise)' : 'var(--border-color)',
                        transition: 'all 0.2s',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px'
                    }}
                >
                    {tag}
                    {selectedTags.has(tag) && <Check size={12} />}
                </button>
            ))}
            {selectedTags.size > 0 && (
                <button
                    onClick={() => setSelectedTags(new Set())}
                    style={{ fontSize: '0.8rem', color: 'var(--text-tertiary)', border: 'none', background: 'none', cursor: 'pointer' }}
                >
                    Clear
                </button>
            )}
        </div>
    );
};
