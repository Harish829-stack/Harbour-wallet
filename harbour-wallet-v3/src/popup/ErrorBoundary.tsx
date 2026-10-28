import React from 'react';
import { logError } from '../core/logger';
import { friendlyMessage } from '../core/errors';

// Global error boundary: a render crash shows a calm recovery screen instead of a blank popup. No stack or internals are shown.
interface State { error: unknown | null }
export class ErrorBoundary extends React.Component<React.PropsWithChildren, State> {
  state: State = { error: null };
  static getDerivedStateFromError(error: unknown): State { return { error }; }
  componentDidCatch(error: unknown): void { logError('ui crashed', error); }
  render(): React.ReactNode {
    if (this.state.error === null) return this.props.children;
    const box: React.CSSProperties = { padding: 24, minHeight: 280, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 12, textAlign: 'center' };
    const btn: React.CSSProperties = { padding: '10px 16px', borderRadius: 12, border: '1px solid currentColor', background: 'transparent', color: 'inherit', font: 'inherit', cursor: 'pointer' };
    return (
      <div role="alert" style={box}>
        <h2 style={{ margin: 0 }}>Something went wrong</h2>
        <p style={{ margin: 0, opacity: 0.75 }}>{friendlyMessage(this.state.error)}</p>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
          <button style={btn} onClick={() => this.setState({ error: null })}>Try again</button>
          <button style={btn} onClick={() => window.location.reload()}>Reload</button>
        </div>
      </div>
    );
  }
}
