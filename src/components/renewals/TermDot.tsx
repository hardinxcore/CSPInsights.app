import React from 'react';
import type { TermCategory } from './types';
import { TERM_COLORS } from './constants';

export const TermDot: React.FC<{ category: TermCategory; size?: number }> = ({ category, size = 8 }) => (
    <span style={{
        display: 'inline-block', width: size, height: size, borderRadius: '50%',
        background: TERM_COLORS[category], flexShrink: 0,
    }} />
);
