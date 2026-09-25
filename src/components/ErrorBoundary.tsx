import React from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface ErrorBoundaryState {
  error: Error | null;
}

// Wraps the whole app (see main.tsx). Without this, ANY uncaught error
// during render -- anywhere, in any of the three route trees -- takes
// down the entire page to a blank screen with nothing to tell the
// person what happened or what to do next (see the null-treeId /
// toLowerCase crash this was added alongside). React only stops an
// unmount cascade at the nearest class component implementing
// getDerivedStateFromError -- there was none anywhere in this app
// before this file.
export class ErrorBoundary extends React.Component<{ children: React.ReactNode }, ErrorBoundaryState> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    // Surfaces in the browser console with a clear marker, same place
    // you'd already be looking (F12 -> Console) -- doesn't replace it.
    console.error('CocoSense: uncaught render error', error, info.componentStack);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="min-h-screen bg-[#0A0A0A] flex items-center justify-center p-6">
          <div className="max-w-md w-full rounded-lg bg-[#141414] border border-[#262626] p-6 text-center space-y-4">
            <div className="mx-auto w-12 h-12 rounded-full bg-[#2B1B1B] border border-[#F44336]/30 flex items-center justify-center">
              <AlertTriangle className="w-6 h-6 text-[#F44336]" />
            </div>
            <div>
              <h1 className="text-white font-bold text-lg">Something went wrong</h1>
              <p className="text-[#808080] text-sm mt-1">
                The page hit an unexpected error and couldn't continue. Reloading usually fixes it.
              </p>
            </div>
            <p className="text-[10px] font-mono text-[#606060] break-words bg-[#0A0A0A] rounded p-2 border border-[#262626]">
              {this.state.error.message}
            </p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="w-full flex items-center justify-center gap-2 px-4 py-2 rounded bg-[#D4AF37] text-black font-semibold hover:bg-[#c9a431]"
            >
              <RefreshCw className="w-4 h-4" /> Reload page
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
