/**
 * Search Worker Tests
 *
 * Tests the search worker functionality.
 */

// Mock the worker environment
class MockWorker {
  onmessage: ((event: MessageEvent) => void) | null = null;

  postMessage(data: any): void {
    if (this.onmessage) {
      this.onmessage(new MessageEvent("message", { data }));
    }
  }
}

// Mock the self global
const mockSelf = {
  onmessage: null as ((event: MessageEvent) => void) | null,
  postMessage: jest.fn(),
};

// Mock the findTermIndices function
jest.mock("../../../src/electron/utils/searchUtils.js", () => ({
  findTermIndices: jest.fn().mockImplementation((content, term) => {
    if (content.includes(term)) {
      return [content.indexOf(term)];
    }
    return [];
  }),
}));

// Mock the escapeRegExp function
jest.mock("../../../src/electron/utils/regexUtils.js", () => ({
  escapeRegExp: jest
    .fn()
    .mockImplementation((str) =>
      str.replace(/[.*+?^${}()|[\\]\\\\]/g, "\\\\$&")
    ),
}));

describe("Search Worker", () => {
  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();
    mockSelf.postMessage.mockClear();

    // Set up the global self object
    global.self = mockSelf as any;

    // Load the worker script
    jest.isolateModules(() => {
      require("../../../src/ui/workers/search.worker.ts");
    });
  });

  test("should handle search requests and return results", () => {
    // Trigger the search
    mockSelf.onmessage?.(
      new MessageEvent("message", {
        data: {
          id: "test-id",
          action: "search",
          payload: {
            content: "This is a test content with test term",
            term: "test",
            options: {
              caseSensitive: false,
            },
          },
        },
      })
    );

    // Check that postMessage was called with the expected result
    expect(mockSelf.postMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "test-id",
        status: "success",
        result: expect.objectContaining({
          matches: expect.any(Array),
          matchCount: expect.any(Number),
          processingTimeMs: expect.any(Number),
        }),
      })
    );
  });

  test("should handle errors during search", () => {
    // Mock findTermIndices to throw an error
    require("../../../src/electron/utils/searchUtils.js").findTermIndices.mockImplementationOnce(
      () => {
        throw new Error("Test error");
      }
    );

    // Trigger the search
    mockSelf.onmessage?.(
      new MessageEvent("message", {
        data: {
          id: "test-id",
          action: "search",
          payload: {
            content: "This is a test content",
            term: "test",
            options: {
              caseSensitive: false,
            },
          },
        },
      })
    );

    // Check that postMessage was called with an error
    expect(mockSelf.postMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "test-id",
        status: "error",
        error: expect.stringContaining("Test error"),
      })
    );
  });

  test("should handle cancellation requests", () => {
    // Start a search
    mockSelf.onmessage?.(
      new MessageEvent("message", {
        data: {
          id: "search-id",
          action: "search",
          payload: {
            content: "This is a test content",
            term: "test",
            options: {
              caseSensitive: false,
            },
          },
        },
      })
    );

    // Cancel the search
    mockSelf.onmessage?.(
      new MessageEvent("message", {
        data: {
          id: "cancel-id",
          action: "cancel",
          payload: {
            requestId: "search-id",
          },
        },
      })
    );

    // Check that postMessage was called with a success response for the cancellation
    expect(mockSelf.postMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "cancel-id",
        status: "success",
      })
    );
  });

  test("should handle unknown actions", () => {
    // Trigger an unknown action
    mockSelf.onmessage?.(
      new MessageEvent("message", {
        data: {
          id: "test-id",
          action: "unknown",
          payload: {},
        },
      })
    );

    // Check that postMessage was called with an error
    expect(mockSelf.postMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "test-id",
        status: "error",
        error: expect.stringContaining("Unknown action"),
      })
    );
  });
});
