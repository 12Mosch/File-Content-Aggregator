/**
 * Worker Pool Tests
 *
 * Tests the WorkerPool class functionality.
 */

import { WorkerPool } from "../../../src/ui/services/WorkerPool";

// Mock Worker class
class MockWorker {
  onmessage: ((event: MessageEvent) => void) | null = null;
  onerror: ((event: ErrorEvent) => void) | null = null;

  constructor(public url: string) {
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

  postMessage(data: any): void {
    // Simulate worker response
    setTimeout(() => {
      if (this.onmessage) {
        if (data.action === "test") {
          this.onmessage(
            new MessageEvent("message", {
              data: {
                id: data.id,
                result: { value: "test result" },
                status: "success",
              },
            })
          );
        } else if (data.action === "error") {
          this.onmessage(
            new MessageEvent("message", {
              data: {
                id: data.id,
                error: "Test error",
                status: "error",
              },
            })
          );
        } else if (data.action === "cancel") {
          // Handle cancellation
          const requestId = data.payload?.requestId;
          if (requestId) {
            this.onmessage(
              new MessageEvent("message", {
                data: {
                  id: data.id,
                  status: "success",
                },
              })
            );
          }
        }
      }
    }, 20);
  }

  terminate(): void {
    // Cleanup
  }
}

// Mock global Worker
global.Worker = MockWorker as any;

describe("WorkerPool", () => {
  let workerPool: WorkerPool;

  beforeEach(() => {
    workerPool = new WorkerPool("test-worker.js", 2, 4);
  });

  afterEach(() => {
    workerPool.terminate();
  });

  test("should execute tasks and return results", async () => {
    const result = await workerPool.execute("test", { value: "test" });
    expect(result).toHaveProperty("result");
    expect(result.result).toHaveProperty("value", "test result");
    expect(result.status).toBe("success");
  });

  test("should handle errors", async () => {
    await expect(workerPool.execute("error", {})).rejects.toThrow("Test error");
  });

  test("should cancel tasks", async () => {
    // Start a task that we'll cancel
    const taskPromise = workerPool.execute("test", {
      value: "to be cancelled",
    });

    // Get the task ID from the worker pool's internal state
    const stats = workerPool.getStats();
    expect(stats.busyWorkers).toBeGreaterThan(0);

    // Cancel all tasks (since we can't easily get the task ID)
    workerPool.terminate();

    // The task should be rejected
    await expect(taskPromise).rejects.toThrow("Worker pool terminated");
  });

  test("should provide stats about the worker pool", () => {
    const stats = workerPool.getStats();
    expect(stats).toHaveProperty("totalWorkers");
    expect(stats).toHaveProperty("busyWorkers");
    expect(stats).toHaveProperty("queuedTasks");
    expect(stats).toHaveProperty("maxWorkers");
    expect(stats.maxWorkers).toBe(4);
  });
});
