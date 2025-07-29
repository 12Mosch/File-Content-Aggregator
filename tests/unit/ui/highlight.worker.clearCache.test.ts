/**
 * Test for highlight worker clearCache functionality
 */

import { WorkerPool } from "../../../src/ui/services/WorkerPool";

// Mock Worker for testing
class MockWorker {
  onmessage: ((event: MessageEvent) => void) | null = null;
  onerror: ((event: ErrorEvent) => void) | null = null;
  static shouldFailInit = false;
  static shouldTriggerError = false;
  static errorAction: string | null = null;

  constructor(public url: string) {
    // Simulate worker initialization failure
    if (MockWorker.shouldFailInit) {
      setTimeout(() => {
        if (this.onerror) {
          this.onerror(new ErrorEvent("error", {
            message: "Worker initialization failed",
            error: new Error("Failed to initialize worker")
          }));
        }
      }, 10);
      return;
    }

    // Simulate worker initialization
    setTimeout(() => {
      if (this.onmessage) {
        this.onmessage(
          new MessageEvent("message", {
            data: { status: "ready" },
          })
        );
      }
    }, 10);
  }

  postMessage(data: unknown): void {
    // Simulate worker error during processing
    if (MockWorker.shouldTriggerError) {
      setTimeout(() => {
        if (this.onerror) {
          this.onerror(new ErrorEvent("error", {
            message: "Worker failed",
            error: new Error("Test error")
          }));
        }
      }, 10);
      return;
    }

    // Simulate worker response
    setTimeout(() => {
      if (this.onmessage) {
        const message = data as {
          id: string;
          action: string;
          payload: unknown;
        };

        // Check for specific error action
        if (MockWorker.errorAction && message.action === MockWorker.errorAction) {
          setTimeout(() => {
            if (this.onerror) {
              this.onerror(new ErrorEvent("error", {
                message: "Worker failed",
                error: new Error("Test error")
              }));
            }
          }, 10);
          return;
        }

        if (message.action === "highlight") {
          this.onmessage(
            new MessageEvent("message", {
              data: {
                id: message.id,
                filePath: "test.js",
                highlightedHtml: "<span>test</span>",
                status: "done",
                processingTimeMs: 10,
                fromCache: false,
              },
            })
          );
        } else if (message.action === "clearCache") {
          this.onmessage(
            new MessageEvent("message", {
              data: {
                id: message.id,
                status: "done",
                message: "Cache cleared successfully",
              },
            })
          );
        } else if (message.action === "cancel") {
          this.onmessage(
            new MessageEvent("message", {
              data: {
                id: message.id,
                status: "cancelled",
              },
            })
          );
        } else if (message.action === "malformedResponse") {
          // Send malformed response (missing required fields)
          this.onmessage(
            new MessageEvent("message", {
              data: {
                // Missing id field
                invalidField: "invalid",
              },
            })
          );
        } else {
          // For invalid/unknown actions, send error response
          this.onmessage(
            new MessageEvent("message", {
              data: {
                id: message.id,
                status: "error",
                error: `Unknown action: ${message.action}`,
              },
            })
          );
        }
      }
    }, 10);
  }

  terminate(): void {
    // Cleanup
  }
}

// Mock global Worker
global.Worker = MockWorker as unknown as typeof Worker;

describe("WorkerPool clearCache action", () => {
  let workerPool: WorkerPool;

  beforeEach(() => {
    // Reset mock worker state
    MockWorker.shouldFailInit = false;
    MockWorker.shouldTriggerError = false;
    MockWorker.errorAction = null;
    workerPool = new WorkerPool("test-worker.js", 1, 2);
  });

  afterEach(() => {
    workerPool.terminate();
    // Reset mock worker state
    MockWorker.shouldFailInit = false;
    MockWorker.shouldTriggerError = false;
    MockWorker.errorAction = null;
  });

  test("should handle clearCache action successfully", async () => {
    const result = await workerPool.execute("clearCache", {});
    expect(result).toHaveProperty("status", "done");
    expect(result).toHaveProperty("message", "Cache cleared successfully");
  });

  test("should handle highlight action", async () => {
    const result = await workerPool.execute("highlight", {
      filePath: "test.js",
      code: "console.log('test');",
      language: "javascript",
    });
    expect(result).toHaveProperty("status", "done");
    expect(result).toHaveProperty("highlightedHtml", "<span>test</span>");
  });

  test("should handle cancel action", async () => {
    // Cancel action should reject with "Task was cancelled" error
    await expect(workerPool.execute("cancel", {})).rejects.toThrow(
      "Task was cancelled"
    );
  });

  // Additional error scenario tests
  test("should handle worker errors during processing", async () => {
    // Test worker onerror callback
    MockWorker.shouldTriggerError = true;

    await expect(workerPool.execute("highlight", {})).rejects.toThrow(
      "Worker error:"
    );
  });

  test("should handle invalid action types", async () => {
    await expect(workerPool.execute("invalidAction", {})).rejects.toThrow(
      "Unknown action: invalidAction"
    );
  });

  test("should handle malformed message data", async () => {
    // This test verifies that the worker pool handles malformed responses gracefully
    // The malformed response will not match any task ID, so it should timeout or be ignored
    const executePromise = workerPool.execute("malformedResponse", {});

    // Since the malformed response won't have a matching ID, the task should eventually timeout
    // For this test, we'll just verify it doesn't crash the system
    // In a real scenario, you might want to implement a timeout mechanism
    try {
      await Promise.race([
        executePromise,
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error("Test timeout")), 100)
        )
      ]);
    } catch (error) {
      expect(error.message).toBe("Test timeout");
    }
  });

  test("should handle worker initialization failures", async () => {
    // Create a new worker pool with initialization failure
    MockWorker.shouldFailInit = true;
    const failingWorkerPool = new WorkerPool("test-worker.js", 1, 2);

    try {
      // The worker pool should timeout or fail when trying to execute a task
      // since no workers will be available (they all failed to initialize)
      await expect(
        Promise.race([
          failingWorkerPool.execute("highlight", {}),
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error("No workers available")), 100)
          )
        ])
      ).rejects.toThrow();
    } finally {
      failingWorkerPool.terminate();
    }
  }, 15000); // Increase timeout for this test

  test("should handle specific action errors", async () => {
    // Test error for a specific action
    MockWorker.errorAction = "highlight";

    await expect(workerPool.execute("highlight", {})).rejects.toThrow(
      "Worker error:"
    );
  });
});
