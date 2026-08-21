/* eslint-disable @typescript-eslint/no-explicit-any */
import React from 'react';
import { Text } from '@mantine/core';

interface ErrorBoundaryState {
  hasError: boolean;
  error: any;
}

interface ErrorBoundaryProps {
  children: React.ReactNode;
  onError?: (error: unknown) => void;
}

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: any) {
    // Update state so the next render will show the fallback UI.
    return { hasError: true, error };
  }

  componentDidCatch(error: unknown) {
    this.props.onError?.(error);
  }

  render() {
    if (this.state.hasError) {
      // You can render any custom fallback UI
      return <Text>{this.state.error.toString()}</Text>;
    }

    return this.props.children;
  }
}
