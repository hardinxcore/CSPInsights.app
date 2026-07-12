import { lazy, Suspense, useEffect, useState, type CSSProperties } from 'react';
import { FileUpload } from './components/FileUpload';
import { Dashboard } from './components/Dashboard';
import { SettingsPage } from './components/SettingsPage';
import { HistoryModal } from './components/HistoryModal';
import { ErrorBoundary } from './components/ErrorBoundary';
import { cancelBillingParse, parseBillingCSVs } from './utils/csvParser';
import { useBillingStore } from './store/billingStore';
import { useSettingsStore } from './store/settingsStore';
import { useEarningsStore } from './store/earningsStore';
import { HomeDashboard } from './components/HomeDashboard';
import { Loader2, BarChart3, Cloud, ShieldCheck, ExternalLink, TrendingUp, CalendarDays, LineChart } from 'lucide-react';
import { AppHeader, type AppView } from './components/AppHeader';
import { generateDemoData } from './utils/demoData';
import { initAnalytics, trackModuleView } from './utils/analytics';
import './App.css';

const AzureAnalyzer = lazy(() => import('./components/AzureAnalyzer').then(m => ({ default: m.AzureAnalyzer })));
const NceAnalyzer = lazy(() => import('./components/NceAnalyzer').then(m => ({ default: m.NceAnalyzer })));
const RenewalCalendar = lazy(() => import('./components/RenewalCalendar').then(m => ({ default: m.RenewalCalendar })));
const CostTimeline = lazy(() => import('./components/CostTimeline').then(m => ({ default: m.CostTimeline })));
const PricingView = lazy(() => import('./components/PricingView').then(m => ({ default: m.PricingView })));
const EarningsView = lazy(() => import('./components/EarningsView').then(m => ({ default: m.EarningsView })));

// Longhand borders only: mixing the `border` shorthand with `borderBottom`
// in one style object triggers React's conflicting-style warning
const tabButtonStyle = (active: boolean, activeColor = 'var(--accent-primary)'): CSSProperties => ({
  display: 'flex', alignItems: 'center', gap: '0.5rem',
  color: active ? 'var(--text-primary)' : 'var(--text-tertiary)',
  background: 'none', padding: '0.5rem 1rem', cursor: 'pointer', fontWeight: 500,
  borderTop: 'none', borderLeft: 'none', borderRight: 'none',
  borderBottom: active ? `2px solid ${activeColor}` : '2px solid transparent'
});

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
  const { loadFromDisk: loadEarningsFromDisk } = useEarningsStore();

  // Navigation State
  const [currentView, setCurrentView] = useState<AppView>('home');
  const [showHistory, setShowHistory] = useState(false);
  const [isUploading, setIsUploading] = useState(false); // New state to control upload view overlay
  const [notification, setNotification] = useState<string | null>(null);
  const [isParsing, setIsParsing] = useState(false);
  const [parsingProgress, setParsingProgress] = useState(0);

  // Load persisted data on mount (settings first, so the default margin is known)
  useEffect(() => {
    (async () => {
      await loadSettings();
      await loadFromDisk();
    })();
    loadEarningsFromDisk();
    initAnalytics();
  }, [loadEarningsFromDisk, loadFromDisk, loadSettings]);

  // Anonymous module-usage tracking (no-op in dev, with DNT/GPC, or when blocked)
  useEffect(() => {
    trackModuleView(currentView);
  }, [currentView]);

  const handleFileSelect = async (files: File[]) => {
    setIsParsing(true);
    setParsingProgress(0);
    try {
      const result = await parseBillingCSVs(files, setParsingProgress);
      if (result.errors && result.errors.length > 0) {
        console.warn('Errors during parse:', result.errors);
        setNotification(`Some rows were skipped or invalid. ${result.errors.slice(0, 3).join(' ')}`);
      }
      if (result.data.length === 0) {
        setNotification('No valid billing records found in the selected file(s). Please check the export format.');
      }

      if (data.length > 0) {
        appendData(result.data);
        setNotification(`Added ${result.data.length} records to the existing dataset.`);
      } else {
        setData(result.data);
      }
      setIsUploading(false); // Return to dashboard
    } catch (err: unknown) {
      console.error(err);
      setNotification(err instanceof Error ? err.message : 'Failed to parse CSVs.');
    } finally {
      setIsParsing(false);
      setParsingProgress(0);
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

      <AppHeader currentView={currentView} companyName={companyDetails.name} logoUrl={companyDetails.logoUrl} theme={theme} searchQuery={searchQuery} onViewChange={setCurrentView} onThemeChange={() => setTheme(theme === 'system' ? 'light' : theme === 'light' ? 'dark' : 'system')} onSearchChange={setSearchQuery} onHistory={() => setShowHistory(true)} />


      <main className="container animate-fade-in" style={{ marginTop: '2rem' }}>
        {notification && <div role="alert" className="glass-panel" style={{ padding: '1rem', marginBottom: '1rem', borderLeft: '4px solid var(--accent-primary)' }}><span>{notification}</span><button onClick={() => setNotification(null)} style={{ float: 'right' }} aria-label="Dismiss notification">Dismiss</button></div>}
        <ErrorBoundary>
        <Suspense fallback={<div className="flex-center" style={{ minHeight: '400px' }}><Loader2 className="animate-spin" size={40} color="var(--accent-primary)" /></div>}>
        {currentView === 'settings' && (
          <SettingsPage onBack={() => setCurrentView('home')} />
        )}

        {currentView === 'home' && (
          <HomeDashboard onNavigate={(view) => {
            if (view === 'billing') setCurrentView('dashboard');
            else if (view === 'pricing') setCurrentView('pricing');
            else if (view === 'incentives') setCurrentView('incentives');
          }} />
        )}

        {currentView === 'pricing' && <PricingView />}

        {currentView === 'incentives' && (
          <div style={{ marginTop: '0' }}>
            <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem' }}>
              <button
                onClick={() => setCurrentView('incentives')}
                style={tabButtonStyle(true, '#10B981')}
              >
                <TrendingUp size={18} /> Incentives &amp; Earnings
              </button>
            </div>
            <EarningsView />
          </div>
        )}

        {(currentView === 'dashboard' || currentView === 'azure' || currentView === 'nce' || currentView === 'renewals' || currentView === 'timeline') && (
          <>
            {showDashboard && (
              <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem' }}>
                <button
                  onClick={() => setCurrentView('dashboard')}
                  style={tabButtonStyle(currentView === 'dashboard')}
                >
                  <BarChart3 size={18} /> Overview
                </button>
                <button
                  onClick={() => setCurrentView('azure')}
                  style={tabButtonStyle(currentView === 'azure')}
                >
                  <Cloud size={18} /> Azure FinOps
                </button>
                <button
                  onClick={() => setCurrentView('nce')}
                  style={tabButtonStyle(currentView === 'nce')}
                >
                  <ShieldCheck size={18} /> NCE Insights
                </button>
                <button
                  onClick={() => setCurrentView('renewals')}
                  style={tabButtonStyle(currentView === 'renewals')}
                >
                  <CalendarDays size={18} /> Renewal Calendar
                </button>
                <button
                  onClick={() => setCurrentView('timeline')}
                  style={tabButtonStyle(currentView === 'timeline')}
                >
                  <LineChart size={18} /> Cost Timeline
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

                <FileUpload onFileSelect={handleFileSelect} isLoading={isParsing} loadingText={`Processing files… ${parsingProgress}%`} onCancel={cancelBillingParse} />

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
                {currentView === 'renewals' && <RenewalCalendar />}
                {currentView === 'timeline' && <CostTimeline />}
              </>
            )}
          </>
        )}
        </Suspense>
        </ErrorBoundary>
      </main>

      <footer style={{ textAlign: 'center', padding: '2rem 1rem 1rem', color: 'var(--text-tertiary)', fontSize: '0.8rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
        <span>CSP Insights v1.2.0</span>
        <span style={{ opacity: 0.4 }}>|</span>
        <a href="https://github.com/hardinxcore/cspinsights.app" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--text-tertiary)', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>
          GitHub <ExternalLink size={12} />
        </a>
      </footer>
    </div>
  );
}

export default App;
