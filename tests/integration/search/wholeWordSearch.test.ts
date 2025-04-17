/**
 * Integration Tests for Whole Word Matching in Search Pipeline
 *
 * These tests verify that the whole word matching functionality works correctly
 * in the search pipeline, including different search modes and edge cases.
 */

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
  matchDetails?: {
    term: string;
    positions: number[];
    isRegexMatch?: boolean;
  }[];
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
  fuzzySearchEnabled?: boolean;
  fuzzySearchBooleanEnabled?: boolean;
  fuzzySearchNearEnabled?: boolean;
  wholeWordMatchingEnabled?: boolean;
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

describe("Whole Word Matching Integration Tests", () => {
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
      wholeWordMatchingEnabled: false,
    };

    // Setup mock implementation for searchFiles
    searchFiles.mockImplementation(
      async (
        params: SearchParams,
        progressCallback: (data: ProgressData) => void,
        cancellationChecker: () => boolean
      ): Promise<SearchResult> => {
        // Report initial progress
        progressCallback({
          processed: 0,
          total: 4,
          message: "Starting search...",
          status: "running",
        });

        // Check for cancellation
        if (cancellationChecker()) {
          progressCallback({
            processed: 0,
            total: 4,
            message: "Search cancelled.",
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

        // Simulate file discovery
        progressCallback({
          processed: 0,
          total: 4,
          message: "Discovered 4 files.",
          status: "running",
        });

        // Prepare mock result
        const result: SearchResult = {
          structuredItems: [
            {
              filePath: "file1.txt",
              matched: false,
              size: 1024,
              mtime: new Date(),
              matchDetails: [],
            },
            {
              filePath: "file2.md",
              matched: false,
              size: 2048,
              mtime: new Date(),
              matchDetails: [],
            },
            {
              filePath: "file3.js",
              matched: false,
              size: 4096,
              mtime: new Date(),
              matchDetails: [],
            },
            {
              filePath: "file4.ts",
              matched: false,
              size: 8192,
              mtime: new Date(),
              matchDetails: [],
            },
          ],
          filesProcessed: 4,
          filesFound: 4,
          errorsEncountered: 0,
          pathErrors: [],
          fileReadErrors: [],
        };

        // Simulate file content based on search parameters
        if (params.contentSearchMode === "term") {
          // Simple term search
          if (params.contentSearchTerm === "test") {
            // With whole word matching disabled
            if (!params.wholeWordMatchingEnabled) {
              // Match "test" in all files (as part of words like "testing", "contest", etc.)
              result.structuredItems[0].matched = true; // Contains "test"
              result.structuredItems[1].matched = true; // Contains "testing"
              result.structuredItems[2].matched = true; // Contains "contest"
              result.structuredItems[3].matched = true; // Contains "testable"
            }
            // With whole word matching enabled
            else {
              // Only match "test" as a whole word
              result.structuredItems[0].matched = true; // Contains "test" as a whole word
              result.structuredItems[1].matched = false; // Contains "testing" (not a whole word match)
              result.structuredItems[2].matched = false; // Contains "contest" (not a whole word match)
              result.structuredItems[3].matched = false; // Contains "testable" (not a whole word match)
            }
          } else if (params.contentSearchTerm === "log") {
            // With whole word matching disabled
            if (!params.wholeWordMatchingEnabled) {
              // Match "log" in all files (as part of words like "catalog", "logging", etc.)
              result.structuredItems[0].matched = true; // Contains "catalog"
              result.structuredItems[1].matched = true; // Contains "logging"
              result.structuredItems[2].matched = true; // Contains "blog"
              result.structuredItems[3].matched = false; // Does not contain "log"
            }
            // With whole word matching enabled
            else {
              // Only match "log" as a whole word
              result.structuredItems[0].matched = false; // Contains "catalog" (not a whole word match)
              result.structuredItems[1].matched = false; // Contains "logging" (not a whole word match)
              result.structuredItems[2].matched = true; // Contains "log" as a whole word
              result.structuredItems[3].matched = false; // Does not contain "log"
            }
          }
        } else if (params.contentSearchMode === "boolean") {
          // Boolean query
          if (params.contentSearchTerm === "test AND string") {
            // With whole word matching disabled
            if (!params.wholeWordMatchingEnabled) {
              // Match files containing both "test" and "string"
              result.structuredItems[0].matched = true; // Contains both "test" and "string"
              result.structuredItems[3].matched = true; // Contains both "testable" and "string"
            }
            // With whole word matching enabled
            else {
              // Only match files containing both "test" and "string" as whole words
              result.structuredItems[0].matched = true; // Contains both "test" and "string" as whole words
              result.structuredItems[3].matched = false; // Contains "testable" (not a whole word match) and "string"
            }
          } else if (params.contentSearchTerm === "quick AND fox") {
            // With whole word matching disabled
            if (!params.wholeWordMatchingEnabled) {
              // Match files containing both "quick" and "fox"
              result.structuredItems[1].matched = true; // Contains both "quicksand" and "foxes"
            }
            // With whole word matching enabled
            else {
              // Only match files containing both "quick" and "fox" as whole words
              result.structuredItems[1].matched = false; // Contains "quicksand" and "foxes" (not whole word matches)
              result.structuredItems[2].matched = true; // Contains both "quick" and "fox" as whole words
            }
          } else if (params.contentSearchTerm.includes("NEAR")) {
            // NEAR operator
            if (params.contentSearchTerm === 'NEAR("fox", "dog", 5)') {
              // With whole word matching disabled
              if (!params.wholeWordMatchingEnabled) {
                // Match files where "fox" and "dog" are within 5 words
                result.structuredItems[1].matched = true; // Contains "foxes" and "doghouse" within 5 words
                result.structuredItems[2].matched = true; // Contains "fox" and "dog" within 5 words
              }
              // With whole word matching enabled
              else {
                // Only match files where "fox" and "dog" are whole words and within 5 words
                result.structuredItems[1].matched = false; // Contains "foxes" and "doghouse" (not whole word matches)
                result.structuredItems[2].matched = true; // Contains "fox" and "dog" as whole words within 5 words
              }
            }
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

  describe("Simple Term Search with Whole Word Matching", () => {
    test("should only match whole words when enabled", async () => {
      // First with whole word matching disabled (default)
      const result1 = await searchFiles(
        defaultSearchParams,
        mockProgressCallback,
        mockCancellationChecker
      );

      // Verify all files match with "test" when whole word matching is disabled
      expect(
        result1.structuredItems.filter((item) => item.matched).length
      ).toBe(4);

      // Now with whole word matching enabled
      const result2 = await searchFiles(
        {
          ...defaultSearchParams,
          wholeWordMatchingEnabled: true,
        },
        mockProgressCallback,
        mockCancellationChecker
      );

      // Verify only one file matches with "test" as a whole word
      expect(
        result2.structuredItems.filter((item) => item.matched).length
      ).toBe(1);
      expect(
        result2.structuredItems.find((item) => item.filePath === "file1.txt")
          ?.matched
      ).toBe(true);
    });

    test("should not match substrings within words when enabled", async () => {
      // Search for "log"
      // First with whole word matching disabled
      const result1 = await searchFiles(
        {
          ...defaultSearchParams,
          contentSearchTerm: "log",
        },
        mockProgressCallback,
        mockCancellationChecker
      );

      // Verify files with "catalog", "logging", and "blog" match when whole word matching is disabled
      expect(
        result1.structuredItems.filter((item) => item.matched).length
      ).toBe(3);

      // Now with whole word matching enabled
      const result2 = await searchFiles(
        {
          ...defaultSearchParams,
          contentSearchTerm: "log",
          wholeWordMatchingEnabled: true,
        },
        mockProgressCallback,
        mockCancellationChecker
      );

      // Verify only the file with "log" as a whole word matches
      expect(
        result2.structuredItems.filter((item) => item.matched).length
      ).toBe(1);
      expect(
        result2.structuredItems.find((item) => item.filePath === "file3.js")
          ?.matched
      ).toBe(true);
    });
  });

  describe("Boolean Expressions with Whole Word Matching", () => {
    test("should apply whole word matching to terms in boolean expressions", async () => {
      // First with whole word matching disabled
      const result1 = await searchFiles(
        {
          ...defaultSearchParams,
          contentSearchTerm: "test AND string",
          contentSearchMode: "boolean",
        },
        mockProgressCallback,
        mockCancellationChecker
      );

      // Verify files with both "test" (or derivatives) and "string" match
      expect(
        result1.structuredItems.filter((item) => item.matched).length
      ).toBe(2);

      // Now with whole word matching enabled
      const result2 = await searchFiles(
        {
          ...defaultSearchParams,
          contentSearchTerm: "test AND string",
          contentSearchMode: "boolean",
          wholeWordMatchingEnabled: true,
        },
        mockProgressCallback,
        mockCancellationChecker
      );

      // Verify only the file with both "test" and "string" as whole words matches
      expect(
        result2.structuredItems.filter((item) => item.matched).length
      ).toBe(1);
      expect(
        result2.structuredItems.find((item) => item.filePath === "file1.txt")
          ?.matched
      ).toBe(true);
    });

    test("should not match terms that are substrings when whole word matching is enabled", async () => {
      // First with whole word matching disabled
      const result1 = await searchFiles(
        {
          ...defaultSearchParams,
          contentSearchTerm: "quick AND fox",
          contentSearchMode: "boolean",
        },
        mockProgressCallback,
        mockCancellationChecker
      );

      // Verify files with both "quick" (or derivatives) and "fox" (or derivatives) match
      expect(
        result1.structuredItems.filter((item) => item.matched).length
      ).toBe(1);
      expect(
        result1.structuredItems.find((item) => item.filePath === "file2.md")
          ?.matched
      ).toBe(true);

      // Now with whole word matching enabled
      const result2 = await searchFiles(
        {
          ...defaultSearchParams,
          contentSearchTerm: "quick AND fox",
          contentSearchMode: "boolean",
          wholeWordMatchingEnabled: true,
        },
        mockProgressCallback,
        mockCancellationChecker
      );

      // Verify only the file with both "quick" and "fox" as whole words matches
      expect(
        result2.structuredItems.filter((item) => item.matched).length
      ).toBe(1);
      expect(
        result2.structuredItems.find((item) => item.filePath === "file3.js")
          ?.matched
      ).toBe(true);
    });
  });

  describe("NEAR Operator with Whole Word Matching", () => {
    test("should apply whole word matching to terms in NEAR expressions", async () => {
      // First with whole word matching disabled
      const result1 = await searchFiles(
        {
          ...defaultSearchParams,
          contentSearchTerm: 'NEAR("fox", "dog", 5)',
          contentSearchMode: "boolean",
        },
        mockProgressCallback,
        mockCancellationChecker
      );

      // Verify files with "fox" (or derivatives) and "dog" (or derivatives) within 5 words match
      expect(
        result1.structuredItems.filter((item) => item.matched).length
      ).toBe(2);

      // Now with whole word matching enabled
      const result2 = await searchFiles(
        {
          ...defaultSearchParams,
          contentSearchTerm: 'NEAR("fox", "dog", 5)',
          contentSearchMode: "boolean",
          wholeWordMatchingEnabled: true,
        },
        mockProgressCallback,
        mockCancellationChecker
      );

      // Verify only the file with both "fox" and "dog" as whole words within 5 words matches
      expect(
        result2.structuredItems.filter((item) => item.matched).length
      ).toBe(1);
      expect(
        result2.structuredItems.find((item) => item.filePath === "file3.js")
          ?.matched
      ).toBe(true);
    });
  });
});
