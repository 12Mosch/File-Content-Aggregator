/**
 * Highlight Worker Pool Service
 *
 * Manages a pool of highlighting workers for concurrent syntax highlighting processing.
 * Provides enhanced features like priority queuing, theme support, and performance monitoring.
 */

import { WorkerPool } from "./WorkerPool";

export interface HighlightRequest {
  filePath: string;
  code: string;
  language?: string;
  theme?: "light" | "dark" | "high-contrast";
  priority?: "high" | "normal" | "low";
  isVisible?: boolean;
}

export interface HighlightResult {
  filePath: string;
  highlightedHtml: string;
  status: "done" | "error" | "partial";
  error?: string;
  progress?: number;
  processingTimeMs?: number;
  fromCache?: boolean;
}

export interface HighlightStats {
  totalRequests: number;
  cacheHits: number;
  cacheMisses: number;
  averageProcessingTime: number;
  activeWorkers: number;
  queuedRequests: number;
}

export class HighlightWorkerPool {
  private workerPool: WorkerPool;
  private readonly stats: HighlightStats;
  private requestQueue: Map<string, HighlightRequest>;
  private activeRequests: Set<string>;
  private filePathToTaskId: Map<string, string>;

  constructor(initialWorkers = 2, maxWorkers = 4) {
    // Create worker pool with highlight worker script
    this.workerPool = new WorkerPool(
      new URL("../highlight.worker.ts", import.meta.url).href,
      initialWorkers,
      maxWorkers
    );

    this.stats = {
      totalRequests: 0,
      cacheHits: 0,
      cacheMisses: 0,
      averageProcessingTime: 0,
      activeWorkers: 0,
      queuedRequests: 0,
    };

    this.requestQueue = new Map();
    this.activeRequests = new Set();
    this.filePathToTaskId = new Map();
  }

  /**
   * Request syntax highlighting for a file
   */
  async highlight(request: HighlightRequest): Promise<HighlightResult> {
    const startTime = performance.now();
    this.stats.totalRequests++;

    // Add to active requests
    this.activeRequests.add(request.filePath);

    try {
      // Execute highlighting task and get task ID for cancellation tracking
      const { result, taskId } = await this.workerPool.executeWithTaskId<HighlightResult>(
        "highlight",
        request
      );

      // Store task ID for potential cancellation
      this.filePathToTaskId.set(request.filePath, taskId);

      // Update stats
      if (result.fromCache) {
        this.stats.cacheHits++;
      } else {
        this.stats.cacheMisses++;
      }

      const processingTime = performance.now() - startTime;
      this.updateAverageProcessingTime(processingTime);

      return result;
    } catch (error) {
      console.error(
        "[HighlightWorkerPool] Error processing highlight request:",
        error
      );
      return {
        filePath: request.filePath,
        highlightedHtml: "",
        status: "error",
        error: error instanceof Error ? error.message : "Unknown error",
        processingTimeMs: performance.now() - startTime,
      };
    } finally {
      // Clean up tracking maps
      this.activeRequests.delete(request.filePath);
      this.filePathToTaskId.delete(request.filePath);
    }
  }

  /**
   * Batch highlight multiple files
   */
  async highlightBatch(
    requests: HighlightRequest[]
  ): Promise<HighlightResult[]> {
    const promises = requests.map((request) => this.highlight(request));
    return Promise.all(promises);
  }

  /**
   * Cancel a specific highlighting request
   */
  cancelHighlight(filePath: string): void {
    if (this.activeRequests.has(filePath)) {
      // Get the task ID for this file path
      const taskId = this.filePathToTaskId.get(filePath);

      if (taskId) {
        // Cancel the actual worker task
        this.workerPool.cancelTask(taskId);
        console.log(`[HighlightWorkerPool] Cancelled highlighting task for ${filePath}`);
      }

      // Clean up tracking maps
      this.activeRequests.delete(filePath);
      this.filePathToTaskId.delete(filePath);
    }
  }

  /**
   * Get current statistics
   */
  getStats(): HighlightStats {
    const poolStats = this.workerPool.getStats();
    return {
      ...this.stats,
      activeWorkers: poolStats.busyWorkers,
      queuedRequests: poolStats.queuedTasks,
    };
  }

  /**
   * Clear all caches (sends message to all workers)
   */
  async clearCache(): Promise<void> {
    try {
      // Send clearCache action to all workers
      await this.workerPool.execute("clearCache", {});
      console.log("[HighlightWorkerPool] Cache cleared successfully");
    } catch (error) {
      console.error("[HighlightWorkerPool] Failed to clear cache:", error);
    }
  }

  /**
   * Terminate the worker pool
   */
  terminate(): void {
    this.workerPool.terminate();
    this.requestQueue.clear();
    this.activeRequests.clear();
    this.filePathToTaskId.clear();
  }

  /**
   * Update average processing time using exponential moving average
   */
  private updateAverageProcessingTime(newTime: number): void {
    if (this.stats.averageProcessingTime === 0) {
      this.stats.averageProcessingTime = newTime;
    } else {
      // Use exponential moving average with alpha = 0.1
      this.stats.averageProcessingTime =
        0.9 * this.stats.averageProcessingTime + 0.1 * newTime;
    }
  }

  /**
   * Get performance metrics
   */
  getPerformanceMetrics() {
    const stats = this.getStats();
    return {
      cacheHitRate:
        stats.totalRequests > 0 ? stats.cacheHits / stats.totalRequests : 0,
      averageProcessingTime: stats.averageProcessingTime,
      throughput: stats.totalRequests,
      efficiency:
        stats.activeWorkers > 0
          ? stats.queuedRequests / stats.activeWorkers
          : 0,
    };
  }
}

// Singleton instance for global use
let highlightWorkerPoolInstance: HighlightWorkerPool | null = null;

/**
 * Get the global highlight worker pool instance
 */
export function getHighlightWorkerPool(): HighlightWorkerPool {
  if (!highlightWorkerPoolInstance) {
    highlightWorkerPoolInstance = new HighlightWorkerPool();
  }
  return highlightWorkerPoolInstance;
}
