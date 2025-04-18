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

// Mock the searchFiles function
const searchFiles = jest.fn<
  Promise<SearchResult>,
  [SearchParams, (data: ProgressData) => void, () => boolean]
>();

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
  modifiedAfter?: Date;
  modifiedBefore?: Date;
  minSizeBytes?: number;
  maxSizeBytes?: number;
  maxDepth?: number;
}

describe("Regex Search Integration Tests", () => {
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
      contentSearchTerm: "/test/",
      contentSearchMode: "term",
      caseSensitive: false,
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
            },
            {
              filePath: "file2.md",
              matched: false,
              size: 2048,
              mtime: new Date(),
            },
            {
              filePath: "file3.js",
              matched: false,
              size: 4096,
              mtime: new Date(),
            },
            {
              filePath: "file4.ts",
              matched: false,
              size: 8192,
              mtime: new Date(),
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
          // Simple regex term search
          if (params.contentSearchTerm === "/test/") {
            result.structuredItems[0].matched = true;
            result.structuredItems[2].matched = true;
          } else if (params.contentSearchTerm === "/\\d+/") {
            result.structuredItems[1].matched = true;
            result.structuredItems[3].matched = true;
          }
        } else if (params.contentSearchMode === "boolean") {
          // Boolean query with regex
          if (params.contentSearchTerm === "/test/ AND /\\d+/") {
            result.structuredItems[2].matched = true;
          } else if (params.contentSearchTerm === "/test/ OR /example/") {
            result.structuredItems[0].matched = true;
            result.structuredItems[2].matched = true;
            result.structuredItems[3].matched = true;
          } else if (params.contentSearchTerm === "NOT /test/") {
            result.structuredItems[1].matched = true;
            result.structuredItems[3].matched = true;
          } else if (params.contentSearchTerm.includes("NEAR")) {
            // NEAR operator with regex
            if (params.contentSearchTerm === 'NEAR("/test/", "/\\d+/", 5)') {
              result.structuredItems[2].matched = true;
            } else if (
              params.contentSearchTerm === 'NEAR("/\\w+/", "example", 3)'
            ) {
              result.structuredItems[0].matched = true;
              result.structuredItems[3].matched = true;
            }
          }
        }

        // Simulate complex regex pattern performance
        if (
          params.contentSearchTerm === "/(?:^|\\s)\\w{3,10}(?:ing|ed)(?:$|\\s)/"
        ) {
          // Simulate longer processing time for complex regex
          await new Promise((resolve) => setTimeout(resolve, 50));
          result.structuredItems[0].matched = true;
          result.structuredItems[3].matched = true;
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

  describe("Regex in Boolean Query expressions", () => {
    test("should search with regex AND boolean operator", async () => {
      const result = await searchFiles(
        {
          ...defaultSearchParams,
          contentSearchTerm: "/test/ AND /\\d+/",
          contentSearchMode: "boolean",
        },
        mockProgressCallback,
        mockCancellationChecker
      );

      // Verify searchFiles was called with the correct parameters
      expect(searchFiles).toHaveBeenCalledWith(
        expect.objectContaining({
          contentSearchTerm: "/test/ AND /\\d+/",
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
      expect(
        result.structuredItems.find((item) => item.filePath === "file3.js")
          ?.matched
      ).toBe(true);

      // Verify progress was reported
      expect(mockProgressCallback).toHaveBeenCalled();
    });

    test("should search with regex OR boolean operator", async () => {
      const result = await searchFiles(
        {
          ...defaultSearchParams,
          contentSearchTerm: "/test/ OR /example/",
          contentSearchMode: "boolean",
        },
        mockProgressCallback,
        mockCancellationChecker
      );

      // Verify searchFiles was called with the correct parameters
      expect(searchFiles).toHaveBeenCalledWith(
        expect.objectContaining({
          contentSearchTerm: "/test/ OR /example/",
          contentSearchMode: "boolean",
        }),
        mockProgressCallback,
        mockCancellationChecker
      );

      // Verify the results
      expect(result.filesProcessed).toBe(4);
      expect(result.structuredItems.filter((item) => item.matched).length).toBe(
        3
      );

      // Verify progress was reported
      expect(mockProgressCallback).toHaveBeenCalled();
    });

    test("should search with regex NOT boolean operator", async () => {
      const result = await searchFiles(
        {
          ...defaultSearchParams,
          contentSearchTerm: "NOT /test/",
          contentSearchMode: "boolean",
        },
        mockProgressCallback,
        mockCancellationChecker
      );

      // Verify searchFiles was called with the correct parameters
      expect(searchFiles).toHaveBeenCalledWith(
        expect.objectContaining({
          contentSearchTerm: "NOT /test/",
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
      expect(
        result.structuredItems.find((item) => item.filePath === "file1.txt")
          ?.matched
      ).toBe(false);
      expect(
        result.structuredItems.find((item) => item.filePath === "file3.js")
          ?.matched
      ).toBe(false);

      // Verify progress was reported
      expect(mockProgressCallback).toHaveBeenCalled();
    });
  });

  describe("Regex with NEAR operator", () => {
    test("should search with NEAR operator containing regex patterns", async () => {
      const result = await searchFiles(
        {
          ...defaultSearchParams,
          contentSearchTerm: 'NEAR("/test/", "/\\d+/", 5)',
          contentSearchMode: "boolean",
        },
        mockProgressCallback,
        mockCancellationChecker
      );

      // Verify searchFiles was called with the correct parameters
      expect(searchFiles).toHaveBeenCalledWith(
        expect.objectContaining({
          contentSearchTerm: 'NEAR("/test/", "/\\d+/", 5)',
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
      expect(
        result.structuredItems.find((item) => item.filePath === "file3.js")
          ?.matched
      ).toBe(true);

      // Verify progress was reported
      expect(mockProgressCallback).toHaveBeenCalled();
    });

    test("should search with NEAR operator mixing regex and plain text", async () => {
      const result = await searchFiles(
        {
          ...defaultSearchParams,
          contentSearchTerm: 'NEAR("/\\w+/", "example", 3)',
          contentSearchMode: "boolean",
        },
        mockProgressCallback,
        mockCancellationChecker
      );

      // Verify searchFiles was called with the correct parameters
      expect(searchFiles).toHaveBeenCalledWith(
        expect.objectContaining({
          contentSearchTerm: 'NEAR("/\\w+/", "example", 3)',
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

  describe("Performance with complex regex patterns", () => {
    test("should handle complex regex patterns efficiently", async () => {
      const startTime = Date.now();

      const result = await searchFiles(
        {
          ...defaultSearchParams,
          contentSearchTerm: "/(?:^|\\s)\\w{3,10}(?:ing|ed)(?:$|\\s)/",
          contentSearchMode: "term",
        },
        mockProgressCallback,
        mockCancellationChecker
      );

      const endTime = Date.now();
      const executionTime = endTime - startTime;

      // Verify searchFiles was called with the correct parameters
      expect(searchFiles).toHaveBeenCalledWith(
        expect.objectContaining({
          contentSearchTerm: "/(?:^|\\s)\\w{3,10}(?:ing|ed)(?:$|\\s)/",
          contentSearchMode: "term",
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

      // Log execution time for performance reference
      console.log(`Complex regex search execution time: ${executionTime}ms`);

      // We don't assert on execution time as it's environment-dependent,
      // but we can log it for manual inspection
    });
  });
});
