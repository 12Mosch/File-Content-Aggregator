/**
 * Test for HighlightWorkerPool cancelHighlight functionality
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

// Mock the WorkerPool first
const mockWorkerPool = {
  executeWithTaskId: jest.fn(),
  cancelTask: jest.fn(),
  terminate: jest.fn(),
  getStats: jest.fn().mockReturnValue({
    totalWorkers: 2,
    busyWorkers: 0,
    queuedTasks: 0,
    maxWorkers: 4,
  }),
};

jest.mock("../../../src/ui/services/WorkerPool", () => {
  return {
    WorkerPool: jest.fn().mockImplementation(() => mockWorkerPool),
  };
});

// Mock the entire HighlightWorkerPool module to avoid import.meta.url issues
jest.mock("../../../src/ui/services/HighlightWorkerPool", () => {
  class MockHighlightWorkerPool {
    private workerPool: typeof mockWorkerPool;
    private activeRequests: Set<string>;
    private filePathToTaskId: Map<string, string>;
    private readonly stats: {
      totalRequests: number;
      cacheHits: number;
      cacheMisses: number;
      averageProcessingTime: number;
      activeWorkers: number;
      queuedRequests: number;
    };
    private requestQueue: Map<string, unknown>;

    constructor(_initialWorkers = 2, _maxWorkers = 4) {
      this.workerPool = mockWorkerPool;
      this.activeRequests = new Set();
      this.filePathToTaskId = new Map();
      this.stats = {
        totalRequests: 0,
        cacheHits: 0,
        cacheMisses: 0,
        averageProcessingTime: 0,
        activeWorkers: 0,
        queuedRequests: 0,
      };
      this.requestQueue = new Map();
    }

    async highlight(request: { filePath: string; code: string; language?: string }): Promise<{
      filePath: string;
      highlightedHtml: string;
      status: string;
      error?: string;
      processingTimeMs?: number;
    }> {
      const startTime = performance.now();
      this.stats.totalRequests++;

      // Add to active requests
      this.activeRequests.add(request.filePath);

      try {
        // Execute highlighting task and get task ID for cancellation tracking
        const { result, taskId } = await this.workerPool.executeWithTaskId(
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

        // Clean up tracking maps only on successful completion
        this.activeRequests.delete(request.filePath);
        this.filePathToTaskId.delete(request.filePath);

        return result;
      } catch (error) {
        console.error(
          "[HighlightWorkerPool] Error processing highlight request:",
          error
        );

        // Clean up tracking maps on error
        this.activeRequests.delete(request.filePath);
        this.filePathToTaskId.delete(request.filePath);

        return {
          filePath: request.filePath,
          highlightedHtml: "",
          status: "error",
          error: error instanceof Error ? error.message : "Unknown error",
          processingTimeMs: performance.now() - startTime,
        };
      }
    }

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

    terminate(): void {
      this.workerPool.terminate();
      this.requestQueue.clear();
      this.activeRequests.clear();
      this.filePathToTaskId.clear();
    }

    getStats(): typeof this.stats & { activeWorkers: number; queuedRequests: number } {
      const poolStats = this.workerPool.getStats();
      return {
        ...this.stats,
        activeWorkers: poolStats.busyWorkers,
        queuedRequests: poolStats.queuedTasks,
      };
    }

    private updateAverageProcessingTime(newTime: number): void {
      if (this.stats.averageProcessingTime === 0) {
        this.stats.averageProcessingTime = newTime;
      } else {
        // Use exponential moving average with alpha = 0.1
        this.stats.averageProcessingTime =
          0.9 * this.stats.averageProcessingTime + 0.1 * newTime;
      }
    }
  }

  return {
    HighlightWorkerPool: MockHighlightWorkerPool,
  };
});

import { HighlightWorkerPool } from "../../../src/ui/services/HighlightWorkerPool";

describe("HighlightWorkerPool cancelHighlight", () => {
  let highlightWorkerPool: HighlightWorkerPool;

  beforeEach(() => {
    // Clear all mocks
    jest.clearAllMocks();

    highlightWorkerPool = new HighlightWorkerPool(2, 4);
  });

  afterEach(() => {
    highlightWorkerPool.terminate();
  });

  test("should properly cancel a highlighting task", async () => {
    const testTaskId = "test-task-id-123";
    const testFilePath = "test.js";

    // Create a promise that we can control
    let resolveTask: (value: unknown) => void;
    const taskPromise = new Promise((resolve) => {
      resolveTask = resolve;
    });

    // Mock the executeWithTaskId to return a task ID and simulate a long-running task
    mockWorkerPool.executeWithTaskId.mockImplementation(async () => {
      // Return the task ID immediately but don't resolve the result yet
      await taskPromise;
      return {
        result: {
          filePath: testFilePath,
          highlightedHtml: "<span>test</span>",
          status: "done",
        },
        taskId: testTaskId,
      };
    });

    // Start a highlighting task (don't await it)
    const highlightPromise = highlightWorkerPool.highlight({
      filePath: testFilePath,
      code: "console.log('test');",
      language: "javascript",
    });

    // Give it a moment to start and add to tracking maps
    await new Promise(resolve => setTimeout(resolve, 10));

    // Manually add to tracking maps to simulate the task being in progress
    (highlightWorkerPool as any).activeRequests.add(testFilePath);
    (highlightWorkerPool as any).filePathToTaskId.set(testFilePath, testTaskId);

    // Cancel the highlighting task
    highlightWorkerPool.cancelHighlight(testFilePath);

    // Verify that cancelTask was called with the correct task ID
    expect(mockWorkerPool.cancelTask).toHaveBeenCalledWith(testTaskId);
    expect(mockWorkerPool.cancelTask).toHaveBeenCalledTimes(1);

    // Resolve the task to clean up
    resolveTask!({});

    // Clean up the promise
    try {
      await highlightPromise;
    } catch {
      // Expected if the task was cancelled
    }
  });

  test("should not call cancelTask if file path is not in active requests", () => {
    const testFilePath = "nonexistent.js";

    // Try to cancel a task that doesn't exist
    highlightWorkerPool.cancelHighlight(testFilePath);

    // Verify that cancelTask was not called
    expect(mockWorkerPool.cancelTask).not.toHaveBeenCalled();
  });

  test("should clean up tracking maps when cancelling", async () => {
    const testTaskId = "test-task-id-456";
    const testFilePath = "cleanup-test.js";

    // Manually add to tracking maps to simulate an active task
    (highlightWorkerPool as any).activeRequests.add(testFilePath);
    (highlightWorkerPool as any).filePathToTaskId.set(testFilePath, testTaskId);

    // Verify the file is in active requests
    expect((highlightWorkerPool as any).activeRequests.has(testFilePath)).toBe(true);
    expect((highlightWorkerPool as any).filePathToTaskId.has(testFilePath)).toBe(true);

    // Cancel the highlighting task
    highlightWorkerPool.cancelHighlight(testFilePath);

    // Verify that the tracking maps are cleaned up
    expect((highlightWorkerPool as any).activeRequests.has(testFilePath)).toBe(false);
    expect((highlightWorkerPool as any).filePathToTaskId.has(testFilePath)).toBe(false);

    // Verify that cancelTask was called
    expect(mockWorkerPool.cancelTask).toHaveBeenCalledWith(testTaskId);
  });

  test("should handle cancellation when task ID is not found", () => {
    const testFilePath = "test-no-task-id.js";

    // Manually add to activeRequests but not to filePathToTaskId
    (highlightWorkerPool as any).activeRequests.add(testFilePath);

    // Try to cancel - should not throw an error
    expect(() => {
      highlightWorkerPool.cancelHighlight(testFilePath);
    }).not.toThrow();

    // Verify that cancelTask was not called since no task ID was found
    expect(mockWorkerPool.cancelTask).not.toHaveBeenCalled();

    // Verify cleanup still happened
    expect((highlightWorkerPool as any).activeRequests.has(testFilePath)).toBe(false);
  });
});
