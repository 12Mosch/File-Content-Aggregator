/**
 * FileDiscoveryService
 *
 * A service for discovering files based on search criteria.
 * This service optimizes file discovery and filtering.
 */

import path from "path";
import picomatch from "picomatch";
import { FileProcessingService, FileStats } from "./index.js";

// Import module and create a require function
import module from "node:module";
const require = module.createRequire(import.meta.url);

// Use the created require function to load fast-glob
import type { Options as FastGlobOptions } from "fast-glob";
const fg: (
  patterns: string | readonly string[],
  options?: FastGlobOptions
) => Promise<string[]> = require("fast-glob");

// Define interfaces for the service
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

export class FileDiscoveryService {
  private static instance: FileDiscoveryService;

  // Services
  private fileProcessingService: FileProcessingService;

  // Private constructor for singleton pattern
  private constructor() {
    this.fileProcessingService = FileProcessingService.getInstance();
  }

  /**
   * Gets the singleton instance of FileDiscoveryService
   * @returns The FileDiscoveryService instance
   */
  public static getInstance(): FileDiscoveryService {
    if (!FileDiscoveryService.instance) {
      FileDiscoveryService.instance = new FileDiscoveryService();
    }
    return FileDiscoveryService.instance;
  }

  /**
   * Discovers files based on search criteria
   * @param searchPaths Array of paths to search
   * @param options Discovery options
   * @param progressCallback Callback for progress updates
   * @param checkCancellation Function to check if the operation should be cancelled
   * @returns Array of discovered files with their stats
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
    const {
      extensions = [],
      excludeFiles = [],
      excludeFolders = [],
      folderExclusionMode = "contains",
      maxDepth,
    } = options;

    const allFoundFiles = new Set<string>();
    const detailedPathErrors: PathErrorDetail[] = [];
    let wasCancelled = false;

    progressCallback({
      processed: 0,
      total: 0,
      message: "Scanning directories...",
      status: "searching",
    });

    // Prepare file patterns for fast-glob
    const includePatterns =
      extensions.length > 0
        ? extensions.map((ext) => `**/*.${ext.replace(/^\./, "")}`)
        : ["**/*"]; // If no extensions specified, include all files

    const globDepth = maxDepth && maxDepth > 0 ? maxDepth : Infinity;

    // Check for cancellation before starting
    if (checkCancellation()) {
      wasCancelled = true;
      progressCallback({
        processed: 0,
        total: 0,
        message: "Search cancelled before file discovery.",
        status: "cancelled",
      });
      return { files: [], errors: detailedPathErrors, wasCancelled };
    }

    // Process each search path concurrently
    await Promise.all(
      searchPaths.map(async (searchPath) => {
        if (checkCancellation()) {
          wasCancelled = true;
          return;
        }

        const normalizedPath = searchPath.replace(/\\/g, "/");

        try {
          // Run fast-glob, suppressing errors to continue scan
          const found = await fg(includePatterns, {
            cwd: normalizedPath,
            absolute: true,
            onlyFiles: true,
            dot: options.includeDotFiles ?? true,
            stats: false,
            suppressErrors: true, // Suppress errors to get accessible files
            deep: globDepth,
          });

          if (checkCancellation()) {
            wasCancelled = true;
            return;
          }

          // Add successfully found files to the set
          found.forEach((file: string) =>
            allFoundFiles.add(file.replace(/\\/g, "/"))
          );
        } catch (globError: unknown) {
          // Catch unexpected errors *other* than traversal issues suppressed above
          const message =
            globError instanceof Error ? globError.message : String(globError);

          console.error(
            `Unexpected error during fast-glob execution for path "${searchPath}":`,
            message
          );

          detailedPathErrors.push({
            searchPath: searchPath,
            errorPath: searchPath,
            message: `Unexpected error scanning "${searchPath}": ${message}`,
          });
        }
      })
    );

    if (wasCancelled) {
      progressCallback({
        processed: 0,
        total: 0,
        message: "Search cancelled during file discovery.",
        status: "cancelled",
      });
      return { files: [], errors: detailedPathErrors, wasCancelled };
    }

    const initialFileCount = allFoundFiles.size;

    progressCallback({
      processed: 0,
      total: initialFileCount,
      message: `Found ${initialFileCount} potential files (depth limit: ${globDepth === Infinity ? "none" : globDepth}). Filtering...`,
      status: "searching",
    });

    // Filter files based on exclusion patterns
    let filesToProcess = Array.from(allFoundFiles);

    if (excludeFiles.length > 0 || excludeFolders.length > 0) {
      filesToProcess = filesToProcess.filter((filePath) => {
        // Check file exclusions
        if (excludeFiles.length > 0) {
          const fileName = path.basename(filePath);
          for (const pattern of excludeFiles) {
            if (picomatch.isMatch(fileName, pattern, { dot: true })) {
              return false;
            }
          }
        }

        // Check folder exclusions
        if (excludeFolders.length > 0) {
          const dirPath = path.dirname(filePath);
          if (
            this.isDirectoryExcluded(
              dirPath,
              excludeFolders,
              folderExclusionMode
            )
          ) {
            return false;
          }
        }

        return true;
      });
    }

    if (checkCancellation()) {
      wasCancelled = true;
      progressCallback({
        processed: 0,
        total: initialFileCount,
        message: "Search cancelled during file filtering.",
        status: "cancelled",
      });
      return { files: [], errors: detailedPathErrors, wasCancelled };
    }

    progressCallback({
      processed: 0,
      total: filesToProcess.length,
      message: `Filtered to ${filesToProcess.length} files. Getting file metadata...`,
      status: "searching",
    });

    // Get file stats for all files
    const filesWithStats: Array<{ filePath: string; stats: FileStats | null }> =
      [];
    let processedCount = 0;

    // Process files in batches to avoid overwhelming the system
    const batchSize = 100;
    for (let i = 0; i < filesToProcess.length; i += batchSize) {
      if (checkCancellation()) {
        wasCancelled = true;
        break;
      }

      const batch = filesToProcess.slice(i, i + batchSize);
      const batchResults = await Promise.all(
        batch.map(async (filePath) => {
          if (checkCancellation()) {
            return null;
          }

          const stats = await this.fileProcessingService.getFileStats(filePath);
          processedCount++;

          if (
            processedCount % 100 === 0 ||
            processedCount === filesToProcess.length
          ) {
            progressCallback({
              processed: processedCount,
              total: filesToProcess.length,
              currentFile: filePath,
              message: `Getting metadata: ${processedCount}/${filesToProcess.length}`,
              status: "searching",
            });
          }

          return { filePath, stats };
        })
      );

      // Add non-null results to the final array
      batchResults.forEach((result) => {
        if (result) {
          filesWithStats.push(result);
        }
      });
    }

    if (wasCancelled) {
      progressCallback({
        processed: processedCount,
        total: filesToProcess.length,
        message: "Search cancelled during metadata fetch.",
        status: "cancelled",
      });
      return { files: [], errors: detailedPathErrors, wasCancelled };
    }

    // Apply date and size filters
    const filteredFiles = this.applyDateAndSizeFilters(filesWithStats, options);

    progressCallback({
      processed: filesToProcess.length,
      total: filesToProcess.length,
      message: `Found ${filteredFiles.length} files matching criteria.`,
      status: "searching",
    });

    return {
      files: filteredFiles,
      errors: detailedPathErrors,
      wasCancelled,
    };
  }

  /**
   * Applies date and size filters to files
   * @param files Array of files with their stats
   * @param options Filter options
   * @returns Filtered array of files
   */
  private applyDateAndSizeFilters(
    files: Array<{ filePath: string; stats: FileStats | null }>,
    options: FileDiscoveryOptions
  ): Array<{ filePath: string; stats: FileStats | null }> {
    const { modifiedAfter, modifiedBefore, minSizeBytes, maxSizeBytes } =
      options;

    // Parse date strings to timestamps
    const afterTimestamp = modifiedAfter
      ? new Date(modifiedAfter).getTime()
      : null;
    const beforeTimestamp = modifiedBefore
      ? new Date(modifiedBefore).getTime()
      : null;

    return files.filter(({ stats }) => {
      // Skip files without stats
      if (!stats) return true;

      // Apply date filters
      if (afterTimestamp !== null && stats.mtime.getTime() < afterTimestamp) {
        return false;
      }

      if (beforeTimestamp !== null && stats.mtime.getTime() > beforeTimestamp) {
        return false;
      }

      // Apply size filters
      if (minSizeBytes !== undefined && stats.size < minSizeBytes) {
        return false;
      }

      if (maxSizeBytes !== undefined && stats.size > maxSizeBytes) {
        return false;
      }

      return true;
    });
  }

  /**
   * Checks if a directory path matches any of the exclusion patterns
   * @param dirPath The directory path to check
   * @param excludeFolders Array of exclusion patterns
   * @param folderExclusionMode The matching mode
   * @returns True if the directory should be excluded, false otherwise
   */
  public isDirectoryExcluded(
    dirPath: string,
    excludeFolders: string[],
    folderExclusionMode: FolderExclusionMode
  ): boolean {
    if (!excludeFolders || excludeFolders.length === 0) {
      return false;
    }

    const picoOptions = { dot: true, nocase: true }; // Case-insensitive folder matching
    const folderMatchers = excludeFolders.map((pattern) => {
      let matchPattern = pattern;

      switch (folderExclusionMode) {
        case "startsWith":
          matchPattern = pattern + "*";
          break;
        case "endsWith":
          matchPattern = "*" + pattern;
          break;
        case "contains":
          if (!pattern.includes("*") && !pattern.includes("?")) {
            matchPattern = "*" + pattern + "*";
          }
          break;
        case "exact":
        default:
          break;
      }

      return picomatch(matchPattern, picoOptions);
    });

    // Split path into segments, handling both Windows and POSIX separators
    const segments = dirPath.replace(/\\/g, "/").split("/").filter(Boolean);

    // Check if any segment matches any exclusion pattern
    return folderMatchers.some((isMatch) =>
      segments.some((segment) => isMatch(segment))
    );
  }

  /**
   * Filters path errors to remove those related to directories that would have been excluded anyway
   * @param allPathErrors Array of all captured path errors
   * @param excludeFolders Array of folder exclusion patterns
   * @param folderExclusionMode The matching mode for folder exclusions
   * @returns Array of relevant path error messages for the user
   */
  public filterRelevantPathErrors(
    allPathErrors: PathErrorDetail[],
    excludeFolders: string[],
    folderExclusionMode: FolderExclusionMode
  ): string[] {
    return allPathErrors
      .filter((errorDetail) => {
        // Keep non-permission errors or errors without a specific path
        // Also keep errors related to the top-level search path itself (e.g., ENOENT)
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
      .map((errorDetail) => errorDetail.message); // Return only the message string
  }
}
