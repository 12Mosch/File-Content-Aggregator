import React from "react";
import ErrorBoundary from "./ErrorBoundary";

/**
 * Higher-order component that wraps a component with an error boundary
 * @param Component Component to wrap
 * @param componentName Name of the component (for error reporting)
 * @returns Wrapped component with error boundary
 */
export function withErrorBoundary<P extends object>(
  Component: React.ComponentType<P>,
  componentName?: string
): React.FC<P> {
  return (props: P) => (
    <ErrorBoundary component={componentName}>
      <Component {...props} />
    </ErrorBoundary>
  );
}
