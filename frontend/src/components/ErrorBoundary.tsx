import React, { Component, ErrorInfo, ReactNode } from 'react';
import { ShieldAlert, RefreshCw } from 'lucide-react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
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
    console.error("Uncaught error intercepted by ErrorBoundary:", error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="flex min-h-[60vh] flex-col items-center justify-center p-8 text-center">
          <div className="glass-panel glow-rose max-w-md rounded-3xl p-8 backdrop-blur-md">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-rose-500/10 text-rose-500 border border-rose-500/20 mb-5">
              <ShieldAlert className="h-7 w-7" />
            </div>
            <h2 className="text-xl font-bold tracking-tight text-white">Dashboard Component Error</h2>
            <p className="mt-3 text-xs text-slate-400 leading-relaxed">
              We encountered an issue rendering this analytics view. This can happen due to transient network updates or temporary state mismatches.
            </p>
            {this.state.error && (
              <div className="mt-4 rounded-xl bg-slate-950/40 p-3 border border-slate-900 font-mono text-[10px] text-rose-400 text-left max-h-24 overflow-y-auto">
                {this.state.error.toString()}
              </div>
            )}
            <button
              onClick={() => window.location.reload()}
              className="mt-6 inline-flex items-center gap-2 rounded-xl bg-brand-600 px-5 py-2.5 text-xs font-bold text-white hover:bg-brand-500 active:scale-95 transition-all shadow-lg shadow-brand-600/10"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              <span>Reload Portal</span>
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
