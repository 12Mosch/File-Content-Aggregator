/**
 * Enhanced Highlighting Hook
 *
 * Custom hook that provides enhanced syntax highlighting capabilities
 * using the new HighlightWorkerPool with theme support, accessibility,
 * and performance optimizations.
 */

import { useEffect, useRef, useState, useCallback } from "react";
import {
  getHighlightWorkerPool,
  HighlightRequest,
  HighlightResult,
} from "../services/HighlightWorkerPool";

export interface HighlightInfo {
  status: "idle" | "pending" | "done" | "error" | "partial";
  html?: string;
  error?: string;
  progress?: number;
  processingTimeMs?: number;
  fromCache?: boolean;
}

export interface UseEnhancedHighlightingOptions {
  theme?: "light" | "dark" | "high-contrast";
  enableAccessibility?: boolean;
  prioritizeVisible?: boolean;
}

export interface UseEnhancedHighlightingReturn {
  highlightCache: Map<string, HighlightInfo>;
  requestHighlighting: (
    filePath: string,
    code: string,
    language: string,
    options?: {
      priority?: "high" | "normal" | "low";
      isVisible?: boolean;
      forceUpdate?: boolean;
    }
  ) => Promise<void>;
  clearCache: () => void;
  getStats: () => Record<string, unknown>;
  cancelHighlight: (filePath: string) => void;
}

/**
 * Enhanced highlighting hook with worker pool support
 */
export function useEnhancedHighlighting(
  options: UseEnhancedHighlightingOptions = {}
): UseEnhancedHighlightingReturn {
  const { theme = "light", prioritizeVisible = true } = options;

  const [highlightCache, setHighlightCache] = useState<
    Map<string, HighlightInfo>
  >(new Map());
  const workerPoolRef = useRef(getHighlightWorkerPool());
  const activeRequestsRef = useRef<Set<string>>(new Set());

  /**
   * Request syntax highlighting for a file
   */
  const requestHighlighting = useCallback(
    async (
      filePath: string,
      code: string,
      language: string,
      requestOptions: {
        priority?: "high" | "normal" | "low";
        isVisible?: boolean;
        forceUpdate?: boolean;
      } = {}
    ) => {
      const {
        priority = "normal",
        isVisible = false,
        forceUpdate = false,
      } = requestOptions;

      // Check if already processing this file
      if (activeRequestsRef.current.has(filePath) && !forceUpdate) {
        return;
      }

      // Check cache first (unless forcing update)
      if (!forceUpdate) {
        const cached = highlightCache.get(filePath);
        if (
          cached &&
          (cached.status === "done" || cached.status === "pending")
        ) {
          return;
        }
      }

      // Mark as pending
      setHighlightCache((prev) => {
        const newCache = new Map(prev);
        newCache.set(filePath, { status: "pending" });
        return newCache;
      });

      // Add to active requests
      activeRequestsRef.current.add(filePath);

      try {
        const request: HighlightRequest = {
          filePath,
          code,
          language,
          theme,
          priority: prioritizeVisible && isVisible ? "high" : priority,
          isVisible,
        };

        const result: HighlightResult =
          await workerPoolRef.current.highlight(request);

        // Update cache with result
        setHighlightCache((prev) => {
          const newCache = new Map(prev);
          newCache.set(filePath, {
            status: result.status,
            html: result.highlightedHtml,
            error: result.error,
            progress: result.progress,
            processingTimeMs: result.processingTimeMs,
            fromCache: result.fromCache,
          });
          return newCache;
        });

        // Cache updated, component will re-render automatically
      } catch (error) {
        console.error("[useEnhancedHighlighting] Error:", error);

        // Update cache with error
        setHighlightCache((prev) => {
          const newCache = new Map(prev);
          newCache.set(filePath, {
            status: "error",
            error: error instanceof Error ? error.message : "Unknown error",
          });
          return newCache;
        });

        // Cache updated, component will re-render automatically
      } finally {
        // Remove from active requests
        activeRequestsRef.current.delete(filePath);
      }
    },
    [highlightCache, theme, prioritizeVisible]
  );

  /**
   * Cancel a highlighting request
   */
  const cancelHighlight = useCallback((filePath: string) => {
    workerPoolRef.current.cancelHighlight(filePath);
    activeRequestsRef.current.delete(filePath);

    // Update cache to remove pending status
    setHighlightCache((prev) => {
      const newCache = new Map(prev);
      const current = newCache.get(filePath);
      if (current?.status === "pending") {
        newCache.set(filePath, { status: "idle" });
      }
      return newCache;
    });
  }, []);

  /**
   * Clear all caches
   */
  const clearCache = useCallback(() => {
    setHighlightCache(new Map());
    activeRequestsRef.current.clear();
    void workerPoolRef.current.clearCache();
  }, []);

  /**
   * Get performance statistics
   */
  const getStats = useCallback(() => {
    return {
      ...workerPoolRef.current.getStats(),
      ...workerPoolRef.current.getPerformanceMetrics(),
      cacheSize: highlightCache.size,
      activeRequests: activeRequestsRef.current.size,
    };
  }, [highlightCache.size]);

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
    highlightCache,
    requestHighlighting,
    clearCache,
    getStats,
    cancelHighlight,
  };
}

/**
 * Hook for batch highlighting operations
 */
export function useBatchHighlighting(
  options: UseEnhancedHighlightingOptions = {}
) {
  const workerPoolRef = useRef(getHighlightWorkerPool());

  const highlightBatch = useCallback(
    async (
      requests: Array<{
        filePath: string;
        code: string;
        language: string;
        priority?: "high" | "normal" | "low";
      }>
    ): Promise<HighlightResult[]> => {
      const highlightRequests: HighlightRequest[] = requests.map((req) => ({
        ...req,
        theme: options.theme,
        priority: req.priority || "normal",
      }));

      return workerPoolRef.current.highlightBatch(highlightRequests);
    },
    [options.theme]
  );

  return { highlightBatch };
}

/**
 * Hook for highlighting performance monitoring
 */
export function useHighlightingPerformance() {
  const workerPoolRef = useRef(getHighlightWorkerPool());
  const [metrics, setMetrics] = useState<Record<string, unknown>>({});

  const updateMetrics = useCallback(() => {
    const stats = workerPoolRef.current.getStats();
    const performance = workerPoolRef.current.getPerformanceMetrics();
    setMetrics({ ...stats, ...performance });
  }, []);

  useEffect(() => {
    const interval = setInterval(updateMetrics, 5000); // Update every 5 seconds
    return () => clearInterval(interval);
  }, [updateMetrics]);

  return { metrics, updateMetrics };
}
