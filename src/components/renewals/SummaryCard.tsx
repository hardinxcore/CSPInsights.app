import React from 'react';

export const SummaryCard: React.FC<{
    icon: React.ReactNode; color: string;
    label: string; value: string; sub: string; alert?: boolean;
}> = ({ icon, color, label, value, sub, alert }) => (
    <div style={{
        background: 'var(--bg-secondary)', borderRadius: '12px', padding: '1rem 1.25rem',
        border: `1px solid ${alert ? color + '55' : 'var(--border-color)'}`,
        display: 'flex', gap: '0.75rem', alignItems: 'flex-start',
    }}>
        <div style={{ color, marginTop: '0.1rem', flexShrink: 0 }}>{icon}</div>
        <div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', marginBottom: '0.25rem' }}>{label}</div>
            <div style={{ fontSize: '1.4rem', fontWeight: 700, color: alert ? color : 'var(--text-primary)', lineHeight: 1 }}>{value}</div>
            <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>{sub}</div>
        </div>
    </div>
);
