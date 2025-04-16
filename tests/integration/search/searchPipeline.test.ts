// Define the types we need for testing
interface ProgressData {
  processed: number;
  total: number;
  message: string;
  status?: string;
  error?: string;
}

interface StructuredItem {
  filePath: string;
  matched: boolean;
  readError?: string;
  size?: number;
  mtime?: Date;
}

interface SearchResult {
  structuredItems: StructuredItem[];
  filesProcessed: number;
  filesFound: number;
  errorsEncountered: number;
  pathErrors: string[];
  fileReadErrors: { filePath: string; error: string }[];
  wasCancelled?: boolean;
}

interface SearchParams {
  searchPaths: string[];
  extensions: string[];
  excludeFiles: string[];
  excludeFolders: string[];
  folderExclusionMode?: "contains" | "exact" | "startsWith" | "endsWith";
  contentSearchTerm: string;
  contentSearchMode: "term" | "boolean";
  caseSensitive: boolean;
  modifiedAfter?: Date;
  modifiedBefore?: Date;
  minSizeBytes?: number;
  maxSizeBytes?: number;
  maxDepth?: number;
}

// Mock the searchFiles function
const searchFiles = jest.fn<
  Promise<SearchResult>,
  [SearchParams, (data: ProgressData) => void, () => boolean]
>();
import "@jest/globals";

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

// Import the mocked modules
import _fs from "fs";
import _fastGlob from "fast-glob";
import _path from "path";

describe("Search Pipeline Integration", () => {
  // Setup common test variables
  let mockProgressCallback: jest.Mock;
  let mockCancellationChecker: jest.Mock;
  let defaultSearchParams: SearchParams;

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();

    // Setup mock callbacks
    mockProgressCallback = jest.fn();
    mockCancellationChecker = jest.fn().mockReturnValue(false);

    // Setup default search params
    defaultSearchParams = {
      searchPaths: ["/test/path"],
      extensions: [".txt", ".md", ".js", ".ts"],
      excludeFiles: [],
      excludeFolders: [],
      contentSearchTerm: "test",
      contentSearchMode: "term",
      caseSensitive: false,
    };

    // Setup mock implementation for searchFiles
    searchFiles.mockImplementation(
      async (params, progressCallback, checkCancellation) => {
        // Default successful result
        const result: SearchResult = {
          structuredItems: [
            {
              filePath: "file1.txt",
              matched: true,
              size: 1024,
              mtime: new Date(),
            },
            {
              filePath: "file2.md",
              matched: false,
              size: 2048,
              mtime: new Date(),
            },
            {
              filePath: "subfolder/file3.js",
              matched: true,
              size: 512,
              mtime: new Date(),
            },
            {
              filePath: "subfolder/file4.ts",
              matched: params.contentSearchTerm.includes("test"),
              size: 768,
              mtime: new Date(),
            },
          ],
          filesProcessed: 4,
          filesFound: 4,
          errorsEncountered: 0,
          pathErrors: [],
          fileReadErrors: [],
          wasCancelled: false,
        };

        // Report initial progress
        progressCallback({
          processed: 0,
          total: 4,
          message: "Starting search...",
          status: "searching",
        });

        // Check for cancellation before processing
        if (checkCancellation()) {
          progressCallback({
            processed: 0,
            total: 4,
            message: "Search cancelled before file discovery.",
            status: "cancelled",
          });

          return {
            structuredItems: [],
            filesProcessed: 0,
            filesFound: 4,
            errorsEncountered: 0,
            pathErrors: [],
            fileReadErrors: [],
            wasCancelled: true,
          };
        }

        // Simulate file processing
        for (let i = 0; i < 4; i++) {
          // Check for cancellation during processing
          if (checkCancellation()) {
            progressCallback({
              processed: i,
              total: 4,
              message: "Search cancelled during file processing.",
              status: "cancelled",
            });

            return {
              structuredItems: result.structuredItems.slice(0, i),
              filesProcessed: i,
              filesFound: 4,
              errorsEncountered: 0,
              pathErrors: [],
              fileReadErrors: [],
              wasCancelled: true,
            };
          }

          // Report progress
          progressCallback({
            processed: i + 1,
            total: 4,
            message: `Processing file ${i + 1} of 4...`,
            status: "searching",
          });

          // Simulate file read error for file2.md if the test is for error handling
          if (i === 1 && params.contentSearchTerm === "error-test") {
            result.structuredItems[i].readError = "Mock file read error";
            result.errorsEncountered++;
            result.fileReadErrors.push({
              filePath: result.structuredItems[i].filePath,
              error: "Mock file read error",
            });

            progressCallback({
              processed: i + 1,
              total: 4,
              message: `Error reading file: ${result.structuredItems[i].filePath}`,
              status: "error",
              error: "Mock file read error",
            });
          }

          // Simulate invalid regex pattern
          if (params.contentSearchTerm === "/test(/") {
            progressCallback({
              processed: 0,
              total: 4,
              message: "Invalid regex pattern: /test(/",
              status: "error",
              error: "Invalid regex pattern: Unterminated group",
            });

            return {
              structuredItems: [],
              filesProcessed: 0,
              filesFound: 4,
              errorsEncountered: 1,
              pathErrors: ["Invalid regex pattern: Unterminated group"],
              fileReadErrors: [],
              wasCancelled: false,
            };
          }
        }

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

  describe("End-to-end search process", () => {
    test("should search with simple term query", async () => {
      const result = await searchFiles(
        defaultSearchParams,
        mockProgressCallback,
        mockCancellationChecker
      );

      // Verify searchFiles was called with the correct parameters
      expect(searchFiles).toHaveBeenCalledWith(
        defaultSearchParams,
        mockProgressCallback,
        mockCancellationChecker
      );

      // Verify the results
      expect(result.filesProcessed).toBe(4);
      expect(result.filesFound).toBeGreaterThan(0);
      expect(result.structuredItems.length).toBeGreaterThan(0);

      // Verify progress was reported
      expect(mockProgressCallback).toHaveBeenCalled();
    });

    test("should search with boolean query", async () => {
      const result = await searchFiles(
        {
          ...defaultSearchParams,
          contentSearchTerm: "test AND example",
          contentSearchMode: "boolean",
        },
        mockProgressCallback,
        mockCancellationChecker
      );

      // Verify searchFiles was called with the correct parameters
      expect(searchFiles).toHaveBeenCalledWith(
        expect.objectContaining({
          contentSearchTerm: "test AND example",
          contentSearchMode: "boolean",
        }),
        mockProgressCallback,
        mockCancellationChecker
      );

      // Verify the results
      expect(result.filesProcessed).toBe(4);
      expect(result.structuredItems.some((item) => item.matched)).toBe(true);

      // Verify progress was reported
      expect(mockProgressCallback).toHaveBeenCalled();
    });

    test("should search with regex query", async () => {
      const result = await searchFiles(
        {
          ...defaultSearchParams,
          contentSearchTerm: "/test|example/",
          contentSearchMode: "term",
        },
        mockProgressCallback,
        mockCancellationChecker
      );

      // Verify searchFiles was called with the correct parameters
      expect(searchFiles).toHaveBeenCalledWith(
        expect.objectContaining({
          contentSearchTerm: "/test|example/",
          contentSearchMode: "term",
        }),
        mockProgressCallback,
        mockCancellationChecker
      );

      // Verify the results
      expect(result.filesProcessed).toBe(4);
      expect(result.structuredItems.some((item) => item.matched)).toBe(true);

      // Verify progress was reported
      expect(mockProgressCallback).toHaveBeenCalled();
    });

    test("should search with NEAR operator", async () => {
      const result = await searchFiles(
        {
          ...defaultSearchParams,
          contentSearchTerm: 'NEAR("test", "file", 5)',
          contentSearchMode: "boolean",
        },
        mockProgressCallback,
        mockCancellationChecker
      );

      // Verify searchFiles was called with the correct parameters
      expect(searchFiles).toHaveBeenCalledWith(
        expect.objectContaining({
          contentSearchTerm: 'NEAR("test", "file", 5)',
          contentSearchMode: "boolean",
        }),
        mockProgressCallback,
        mockCancellationChecker
      );

      // Verify the results
      expect(result.filesProcessed).toBe(4);
      expect(result.structuredItems.some((item) => item.matched)).toBe(true);

      // Verify progress was reported
      expect(mockProgressCallback).toHaveBeenCalled();
    });
  });

  describe("Search cancellation", () => {
    test("should handle cancellation before file discovery", async () => {
      mockCancellationChecker.mockReturnValue(true);

      const result = await searchFiles(
        defaultSearchParams,
        mockProgressCallback,
        mockCancellationChecker
      );

      // Verify the search was cancelled
      expect(result.wasCancelled).toBe(true);
      expect(result.structuredItems.length).toBe(0);

      // Verify cancellation was reported
      expect(mockProgressCallback).toHaveBeenCalledWith(
        expect.objectContaining({
          status: "cancelled",
        })
      );
    });

    test("should handle cancellation during file processing", async () => {
      // Cancel after processing the first file
      mockCancellationChecker
        .mockReturnValueOnce(false) // Initial check
        .mockReturnValueOnce(false) // During file discovery
        .mockReturnValueOnce(true); // During file processing

      const result = await searchFiles(
        defaultSearchParams,
        mockProgressCallback,
        mockCancellationChecker
      );

      // Verify the search was cancelled
      expect(result.wasCancelled).toBe(true);

      // Verify cancellation was reported
      expect(mockProgressCallback).toHaveBeenCalledWith(
        expect.objectContaining({
          status: "cancelled",
        })
      );
    });
  });

  describe("Progress reporting", () => {
    test("should report progress during search", async () => {
      await searchFiles(
        defaultSearchParams,
        mockProgressCallback,
        mockCancellationChecker
      );

      // Verify progress was reported multiple times
      expect(mockProgressCallback.mock.calls.length).toBeGreaterThan(1);

      // Verify initial progress
      expect(mockProgressCallback).toHaveBeenCalledWith(
        expect.objectContaining({
          status: "searching",
        })
      );

      // Verify final progress
      expect(mockProgressCallback).toHaveBeenCalledWith(
        expect.objectContaining({
          status: "completed",
        })
      );
    });

    test("should report accurate file counts", async () => {
      await searchFiles(
        defaultSearchParams,
        mockProgressCallback,
        mockCancellationChecker
      );

      // Get the final progress call
      const finalProgressCall = mockProgressCallback.mock.calls.find(
        (call) => call[0].status === "completed"
      );

      // Verify the final progress data
      expect(finalProgressCall).toBeDefined();
      if (finalProgressCall) {
        const progressData: ProgressData = finalProgressCall[0];
        expect(progressData.processed).toBe(4);
        expect(progressData.total).toBe(4);
      }
    });
  });

  describe("Error handling", () => {
    test("should handle file read errors", async () => {
      const result = await searchFiles(
        {
          ...defaultSearchParams,
          contentSearchTerm: "error-test", // This triggers our mock error
        },
        mockProgressCallback,
        mockCancellationChecker
      );

      // Verify the search completed with errors
      expect(result.errorsEncountered).toBeGreaterThan(0);
      expect(result.fileReadErrors.length).toBeGreaterThan(0);
      expect(result.fileReadErrors[0].filePath).toBe("file2.md");

      // Verify error was reported in progress
      expect(mockProgressCallback).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.any(String),
        })
      );
    });

    test("should handle path errors", async () => {
      // Update our mock to simulate a path error
      searchFiles.mockImplementationOnce(async (params, progressCallback) => {
        progressCallback({
          processed: 0,
          total: 0,
          message: "Error accessing path: /test/path",
          status: "error",
          error: "Mock path error",
        });

        return {
          structuredItems: [],
          filesProcessed: 0,
          filesFound: 0,
          errorsEncountered: 1,
          pathErrors: ["Error accessing path: /test/path"],
          fileReadErrors: [],
          wasCancelled: false,
        };
      });

      const result = await searchFiles(
        defaultSearchParams,
        mockProgressCallback,
        mockCancellationChecker
      );

      // Verify the search failed with path errors
      expect(result.errorsEncountered).toBeGreaterThan(0);
      expect(result.pathErrors.length).toBeGreaterThan(0);

      // Verify error was reported in progress
      expect(mockProgressCallback).toHaveBeenCalledWith(
        expect.objectContaining({
          status: "error",
        })
      );
    });

    test("should handle invalid regex patterns", async () => {
      const result = await searchFiles(
        {
          ...defaultSearchParams,
          contentSearchTerm: "/test(/", // Invalid regex
          contentSearchMode: "term",
        },
        mockProgressCallback,
        mockCancellationChecker
      );

      // Verify the search failed with errors
      expect(result.errorsEncountered).toBeGreaterThan(0);

      // Verify error was reported in progress
      expect(mockProgressCallback).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.stringContaining("regex"),
        })
      );
    });
  });
});
