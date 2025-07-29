import React, { Component, ErrorInfo, ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { Button } from "./ui/button";
import { Card } from "./ui/card";
import {
  getErrorHandler,
  ErrorSeverity,
} from "../lib/services/ErrorHandlingService";

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
  component?: string;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

/**
 * Error boundary component that catches JavaScript errors in its child component tree.
 * Displays a fallback UI instead of crashing the whole app.
 */
class ErrorBoundaryClass extends Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    // Update state so the next render will show the fallback UI
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    // Log the error to the error handling service
    const errorHandler = getErrorHandler();
    errorHandler.handleError(error, {
      severity: ErrorSeverity.HIGH,
      context: {
        component: this.props.component || "ErrorBoundary",
        operation: "rendering",
        data: errorInfo,
      },
      showToUser: true,
    });

    // Update state with error details
    this.setState({ errorInfo });

    // Call the onError callback if provided
    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }
  }

  handleReset = (): void => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    });
  };

  render(): ReactNode {
    if (this.state.hasError) {
      // Custom fallback UI
      if (this.props.fallback) {
        return this.props.fallback;
      }

      // Default fallback UI
      return (
        <ErrorFallback error={this.state.error} onReset={this.handleReset} />
      );
    }

    // When there's no error, render children normally
    return this.props.children;
  }
}

interface ErrorFallbackProps {
  error: Error | null;
  onReset: () => void;
}

/**
 * Default fallback UI for the error boundary
 */
function ErrorFallback({
  error,
  onReset,
}: ErrorFallbackProps): React.ReactElement {
  const { t } = useTranslation();

  return (
    <Card className="border-destructive/30 bg-destructive/10 p-6 text-destructive">
      <div className="flex flex-col items-center gap-4 text-center">
        <AlertTriangle className="h-12 w-12" />
        <div>
          <h2 className="mb-2 text-xl font-semibold">
            {t("errors:componentError")}
          </h2>
          <p className="mb-4">{t("errors:componentErrorDescription")}</p>
          {error && (
            <div className="mb-4 max-h-32 overflow-auto rounded-md bg-background/50 p-4 text-left">
              <p className="font-mono text-sm break-all">{error.toString()}</p>
            </div>
          )}
          <Button
            variant="outline"
            onClick={onReset}
            className="flex items-center gap-2"
          >
            <RefreshCw className="h-4 w-4" />
            {t("errors:tryAgain")}
          </Button>
        </div>
      </div>
    </Card>
  );
}

// Export the ErrorBoundary component
export default function ErrorBoundary(
  props: ErrorBoundaryProps
): React.ReactElement {
  return <ErrorBoundaryClass {...props} />;
}
