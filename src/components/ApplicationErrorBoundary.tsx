import { Component, ErrorInfo, ReactNode } from 'react';
import { StartupErrorScreen } from './StartupErrorScreen';

interface ApplicationErrorBoundaryState {
  hasError: boolean;
  error: unknown;
}

export class ApplicationErrorBoundary extends Component<
{ children: ReactNode },
ApplicationErrorBoundaryState
> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: unknown): ApplicationErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: unknown, errorInfo: ErrorInfo) {
    console.error('Unexpected application render error:', error, errorInfo);
  }

  render() {
    const { error, hasError } = this.state;
    if (hasError) {
      return <StartupErrorScreen error={error} />;
    }

    return this.props.children;
  }
}
