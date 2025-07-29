/**
 * Code Block Utilities
 *
 * Utility functions for managing code blocks and highlighting.
 */

import { getHighlightWorkerPool } from "../services/HighlightWorkerPool";

/**
 * Hook for managing multiple code blocks
 */
export function useCodeBlockManager() {
  // This would need to be implemented with proper React hooks
  // For now, providing the interface
  throw new Error("useCodeBlockManager requires React hooks implementation");
}

/**
 * Check if enhanced highlighting is available
 */
export function isEnhancedHighlightingAvailable(): boolean {
  try {
    const workerPool = getHighlightWorkerPool();
    return !!workerPool;
  } catch {
    return false;
  }
}

/**
 * Get highlighting performance metrics
 */
export function getHighlightingMetrics() {
  try {
    const workerPool = getHighlightWorkerPool();
    return {
      ...workerPool.getStats(),
      ...workerPool.getPerformanceMetrics(),
    };
  } catch {
    return null;
  }
}

/**
 * Clear all highlighting caches
 */
export function clearAllHighlightingCaches(): void {
  try {
    const workerPool = getHighlightWorkerPool();
    workerPool.clearCache();
  } catch (error) {
    console.error("Failed to clear highlighting caches:", error);
  }
}

/**
 * Batch highlight multiple code snippets
 */
export async function batchHighlight(
  requests: Array<{
    filePath: string;
    code: string;
    language: string;
    theme?: "light" | "dark" | "high-contrast";
  }>
) {
  try {
    const workerPool = getHighlightWorkerPool();
    return await workerPool.highlightBatch(requests);
  } catch (error) {
    console.error("Batch highlighting failed:", error);
    return [];
  }
}
