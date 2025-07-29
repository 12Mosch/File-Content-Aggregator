/**
 * Results Highlighting Hook
 *
 * Custom hook that integrates the enhanced highlighting system with the existing
 * ResultsDisplay component, maintaining backward compatibility while adding new features.
 */

import { useCallback, useRef, useState, useEffect } from "react";
import { getHighlightWorkerPool } from "../services/HighlightWorkerPool";
import { getCurrentTheme } from "../utils/themeDetection";

// Legacy interface for backward compatibility
export interface LegacyHighlightInfo {
  status: "idle" | "pending" | "done" | "error";
  html?: string;
  error?: string;
}

export type LegacyHighlightCache = Map<string, LegacyHighlightInfo>;

/**
 * Enhanced highlighting hook that maintains compatibility with existing ResultsDisplay
 */
export function useResultsHighlighting() {
  const [highlightUpdateCounter, setHighlightUpdateCounter] = useState(0);
  const highlightCacheRef = useRef<LegacyHighlightCache>(new Map());
  const workerPoolRef = useRef(getHighlightWorkerPool());
  const activeRequestsRef = useRef<Set<string>>(new Set());

  /**
   * Request highlighting with enhanced features while maintaining legacy interface
   */
  const requestHighlighting = useCallback(
    async (
      filePath: string,
      code: string,
      language: string,
      forceUpdate: boolean = false
    ) => {
      // Prevent duplicate requests
      if (activeRequestsRef.current.has(filePath) && !forceUpdate) {
        return;
      }

      // Check cache first (unless forcing update)
      if (!forceUpdate) {
        const cached = highlightCacheRef.current.get(filePath);
        if (
          cached &&
          (cached.status === "done" || cached.status === "pending")
        ) {
          return;
        }
      }

      // Mark as pending
      highlightCacheRef.current.set(filePath, { status: "pending" });
      setHighlightUpdateCounter((prev) => prev + 1);
      activeRequestsRef.current.add(filePath);

      try {
        // Get current theme
        const currentTheme = getCurrentTheme();

        // Use enhanced highlighting system
        const result = await workerPoolRef.current.highlight({
          filePath,
          code,
          language,
          theme: currentTheme,
          priority: "normal",
          isVisible: true, // Assume visible for now
        });

        // Convert to legacy format
        const legacyResult: LegacyHighlightInfo = {
          status:
            result.status === "done"
              ? "done"
              : result.status === "error"
                ? "error"
                : "pending",
          html: result.highlightedHtml,
          error: result.error,
        };

        // Update cache
        highlightCacheRef.current.set(filePath, legacyResult);
        setHighlightUpdateCounter((prev) => prev + 1);
      } catch (error) {
        console.error("[useResultsHighlighting] Error:", error);

        // Update cache with error
        highlightCacheRef.current.set(filePath, {
          status: "error",
          error: error instanceof Error ? error.message : "Unknown error",
        });
        setHighlightUpdateCounter((prev) => prev + 1);
      } finally {
        // Remove from active requests
        activeRequestsRef.current.delete(filePath);
      }
    },
    []
  );

  /**
   * Get performance statistics
   */
  const getStats = useCallback(() => {
    return workerPoolRef.current.getStats();
  }, []);

  /**
   * Clear all caches
   */
  const clearCache = useCallback(() => {
    highlightCacheRef.current.clear();
    activeRequestsRef.current.clear();
    workerPoolRef.current.clearCache();
    setHighlightUpdateCounter((prev) => prev + 1);
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    const workerPool = workerPoolRef.current;
    const activeRequests = activeRequestsRef.current;

    return () => {
      // Cancel all active requests
      activeRequests.forEach((filePath) => {
        workerPool.cancelHighlight(filePath);
      });
      activeRequests.clear();
    };
  }, []);

  return {
    highlightCache: highlightCacheRef.current,
    highlightUpdateCounter,
    requestHighlighting,
    getStats,
    clearCache,
  };
}

/**
 * Hook for batch highlighting operations in results
 */
export function useResultsBatchHighlighting() {
  const workerPoolRef = useRef(getHighlightWorkerPool());

  const highlightBatch = useCallback(
    async (
      requests: Array<{
        filePath: string;
        code: string;
        language: string;
        isVisible?: boolean;
      }>
    ): Promise<void> => {
      const currentTheme = getCurrentTheme();

      const highlightRequests = requests.map((req) => ({
        ...req,
        theme: currentTheme,
        priority: req.isVisible ? ("high" as const) : ("normal" as const),
      }));

      try {
        await workerPoolRef.current.highlightBatch(highlightRequests);
      } catch (error) {
        console.error(
          "[useResultsBatchHighlighting] Batch highlighting failed:",
          error
        );
      }
    },
    []
  );

  return { highlightBatch };
}

/**
 * Hook for monitoring highlighting performance in results
 */
export function useResultsHighlightingPerformance() {
  const workerPoolRef = useRef(getHighlightWorkerPool());
  const [metrics, setMetrics] = useState<Record<string, unknown>>({});

  const updateMetrics = useCallback(() => {
    const stats = workerPoolRef.current.getStats();
    const performance = workerPoolRef.current.getPerformanceMetrics();
    setMetrics({ ...stats, ...performance });
  }, []);

  useEffect(() => {
    // Update metrics every 10 seconds
    const interval = setInterval(updateMetrics, 10000);

    // Initial update
    updateMetrics();

    return () => clearInterval(interval);
  }, [updateMetrics]);

  return { metrics, updateMetrics };
}

/**
 * Utility function to detect if enhanced highlighting is available
 */
export function isEnhancedHighlightingAvailable(): boolean {
  try {
    // Check if the enhanced highlighting system is available
    const workerPool = getHighlightWorkerPool();
    return !!workerPool;
  } catch {
    return false;
  }
}

/**
 * Migration helper to gradually replace legacy highlighting
 */
export function createLegacyCompatibleHighlighter() {
  const workerPool = getHighlightWorkerPool();

  return {
    postMessage: async (data: {
      filePath: string;
      code: string;
      language: string;
    }) => {
      try {
        const currentTheme = getCurrentTheme();
        const result = await workerPool.highlight({
          ...data,
          theme: currentTheme,
          priority: "normal",
        });

        // Simulate legacy worker message format
        const legacyMessage = {
          filePath: data.filePath,
          status: result.status,
          highlightedHtml: result.highlightedHtml,
          error: result.error,
        };

        // Return promise that resolves with legacy format
        return Promise.resolve(legacyMessage);
      } catch (error) {
        return Promise.resolve({
          filePath: data.filePath,
          status: "error",
          error: error instanceof Error ? error.message : "Unknown error",
        });
      }
    },

    terminate: () => {
      // Enhanced system handles termination automatically
      console.log(
        "[Legacy Highlighter] Termination requested - handled by enhanced system"
      );
    },
  };
}
