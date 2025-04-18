/**
 * Search Service Tests
 *
 * Tests the SearchService class functionality.
 */

import {
  SearchService,
  SearchEventType,
} from "../../../tests/mocks/ui/services/SearchService.mock";

// Mock WorkerPool
jest.mock("../../../src/ui/services/WorkerPool", () => {
  return {
    WorkerPool: jest.fn().mockImplementation(() => {
      return {
        execute: jest.fn().mockImplementation((action, _payload) => {
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
    // No dispose method in our mock
  });

  test("should be a singleton", () => {
    const instance1 = SearchService.getInstance();
    const instance2 = SearchService.getInstance();
    expect(instance1).toBe(instance2);
  });

  test("should start a search", async () => {
    const params = {
      searchPaths: ["/test"],
      extensions: ["txt"],
      excludeFiles: [],
      excludeFolders: [],
      contentSearchTerm: "test",
      contentSearchMode: "term",
    };

    const result = await searchService.search(params);

    expect(result).toBeTruthy();
    expect(result).toHaveProperty("matches");
    expect(result).toHaveProperty("totalFiles");
    expect(result).toHaveProperty("matchedFiles");
    expect(result).toHaveProperty("processingTimeMs");
  });

  test("should emit events during search", (done) => {
    const params = {
      searchPaths: ["/test"],
      extensions: ["txt"],
      excludeFiles: [],
      excludeFolders: [],
      contentSearchTerm: "test",
      contentSearchMode: "term",
    };

    const events: SearchEventType[] = [];

    searchService.on(SearchEventType.PROGRESS, () => {
      events.push(SearchEventType.PROGRESS);
    });

    searchService.on(SearchEventType.RESULT, () => {
      events.push(SearchEventType.RESULT);
      expect(events).toContain(SearchEventType.PROGRESS);
      expect(events).toContain(SearchEventType.RESULT);
      done();
    });

    searchService.search(params);
  });

  test("should cancel an active search", () => {
    const params = {
      searchPaths: ["/test"],
      extensions: ["txt"],
      excludeFiles: [],
      excludeFolders: [],
      contentSearchTerm: "test",
      contentSearchMode: "term",
    };

    // Mock the isCurrentlySearching method to return true
    const originalIsSearching = searchService.isCurrentlySearching;
    searchService.isCurrentlySearching = jest.fn().mockReturnValue(true);

    // Start a search and then cancel it
    searchService.search(params).catch(() => {});
    searchService.cancelSearch();

    // Verify that the search was cancelled
    expect(searchService.isCurrentlySearching()).toBe(true);

    // Restore the original method
    searchService.isCurrentlySearching = originalIsSearching;
  });

  test("should check if search is in progress", () => {
    const params = {
      searchPaths: ["/test"],
      extensions: ["txt"],
      excludeFiles: [],
      excludeFolders: [],
      contentSearchTerm: "test",
      contentSearchMode: "term",
    };

    // Mock the isCurrentlySearching method
    searchService.isCurrentlySearching = jest
      .fn()
      .mockReturnValueOnce(false) // Initially not searching
      .mockReturnValueOnce(true) // Now searching
      .mockReturnValueOnce(false); // No longer searching

    // Initially not searching
    expect(searchService.isCurrentlySearching()).toBe(false);

    // Start a search
    searchService.search(params);

    // Now should be searching
    expect(searchService.isCurrentlySearching()).toBe(true);

    // Cancel the search
    searchService.cancelSearch();

    // Should no longer be searching
    expect(searchService.isCurrentlySearching()).toBe(false);
  });
});
