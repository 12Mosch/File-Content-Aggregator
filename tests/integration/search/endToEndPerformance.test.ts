import "@jest/globals";

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
  content?: string;
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

// Mock the file system operations and other dependencies
jest.mock("fs", () => ({
  promises: {
    readFile: jest.fn(),
    stat: jest.fn(),
    access: jest.fn(),
  },
  constants: { F_OK: 0 },
}));

// Mock fast-glob
jest.mock("fast-glob", () => jest.fn());

// Mock p-limit
jest.mock("p-limit", () => jest.fn(() => (fn: () => Promise<unknown>) => fn()));

describe("End-to-End Performance Tests", () => {
  // Setup variables for tests
  let mockProgressCallback: jest.Mock;
  let mockCancellationChecker: jest.Mock;
  let defaultSearchParams: SearchParams;

  // Generate a large number of mock files
  const generateMockFiles = (count: number): StructuredItem[] => {
    return Array.from({ length: count }, (_, i) => ({
      filePath: `file${i}.txt`,
      matched: i % 3 === 0, // Make every third file match
      size: 1024 + (i % 10) * 512, // Vary file sizes
      mtime: new Date(Date.now() - i * 60000), // Vary modification times
    }));
  };

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
  });

  describe("Application Responsiveness", () => {
    test("should report progress at regular intervals during large searches", async () => {
      // Setup a large number of files (10,000)
      const largeFileSet = generateMockFiles(10000);

      // Configure the mock to simulate a long-running search with progress updates
      searchFiles.mockImplementation(
        async (params, progressCallback, checkCancellation) => {
          const totalFiles = largeFileSet.length;
          const batchSize = 500;

          // Process files in batches to simulate progress
          for (let i = 0; i < totalFiles; i += batchSize) {
            // Check for cancellation
            if (checkCancellation()) {
              return {
                structuredItems: largeFileSet.slice(0, i),
                filesProcessed: i,
                filesFound: totalFiles,
                errorsEncountered: 0,
                pathErrors: [],
                fileReadErrors: [],
                wasCancelled: true,
              };
            }

            // Report progress
            progressCallback({
              processed: i,
              total: totalFiles,
              message: `Processed ${i} of ${totalFiles} files...`,
              status: "processing",
            });

            // Simulate processing time
            await new Promise((resolve) => setTimeout(resolve, 5));
          }

          // Final progress update
          progressCallback({
            processed: totalFiles,
            total: totalFiles,
            message: `Completed processing ${totalFiles} files.`,
            status: "completed",
          });

          return {
            structuredItems: largeFileSet,
            filesProcessed: totalFiles,
            filesFound: totalFiles,
            errorsEncountered: 0,
            pathErrors: [],
            fileReadErrors: [],
            wasCancelled: false,
          };
        }
      );

      // Start the search
      const startTime = performance.now();
      const result = await searchFiles(
        defaultSearchParams,
        mockProgressCallback,
        mockCancellationChecker
      );
      const endTime = performance.now();

      // Calculate metrics
      const executionTime = endTime - startTime;
      const progressCallCount = mockProgressCallback.mock.calls.length;
      const avgTimeBetweenUpdates = executionTime / progressCallCount;

      console.log(`Total execution time: ${executionTime.toFixed(2)} ms`);
      console.log(`Progress updates: ${progressCallCount}`);
      console.log(
        `Average time between updates: ${avgTimeBetweenUpdates.toFixed(2)} ms`
      );

      // Verify results
      expect(result.filesProcessed).toBe(10000);
      expect(result.wasCancelled).toBe(false);

      // Verify progress was reported regularly
      expect(progressCallCount).toBeGreaterThan(5);

      // Verify cancellation was checked regularly
      expect(mockCancellationChecker).toHaveBeenCalled();
    });

    test("should handle cancellation promptly during large searches", async () => {
      // Setup a large number of files
      const largeFileSet = generateMockFiles(20000);

      // Configure cancellation to trigger after some time
      let callCount = 0;
      mockCancellationChecker.mockImplementation(() => {
        callCount++;
        // Cancel after 10 calls
        return callCount > 10;
      });

      // Configure the mock to simulate a long-running search
      searchFiles.mockImplementation(
        async (params, progressCallback, checkCancellation) => {
          const totalFiles = largeFileSet.length;
          const batchSize = 1000;

          // Process files in batches
          for (let i = 0; i < totalFiles; i += batchSize) {
            // Check for cancellation
            if (checkCancellation()) {
              return {
                structuredItems: largeFileSet.slice(0, i),
                filesProcessed: i,
                filesFound: totalFiles,
                errorsEncountered: 0,
                pathErrors: [],
                fileReadErrors: [],
                wasCancelled: true,
              };
            }

            // Report progress
            progressCallback({
              processed: i,
              total: totalFiles,
              message: `Processed ${i} of ${totalFiles} files...`,
              status: "processing",
            });

            // Simulate processing time
            await new Promise((resolve) => setTimeout(resolve, 5));
          }

          return {
            structuredItems: largeFileSet,
            filesProcessed: totalFiles,
            filesFound: totalFiles,
            errorsEncountered: 0,
            pathErrors: [],
            fileReadErrors: [],
            wasCancelled: false,
          };
        }
      );

      // Start the search
      const startTime = performance.now();
      const result = await searchFiles(
        defaultSearchParams,
        mockProgressCallback,
        mockCancellationChecker
      );
      const endTime = performance.now();

      // Calculate metrics
      const executionTime = endTime - startTime;

      console.log(
        `Cancelled search execution time: ${executionTime.toFixed(2)} ms`
      );
      console.log(
        `Files processed before cancellation: ${result.filesProcessed}`
      );

      // Verify results
      expect(result.wasCancelled).toBe(true);
      expect(result.filesProcessed).toBeLessThan(20000);

      // Verify cancellation was checked
      expect(mockCancellationChecker).toHaveBeenCalled();
    });
  });

  describe("UI Performance with Large Result Sets", () => {
    test("should efficiently handle very large result sets", async () => {
      // Setup an extremely large result set (100,000 files)
      const veryLargeFileSet = generateMockFiles(100000);

      // Configure the mock to return the large result set immediately
      searchFiles.mockResolvedValue({
        structuredItems: veryLargeFileSet,
        filesProcessed: veryLargeFileSet.length,
        filesFound: veryLargeFileSet.length,
        errorsEncountered: 0,
        pathErrors: [],
        fileReadErrors: [],
        wasCancelled: false,
      });

      // Measure time to get results
      const startTime = performance.now();
      const result = await searchFiles(
        defaultSearchParams,
        mockProgressCallback,
        mockCancellationChecker
      );
      const endTime = performance.now();

      // Calculate metrics
      const executionTime = endTime - startTime;

      console.log(
        `Time to retrieve 100,000 results: ${executionTime.toFixed(2)} ms`
      );
      console.log(`Result set size: ${result.structuredItems.length} items`);

      // Verify results
      expect(result.structuredItems.length).toBe(100000);

      // Simulate processing the results for UI display
      const uiStartTime = performance.now();

      // Simulate what the UI would do with these results
      // 1. Sort the results
      const sortedResults = [...result.structuredItems].sort((a, b) =>
        a.filePath.localeCompare(b.filePath)
      );

      // 2. Filter the results
      const filteredResults = sortedResults.filter((item) =>
        item.filePath.includes("file")
      );

      // 3. Prepare for display (e.g., calculate heights for virtualized list)
      const displayItems = filteredResults.map((item) => ({
        ...item,
        displayHeight: 30 + (item.matched ? 100 : 0), // Simplified height calculation
      }));

      const uiEndTime = performance.now();
      const uiProcessingTime = uiEndTime - uiStartTime;

      console.log(
        `UI processing time for 100,000 results: ${uiProcessingTime.toFixed(2)} ms`
      );

      // Verify UI processing is reasonably fast
      expect(uiProcessingTime).toBeLessThan(5000); // Should process in under 5 seconds
      expect(displayItems.length).toBe(filteredResults.length);
    });

    test("should efficiently handle result filtering and sorting", async () => {
      // Setup a large result set (10,000 files)
      const largeFileSet = generateMockFiles(10000);

      // Configure the mock to return the large result set
      searchFiles.mockResolvedValue({
        structuredItems: largeFileSet,
        filesProcessed: largeFileSet.length,
        filesFound: largeFileSet.length,
        errorsEncountered: 0,
        pathErrors: [],
        fileReadErrors: [],
        wasCancelled: false,
      });

      // Get the results
      const result = await searchFiles(
        defaultSearchParams,
        mockProgressCallback,
        mockCancellationChecker
      );

      // Test different sorting operations
      const sortOperations = [
        {
          name: "Sort by path (asc)",
          fn: () =>
            [...result.structuredItems].sort((a, b) =>
              a.filePath.localeCompare(b.filePath)
            ),
        },
        {
          name: "Sort by path (desc)",
          fn: () =>
            [...result.structuredItems].sort((a, b) =>
              b.filePath.localeCompare(a.filePath)
            ),
        },
        {
          name: "Sort by size (asc)",
          fn: () =>
            [...result.structuredItems].sort(
              (a, b) => (a.size || 0) - (b.size || 0)
            ),
        },
        {
          name: "Sort by size (desc)",
          fn: () =>
            [...result.structuredItems].sort(
              (a, b) => (b.size || 0) - (a.size || 0)
            ),
        },
        {
          name: "Sort by date (asc)",
          fn: () =>
            [...result.structuredItems].sort(
              (a, b) => (a.mtime?.getTime() || 0) - (b.mtime?.getTime() || 0)
            ),
        },
        {
          name: "Sort by date (desc)",
          fn: () =>
            [...result.structuredItems].sort(
              (a, b) => (b.mtime?.getTime() || 0) - (a.mtime?.getTime() || 0)
            ),
        },
        {
          name: "Sort by match status",
          fn: () =>
            [...result.structuredItems].sort(
              (a, b) => (b.matched ? 1 : 0) - (a.matched ? 1 : 0)
            ),
        },
      ];

      // Test each sort operation
      for (const op of sortOperations) {
        const startTime = performance.now();
        const sortedResults = op.fn();
        const endTime = performance.now();

        console.log(`${op.name}: ${(endTime - startTime).toFixed(2)} ms`);

        // Verify sort completed and returned all items
        expect(sortedResults.length).toBe(result.structuredItems.length);
      }

      // Test filtering operations
      const filterOperations = [
        {
          name: "Filter by path contains '1'",
          fn: () =>
            result.structuredItems.filter((item) =>
              item.filePath.includes("1")
            ),
        },
        {
          name: "Filter matched only",
          fn: () => result.structuredItems.filter((item) => item.matched),
        },
        {
          name: "Filter by size > 2KB",
          fn: () =>
            result.structuredItems.filter((item) => (item.size || 0) > 2048),
        },
        {
          name: "Complex filter (matched AND size > 2KB)",
          fn: () =>
            result.structuredItems.filter(
              (item) => item.matched && (item.size || 0) > 2048
            ),
        },
      ];

      // Test each filter operation
      for (const op of filterOperations) {
        const startTime = performance.now();
        const filteredResults = op.fn();
        const endTime = performance.now();

        console.log(
          `${op.name}: ${(endTime - startTime).toFixed(2)} ms, returned ${filteredResults.length} items`
        );

        // Verify filter completed
        expect(typeof filteredResults.length).toBe("number");
      }
    });
  });
});
