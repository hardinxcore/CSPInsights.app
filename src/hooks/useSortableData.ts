import { useMemo, useState } from 'react';

export type SortDirection = 'asc' | 'desc';

export interface SortConfig<K extends string = string> {
    key: K;
    direction: SortDirection;
}

/**
 * Generic comparator used by every sortable table in the app.
 * Numbers sort numerically, everything else via localeCompare;
 * null/undefined always sort last.
 */
export const compareValues = (a: unknown, b: unknown, direction: SortDirection): number => {
    const dir = direction === 'asc' ? 1 : -1;
    const aEmpty = a === null || a === undefined || a === '';
    const bEmpty = b === null || b === undefined || b === '';
    if (aEmpty && bEmpty) return 0;
    if (aEmpty) return 1;
    if (bEmpty) return -1;
    if (typeof a === 'number' && typeof b === 'number') return (a - b) * dir;
    return String(a).localeCompare(String(b)) * dir;
};

/**
 * Shared sorting state + memoized sorted copy. Replaces the per-component
 * sort implementations that used to be duplicated across the tables.
 *
 * `toggleSort(key)` starts a column at `defaultDirection` and flips it on
 * repeated clicks — matching the existing behaviour of the app's tables.
 */
export function useSortableData<T extends object>(
    items: T[],
    initial: SortConfig<Extract<keyof T, string>> | null = null,
    defaultDirection: SortDirection = 'desc'
) {
    const [sortConfig, setSortConfig] = useState<SortConfig<Extract<keyof T, string>> | null>(initial);

    const sorted = useMemo(() => {
        if (!sortConfig) return items;
        const { key, direction } = sortConfig;
        return [...items].sort((x, y) =>
            compareValues((x as Record<string, unknown>)[key], (y as Record<string, unknown>)[key], direction)
        );
    }, [items, sortConfig]);

    const toggleSort = (key: Extract<keyof T, string>) =>
        setSortConfig(current =>
            current && current.key === key
                ? { key, direction: current.direction === 'desc' ? 'asc' : 'desc' }
                : { key, direction: defaultDirection }
        );

    return { sorted, sortConfig, toggleSort, setSortConfig };
}
