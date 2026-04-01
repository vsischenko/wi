import { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  message: string;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    message: '',
  };

  public static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      message: error.message || 'Unknown runtime error',
    };
  }

  public componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Application runtime error:', error, info);
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div
          style={{
            height: '100%',
            display: 'grid',
            placeItems: 'center',
            padding: 24,
            background: '#fafafa',
            color: '#37474f',
          }}
        >
          <div
            style={{
              maxWidth: 720,
              border: '1px solid #e0e6eb',
              borderRadius: 10,
              background: '#fff',
              padding: 16,
            }}
          >
            <h2 style={{ margin: '0 0 8px 0' }}>Runtime error detected</h2>
            <p style={{ margin: 0 }}>
              The page crashed in the browser runtime. Open DevTools Console to see details.
            </p>
            <pre
              style={{
                marginTop: 12,
                padding: 12,
                background: '#f5f7f9',
                borderRadius: 6,
                overflow: 'auto',
                whiteSpace: 'pre-wrap',
              }}
            >
              {this.state.message}
            </pre>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
