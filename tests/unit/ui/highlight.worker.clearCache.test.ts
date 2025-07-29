/**
 * Test for highlight worker clearCache functionality
 */

import { WorkerPool } from "../../../src/ui/services/WorkerPool";

// Mock Worker for testing
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
        const message = data as {
          id: string;
          action: string;
          payload: unknown;
        };

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
    workerPool = new WorkerPool("test-worker.js", 1, 2);
  });

  afterEach(() => {
    workerPool.terminate();
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
});
