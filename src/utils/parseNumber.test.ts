import { describe, it, expect } from 'vitest';
import { parseMoney, toStr } from './parseNumber';

describe('parseMoney', () => {
    it('passes numbers through unchanged', () => {
        expect(parseMoney(1234.56)).toBe(1234.56);
        expect(parseMoney(-5)).toBe(-5);
        expect(parseMoney(NaN)).toBe(0);
    });

    it('parses invariant en-US formatted amounts', () => {
        expect(parseMoney('1234.56')).toBe(1234.56);
        expect(parseMoney('1,234.56')).toBe(1234.56);
        expect(parseMoney('12,345,678.90')).toBe(12345678.9);
        expect(parseMoney('0.05')).toBe(0.05);
    });

    it('parses EU/NL formatted amounts', () => {
        expect(parseMoney('1.234,56')).toBe(1234.56);
        expect(parseMoney('12.345.678,90')).toBe(12345678.9);
        expect(parseMoney('1,50')).toBe(1.5);
        expect(parseMoney('1234,56')).toBe(1234.56);
    });

    it('treats a single comma with 3-digit group as thousands (en-US invariant)', () => {
        expect(parseMoney('1,234')).toBe(1234);
    });

    it('treats a single dot as decimal separator', () => {
        expect(parseMoney('1.234')).toBe(1.234);
    });

    it('treats multiple dots with 3-digit groups as thousands', () => {
        expect(parseMoney('1.234.567')).toBe(1234567);
    });

    it('handles accounting-style negatives in parentheses', () => {
        expect(parseMoney('(1.23)')).toBe(-1.23);
        expect(parseMoney('(1.234,56)')).toBe(-1234.56);
        expect(parseMoney('(€ 99,95)')).toBe(-99.95);
    });

    it('handles leading and trailing minus signs', () => {
        expect(parseMoney('-1.23')).toBe(-1.23);
        expect(parseMoney('1.23-')).toBe(-1.23);
        expect(parseMoney('-1.234,56')).toBe(-1234.56);
    });

    it('strips currency symbols and whitespace', () => {
        expect(parseMoney('€ 1.234,56')).toBe(1234.56);
        expect(parseMoney('$1,234.56')).toBe(1234.56);
        expect(parseMoney('EUR 42')).toBe(42);
    });

    it('returns 0 for unparseable input', () => {
        expect(parseMoney('')).toBe(0);
        expect(parseMoney('   ')).toBe(0);
        expect(parseMoney('abc')).toBe(0);
        expect(parseMoney(null)).toBe(0);
        expect(parseMoney(undefined)).toBe(0);
        expect(parseMoney({})).toBe(0);
    });
});

describe('toStr', () => {
    it('trims strings and stringifies other values', () => {
        expect(toStr('  hello ')).toBe('hello');
        expect(toStr(42)).toBe('42');
        expect(toStr(null)).toBe('');
        expect(toStr(undefined)).toBe('');
    });
});
