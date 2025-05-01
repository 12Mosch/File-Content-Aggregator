/**
 * Mock implementation of FileDiscoveryService
 */

import { FileStats } from "../../../../src/electron/services/FileProcessingService.js";

// Define types
export type FolderExclusionMode =
  | "contains"
  | "exact"
  | "startsWith"
  | "endsWith";

export interface FileDiscoveryOptions {
  extensions?: string[];
  excludeFiles?: string[];
  excludeFolders?: string[];
  folderExclusionMode?: FolderExclusionMode;
  modifiedAfter?: string;
  modifiedBefore?: string;
  minSizeBytes?: number;
  maxSizeBytes?: number;
  maxDepth?: number;
  includeDotFiles?: boolean;
}

export interface PathErrorDetail {
  searchPath: string;
  errorPath: string;
  message: string;
  code?: string;
}

export interface ProgressCallback {
  (data: {
    processed: number;
    total: number;
    currentFile?: string;
    message?: string;
    error?: string;
    status?: "searching" | "cancelling" | "cancelled" | "completed" | "error";
  }): void;
}

export type CancellationChecker = () => boolean;

// Mock FileDiscoveryService class
export class FileDiscoveryService {
  private static instance: FileDiscoveryService;

  // Singleton pattern
  public static getInstance(): FileDiscoveryService {
    if (!FileDiscoveryService.instance) {
      FileDiscoveryService.instance = new FileDiscoveryService();
    }
    return FileDiscoveryService.instance;
  }

  /**
   * Discovers files based on search criteria
   */
  public async discoverFiles(
    searchPaths: string[],
    options: FileDiscoveryOptions = {},
    progressCallback: ProgressCallback,
    checkCancellation: CancellationChecker
  ): Promise<{
    files: Array<{ filePath: string; stats: FileStats | null }>;
    errors: PathErrorDetail[];
    wasCancelled: boolean;
  }> {
    // Check for cancellation
    if (checkCancellation()) {
      progressCallback({
        processed: 0,
        total: 0,
        message: "Search cancelled before file discovery.",
        status: "cancelled",
      });
      return { files: [], errors: [], wasCancelled: true };
    }

    // Mock implementation
    const mockFiles = [
      {
        filePath: "/test/file1.txt",
        stats: {
          size: 1024,
          mtime: new Date("2023-01-01"),
          isDirectory: false,
        } as FileStats,
      },
      {
        filePath: "/test/file2.md",
        stats: {
          size: 2048,
          mtime: new Date("2023-01-02"),
          isDirectory: false,
        } as FileStats,
      },
      {
        filePath: "/test/subfolder/file3.js",
        stats: {
          size: 3072,
          mtime: new Date("2023-01-03"),
          isDirectory: false,
        } as FileStats,
      },
    ];

    // Apply filters based on options
    let filteredFiles = [...mockFiles];

    // Filter by extension
    if (options.extensions && options.extensions.length > 0) {
      const normalizedExtensions = options.extensions.map((ext) =>
        ext.startsWith(".") ? ext : `.${ext}`
      );
      filteredFiles = filteredFiles.filter((file) =>
        normalizedExtensions.some((ext) => file.filePath.endsWith(ext))
      );
    }

    // Filter by excluded files
    if (options.excludeFiles && options.excludeFiles.length > 0) {
      filteredFiles = filteredFiles.filter(
        (file) =>
          !options.excludeFiles!.some((pattern) =>
            file.filePath.includes(pattern)
          )
      );
    }

    // Filter by excluded folders
    if (options.excludeFolders && options.excludeFolders.length > 0) {
      filteredFiles = filteredFiles.filter((file) => {
        return !this.isDirectoryExcluded(
          file.filePath,
          options.excludeFolders!,
          options.folderExclusionMode || "contains"
        );
      });
    }

    // Filter by max depth
    if (options.maxDepth !== undefined) {
      filteredFiles = filteredFiles.filter((file) => {
        // Simple depth calculation based on path segments
        const depth = file.filePath.split("/").length - 2; // Adjust for leading slash and base path
        return depth <= options.maxDepth!;
      });
    }

    // Filter by date
    if (options.modifiedAfter) {
      const afterDate = new Date(options.modifiedAfter);
      filteredFiles = filteredFiles.filter(
        (file) => file.stats && file.stats.mtime > afterDate
      );
    }

    if (options.modifiedBefore) {
      const beforeDate = new Date(options.modifiedBefore);
      filteredFiles = filteredFiles.filter(
        (file) => file.stats && file.stats.mtime < beforeDate
      );
    }

    // Filter by size
    if (options.minSizeBytes !== undefined) {
      filteredFiles = filteredFiles.filter(
        (file) => file.stats && file.stats.size >= options.minSizeBytes!
      );
    }

    if (options.maxSizeBytes !== undefined) {
      filteredFiles = filteredFiles.filter(
        (file) => file.stats && file.stats.size <= options.maxSizeBytes!
      );
    }

    // Mock progress updates
    progressCallback({
      processed: filteredFiles.length,
      total: filteredFiles.length,
      message: `Found ${filteredFiles.length} files matching criteria.`,
      status: "completed",
    });

    return {
      files: filteredFiles,
      errors: [],
      wasCancelled: false,
    };
  }

  /**
   * Checks if a directory should be excluded based on the exclusion patterns
   */
  public isDirectoryExcluded(
    dirPath: string,
    excludeFolders: string[],
    folderExclusionMode: FolderExclusionMode
  ): boolean {
    return excludeFolders.some((pattern) => {
      switch (folderExclusionMode) {
        case "contains":
          return dirPath.includes(pattern);
        case "startsWith":
          return dirPath
            .split("/")
            .some((segment) => segment.startsWith(pattern));
        case "endsWith":
          return dirPath
            .split("/")
            .some((segment) => segment.endsWith(pattern));
        case "exact":
          return dirPath.split("/").includes(pattern);
        default:
          return false;
      }
    });
  }

  /**
   * Filters path errors to remove those related to directories that would have been excluded anyway
   */
  public filterRelevantPathErrors(
    allPathErrors: PathErrorDetail[],
    excludeFolders: string[],
    folderExclusionMode: FolderExclusionMode
  ): string[] {
    return allPathErrors
      .filter((errorDetail) => {
        // Keep non-permission errors or errors without a specific path
        if (
          errorDetail.code !== "EPERM" ||
          !errorDetail.errorPath ||
          errorDetail.errorPath === errorDetail.searchPath
        ) {
          return true;
        }

        // Check if the directory causing the EPERM error should be excluded
        const shouldExclude = this.isDirectoryExcluded(
          errorDetail.errorPath,
          excludeFolders,
          folderExclusionMode
        );

        // Keep the error only if the directory should NOT be excluded
        return !shouldExclude;
      })
      .map((errorDetail) => errorDetail.message);
  }
}

export default FileDiscoveryService;
