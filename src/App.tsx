import { useEffect, useState } from 'react';
import { FileUpload } from './components/FileUpload';
import { Dashboard } from './components/Dashboard';
import { SettingsPage } from './components/SettingsPage';
import { HistoryModal } from './components/HistoryModal';
import { parseBillingCSVs } from './utils/csvParser';
import { useBillingStore } from './store/billingStore';
import { useSettingsStore } from './store/settingsStore';
import { AzureAnalyzer } from './components/AzureAnalyzer';
import { NceAnalyzer } from './components/NceAnalyzer';
import { PricingView } from './components/PricingView';
import { HomeDashboard } from './components/HomeDashboard';
import { Loader2, Settings, History, Sun, Moon, Search, LayoutGrid, BarChart3, Cloud, ShieldCheck } from 'lucide-react';
import { generateDemoData } from './utils/demoData';
import './App.css';

function App() {
  const {
    data,
    meta,
    isLoading: storeLoading,
    error: storeError,
    setData,
    appendData,
    reset,
    loadFromDisk,
    searchQuery,
    setSearchQuery
  } = useBillingStore();

  const { loadSettings, theme, setTheme, companyDetails } = useSettingsStore();

  // Navigation State
  const [currentView, setCurrentView] = useState<'home' | 'dashboard' | 'settings' | 'azure' | 'nce' | 'pricing'>('home');
  const [showHistory, setShowHistory] = useState(false);
  const [isUploading, setIsUploading] = useState(false); // New state to control upload view overlay

  // Load persisted data on mount
  useEffect(() => {
    loadFromDisk();
    loadSettings();
  }, []);

  const handleFileSelect = async (files: File[]) => {
    try {
      const result = await parseBillingCSVs(files);
      if (result.errors && result.errors.length > 0) {
        console.warn('Errors during parse:', result.errors);
        alert(`Warning: Some rows were skipped or invalid.\n${result.errors.slice(0, 5).join('\n')}`);
      }
      if (result.data.length === 0) {
        alert('No valid billing records found in file(s). Please check the file format.');
      }

      if (data.length > 0) {
        appendData(result.data);
        alert(`Added ${result.data.length} records to existing data.`);
      } else {
        setData(result.data);
      }
      setIsUploading(false); // Return to dashboard
    } catch (err: any) {
      console.error(err);
      alert(err.message || 'Failed to parse CSVs');
    }
  };

  const handleClearData = () => {
    if (confirm('Are you sure you want to clear ALL billing data? This cannot be undone.')) {
      reset();
      setIsUploading(false);
    }
  };

  const handleAddFile = () => {
    setIsUploading(true);
  };

  const handleDemo = () => {
    const fakeData = generateDemoData();
    setData(fakeData);
    setIsUploading(false);
  };

  const showDashboard = (data && data.length > 0) && !isUploading;

  // Construct ParseResult for Dashboard (compatibility adapter)
  const dashboardData = {
    data,
    meta,
    errors: []
  };

  return (
    <div className="app-container">
      {showHistory && (
        <HistoryModal
          onClose={() => setShowHistory(false)}
          mode={currentView === 'pricing' ? 'pricing' : 'billing'}
        />
      )}

      {/* Header ... (unchanged) ... */}
      <header className="app-header glass-panel">
        <div className="container flex-center" style={{ justifyContent: 'space-between', padding: '1rem 0' }}>
          <div className="flex-center" style={{ gap: '1rem', cursor: 'pointer' }} onClick={() => setCurrentView('home')}>
            <img src={companyDetails.logoUrl || "/microsoft-logo.svg"} alt={companyDetails.name} style={{ height: '40px' }} />
            <h1 className="text-gradient" style={{ fontSize: '1.5rem', margin: 0 }}>
              CSP Insights
            </h1>
          </div>

          {/* Search Section */}
          <div className="flex-center" style={{ flex: 1, justifyContent: 'center', padding: '0 2rem', opacity: (currentView === 'home' || currentView === 'pricing' || currentView === 'settings') ? 0 : 1, pointerEvents: (currentView === 'home' || currentView === 'pricing' || currentView === 'settings') ? 'none' : 'auto' }}>
            <div style={{ position: 'relative', width: '100%', maxWidth: '500px' }}>
              <Search size={18} style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-tertiary)' }} />
              <input
                type="text"
                placeholder="Search customers, products, or IDs..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{
                  width: '100%',
                  padding: '0.75rem 1rem 0.75rem 2.75rem',
                  borderRadius: '2rem',
                  border: '1px solid var(--border-color)',
                  background: 'var(--bg-primary)',
                  color: 'var(--text-primary)',
                  outline: 'none',
                  boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.05)',
                  transition: 'all 0.2s ease'
                }}
                onFocus={(e) => e.target.style.borderColor = 'var(--accent-secondary)'}
                onBlur={(e) => e.target.style.borderColor = 'var(--border-color)'}
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  style={{ position: 'absolute', right: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-tertiary)', background: 'none', border: 'none', cursor: 'pointer' }}
                >
                  x
                </button>
              )}
            </div>
          </div>

          <div className="flex-center" style={{ gap: '0.5rem' }}>
            <button
              onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}
              className="secondary-btn"
              title={theme === 'light' ? "Switch to Dark Mode" : "Switch to Light Mode"}
              style={{ borderRadius: '50%', width: '40px', height: '40px', padding: 0, display: 'flex', justifyContent: 'center', alignItems: 'center' }}
            >
              {theme === 'light' ? <Moon size={20} /> : <Sun size={20} />}
            </button>
            <button
              onClick={() => setCurrentView('home')}
              className={`secondary-btn ${currentView === 'home' ? 'active' : ''}`}
              title="Home"
              style={{ borderRadius: '50%', width: '40px', height: '40px', padding: 0, display: 'flex', justifyContent: 'center', alignItems: 'center' }}
            >
              <LayoutGrid size={20} />
            </button>
            {(currentView === 'dashboard' || currentView === 'azure' || currentView === 'nce' || currentView === 'pricing') && (
              <button
                onClick={() => setShowHistory(true)}
                className="secondary-btn"
                title="History & Snapshots"
                style={{ borderRadius: '50%', width: '40px', height: '40px', padding: 0, display: 'flex', justifyContent: 'center', alignItems: 'center' }}
              >
                <History size={20} />
              </button>
            )}
            <button
              onClick={() => setCurrentView('settings')}
              className={`secondary-btn ${currentView === 'settings' ? 'active' : ''}`}
              title="Settings"
              style={{ borderRadius: '50%', width: '40px', height: '40px', padding: 0, display: 'flex', justifyContent: 'center', alignItems: 'center' }}
            >
              <Settings size={20} />
            </button>
          </div>
        </div>
      </header>


      <main className="container animate-fade-in" style={{ marginTop: '2rem' }}>
        {currentView === 'settings' && (
          <SettingsPage onBack={() => setCurrentView('home')} />
        )}

        {currentView === 'home' && (
          <HomeDashboard onNavigate={(view) => setCurrentView(view === 'billing' ? 'dashboard' : 'pricing')} />
        )}

        {currentView === 'pricing' && <PricingView />}

        {(currentView === 'dashboard' || currentView === 'azure' || currentView === 'nce') && (
          <>
            {showDashboard && (
              <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem' }}>
                <button
                  onClick={() => setCurrentView('dashboard')}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '0.5rem',
                    borderBottom: currentView === 'dashboard' ? '2px solid var(--accent-primary)' : '2px solid transparent',
                    color: currentView === 'dashboard' ? 'var(--text-primary)' : 'var(--text-tertiary)',
                    background: 'none', border: 'none', padding: '0.5rem 1rem', cursor: 'pointer', fontWeight: 500
                  }}
                >
                  <BarChart3 size={18} /> Overview
                </button>
                <button
                  onClick={() => setCurrentView('azure')}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '0.5rem',
                    borderBottom: currentView === 'azure' ? '2px solid var(--accent-primary)' : '2px solid transparent',
                    color: currentView === 'azure' ? 'var(--text-primary)' : 'var(--text-tertiary)',
                    background: 'none', border: 'none', padding: '0.5rem 1rem', cursor: 'pointer', fontWeight: 500
                  }}
                >
                  <Cloud size={18} /> Azure FinOps
                </button>
                <button
                  onClick={() => setCurrentView('nce')}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '0.5rem',
                    borderBottom: currentView === 'nce' ? '2px solid var(--accent-primary)' : '2px solid transparent',
                    color: currentView === 'nce' ? 'var(--text-primary)' : 'var(--text-tertiary)',
                    background: 'none', border: 'none', padding: '0.5rem 1rem', cursor: 'pointer', fontWeight: 500
                  }}
                >
                  <ShieldCheck size={18} /> NCE Insights
                </button>
              </div>
            )}

            {storeLoading ? (
              <div className="flex-center" style={{ minHeight: '400px', flexDirection: 'column', gap: '1rem' }}>
                <Loader2 className="animate-spin" size={48} color="var(--accent-primary)" />
                <p style={{ color: 'var(--text-secondary)' }}>Loading billing data...</p>
              </div>
            ) : (!showDashboard && (data.length === 0 || isUploading)) ? (
              /* UPLOAD MODE or EMPTY STATE */
              <div style={{ marginTop: '4rem' }}>
                {/* Back button if adding file */}
                {isUploading && data.length > 0 && (
                  <button onClick={() => setIsUploading(false)} style={{ marginBottom: '1rem', color: 'var(--text-tertiary)', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}>
                    &larr; Cancel & Back to Dashboard
                  </button>
                )}

                <FileUpload onFileSelect={handleFileSelect} />

                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', marginTop: '1.5rem', color: 'var(--success)', fontWeight: 500 }}>
                  <ShieldCheck size={18} />
                  <span>Secure & Private: Processed locally in your browser. No data upload.</span>
                </div>

                <div style={{ textAlign: 'center', marginTop: '2rem', color: 'var(--text-tertiary)' }}>
                  <p>Supports M365 & Azure CSP Reconciliation files.</p>
                  <div style={{ marginTop: '2rem' }}>
                    <button onClick={handleDemo} className="secondary-btn" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.9rem' }}>
                      Or try with Demo Data
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              /* ACTIVE DASHBOARDS */
              <>
                {storeError && (
                  <div className="glass-panel" style={{ padding: '1rem', borderLeft: '4px solid var(--danger)', marginBottom: '2rem', color: 'var(--danger)' }}>
                    <strong>Error:</strong> {storeError}
                  </div>
                )}
                {currentView === 'dashboard' && <Dashboard data={dashboardData} onReset={handleAddFile} onClearData={handleClearData} />}
                {currentView === 'azure' && <AzureAnalyzer />}
                {currentView === 'nce' && <NceAnalyzer />}
              </>
            )}
          </>
        )}
      </main>
    </div>
  );
}

export default App;
