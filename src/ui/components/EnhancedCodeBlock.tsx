/**
 * Enhanced Code Block Component
 *
 * A React component that provides enhanced syntax highlighting with
 * accessibility features, theme support, and performance optimizations.
 */

import React, { useEffect, useState, useRef } from "react";
import { useEnhancedHighlighting } from "../hooks/useEnhancedHighlighting";
import { highlightTermsInHtml } from "../highlightHtmlUtils";
import HighlightMatches from "../HighlightMatches";

export interface EnhancedCodeBlockProps {
  /** File path for the code */
  filePath: string;
  /** Code content to highlight */
  code: string;
  /** Programming language */
  language: string;
  /** Theme for highlighting */
  theme?: "light" | "dark" | "high-contrast";
  /** Search terms to highlight within the code */
  searchTerms?: (string | RegExp)[];
  /** Whether search is case sensitive */
  caseSensitive?: boolean;
  /** Whether to use whole word matching */
  wholeWordMatching?: boolean;
  /** Priority for highlighting request */
  priority?: "high" | "normal" | "low";
  /** Whether this code block is currently visible */
  isVisible?: boolean;
  /** Whether to show line numbers */
  showLineNumbers?: boolean;
  /** Maximum height before scrolling */
  maxHeight?: string;
  /** Callback when highlighting is complete */
  onHighlightComplete?: (processingTime: number, fromCache: boolean) => void;
  /** Callback when highlighting fails */
  onHighlightError?: (error: string) => void;
}

/**
 * Enhanced code block with syntax highlighting and accessibility
 */
export const EnhancedCodeBlock: React.FC<EnhancedCodeBlockProps> = ({
  filePath,
  code,
  language,
  theme = "light",
  searchTerms = [],
  caseSensitive = false,
  wholeWordMatching = false,
  priority = "normal",
  isVisible = false,
  showLineNumbers: _showLineNumbers = false,
  maxHeight = "400px",
  onHighlightComplete,
  onHighlightError,
}) => {
  const { highlightCache, requestHighlighting } = useEnhancedHighlighting({
    theme,
    enableAccessibility: true,
    prioritizeVisible: true,
  });

  const [isLoading, setIsLoading] = useState(false);
  const codeBlockRef = useRef<HTMLDivElement>(null);
  const highlightInfo = highlightCache.get(filePath);

  // Request highlighting when component mounts or dependencies change
  useEffect(() => {
    if (!code || !language) return;

    const performHighlighting = async () => {
      setIsLoading(true);
      try {
        await requestHighlighting(filePath, code, language, {
          priority,
          isVisible,
        });
      } catch (error) {
        console.error("Highlighting failed:", error);
        onHighlightError?.(
          error instanceof Error ? error.message : "Unknown error"
        );
      } finally {
        setIsLoading(false);
      }
    };

    void performHighlighting();
  }, [
    filePath,
    code,
    language,
    priority,
    isVisible,
    requestHighlighting,
    onHighlightError,
  ]);

  // Handle highlighting completion
  useEffect(() => {
    if (
      highlightInfo?.status === "done" &&
      highlightInfo.processingTimeMs !== undefined
    ) {
      onHighlightComplete?.(
        highlightInfo.processingTimeMs,
        highlightInfo.fromCache || false
      );
    } else if (highlightInfo?.status === "error" && highlightInfo.error) {
      onHighlightError?.(highlightInfo.error);
    }
  }, [highlightInfo, onHighlightComplete, onHighlightError]);

  // Generate unique ID for accessibility
  const blockId = `code-block-${filePath.replace(/[^a-zA-Z0-9]/g, "-")}`;

  // Render loading state
  if (isLoading || highlightInfo?.status === "pending") {
    return (
      <div
        className="hljs-enhanced hljs-loading"
        style={{ maxHeight }}
        role="status"
        aria-label="Syntax highlighting in progress"
      >
        <div className="flex items-center justify-center p-4">
          <div className="h-6 w-6 animate-spin rounded-full border-b-2 border-primary"></div>
          <span className="ml-2 text-sm text-muted-foreground">
            Highlighting {language} code...
          </span>
        </div>
      </div>
    );
  }

  // Render error state
  if (highlightInfo?.status === "error") {
    return (
      <div
        className="hljs-enhanced hljs-error"
        style={{ maxHeight }}
        role="alert"
        aria-label="Syntax highlighting error"
      >
        <div className="rounded border border-destructive p-4">
          <p className="mb-2 font-medium text-destructive">
            Highlighting Error
          </p>
          <p className="mb-3 text-sm text-muted-foreground">
            {highlightInfo.error}
          </p>
          <div className="text-sm">
            <span className="font-medium">Fallback:</span> Showing plain text
            with search highlighting
          </div>
        </div>
        <pre
          className="mt-2 overflow-auto rounded bg-muted p-4 font-mono text-sm"
          style={{ maxHeight: `calc(${maxHeight} - 120px)` }}
        >
          <code>
            <HighlightMatches
              text={code}
              terms={searchTerms}
              caseSensitive={caseSensitive}
              wholeWordMatching={wholeWordMatching}
            />
          </code>
        </pre>
      </div>
    );
  }

  // Render plain text fallback
  if (language === "plaintext" || !highlightInfo?.html) {
    return (
      <div
        id={blockId}
        className="hljs-enhanced hljs-plaintext"
        style={{ maxHeight }}
        role="region"
        aria-label={`Plain text code from ${filePath}`}
        tabIndex={0}
        ref={codeBlockRef}
      >
        <pre className="overflow-auto rounded bg-muted p-4 font-mono text-sm">
          <code>
            <HighlightMatches
              text={code}
              terms={searchTerms}
              caseSensitive={caseSensitive}
              wholeWordMatching={wholeWordMatching}
            />
          </code>
        </pre>
      </div>
    );
  }

  // Render syntax highlighted code
  const enhancedHtml =
    searchTerms.length > 0
      ? highlightTermsInHtml(
          highlightInfo.html,
          searchTerms,
          caseSensitive,
          wholeWordMatching
        )
      : highlightInfo.html;

  return (
    <div
      id={blockId}
      className={`hljs-enhanced hljs-theme-${theme}`}
      style={{ maxHeight }}
      ref={codeBlockRef}
    >
      {/* Skip link for long code blocks */}
      {code.split("\n").length > 20 && (
        <a
          href={`#${blockId}-end`}
          className="hljs-skip-link sr-only-focusable"
        >
          Skip code block ({code.split("\n").length} lines)
        </a>
      )}

      {/* Performance info for debugging */}
      {process.env.NODE_ENV === "development" &&
        highlightInfo.processingTimeMs && (
          <div className="border-b p-2 text-xs text-muted-foreground">
            Highlighted in {highlightInfo.processingTimeMs.toFixed(2)}ms
            {highlightInfo.fromCache && " (cached)"}
          </div>
        )}

      {/* Main code content */}
      <div
        className="hljs-content-wrapper overflow-auto"
        style={{ maxHeight: `calc(${maxHeight} - 40px)` }}
      >
        <div
          dangerouslySetInnerHTML={{ __html: enhancedHtml }}
          className="hljs-content"
        />
      </div>

      {/* Skip target for accessibility */}
      {code.split("\n").length > 20 && (
        <div id={`${blockId}-end`} className="hljs-skip-target" tabIndex={-1} />
      )}
    </div>
  );
};

// Utility functions moved to src/ui/utils/codeBlockUtils.ts

export default EnhancedCodeBlock;
