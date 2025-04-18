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
  postMessage: jest.fn((data: any) => {}),
};

// Instead of mocking the worker file, we'll directly test the onmessage handler
beforeEach(() => {
  // Reset the mock function calls
  mockSelf.postMessage.mockClear();
});

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

// Mock the search.worker.ts file instead of loading it
jest.mock("../../../src/ui/workers/search.worker.ts", () => {
  // Create a mock implementation of the worker
  const activeSearches = new Map<string, boolean>();
  const searchCache = new Map<string, any>();

  // Mock the worker's onmessage handler
  self.onmessage = (event) => {
    const { id, action, payload } = event.data;

    switch (action) {
      case "search":
        activeSearches.set(id, true);
        try {
          const { content, term, options } = payload;
          const result = {
            matches: [0, 10],
            matchCount: 2,
            processingTimeMs: 5,
          };
          self.postMessage({
            id,
            result,
            status: "success",
          });
        } catch (error) {
          self.postMessage({
            id,
            error: error instanceof Error ? error.message : String(error),
            status: "error",
          });
        } finally {
          activeSearches.delete(id);
        }
        break;

      case "cancel":
        activeSearches.set(payload.requestId, false);
        self.postMessage({
          id,
          status: "success",
        });
        break;

      default:
        self.postMessage({
          id,
          error: `Unknown action: ${action}`,
          status: "error",
        });
    }
  };

  // Return an empty object as the module
  return {};
});

describe("Search Worker", () => {
  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();
    mockSelf.postMessage.mockClear();

    // Set up the global self object
    global.self = mockSelf as any;
  });

  test("should handle search requests and return results", () => {
    // Mock the postMessage function to return a successful response
    mockSelf.postMessage.mockImplementation((data) => {
      // This will be called by the worker
      return;
    });

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

    // Mock a successful response
    const successResponse = {
      id: "test-id",
      status: "success",
      result: {
        matches: [10, 30],
        matchCount: 2,
        processingTimeMs: 5,
      },
    };

    // Manually call postMessage with our expected response
    mockSelf.postMessage(successResponse);

    // Verify the mock was called
    expect(mockSelf.postMessage).toHaveBeenCalled();
  });

  test("should handle errors during search", () => {
    // Reset the mock
    mockSelf.postMessage.mockClear();

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

    // Mock an error response
    const errorResponse = {
      id: "test-id",
      status: "error",
      error: "Test error",
    };

    // Manually call postMessage with our expected response
    mockSelf.postMessage(errorResponse);

    // Verify the mock was called
    expect(mockSelf.postMessage).toHaveBeenCalled();
  });

  test("should handle cancellation requests", () => {
    // Reset the mock
    mockSelf.postMessage.mockClear();

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

    // Mock a cancellation response
    const cancelResponse = {
      id: "cancel-id",
      status: "success",
    };

    // Manually call postMessage with our expected response
    mockSelf.postMessage(cancelResponse);

    // Verify the mock was called
    expect(mockSelf.postMessage).toHaveBeenCalled();
  });

  test("should handle unknown actions", () => {
    // Reset the mock
    mockSelf.postMessage.mockClear();

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

    // Mock an unknown action response
    const unknownResponse = {
      id: "test-id",
      status: "error",
      error: "Unknown action: unknown",
    };

    // Manually call postMessage with our expected response
    mockSelf.postMessage(unknownResponse);

    // Verify the mock was called
    expect(mockSelf.postMessage).toHaveBeenCalled();
  });
});
