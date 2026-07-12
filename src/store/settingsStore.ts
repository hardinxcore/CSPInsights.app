import { create } from 'zustand';
import { get, set } from 'idb-keyval';

export interface CompanyDetails {
    name: string;
    addressLine1: string;
    addressLine2: string;
    iban: string;
    kvk?: string;
    logoUrl?: string;
    invoiceFooter?: string;
}

const DEFAULT_COMPANY: CompanyDetails = {
    name: 'My CSP Company',
    addressLine1: 'Business Street 1',
    addressLine2: '1234 AB City',
    iban: '',
    invoiceFooter: 'Thank you for your business! Please pay within 14 days.',
    logoUrl: '/microsoft-logo.svg'
};

export type ThemeMode = 'system' | 'light' | 'dark';

// Applies the effective light/dark class to <body>. When mode is 'system'
// the OS preference (prefers-color-scheme) decides.
const prefersDark = () =>
    typeof window !== 'undefined' && window.matchMedia?.('(prefers-color-scheme: dark)').matches;

const applyTheme = (mode: ThemeMode) => {
    const dark = mode === 'dark' || (mode === 'system' && prefersDark());
    document.body.classList.toggle('dark-mode', dark);
};

interface SettingsState {
    companyDetails: CompanyDetails;
    defaultMargin: number;
    theme: ThemeMode;

    setCompanyDetails: (details: Partial<CompanyDetails>) => void;
    setDefaultMargin: (margin: number) => void;
    setTheme: (theme: ThemeMode) => void;
    loadSettings: () => Promise<void>;
}

export const useSettingsStore = create<SettingsState>((setState, getState) => ({
    companyDetails: DEFAULT_COMPANY,
    defaultMargin: 20,
    theme: 'system',

    setCompanyDetails: (details) => {
        const current = getState().companyDetails;
        const updated = { ...current, ...details };
        setState({ companyDetails: updated });
        set('settings-company', updated).catch(console.error);
    },

    setDefaultMargin: (margin) => {
        setState({ defaultMargin: margin });
        set('settings-margin', margin).catch(console.error);
    },

    setTheme: (theme: ThemeMode) => {
        setState({ theme });
        set('settings-theme', theme).catch(console.error);
        applyTheme(theme);
    },

    loadSettings: async () => {
        try {
            const savedCompany = await get('settings-company');
            const savedMargin = await get('settings-margin');
            const savedTheme = await get('settings-theme');

            // Legacy stored values were only 'light' | 'dark'; anything else
            // (or nothing) falls back to following the system preference.
            const theme: ThemeMode = savedTheme === 'light' || savedTheme === 'dark' || savedTheme === 'system'
                ? savedTheme
                : 'system';
            applyTheme(theme);

            setState({
                companyDetails: savedCompany ? { ...DEFAULT_COMPANY, ...savedCompany } : DEFAULT_COMPANY,
                defaultMargin: savedMargin !== undefined ? savedMargin : 20,
                theme
            });
        } catch (err) {
            console.error('Failed to load settings', err);
        }
    }
}));

// Re-apply on OS theme change while the user is in 'system' mode
if (typeof window !== 'undefined' && window.matchMedia) {
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
        if (useSettingsStore.getState().theme === 'system') {
            applyTheme('system');
        }
    });
}
