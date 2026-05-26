import React from 'react';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error("ErrorBoundary caught an active runtime failure:", error, errorInfo);
    this.setState({ errorInfo });
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
    window.location.href = '/dashboard';
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen w-full flex items-center justify-center bg-brand-bg px-4">
          <div className="max-w-md w-full glass-panel rounded-card shadow-premium p-8 border-t-4 border-brand-error text-center">
            <div className="w-16 h-16 mx-auto rounded-full bg-red-100 flex items-center justify-center mb-6">
              <svg className="w-8 h-8 text-brand-error" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            
            <h1 className="text-2xl font-bold text-brand-textPrimary mb-2">Something Went Wrong</h1>
            <p className="text-sm text-brand-textMuted mb-6">
              We encountered a glitch while rendering this section. Rest assured, your funds and assets are completely safe.
            </p>

            {process.env.NODE_ENV !== 'production' && this.state.error && (
              <div className="text-left bg-slate-900 text-slate-100 p-4 rounded-input text-xs font-mono mb-6 overflow-x-auto max-h-40">
                <p className="font-bold mb-1">{this.state.error.toString()}</p>
                {this.state.errorInfo && <pre>{this.state.errorInfo.componentStack}</pre>}
              </div>
            )}

            <button
              onClick={this.handleReset}
              className="w-full py-3 px-4 font-semibold text-white rounded-input bg-brand-primary hover:bg-brand-dark transition-colors duration-200 shadow-md focus:outline-none focus:ring-4 focus:ring-brand-primary/20"
            >
              Refresh Workspace
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
