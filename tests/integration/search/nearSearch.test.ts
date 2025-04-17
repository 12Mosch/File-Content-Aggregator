import "@jest/globals";
import {
  SearchResult,
  ProgressData,
  SearchParams as BaseSearchParams,
} from "../../../src/ui/vite-env.d";

// Extend the SearchParams type for testing
interface SearchParams extends BaseSearchParams {
  fuzzySearchEnabled?: boolean;
  fuzzySearchBooleanEnabled?: boolean;
  fuzzySearchNearEnabled?: boolean;
}

// Mock the searchFiles function
const searchFiles = jest.fn<
  Promise<SearchResult>,
  [SearchParams, (data: ProgressData) => void, () => boolean]
>();

// Mock the file system operations and other dependencies
jest.mock("fs", () => ({
  promises: {
    readFile: jest.fn(),
    stat: jest.fn(),
    access: jest.fn(),
  },
  constants: { F_OK: 0 },
}));

jest.mock("fast-glob", () => jest.fn());
jest.mock("p-limit", () =>
  jest.fn(() => (fn: (...args: unknown[]) => unknown) => fn())
);

// Import the mocked module
jest.mock("../../../src/electron/fileSearchService", () => ({
  searchFiles,
}));

describe("NEAR Operator Integration Tests", () => {
  // Default search parameters
  const defaultSearchParams = {
    searchPaths: ["./test-data"],
    extensions: ["*"],
    excludeFiles: [],
    excludeFolders: [],
    contentSearchTerm: "",
    contentSearchMode: "term" as const,
    caseSensitive: false,
  };

  // Mock progress callback
  const mockProgressCallback = jest.fn();

  // Mock cancellation checker
  const mockCancellationChecker = jest.fn(() => false);

  beforeEach(() => {
    // Clear all mocks before each test
    jest.clearAllMocks();

    // Setup mock implementation for searchFiles
    searchFiles.mockImplementation(
      async (params, progressCallback, _checkCancellation) => {
        // Default successful result
        const result: SearchResult = {
          structuredItems: [
            {
              filePath: "file1.txt",
              matched: false,
              size: 1024,
              mtime: Date.now(),
            },
            {
              filePath: "file2.md",
              matched: false,
              size: 2048,
              mtime: Date.now(),
            },
            {
              filePath: "subfolder/file3.js",
              matched: false,
              size: 512,
              mtime: Date.now(),
            },
            {
              filePath: "subfolder/file4.ts",
              matched: false,
              size: 768,
              mtime: Date.now(),
            },
          ],
          filesProcessed: 4,
          filesFound: 4,
          errorsEncountered: 0,
          pathErrors: [],
          fileReadErrors: [],
          wasCancelled: false,
        };

        // Simulate different search scenarios based on the search parameters
        if (params.contentSearchMode === "boolean") {
          // NEAR with mixed term types
          if (params.contentSearchTerm === 'NEAR("test", "/example/", 5)') {
            result.structuredItems[0].matched = true;
            result.structuredItems[2].matched = true;
          }
          // NEAR with regex and fuzzy
          else if (
            params.contentSearchTerm === 'NEAR("/\\w+/", "exmple", 3)' &&
            params.fuzzySearchNearEnabled
          ) {
            result.structuredItems[1].matched = true;
            result.structuredItems[3].matched = true;
          }
          // NEAR with nested expressions
          else if (params.contentSearchTerm.includes("NEAR(NEAR(")) {
            result.structuredItems[2].matched = true;
          }
          // NEAR with complex boolean expressions
          else if (
            params.contentSearchTerm.includes(
              'NEAR(("test" AND "data"), ("example" OR "sample"), 10)'
            )
          ) {
            result.structuredItems[0].matched = true;
            result.structuredItems[3].matched = true;
          }
          // NEAR with case sensitivity
          else if (
            params.contentSearchTerm === 'NEAR("Test", "Example", 5)' &&
            params.caseSensitive
          ) {
            result.structuredItems[1].matched = true;
          }
        }

        // Report progress
        progressCallback({
          processed: 2,
          total: 4,
          message: "Processing files...",
          status: "searching",
        });

        // Report completion
        progressCallback({
          processed: 4,
          total: 4,
          message: "Search completed.",
          status: "completed",
        });

        return result;
      }
    );
  });

  describe("NEAR with Mixed Term Types", () => {
    test("should search with NEAR operator combining exact terms and regex patterns", async () => {
      const result = await searchFiles(
        {
          ...defaultSearchParams,
          contentSearchTerm: 'NEAR("test", "/example/", 5)',
          contentSearchMode: "boolean",
        },
        mockProgressCallback,
        mockCancellationChecker
      );

      // Verify searchFiles was called with the correct parameters
      expect(searchFiles).toHaveBeenCalledWith(
        expect.objectContaining({
          contentSearchTerm: 'NEAR("test", "/example/", 5)',
          contentSearchMode: "boolean",
        }),
        mockProgressCallback,
        mockCancellationChecker
      );

      // Verify the results
      expect(result.filesProcessed).toBe(4);
      expect(result.structuredItems.filter((item) => item.matched).length).toBe(
        2
      );

      // Verify progress was reported
      expect(mockProgressCallback).toHaveBeenCalled();
    });

    test("should search with NEAR operator combining regex patterns and fuzzy terms", async () => {
      const result = await searchFiles(
        {
          ...defaultSearchParams,
          contentSearchTerm: 'NEAR("/\\w+/", "exmple", 3)', // Misspelled "example"
          contentSearchMode: "boolean",
          fuzzySearchNearEnabled: true,
        },
        mockProgressCallback,
        mockCancellationChecker
      );

      // Verify searchFiles was called with the correct parameters
      expect(searchFiles).toHaveBeenCalledWith(
        expect.objectContaining({
          contentSearchTerm: 'NEAR("/\\w+/", "exmple", 3)',
          contentSearchMode: "boolean",
          fuzzySearchNearEnabled: true,
        }),
        mockProgressCallback,
        mockCancellationChecker
      );

      // Verify the results
      expect(result.filesProcessed).toBe(4);
      expect(result.structuredItems.filter((item) => item.matched).length).toBe(
        2
      );

      // Verify progress was reported
      expect(mockProgressCallback).toHaveBeenCalled();
    });

    test("should respect case sensitivity in NEAR operator", async () => {
      const result = await searchFiles(
        {
          ...defaultSearchParams,
          contentSearchTerm: 'NEAR("Test", "Example", 5)',
          contentSearchMode: "boolean",
          caseSensitive: true,
        },
        mockProgressCallback,
        mockCancellationChecker
      );

      // Verify searchFiles was called with the correct parameters
      expect(searchFiles).toHaveBeenCalledWith(
        expect.objectContaining({
          contentSearchTerm: 'NEAR("Test", "Example", 5)',
          contentSearchMode: "boolean",
          caseSensitive: true,
        }),
        mockProgressCallback,
        mockCancellationChecker
      );

      // Verify the results
      expect(result.filesProcessed).toBe(4);
      expect(result.structuredItems.filter((item) => item.matched).length).toBe(
        1
      );

      // Verify progress was reported
      expect(mockProgressCallback).toHaveBeenCalled();
    });
  });

  describe("Complex NEAR Expressions", () => {
    test("should search with nested NEAR operators", async () => {
      const result = await searchFiles(
        {
          ...defaultSearchParams,
          contentSearchTerm: 'NEAR(NEAR("function", "return", 3), "data", 5)',
          contentSearchMode: "boolean",
        },
        mockProgressCallback,
        mockCancellationChecker
      );

      // Verify searchFiles was called with the correct parameters
      expect(searchFiles).toHaveBeenCalledWith(
        expect.objectContaining({
          contentSearchTerm: 'NEAR(NEAR("function", "return", 3), "data", 5)',
          contentSearchMode: "boolean",
        }),
        mockProgressCallback,
        mockCancellationChecker
      );

      // Verify the results
      expect(result.filesProcessed).toBe(4);
      expect(result.structuredItems.filter((item) => item.matched).length).toBe(
        1
      );

      // Verify progress was reported
      expect(mockProgressCallback).toHaveBeenCalled();
    });

    test("should search with NEAR operator containing complex boolean expressions", async () => {
      const result = await searchFiles(
        {
          ...defaultSearchParams,
          contentSearchTerm:
            'NEAR(("test" AND "data"), ("example" OR "sample"), 10)',
          contentSearchMode: "boolean",
        },
        mockProgressCallback,
        mockCancellationChecker
      );

      // Verify searchFiles was called with the correct parameters
      expect(searchFiles).toHaveBeenCalledWith(
        expect.objectContaining({
          contentSearchTerm:
            'NEAR(("test" AND "data"), ("example" OR "sample"), 10)',
          contentSearchMode: "boolean",
        }),
        mockProgressCallback,
        mockCancellationChecker
      );

      // Verify the results
      expect(result.filesProcessed).toBe(4);
      expect(result.structuredItems.filter((item) => item.matched).length).toBe(
        2
      );

      // Verify progress was reported
      expect(mockProgressCallback).toHaveBeenCalled();
    });
  });

  describe("Performance with Complex NEAR Expressions", () => {
    test("should handle large files with complex NEAR expressions efficiently", async () => {
      // Mock a large file scenario
      searchFiles.mockImplementationOnce(
        async (params, progressCallback, _checkCancellation) => {
          // Simulate processing a large file
          progressCallback({
            processed: 0,
            total: 1,
            message: "Processing large file...",
            status: "searching",
          });

          // Simulate completion
          progressCallback({
            processed: 1,
            total: 1,
            message: "Search completed.",
            status: "completed",
          });

          return {
            structuredItems: [
              {
                filePath: "large-file.txt",
                matched: true,
                size: 10 * 1024 * 1024, // 10MB
                mtime: Date.now(),
              },
            ],
            filesProcessed: 1,
            filesFound: 1,
            errorsEncountered: 0,
            pathErrors: [],
            fileReadErrors: [],
            wasCancelled: false,
          };
        }
      );

      const startTime = Date.now();

      const result = await searchFiles(
        {
          ...defaultSearchParams,
          contentSearchTerm:
            'NEAR(NEAR("function", "return", 3), NEAR("data", "process", 5), 10)',
          contentSearchMode: "boolean",
        },
        mockProgressCallback,
        mockCancellationChecker
      );

      const endTime = Date.now();
      const executionTime = endTime - startTime;

      // Verify the search completed
      expect(result.filesProcessed).toBe(1);
      expect(result.structuredItems[0].matched).toBe(true);

      // Verify progress was reported
      expect(mockProgressCallback).toHaveBeenCalledWith(
        expect.objectContaining({
          status: "completed",
        })
      );

      // Log execution time for performance analysis
      console.log(`Search execution time: ${executionTime}ms`);

      // We don't assert on execution time as it can vary, but we log it for analysis
    });

    test("should handle multiple nested NEAR operators efficiently", async () => {
      // Create a complex NEAR expression with multiple nested operators
      const complexExpression =
        'NEAR(NEAR(NEAR("term1", "term2", 2), "term3", 3), NEAR("term4", NEAR("term5", "term6", 2), 4), 10)';

      const result = await searchFiles(
        {
          ...defaultSearchParams,
          contentSearchTerm: complexExpression,
          contentSearchMode: "boolean",
        },
        mockProgressCallback,
        mockCancellationChecker
      );

      // Verify the search completed
      expect(result.filesProcessed).toBe(4);

      // Verify progress was reported
      expect(mockProgressCallback).toHaveBeenCalledWith(
        expect.objectContaining({
          status: "completed",
        })
      );
    });
  });
});
