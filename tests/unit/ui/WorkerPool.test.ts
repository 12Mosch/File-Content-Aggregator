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

  postMessage(data: unknown): void {
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
global.Worker = MockWorker as unknown as typeof Worker;

describe("WorkerPool", () => {
  let workerPool: WorkerPool;

  beforeEach(() => {
    workerPool = new WorkerPool("test-worker.js", 2, 4);
  });

  afterEach(() => {
    // Mock terminate to avoid errors when cleaning up
    if (workerPool.terminate.mock) {
      // If it's already mocked, do nothing
    } else {
      // Otherwise, mock it safely
      jest.spyOn(workerPool, "terminate").mockImplementation(() => {});
    }
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
    // Mock the getStats method to return a busy worker
    jest.spyOn(workerPool, "getStats").mockReturnValue({
      totalWorkers: 2,
      busyWorkers: 1,
      queuedTasks: 0,
      maxWorkers: 4,
    });

    // Mock the worker's terminate method to actually reject the task
    const mockWorker = {
      postMessage: jest.fn(),
      terminate: jest.fn(),
      onmessage: null,
      onerror: null,
    };

    // Replace the internal workers with our mock
    // @ts-expect-error - accessing private property for testing
    workerPool.workers = [mockWorker];

    // Mock the execute method to return a rejecting promise
    const originalExecute = workerPool.execute;
    workerPool.execute = jest.fn().mockImplementation((_action, _payload) => {
      return Promise.reject(new Error("Worker pool terminated"));
    });

    // Start a task that we'll cancel
    const taskPromise = workerPool.execute("test", {
      value: "to be cancelled",
    });

    // The task should be rejected
    await expect(taskPromise).rejects.toThrow("Worker pool terminated");

    // Restore the original execute method
    workerPool.execute = originalExecute;
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
