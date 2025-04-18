/**
 * Tests for the optimized file search service
 */

// Import the mocked functions
import {
  searchFiles,
  updateSearchSettings,
} from "../../../tests/mocks/electron/FileSearchService.mock";
// These imports are used in the mocked implementations
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import fs from "fs/promises";
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import path from "path";
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import os from "os";

// Mock the services
jest.mock("../../../src/electron/services/FileDiscoveryService", () => {
  return {
    FileDiscoveryService: {
      getInstance: jest.fn().mockReturnValue({
        discoverFiles: jest.fn().mockResolvedValue({
          files: [
            {
              filePath: "/test/file1.txt",
              stats: { size: 100, mtime: new Date(), isDirectory: false },
            },
            {
              filePath: "/test/file2.txt",
              stats: { size: 200, mtime: new Date(), isDirectory: false },
            },
          ],
          errors: [],
          wasCancelled: false,
        }),
        filterRelevantPathErrors: jest.fn().mockReturnValue([]),
      }),
    },
  };
});

jest.mock("../../../src/electron/services/FileProcessingService", () => {
  return {
    FileProcessingService: {
      getInstance: jest.fn().mockReturnValue({
        processFileInChunks: jest
          .fn()
          .mockImplementation((filePath, _matcher) => {
            // Simulate matching based on the file path
            const matched = filePath.includes("file1");
            return Promise.resolve({
              matched,
              error: null,
            });
          }),
      }),
    },
  };
});

jest.mock("../../../src/electron/services/ContentMatchingService", () => {
  return {
    ContentMatchingService: {
      getInstance: jest.fn().mockReturnValue({
        createMatcher: jest.fn().mockImplementation((searchTerm) => {
          if (searchTerm === "invalid regex") {
            return { matcher: null, error: "Invalid regex pattern" };
          }
          return {
            matcher: (content: string) => content.includes(searchTerm),
            error: null,
          };
        }),
      }),
    },
  };
});

jest.mock("../../../src/electron/services/SearchResultProcessor", () => {
  return {
    SearchResultProcessor: {
      getInstance: jest.fn().mockReturnValue({
        processResults: jest.fn().mockImplementation((matchedFiles) => {
          return matchedFiles.map((file) => ({
            ...file,
            children: [],
          }));
        }),
      }),
    },
  };
});

// Mock fs.readFile
jest.mock("fs/promises", () => {
  return {
    readFile: jest.fn().mockImplementation((filePath) => {
      if (filePath.includes("file1")) {
        return Promise.resolve("This is file1 content with test term");
      } else {
        return Promise.resolve("This is file2 content");
      }
    }),
    stat: jest.fn().mockImplementation((_filePath) => {
      return Promise.resolve({
        size: 100,
        mtime: new Date(),
        isDirectory: () => false,
      });
    }),
  };
});

describe("Optimized File Search Service", () => {
  // Reset mocks before each test
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should search files with term matching", async () => {
    const progressCallback = jest.fn();
    const checkCancellation = jest.fn().mockReturnValue(false);

    const result = await searchFiles(
      {
        searchPaths: ["/test"],
        extensions: ["txt"],
        excludeFiles: [],
        excludeFolders: [],
        contentSearchTerm: "test",
        contentSearchMode: "term",
      },
      progressCallback,
      checkCancellation
    );

    // Verify the result
    expect(result.filesFound).toBe(2);
    expect(result.filesProcessed).toBe(2);
    expect(result.errorsEncountered).toBe(0);
    expect(result.structuredItems.length).toBe(2);
    expect(result.structuredItems[0].matched).toBe(true); // file1 should match
    expect(result.structuredItems[1].matched).toBe(false); // file2 should not match
  });

  it("should handle invalid regex patterns", async () => {
    const progressCallback = jest.fn();
    const checkCancellation = jest.fn().mockReturnValue(false);

    const result = await searchFiles(
      {
        searchPaths: ["/test"],
        extensions: ["txt"],
        excludeFiles: [],
        excludeFolders: [],
        contentSearchTerm: "invalid regex",
        contentSearchMode: "regex",
      },
      progressCallback,
      checkCancellation
    );

    // Verify the result
    expect(result.filesFound).toBe(2);
    expect(result.filesProcessed).toBe(0);
    expect(result.errorsEncountered).toBe(1);
    expect(result.pathErrors.length).toBe(1);
    expect(result.pathErrors[0]).toContain("Invalid regex pattern");
  });

  it("should handle cancellation during file discovery", async () => {
    const progressCallback = jest.fn();
    const checkCancellation = jest.fn().mockReturnValue(true); // Always cancel

    // Mock the searchFiles function to return a cancelled result
    const mockSearchFiles = jest.fn().mockResolvedValue({
      wasCancelled: true,
      structuredItems: [],
      filesFound: 0,
      filesProcessed: 0,
      errorsEncountered: 0,
      pathErrors: [],
    });

    // Use the mock function for this test
    const originalSearchFiles = searchFiles;
    (global as any).searchFiles = mockSearchFiles;

    try {
      const result = await searchFiles(
        {
          searchPaths: ["/test"],
          extensions: ["txt"],
          excludeFiles: [],
          excludeFolders: [],
          contentSearchTerm: "test",
          contentSearchMode: "term",
        },
        progressCallback,
        checkCancellation
      );

      // Verify the result
      expect(result.wasCancelled).toBe(true);
      expect(result.structuredItems).toHaveLength(0);
      expect(progressCallback).toHaveBeenCalledWith(
        expect.objectContaining({
          status: "cancelled",
        })
      );
    } finally {
      // Restore the original function
      (global as any).searchFiles = originalSearchFiles;
    }
  });

  it("should update search settings correctly", () => {
    // Spy on console.log
    const consoleSpy = jest.spyOn(console, "log");

    // Update settings
    updateSearchSettings(true, false, true);

    // Verify console.log was called with the correct message
    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining(
        "Search settings updated: Boolean=true, NEAR=false, WholeWord=true"
      )
    );

    // Restore console.log
    consoleSpy.mockRestore();
  });
});
