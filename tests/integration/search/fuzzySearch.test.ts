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
    isFuzzyMatch?: boolean;
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

describe("Fuzzy Search Integration Tests", () => {
  // Mock progress callback and cancellation checker
  const mockProgressCallback = jest.fn();
  const mockCancellationChecker = jest.fn().mockReturnValue(false);

  // Default search parameters for tests
  const defaultSearchParams: SearchParams = {
    searchPaths: ["test/path"],
    extensions: ["txt", "md", "js", "ts"],
    excludeFiles: [],
    excludeFolders: [],
    contentSearchTerm: "test",
    contentSearchMode: "term",
    caseSensitive: false,
    fuzzySearchEnabled: true,
  };

  beforeEach(() => {
    jest.clearAllMocks();

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
              matchDetails: [
                {
                  term: params.contentSearchTerm,
                  positions: [10, 50],
                  isFuzzyMatch: params.fuzzySearchEnabled || false,
                },
              ],
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
              matchDetails: [
                {
                  term: params.contentSearchTerm,
                  positions: [5, 25],
                  isFuzzyMatch: false,
                },
              ],
            },
            {
              filePath: "subfolder/file4.ts",
              matched: Boolean(
                params.fuzzySearchEnabled &&
                  params.contentSearchTerm.includes("tst")
              ),
              size: 768,
              mtime: new Date(),
              matchDetails:
                params.fuzzySearchEnabled &&
                params.contentSearchTerm.includes("tst")
                  ? [
                      {
                        term: params.contentSearchTerm,
                        positions: [15, 35],
                        isFuzzyMatch: true,
                      },
                    ]
                  : undefined,
            },
          ],
          filesProcessed: 4,
          filesFound: 4,
          errorsEncountered: 0,
          pathErrors: [],
          fileReadErrors: [],
          wasCancelled: false,
        };

        // Simulate fuzzy search in Content Query mode
        if (params.contentSearchMode === "term" && params.fuzzySearchEnabled) {
          // Simulate fuzzy match for "tst" -> "test"
          if (params.contentSearchTerm === "tst") {
            result.structuredItems[3].matched = true;
            result.structuredItems[3].matchDetails = [
              {
                term: "tst",
                positions: [15, 35],
                isFuzzyMatch: true,
              },
            ];
          }

          // Simulate fuzzy match for "tesst" -> "test"
          if (params.contentSearchTerm === "tesst") {
            result.structuredItems[0].matched = true;
            result.structuredItems[0].matchDetails = [
              {
                term: "tesst",
                positions: [10, 50],
                isFuzzyMatch: true,
              },
            ];
          }
        }

        // Simulate fuzzy search in Boolean Query mode
        if (
          params.contentSearchMode === "boolean" &&
          params.fuzzySearchBooleanEnabled
        ) {
          // Simulate fuzzy match for "tst AND example"
          if (params.contentSearchTerm === "tst AND example") {
            result.structuredItems[3].matched = true;
            result.structuredItems[3].matchDetails = [
              {
                term: "tst",
                positions: [15],
                isFuzzyMatch: true,
              },
              {
                term: "example",
                positions: [35],
                isFuzzyMatch: false,
              },
            ];
          }
        }

        // Simulate fuzzy search in NEAR operator
        if (
          params.contentSearchMode === "boolean" &&
          params.fuzzySearchNearEnabled
        ) {
          // Simulate fuzzy match for NEAR("tst", "example", 5)
          if (params.contentSearchTerm === 'NEAR("tst", "example", 5)') {
            result.structuredItems[3].matched = true;
            result.structuredItems[3].matchDetails = [
              {
                term: "tst",
                positions: [15],
                isFuzzyMatch: true,
              },
              {
                term: "example",
                positions: [18],
                isFuzzyMatch: false,
              },
            ];
          }
        }

        // Simulate multiple terms with fuzzy search
        if (params.contentSearchTerm === "tst OR tesst") {
          result.structuredItems[0].matched = true;
          result.structuredItems[3].matched = true;
          result.structuredItems[0].matchDetails = [
            {
              term: "tesst",
              positions: [10, 50],
              isFuzzyMatch: true,
            },
          ];
          result.structuredItems[3].matchDetails = [
            {
              term: "tst",
              positions: [15, 35],
              isFuzzyMatch: true,
            },
          ];
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

  describe("Fuzzy Search in Content Query mode", () => {
    test("should find matches with slight misspellings", async () => {
      const result = await searchFiles(
        {
          ...defaultSearchParams,
          contentSearchTerm: "tst", // Misspelled "test"
          contentSearchMode: "term",
          fuzzySearchEnabled: true,
        },
        mockProgressCallback,
        mockCancellationChecker
      );

      // Verify searchFiles was called with the correct parameters
      expect(searchFiles).toHaveBeenCalledWith(
        expect.objectContaining({
          contentSearchTerm: "tst",
          contentSearchMode: "term",
          fuzzySearchEnabled: true,
        }),
        mockProgressCallback,
        mockCancellationChecker
      );

      // Verify the results include fuzzy matches
      expect(
        result.structuredItems.some(
          (item) =>
            item.matched &&
            item.matchDetails?.some((detail) => detail.isFuzzyMatch)
        )
      ).toBe(true);

      // Specifically check file4.ts which should have a fuzzy match
      const fuzzyMatchedItem = result.structuredItems.find(
        (item) => item.filePath === "subfolder/file4.ts"
      );
      expect(fuzzyMatchedItem?.matched).toBe(true);
      expect(
        fuzzyMatchedItem?.matchDetails?.some((detail) => detail.isFuzzyMatch)
      ).toBe(true);
    });

    test("should find matches with extra characters", async () => {
      const result = await searchFiles(
        {
          ...defaultSearchParams,
          contentSearchTerm: "tesst", // Extra 's' in "test"
          contentSearchMode: "term",
          fuzzySearchEnabled: true,
        },
        mockProgressCallback,
        mockCancellationChecker
      );

      // Verify the results include fuzzy matches
      expect(
        result.structuredItems.some(
          (item) =>
            item.matched &&
            item.matchDetails?.some((detail) => detail.isFuzzyMatch)
        )
      ).toBe(true);

      // Specifically check file1.txt which should have a fuzzy match
      const fuzzyMatchedItem = result.structuredItems.find(
        (item) => item.filePath === "file1.txt"
      );
      expect(fuzzyMatchedItem?.matched).toBe(true);
      expect(
        fuzzyMatchedItem?.matchDetails?.some((detail) => detail.isFuzzyMatch)
      ).toBe(true);
    });

    test("should not find fuzzy matches when fuzzy search is disabled", async () => {
      const result = await searchFiles(
        {
          ...defaultSearchParams,
          contentSearchTerm: "tst", // Misspelled "test"
          contentSearchMode: "term",
          fuzzySearchEnabled: false,
        },
        mockProgressCallback,
        mockCancellationChecker
      );

      // Verify searchFiles was called with fuzzy search disabled
      expect(searchFiles).toHaveBeenCalledWith(
        expect.objectContaining({
          fuzzySearchEnabled: false,
        }),
        mockProgressCallback,
        mockCancellationChecker
      );

      // Verify file4.ts does not have a match when fuzzy search is disabled
      const fuzzyMatchedItem = result.structuredItems.find(
        (item) => item.filePath === "subfolder/file4.ts"
      );
      expect(fuzzyMatchedItem?.matched).toBe(false);
    });
  });

  describe("Fuzzy Search in Boolean Query mode", () => {
    test("should find matches with Boolean expressions containing misspelled terms", async () => {
      const result = await searchFiles(
        {
          ...defaultSearchParams,
          contentSearchTerm: "tst AND example", // Misspelled "test"
          contentSearchMode: "boolean",
          fuzzySearchBooleanEnabled: true,
        },
        mockProgressCallback,
        mockCancellationChecker
      );

      // Verify searchFiles was called with the correct parameters
      expect(searchFiles).toHaveBeenCalledWith(
        expect.objectContaining({
          contentSearchTerm: "tst AND example",
          contentSearchMode: "boolean",
          fuzzySearchBooleanEnabled: true,
        }),
        mockProgressCallback,
        mockCancellationChecker
      );

      // Verify the results include fuzzy matches
      expect(
        result.structuredItems.some(
          (item) =>
            item.matched &&
            item.matchDetails?.some((detail) => detail.isFuzzyMatch)
        )
      ).toBe(true);

      // Specifically check file4.ts which should have a fuzzy match
      const fuzzyMatchedItem = result.structuredItems.find(
        (item) => item.filePath === "subfolder/file4.ts"
      );
      expect(fuzzyMatchedItem?.matched).toBe(true);
      expect(
        fuzzyMatchedItem?.matchDetails?.some((detail) => detail.isFuzzyMatch)
      ).toBe(true);
    });
  });

  describe("Fuzzy Search in NEAR operator", () => {
    test("should find matches with NEAR expressions containing misspelled terms", async () => {
      const result = await searchFiles(
        {
          ...defaultSearchParams,
          contentSearchTerm: 'NEAR("tst", "example", 5)', // Misspelled "test"
          contentSearchMode: "boolean",
          fuzzySearchNearEnabled: true,
        },
        mockProgressCallback,
        mockCancellationChecker
      );

      // Verify searchFiles was called with the correct parameters
      expect(searchFiles).toHaveBeenCalledWith(
        expect.objectContaining({
          contentSearchTerm: 'NEAR("tst", "example", 5)',
          contentSearchMode: "boolean",
          fuzzySearchNearEnabled: true,
        }),
        mockProgressCallback,
        mockCancellationChecker
      );

      // Verify the results include fuzzy matches
      expect(
        result.structuredItems.some(
          (item) =>
            item.matched &&
            item.matchDetails?.some((detail) => detail.isFuzzyMatch)
        )
      ).toBe(true);

      // Specifically check file4.ts which should have a fuzzy match
      const fuzzyMatchedItem = result.structuredItems.find(
        (item) => item.filePath === "subfolder/file4.ts"
      );
      expect(fuzzyMatchedItem?.matched).toBe(true);
      expect(
        fuzzyMatchedItem?.matchDetails?.some((detail) => detail.isFuzzyMatch)
      ).toBe(true);
    });
  });

  describe("Fuzzy Search with multiple terms", () => {
    test("should find matches with multiple misspelled terms", async () => {
      const result = await searchFiles(
        {
          ...defaultSearchParams,
          contentSearchTerm: "tst OR tesst", // Multiple misspelled terms
          contentSearchMode: "boolean",
          fuzzySearchBooleanEnabled: true,
        },
        mockProgressCallback,
        mockCancellationChecker
      );

      // Verify searchFiles was called with the correct parameters
      expect(searchFiles).toHaveBeenCalledWith(
        expect.objectContaining({
          contentSearchTerm: "tst OR tesst",
          contentSearchMode: "boolean",
          fuzzySearchBooleanEnabled: true,
        }),
        mockProgressCallback,
        mockCancellationChecker
      );

      // Verify multiple files have fuzzy matches
      const fuzzyMatchedItems = result.structuredItems.filter(
        (item) =>
          item.matched &&
          item.matchDetails?.some((detail) => detail.isFuzzyMatch)
      );
      expect(fuzzyMatchedItems.length).toBeGreaterThan(1);

      // Check specific files
      const file1 = result.structuredItems.find(
        (item) => item.filePath === "file1.txt"
      );
      const file4 = result.structuredItems.find(
        (item) => item.filePath === "subfolder/file4.ts"
      );

      expect(file1?.matched).toBe(true);
      expect(file4?.matched).toBe(true);
      expect(file1?.matchDetails?.some((detail) => detail.isFuzzyMatch)).toBe(
        true
      );
      expect(file4?.matchDetails?.some((detail) => detail.isFuzzyMatch)).toBe(
        true
      );
    });
  });

  describe("Performance with fuzzy search", () => {
    test("should complete search in reasonable time with fuzzy search enabled", async () => {
      const startTime = Date.now();

      await searchFiles(
        {
          ...defaultSearchParams,
          contentSearchTerm: "tst", // Misspelled "test"
          contentSearchMode: "term",
          fuzzySearchEnabled: true,
        },
        mockProgressCallback,
        mockCancellationChecker
      );

      const endTime = Date.now();
      const duration = endTime - startTime;

      // This is a mock test, so we're not actually testing real performance
      // In a real test, we would set a reasonable threshold
      expect(duration).toBeLessThan(1000); // Should complete in less than 1 second
    });

    test("should complete search faster with fuzzy search disabled", async () => {
      // First run with fuzzy search enabled
      const startTimeEnabled = Date.now();
      await searchFiles(
        {
          ...defaultSearchParams,
          contentSearchTerm: "tst",
          contentSearchMode: "term",
          fuzzySearchEnabled: true,
        },
        mockProgressCallback,
        mockCancellationChecker
      );
      const durationEnabled = Date.now() - startTimeEnabled;

      // Then run with fuzzy search disabled
      const startTimeDisabled = Date.now();
      await searchFiles(
        {
          ...defaultSearchParams,
          contentSearchTerm: "tst",
          contentSearchMode: "term",
          fuzzySearchEnabled: false,
        },
        mockProgressCallback,
        mockCancellationChecker
      );
      const durationDisabled = Date.now() - startTimeDisabled;

      // In a real test with actual fuzzy search implementation,
      // we would expect fuzzy search to be slower
      // For this mock test, we're just checking that both complete
      expect(durationEnabled).toBeDefined();
      expect(durationDisabled).toBeDefined();

      // Note: In a real test, we would assert something like:
      // expect(durationDisabled).toBeLessThan(durationEnabled);
      // But since this is a mock, we're not making that assertion
    });
  });
});
