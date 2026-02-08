import React from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface Props {
  children: React.ReactNode;
}

interface State {
  hasError: boolean;
  retryCount: number;
}

export class KDSErrorBoundary extends React.Component<Props, State> {
  private retryTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, retryCount: 0 };
  }

  static getDerivedStateFromError(): Partial<State> {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('[KDSErrorBoundary] Caught error:', error.message);
    console.error('[KDSErrorBoundary] Component stack:', info.componentStack);

    // Auto-retry after 5 seconds (max 3 retries)
    if (this.state.retryCount < 3) {
      this.retryTimer = setTimeout(() => {
        this.setState((prev) => ({
          hasError: false,
          retryCount: prev.retryCount + 1,
        }));
      }, 5000);
    }
  }

  componentWillUnmount() {
    if (this.retryTimer) clearTimeout(this.retryTimer);
  }

  handleManualRetry = () => {
    if (this.retryTimer) clearTimeout(this.retryTimer);
    this.setState({ hasError: false, retryCount: 0 });
  };

  handleFullReload = () => {
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex h-[calc(100vh-5rem)] items-center justify-center p-4">
          <div className="text-center space-y-4 max-w-sm">
            <AlertTriangle className="h-12 w-12 mx-auto text-destructive opacity-60" />
            <h2 className="text-lg font-semibold">Erro no KDS</h2>
            <p className="text-sm text-muted-foreground">
              {this.state.retryCount < 3
                ? 'Reconectando automaticamente em 5 segundos...'
                : 'Não foi possível recuperar automaticamente.'}
            </p>
            <div className="flex gap-2 justify-center">
              <Button variant="outline" size="sm" onClick={this.handleManualRetry}>
                <RefreshCw className="h-4 w-4 mr-1" />
                Tentar novamente
              </Button>
              <Button variant="default" size="sm" onClick={this.handleFullReload}>
                Recarregar página
              </Button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
