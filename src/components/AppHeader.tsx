import { History, LayoutGrid, Moon, Search, Settings, Sun } from 'lucide-react';

export type AppView = 'home' | 'dashboard' | 'settings' | 'azure' | 'nce' | 'renewals' | 'timeline' | 'pricing' | 'incentives';

interface AppHeaderProps {
  currentView: AppView;
  companyName: string;
  logoUrl?: string;
  theme: 'light' | 'dark';
  searchQuery: string;
  onViewChange: (view: AppView) => void;
  onThemeChange: () => void;
  onSearchChange: (query: string) => void;
  onHistory: () => void;
}

export const AppHeader = ({ currentView, companyName, logoUrl, theme, searchQuery, onViewChange, onThemeChange, onSearchChange, onHistory }: AppHeaderProps) => {
  const hideSearch = ['home', 'pricing', 'settings', 'incentives', 'renewals', 'timeline'].includes(currentView);
  const showHistory = ['dashboard', 'azure', 'nce', 'renewals', 'timeline', 'pricing', 'incentives'].includes(currentView);
  return <header className="app-header glass-panel">
    <div className="container flex-center" style={{ justifyContent: 'space-between', padding: '1rem 0' }}>
      <button type="button" className="flex-center" onClick={() => onViewChange('home')} aria-label="Go to home" style={{ gap: '1rem', cursor: 'pointer', border: 0, background: 'transparent' }}>
        <img src={logoUrl || '/microsoft-logo.svg'} alt={companyName} style={{ height: '40px' }} />
        <h1 className="text-gradient" style={{ fontSize: '1.5rem', margin: 0 }}>CSP Insights</h1>
      </button>
      <div className="flex-center" style={{ flex: 1, justifyContent: 'center', padding: '0 2rem', opacity: hideSearch ? 0 : 1, pointerEvents: hideSearch ? 'none' : 'auto' }}>
        <div style={{ position: 'relative', width: '100%', maxWidth: '500px' }}>
          <Search size={18} aria-hidden="true" style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-tertiary)' }} />
          <input type="search" placeholder="Search customers, products, or IDs..." aria-label="Search customers, products, or IDs" value={searchQuery} onChange={e => onSearchChange(e.target.value)} style={{ width: '100%', padding: '0.75rem 1rem 0.75rem 2.75rem', borderRadius: '2rem', border: '1px solid var(--border-color)', background: 'var(--bg-primary)', color: 'var(--text-primary)' }} />
          {searchQuery && <button type="button" onClick={() => onSearchChange('')} aria-label="Clear search" style={{ position: 'absolute', right: '0.75rem', top: '50%', transform: 'translateY(-50%)' }}>×</button>}
        </div>
      </div>
      <div className="flex-center" style={{ gap: '0.5rem' }}>
        <button type="button" onClick={onThemeChange} className="secondary-btn" aria-label={theme === 'light' ? 'Switch to dark mode' : 'Switch to light mode'} title={theme === 'light' ? 'Switch to Dark Mode' : 'Switch to Light Mode'}>{theme === 'light' ? <Moon size={20} /> : <Sun size={20} />}</button>
        <button type="button" onClick={() => onViewChange('home')} className={`secondary-btn ${currentView === 'home' ? 'active' : ''}`} aria-label="Home" title="Home"><LayoutGrid size={20} /></button>
        {showHistory && <button type="button" onClick={onHistory} className="secondary-btn" aria-label="History and snapshots" title="History & Snapshots"><History size={20} /></button>}
        <button type="button" onClick={() => onViewChange('settings')} className={`secondary-btn ${currentView === 'settings' ? 'active' : ''}`} aria-label="Settings" title="Settings"><Settings size={20} /></button>
      </div>
    </div>
  </header>;
};
