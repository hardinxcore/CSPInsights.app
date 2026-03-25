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

interface SettingsState {
    companyDetails: CompanyDetails;
    defaultMargin: number;
    theme: 'light' | 'dark'; // Add theme

    setCompanyDetails: (details: Partial<CompanyDetails>) => void;
    setDefaultMargin: (margin: number) => void;
    setTheme: (theme: 'light' | 'dark') => void; // Add action
    loadSettings: () => Promise<void>;
}

export const useSettingsStore = create<SettingsState>((setState, getState) => ({
    companyDetails: DEFAULT_COMPANY,
    defaultMargin: 20,
    theme: 'light',

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

    setTheme: (theme: 'light' | 'dark') => {
        setState({ theme });
        set('settings-theme', theme).catch(console.error);

        // update DOM immediately
        if (theme === 'dark') {
            document.body.classList.add('dark-mode');
        } else {
            document.body.classList.remove('dark-mode');
        }
    },

    loadSettings: async () => {
        try {
            const savedCompany = await get('settings-company');
            const savedMargin = await get('settings-margin');
            const savedTheme = await get('settings-theme');

            // Apply theme on load
            if (savedTheme === 'dark') {
                document.body.classList.add('dark-mode');
            } else {
                document.body.classList.remove('dark-mode');
            }

            setState({
                companyDetails: savedCompany ? { ...DEFAULT_COMPANY, ...savedCompany } : DEFAULT_COMPANY,
                defaultMargin: savedMargin !== undefined ? savedMargin : 20,
                theme: savedTheme || 'light'
            });
        } catch (err) {
            console.error('Failed to load settings', err);
        }
    }
}));
