import { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Uncaught error:", error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-background text-text-primary text-center">
          <div className="max-w-md w-full bg-surface border border-border rounded-xl p-8 shadow-xl">
            <div className="w-16 h-16 rounded-full bg-danger/10 text-danger flex items-center justify-center mx-auto mb-6">
              <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <h1 className="text-xl font-bold tracking-tight mb-2">Something went wrong</h1>
            <p className="text-sm text-text-secondary mb-6 leading-relaxed">
              An unexpected frontend crash occurred. Please reload the page to restore the application state.
            </p>
            <button
              onClick={() => window.location.reload()}
              className="w-full h-11 bg-accent hover:bg-accent/90 text-white font-semibold rounded-lg shadow transition-colors"
            >
              Reload Page
            </button>
            {this.state.error && (
              <details className="mt-4 text-left bg-background p-3 rounded border border-border overflow-auto max-h-[140px]">
                <summary className="text-[10px] text-text-secondary cursor-pointer font-semibold select-none">Technical Details</summary>
                <pre className="text-[9px] font-mono mt-2 text-danger whitespace-pre-wrap">{this.state.error.stack || this.state.error.message}</pre>
              </details>
            )}
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
