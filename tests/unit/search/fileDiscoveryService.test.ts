/**
 * Unit tests for FileDiscoveryService
 */

import {
  describe,
  expect,
  it,
  jest,
  beforeEach,
  afterEach,
} from "@jest/globals";
import {
  FileDiscoveryService,
  type FileDiscoveryOptions,
  type PathErrorDetail,
} from "../../../tests/mocks/electron/services/FileDiscoveryService.mock";

describe("FileDiscoveryService", () => {
  // Setup variables
  let fileDiscoveryService: FileDiscoveryService;
  let mockProgressCallback: jest.Mock;
  let mockCancellationChecker: jest.Mock;

  // Setup before each test
  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();

    // Create instance of service
    fileDiscoveryService = FileDiscoveryService.getInstance();

    // Setup mock callbacks
    mockProgressCallback = jest.fn();
    mockCancellationChecker = jest.fn().mockReturnValue(false);
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  describe("Constructor and initialization", () => {
    it("should create an instance", () => {
      expect(fileDiscoveryService).toBeInstanceOf(FileDiscoveryService);
    });
  });

  describe("discoverFiles method", () => {
    it("should discover files with default options", async () => {
      const searchPaths = ["/test"];
      const options: FileDiscoveryOptions = {};

      const result = await fileDiscoveryService.discoverFiles(
        searchPaths,
        options,
        mockProgressCallback,
        mockCancellationChecker
      );

      // Verify results
      expect(result.files.length).toBe(3);
      expect(result.errors).toEqual([]);
      expect(result.wasCancelled).toBe(false);

      // Verify progress callback was called
      expect(mockProgressCallback).toHaveBeenCalled();
    });

    it("should filter files by extension", async () => {
      const searchPaths = ["/test"];
      const options: FileDiscoveryOptions = {
        extensions: ["txt", "md"],
      };

      const result = await fileDiscoveryService.discoverFiles(
        searchPaths,
        options,
        mockProgressCallback,
        mockCancellationChecker
      );

      // Verify only txt and md files are included
      expect(
        result.files.every(
          (f) => f.filePath.endsWith(".txt") || f.filePath.endsWith(".md")
        )
      ).toBe(true);

      // Verify js files are excluded
      expect(result.files.some((f) => f.filePath.endsWith(".js"))).toBe(false);

      // Verify progress callback was called
      expect(mockProgressCallback).toHaveBeenCalled();
    });

    it("should exclude files based on patterns", async () => {
      const searchPaths = ["/test"];
      const options: FileDiscoveryOptions = {
        excludeFiles: ["file1.txt"],
      };

      const result = await fileDiscoveryService.discoverFiles(
        searchPaths,
        options,
        mockProgressCallback,
        mockCancellationChecker
      );

      // We expect file1.txt to be excluded
      expect(result.files.some((f) => f.filePath.includes("file1.txt"))).toBe(
        false
      );

      // Verify progress callback was called
      expect(mockProgressCallback).toHaveBeenCalled();
    });

    it('should exclude folders with "contains" mode', async () => {
      const searchPaths = ["/test"];
      const options: FileDiscoveryOptions = {
        excludeFolders: ["subfolder"],
        folderExclusionMode: "contains",
      };

      const result = await fileDiscoveryService.discoverFiles(
        searchPaths,
        options,
        mockProgressCallback,
        mockCancellationChecker
      );

      // We expect files in subfolder to be excluded
      expect(result.files.some((f) => f.filePath.includes("subfolder"))).toBe(
        false
      );

      // Verify progress callback was called
      expect(mockProgressCallback).toHaveBeenCalled();
    });

    it('should exclude folders with "startsWith" mode', async () => {
      const searchPaths = ["/test"];
      const options: FileDiscoveryOptions = {
        excludeFolders: ["sub"],
        folderExclusionMode: "startsWith",
      };

      const result = await fileDiscoveryService.discoverFiles(
        searchPaths,
        options,
        mockProgressCallback,
        mockCancellationChecker
      );

      // We expect files in folders starting with 'sub' to be excluded
      expect(result.files.some((f) => f.filePath.includes("subfolder"))).toBe(
        false
      );

      // Verify progress callback was called
      expect(mockProgressCallback).toHaveBeenCalled();
    });

    it('should exclude folders with "endsWith" mode', async () => {
      const searchPaths = ["/test"];
      const options: FileDiscoveryOptions = {
        excludeFolders: ["folder"],
        folderExclusionMode: "endsWith",
      };

      const result = await fileDiscoveryService.discoverFiles(
        searchPaths,
        options,
        mockProgressCallback,
        mockCancellationChecker
      );

      // We expect files in folders ending with 'folder' to be excluded
      expect(result.files.some((f) => f.filePath.includes("subfolder"))).toBe(
        false
      );

      // Verify progress callback was called
      expect(mockProgressCallback).toHaveBeenCalled();
    });

    it('should exclude folders with "exact" mode', async () => {
      const searchPaths = ["/test"];
      const options: FileDiscoveryOptions = {
        excludeFolders: ["subfolder"],
        folderExclusionMode: "exact",
      };

      const result = await fileDiscoveryService.discoverFiles(
        searchPaths,
        options,
        mockProgressCallback,
        mockCancellationChecker
      );

      // We expect files in the exact 'subfolder' to be excluded
      expect(result.files.some((f) => f.filePath.includes("subfolder"))).toBe(
        false
      );

      // Verify progress callback was called
      expect(mockProgressCallback).toHaveBeenCalled();
    });

    it("should respect maxDepth option", async () => {
      const searchPaths = ["/test"];
      const options: FileDiscoveryOptions = {
        maxDepth: 1,
      };

      const result = await fileDiscoveryService.discoverFiles(
        searchPaths,
        options,
        mockProgressCallback,
        mockCancellationChecker
      );

      // Verify files from deeper paths are excluded
      expect(result.files.some((f) => f.filePath.includes("subfolder"))).toBe(
        false
      );

      // Verify progress callback was called
      expect(mockProgressCallback).toHaveBeenCalled();
    });
  });

  describe("Date and size filtering", () => {
    it("should filter files by modified after date", async () => {
      const searchPaths = ["/test"];
      const options: FileDiscoveryOptions = {
        modifiedAfter: "2023-01-01", // Same as file1.txt's date, so it should be excluded
      };

      const result = await fileDiscoveryService.discoverFiles(
        searchPaths,
        options,
        mockProgressCallback,
        mockCancellationChecker
      );

      // We expect file1.txt to be excluded (same as modifiedAfter)
      expect(result.files.some((f) => f.filePath.includes("file1.txt"))).toBe(
        false
      );
      // We expect file3.js to be included (newer than modifiedAfter)
      expect(result.files.some((f) => f.filePath.includes("file3.js"))).toBe(
        true
      );
    });

    it("should filter files by modified before date", async () => {
      const searchPaths = ["/test"];
      const options: FileDiscoveryOptions = {
        modifiedBefore: "2023-01-02", // Before file2.md's date
      };

      const result = await fileDiscoveryService.discoverFiles(
        searchPaths,
        options,
        mockProgressCallback,
        mockCancellationChecker
      );

      // We expect file1.txt to be included (older than modifiedBefore)
      expect(result.files.some((f) => f.filePath.includes("file1.txt"))).toBe(
        true
      );
      // We expect file2.md to be excluded (newer than modifiedBefore)
      expect(result.files.some((f) => f.filePath.includes("file2.md"))).toBe(
        false
      );
    });

    it("should filter files by minimum size", async () => {
      const searchPaths = ["/test"];
      const options: FileDiscoveryOptions = {
        minSizeBytes: 2000, // Between file1.txt (1024) and file2.md (2048)
      };

      const result = await fileDiscoveryService.discoverFiles(
        searchPaths,
        options,
        mockProgressCallback,
        mockCancellationChecker
      );

      // We expect file1.txt to be excluded (smaller than minSizeBytes)
      expect(result.files.some((f) => f.filePath.includes("file1.txt"))).toBe(
        false
      );
      // We expect file2.md to be included (larger than minSizeBytes)
      expect(result.files.some((f) => f.filePath.includes("file2.md"))).toBe(
        true
      );
    });

    it("should filter files by maximum size", async () => {
      const searchPaths = ["/test"];
      const options: FileDiscoveryOptions = {
        maxSizeBytes: 2000, // Between file1.txt (1024) and file2.md (2048)
      };

      const result = await fileDiscoveryService.discoverFiles(
        searchPaths,
        options,
        mockProgressCallback,
        mockCancellationChecker
      );

      // We expect file1.txt to be included (smaller than maxSizeBytes)
      expect(result.files.some((f) => f.filePath.includes("file1.txt"))).toBe(
        true
      );
      // We expect file2.md to be excluded (larger than maxSizeBytes)
      expect(result.files.some((f) => f.filePath.includes("file2.md"))).toBe(
        false
      );
    });
  });

  describe("Cancellation handling", () => {
    it("should handle cancellation before starting", async () => {
      const searchPaths = ["/test"];
      const options: FileDiscoveryOptions = {};

      // Mock cancellation checker to return true (cancelled)
      mockCancellationChecker.mockReturnValue(true);

      const result = await fileDiscoveryService.discoverFiles(
        searchPaths,
        options,
        mockProgressCallback,
        mockCancellationChecker
      );

      // Verify the operation was cancelled
      expect(result.wasCancelled).toBe(true);
      expect(result.files).toEqual([]);

      // Verify progress callback was called with cancelled status
      expect(mockProgressCallback).toHaveBeenCalledWith(
        expect.objectContaining({
          status: "cancelled",
        })
      );
    });
  });

  describe("Path error filtering", () => {
    it("should filter out errors for excluded directories", () => {
      const allPathErrors: PathErrorDetail[] = [
        {
          searchPath: "/test",
          errorPath: "/test/node_modules/package",
          message: "Permission denied",
          code: "EPERM",
        },
        {
          searchPath: "/test",
          errorPath: "/test/src/file.ts",
          message: "Permission denied",
          code: "EPERM",
        },
        {
          searchPath: "/test",
          errorPath: "/test",
          message: "Directory not found",
          code: "ENOENT",
        },
      ];

      const excludeFolders = ["node_modules"];
      const folderExclusionMode = "contains" as const;

      const filteredErrors = fileDiscoveryService.filterRelevantPathErrors(
        allPathErrors,
        excludeFolders,
        folderExclusionMode
      );

      // We expect errors for node_modules to be filtered out
      expect(filteredErrors.length).toBe(2);
      expect(filteredErrors.some((e) => e.includes("node_modules"))).toBe(
        false
      );
      // We expect other errors to be included
      expect(filteredErrors.some((e) => e.includes("Permission denied"))).toBe(
        true
      );
      expect(
        filteredErrors.some((e) => e.includes("Directory not found"))
      ).toBe(true);
    });

    it("should keep non-permission errors", () => {
      const allPathErrors: PathErrorDetail[] = [
        {
          searchPath: "/test",
          errorPath: "/test/node_modules/package",
          message: "Permission denied",
          code: "EPERM",
        },
        {
          searchPath: "/test",
          errorPath: "/test/src/file.ts",
          message: "File not found",
          code: "ENOENT",
        },
      ];

      const excludeFolders: string[] = [];
      const folderExclusionMode = "contains" as const;

      const filteredErrors = fileDiscoveryService.filterRelevantPathErrors(
        allPathErrors,
        excludeFolders,
        folderExclusionMode
      );

      // We expect all errors to be included (none excluded)
      expect(filteredErrors.length).toBe(2);
    });
  });
});
