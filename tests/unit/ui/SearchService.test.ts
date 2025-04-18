/**
 * Search Service Tests
 *
 * Tests the SearchService class functionality.
 */

import {
  SearchService,
  SearchEventType,
} from "../../../src/ui/services/SearchService";

// Mock WorkerPool
jest.mock("../../../src/ui/services/WorkerPool", () => {
  return {
    WorkerPool: jest.fn().mockImplementation(() => {
      return {
        execute: jest.fn().mockImplementation((action, payload) => {
          if (action === "search") {
            return Promise.resolve({
              id: "test-id",
              result: {
                matches: [0, 10, 20],
                matchCount: 3,
                processingTimeMs: 5,
              },
              status: "success",
            });
          }
          return Promise.resolve({ status: "success" });
        }),
        terminate: jest.fn(),
      };
    }),
  };
});

describe("SearchService", () => {
  let searchService: SearchService;

  beforeEach(() => {
    // Clear all instances and calls to constructor and all methods
    jest.clearAllMocks();
    searchService = SearchService.getInstance();
  });

  afterEach(() => {
    searchService.dispose();
  });

  test("should be a singleton", () => {
    const instance1 = SearchService.getInstance();
    const instance2 = SearchService.getInstance();
    expect(instance1).toBe(instance2);
  });

  test("should start a search and return a search ID", () => {
    const files = [
      { filePath: "file1.txt", content: "test content 1" },
      { filePath: "file2.txt", content: "test content 2" },
    ];

    const searchId = searchService.startSearch(files, "test", {
      caseSensitive: false,
    });

    expect(searchId).toBeTruthy();
    expect(typeof searchId).toBe("string");
  });

  test("should notify listeners of search events", (done) => {
    const files = [{ filePath: "file1.txt", content: "test content 1" }];

    const searchId = searchService.startSearch(files, "test", {
      caseSensitive: false,
    });

    const events: SearchEventType[] = [];

    searchService.addListener(searchId, (type, data) => {
      events.push(type);

      if (type === "complete") {
        expect(events).toContain("progress");
        expect(events).toContain("complete");
        done();
      }
    });
  });

  test("should cancel an active search", () => {
    const files = [{ filePath: "file1.txt", content: "test content 1" }];

    const searchId = searchService.startSearch(files, "test", {
      caseSensitive: false,
    });

    let wasCancelled = false;

    searchService.addListener(searchId, (type) => {
      if (type === "cancelled") {
        wasCancelled = true;
      }
    });

    searchService.cancelSearch(searchId);

    // Since cancellation happens asynchronously, we need to wait a bit
    setTimeout(() => {
      expect(wasCancelled).toBe(true);
    }, 50);
  });

  test("should remove listeners", () => {
    const files = [{ filePath: "file1.txt", content: "test content 1" }];

    const searchId = searchService.startSearch(files, "test", {
      caseSensitive: false,
    });

    let eventCount = 0;

    const listenerId = searchService.addListener(searchId, () => {
      eventCount++;
    });

    searchService.removeListener(searchId, listenerId);

    // Since events are processed asynchronously, we need to wait a bit
    setTimeout(() => {
      expect(eventCount).toBe(0);
    }, 50);
  });
});
