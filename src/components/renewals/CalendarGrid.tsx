import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { RenewalEntry } from './types';
import { DAY_HEADERS } from './constants';
import { dayKey, formatDate, isSameDay } from './helpers';
import { TermDot } from './TermDot';
import { RenewalDetailRow } from './RenewalDetailRow';

export const CalendarGrid: React.FC<{
    currentMonth: Date;
    setCurrentMonth: React.Dispatch<React.SetStateAction<Date>>;
    today: Date;
    selectedDay: Date | null;
    setSelectedDay: React.Dispatch<React.SetStateAction<Date | null>>;
    calendarCells: (Date | null)[];
    renewalsByDay: Map<string, RenewalEntry[]>;
    selectedDayRenewals: RenewalEntry[];
    expandedRow: string | null;
    setExpandedRow: React.Dispatch<React.SetStateAction<string | null>>;
}> = ({
    currentMonth, setCurrentMonth, today, selectedDay, setSelectedDay,
    calendarCells, renewalsByDay, selectedDayRenewals, expandedRow, setExpandedRow,
}) => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        {/* Month navigation */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <button onClick={() => setCurrentMonth(m => new Date(m.getFullYear(), m.getMonth() - 1, 1))}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', padding: '0.3rem', display: 'flex' }}>
                <ChevronLeft size={20} />
            </button>
            <span style={{ fontWeight: 600, fontSize: '1.05rem', color: 'var(--text-primary)', minWidth: '150px', textAlign: 'center' }}>
                {currentMonth.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })}
            </span>
            <button onClick={() => setCurrentMonth(m => new Date(m.getFullYear(), m.getMonth() + 1, 1))}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', padding: '0.3rem', display: 'flex' }}>
                <ChevronRight size={20} />
            </button>
            <button onClick={() => { setCurrentMonth(new Date(today.getFullYear(), today.getMonth(), 1)); setSelectedDay(null); }}
                style={{ fontSize: '0.8rem', padding: '0.25rem 0.65rem', borderRadius: '6px', border: '1px solid var(--border-color)', background: 'var(--bg-secondary)', color: 'var(--text-secondary)', cursor: 'pointer' }}>
                Today
            </button>
        </div>

        {/* Grid */}
        <div style={{ background: 'var(--bg-secondary)', borderRadius: '12px', border: '1px solid var(--border-color)', overflow: 'hidden' }}>
            {/* Day headers */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', borderBottom: '1px solid var(--border-color)' }}>
                {DAY_HEADERS.map(h => (
                    <div key={h} style={{ padding: '0.5rem', textAlign: 'center', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-tertiary)', letterSpacing: '0.04em' }}>{h}</div>
                ))}
            </div>

            {/* Day cells */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)' }}>
                {calendarCells.map((day, i) => {
                    if (!day) return (
                        <div key={`e${i}`} style={{ minHeight: '80px', borderRight: '1px solid var(--border-color)', borderBottom: '1px solid var(--border-color)', background: 'var(--bg-tertiary)', opacity: 0.4 }} />
                    );
                    const k = dayKey(day);
                    const dayRenewals = renewalsByDay.get(k) ?? [];
                    const isToday = isSameDay(day, today);
                    const isSelected = selectedDay ? isSameDay(day, selectedDay) : false;
                    const isPast = day < today && !isToday;
                    const hasItems = dayRenewals.length > 0;
                    return (
                        <div key={k} onClick={() => hasItems ? setSelectedDay(isSelected ? null : day) : undefined}
                            style={{
                                minHeight: '80px', padding: '0.4rem',
                                borderRight: '1px solid var(--border-color)', borderBottom: '1px solid var(--border-color)',
                                background: isSelected ? 'rgba(99,102,241,0.1)' : isToday ? 'rgba(16,185,129,0.06)' : 'transparent',
                                cursor: hasItems ? 'pointer' : 'default',
                                opacity: isPast ? 0.45 : 1,
                                transition: 'background 0.12s',
                            }}>
                            <div style={{
                                width: 22, height: 22, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                                fontSize: '0.8rem', fontWeight: isToday ? 700 : 400,
                                color: isToday ? '#10B981' : isSelected ? 'var(--accent-primary)' : 'var(--text-secondary)',
                                background: isToday ? 'rgba(16,185,129,0.15)' : 'transparent',
                                marginBottom: '0.3rem',
                            }}>
                                {day.getDate()}
                            </div>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '2px', alignItems: 'center' }}>
                                {dayRenewals.slice(0, 6).map((r, j) => (
                                    <TermDot key={j} category={r.termCategory} size={8} />
                                ))}
                                {dayRenewals.length > 6 && (
                                    <span style={{ fontSize: '0.65rem', color: 'var(--text-tertiary)', lineHeight: '8px' }}>+{dayRenewals.length - 6}</span>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>

        {/* Selected day detail */}
        {selectedDay && (
            <div style={{ background: 'var(--bg-secondary)', borderRadius: '12px', border: '1px solid var(--border-color)', padding: '1rem' }}>
                <div style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '0.75rem' }}>
                    {selectedDayRenewals.length > 0
                        ? `${selectedDayRenewals.length} renewal${selectedDayRenewals.length > 1 ? 's' : ''} on ${formatDate(selectedDay)}`
                        : `No renewals on ${formatDate(selectedDay)}`}
                </div>
                {selectedDayRenewals.length > 0 && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>
                        {selectedDayRenewals.map(r => (
                            <RenewalDetailRow
                                key={r.subscriptionId}
                                renewal={r}
                                isExpanded={expandedRow === r.subscriptionId}
                                onToggle={() => setExpandedRow(expandedRow === r.subscriptionId ? null : r.subscriptionId)}
                            />
                        ))}
                    </div>
                )}
            </div>
        )}
    </div>
);
