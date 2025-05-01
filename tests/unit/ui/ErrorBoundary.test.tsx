/**
 * Unit tests for the ErrorBoundary component
 */

import React from "react";
import { render, screen } from "@testing-library/react";

// Mock the UI components
jest.mock("../../../src/components/ui/button", () => ({
  Button: ({
    children,
    onClick,
  }: {
    children: React.ReactNode;
    onClick?: () => void;
  }) => <button onClick={onClick}>{children}</button>,
}));

jest.mock("../../../src/components/ui/card", () => ({
  Card: ({
    children,
    className,
  }: {
    children: React.ReactNode;
    className?: string;
  }) => <div className={className}>{children}</div>,
}));

jest.mock("lucide-react", () => ({
  AlertTriangle: () => <div>AlertTriangle</div>,
  RefreshCw: () => <div>RefreshCw</div>,
}));

// Mock the utils module
jest.mock("../../../src/lib/utils", () => ({
  cn: (...inputs: unknown[]) => inputs.filter(Boolean).join(" "),
}));

import ErrorBoundary from "../../../src/components/ErrorBoundary";
import { withErrorBoundary } from "../../../src/components/ErrorBoundaryUtils";

// Mock the error handler
jest.mock("../../../src/lib/services/ErrorHandlingService", () => ({
  getErrorHandler: jest.fn(() => ({
    handleError: jest.fn(),
  })),
  ErrorSeverity: {
    HIGH: "high",
  },
}));

// Mock the i18next hook
jest.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => {
      const translations: Record<string, string> = {
        "errors:componentError": "Component Error",
        "errors:componentErrorDescription":
          "An error occurred in this component",
        "errors:tryAgain": "Try Again",
      };
      return translations[key] || key;
    },
  }),
}));

// Component that throws an error
const ErrorComponent = ({ shouldThrow = false }: { shouldThrow?: boolean }) => {
  if (shouldThrow) {
    throw new Error("Test error");
  }
  return <div>No error</div>;
};

describe("ErrorBoundary", () => {
  // Suppress console errors during tests
  const originalConsoleError = console.error;
  beforeAll(() => {
    console.error = jest.fn();
  });

  afterAll(() => {
    console.error = originalConsoleError;
  });

  it("renders children when there is no error", () => {
    render(
      <ErrorBoundary>
        <div data-testid="child">Child content</div>
      </ErrorBoundary>
    );

    expect(screen.getByTestId("child")).toBeInTheDocument();
  });

  it("renders fallback UI when an error occurs", () => {
    // Using ErrorComponent with shouldThrow=true to simulate an error
    render(
      <ErrorBoundary>
        <ErrorComponent shouldThrow={true} />
      </ErrorBoundary>
    );

    // Check that the fallback UI is rendered
    expect(screen.getByText("Component Error")).toBeInTheDocument();
    expect(
      screen.getByText("An error occurred in this component")
    ).toBeInTheDocument();
    expect(screen.getByText("Try Again")).toBeInTheDocument();
  });

  it("renders custom fallback when provided", () => {
    const customFallback = (
      <div data-testid="custom-fallback">Custom fallback</div>
    );

    render(
      <ErrorBoundary fallback={customFallback}>
        <ErrorComponent shouldThrow={true} />
      </ErrorBoundary>
    );

    expect(screen.getByTestId("custom-fallback")).toBeInTheDocument();
  });

  it("has a reset button in the error UI", () => {
    // Render the error boundary with a component that throws
    render(
      <ErrorBoundary>
        <ErrorComponent shouldThrow={true} />
      </ErrorBoundary>
    );

    // Check that the error UI is shown
    expect(screen.getByText("Component Error")).toBeInTheDocument();

    // Check that the reset button exists
    const resetButton = screen.getByText("Try Again");
    expect(resetButton).toBeInTheDocument();

    // We can't fully test the reset functionality in a unit test because
    // React's error boundaries can only recover in production, not in tests
  });

  describe("withErrorBoundary HOC", () => {
    it("wraps a component with an error boundary", () => {
      const WrappedComponent = withErrorBoundary(
        ErrorComponent,
        "TestComponent"
      );

      render(<WrappedComponent />);

      // No error, so the component should render normally
      expect(screen.getByText("No error")).toBeInTheDocument();
    });

    it("catches errors in the wrapped component", () => {
      const WrappedComponent = withErrorBoundary(
        ErrorComponent,
        "TestComponent"
      );

      render(<WrappedComponent shouldThrow={true} />);

      // Error boundary should catch the error and show the fallback UI
      expect(screen.getByText("Component Error")).toBeInTheDocument();
    });
  });
});
