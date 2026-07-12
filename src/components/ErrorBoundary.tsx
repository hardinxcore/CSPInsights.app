import { Component, type ErrorInfo, type ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { trackException } from '../utils/analytics';

interface ErrorBoundaryProps {
    children: ReactNode;
}

interface ErrorBoundaryState {
    error: Error | null;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
    state: ErrorBoundaryState = { error: null };

    static getDerivedStateFromError(error: Error): ErrorBoundaryState {
        return { error };
    }

    componentDidCatch(error: Error, errorInfo: ErrorInfo) {
        console.error('Unhandled error in view', error, errorInfo);
        // Anonymous crash reporting; no-op in dev or with DNT/GPC enabled
        trackException(error);
    }

    handleReset = () => {
        this.setState({ error: null });
    };

    render() {
        if (this.state.error) {
            return (
                <div className="glass-panel" style={{ padding: '2rem', margin: '2rem auto', maxWidth: '600px', textAlign: 'center' }}>
                    <AlertTriangle size={48} color="var(--danger)" style={{ marginBottom: '1rem' }} />
                    <h2 style={{ marginBottom: '0.5rem' }}>Something went wrong</h2>
                    <p style={{ color: 'var(--text-secondary)', marginBottom: '1rem' }}>
                        An unexpected error occurred while rendering this view. Your data is stored locally and is not affected.
                    </p>
                    <details style={{ textAlign: 'left', marginBottom: '1.5rem', color: 'var(--text-tertiary)', fontSize: '0.85rem' }}>
                        <summary style={{ cursor: 'pointer' }}>Technical details</summary>
                        <pre style={{ whiteSpace: 'pre-wrap', overflowX: 'auto' }}>{this.state.error.message}</pre>
                    </details>
                    <button onClick={this.handleReset} className="secondary-btn" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}>
                        <RefreshCw size={16} /> Try again
                    </button>
                </div>
            );
        }
        return this.props.children;
    }
}
