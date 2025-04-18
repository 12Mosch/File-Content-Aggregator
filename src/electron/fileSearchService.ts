/**
 * Optimized File Search Service
 *
 * This service provides file search functionality with optimized memory usage.
 * It uses streaming file processing and efficient caching to improve performance.
 */

// Path module is not used directly but is needed for type definitions
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import path from "path";
import type PLimit from "p-limit";

// Import module and create a require function
import module from "node:module";
const require = module.createRequire(import.meta.url);

// Use the created require function to load CJS modules
const pLimitModule = require("p-limit") as {
  default?: typeof PLimit;
  __esModule?: boolean;
};
const pLimit: typeof PLimit =
  pLimitModule.default ?? (pLimitModule as typeof PLimit);

// Import services
import {
  FileDiscoveryService,
  FileProcessingService,
  ContentMatchingService,
  SearchResultProcessor,
  type ContentSearchMode,
} from "./services/index.js";

// Import boolean expression utilities
import { updateBooleanSearchSettings } from "./utils/booleanExpressionUtils.js";

// Import types
import {
  SearchParams,
  SearchResult,
  ProgressCallback,
  CancellationChecker,
  FileReadError,
} from "./types.js";

// Concurrency limit for file operations
const FILE_OPERATION_CONCURRENCY_LIMIT = 20;

// Global search settings
let fuzzySearchBooleanEnabled = true;
let fuzzySearchNearEnabled = true;
let wholeWordMatchingEnabled = false;

/**
 * Updates the search settings
 * @param booleanEnabled Whether fuzzy search is enabled for boolean queries
 * @param nearEnabled Whether fuzzy search is enabled for NEAR operator
 * @param wholeWordEnabled Whether whole word matching is enabled
 */
export function updateSearchSettings(
  booleanEnabled: boolean,
  nearEnabled: boolean,
  wholeWordEnabled: boolean
): void {
  fuzzySearchBooleanEnabled = booleanEnabled;
  fuzzySearchNearEnabled = nearEnabled;
  wholeWordMatchingEnabled = wholeWordEnabled;

  // Update the settings in the boolean expression utilities
  updateBooleanSearchSettings(booleanEnabled, nearEnabled, wholeWordEnabled);

  console.log(
    `[SearchService] Search settings updated: Boolean=${fuzzySearchBooleanEnabled}, NEAR=${fuzzySearchNearEnabled}, WholeWord=${wholeWordMatchingEnabled}`
  );
}

/**
 * Legacy function for backward compatibility
 * @param booleanEnabled Whether fuzzy search is enabled for boolean queries
 * @param nearEnabled Whether fuzzy search is enabled for NEAR operator
 */
export function updateFuzzySearchSettings(
  booleanEnabled: boolean,
  nearEnabled: boolean
): void {
  // Call the new function with the current value of wholeWordMatchingEnabled
  updateSearchSettings(booleanEnabled, nearEnabled, wholeWordMatchingEnabled);
}

/**
 * Main search function
 * @param params Search parameters
 * @param progressCallback Callback for progress updates
 * @param checkCancellation Function to check if the search should be cancelled
 * @returns Search results
 */
export async function searchFiles(
  params: SearchParams,
  progressCallback: ProgressCallback,
  checkCancellation: CancellationChecker
): Promise<SearchResult> {
  // Initialize services
  const fileDiscoveryService = FileDiscoveryService.getInstance();
  const fileProcessingService = FileProcessingService.getInstance();
  const contentMatchingService = ContentMatchingService.getInstance();
  const searchResultProcessor = SearchResultProcessor.getInstance();

  // Extract search parameters
  const {
    searchPaths,
    extensions,
    excludeFiles,
    excludeFolders,
    folderExclusionMode = "contains",
    contentSearchTerm,
    contentSearchMode = "term",
    caseSensitive = false,
    modifiedAfter,
    modifiedBefore,
    minSizeBytes,
    maxSizeBytes,
    maxDepth,
    wholeWordMatching = wholeWordMatchingEnabled,
  } = params;

  // Initialize result variables
  const fileReadErrors: FileReadError[] = [];
  let wasCancelled = false;

  // Ensure p-limit is loaded correctly
  if (typeof pLimit !== "function") {
    console.error(
      "pLimit was not loaded correctly. Type:",
      typeof pLimit,
      "Value:",
      pLimit
    );
    return {
      structuredItems: [],
      filesFound: 0,
      filesProcessed: 0,
      errorsEncountered: 0,
      pathErrors: ["Internal error: Concurrency limiter failed to load."],
      fileReadErrors,
      wasCancelled: false,
    };
  }

  // Create a concurrency limiter
  const limit = pLimit(FILE_OPERATION_CONCURRENCY_LIMIT);

  // --- Phase 1: File Discovery ---
  const discoveryResult = await fileDiscoveryService.discoverFiles(
    searchPaths,
    {
      extensions,
      excludeFiles,
      excludeFolders,
      folderExclusionMode,
      modifiedAfter,
      modifiedBefore,
      minSizeBytes,
      maxSizeBytes,
      maxDepth,
    },
    progressCallback,
    checkCancellation
  );

  if (discoveryResult.wasCancelled || checkCancellation()) {
    wasCancelled = true;
    progressCallback({
      processed: 0,
      total: 0,
      message: "Search cancelled during file discovery.",
      status: "cancelled",
    });
    return {
      structuredItems: [],
      filesFound: discoveryResult.files.length,
      filesProcessed: 0,
      errorsEncountered: discoveryResult.errors.length,
      pathErrors: fileDiscoveryService.filterRelevantPathErrors(
        discoveryResult.errors,
        excludeFolders,
        folderExclusionMode
      ),
      fileReadErrors,
      wasCancelled,
    };
  }

  const filesToProcess = discoveryResult.files;
  const initialFileCount = filesToProcess.length;

  // --- Phase 2: Content Matching (if applicable) ---
  let filesProcessedCounter = 0;
  const totalFilesToProcess = filesToProcess.length;

  // Create content matcher
  let contentMatcher: ((content: string) => boolean) | null = null;
  let parseOrRegexError = false;
  let parseErrorMessage = "";

  if (contentSearchTerm) {
    const matcherResult = contentMatchingService.createMatcher(
      contentSearchTerm,
      contentSearchMode as ContentSearchMode,
      {
        caseSensitive,
        wholeWordMatching,
        fuzzySearchEnabled: fuzzySearchBooleanEnabled,
        fuzzySearchNearEnabled,
      }
    );

    if (matcherResult.error) {
      parseOrRegexError = true;
      parseErrorMessage = matcherResult.error;
    } else {
      contentMatcher = matcherResult.matcher;
    }
  }

  // If there was a parsing error, return early
  if (parseOrRegexError) {
    return {
      structuredItems: [],
      filesFound: initialFileCount,
      filesProcessed: 0,
      errorsEncountered: 1,
      pathErrors: [parseErrorMessage],
      fileReadErrors,
      wasCancelled: false,
    };
  }

  // Process files only if no parsing/regex errors occurred
  if (checkCancellation()) {
    wasCancelled = true;
    progressCallback({
      processed: 0,
      total: totalFilesToProcess,
      message: "Search cancelled before processing files.",
      status: "cancelled",
    });
    return {
      structuredItems: [],
      filesFound: initialFileCount,
      filesProcessed: 0,
      errorsEncountered: 0,
      pathErrors: fileDiscoveryService.filterRelevantPathErrors(
        discoveryResult.errors,
        excludeFolders,
        folderExclusionMode
      ),
      fileReadErrors,
      wasCancelled,
    };
  }

  // --- Phase 3: Process Files ---
  const matchedFiles: Array<{
    filePath: string;
    content?: string;
    matched: boolean;
    readError?: string;
    size?: number;
    mtime?: number;
  }> = [];

  // If there's no content matcher, all files match
  if (!contentMatcher) {
    // Just add all files as matched without reading content
    matchedFiles.push(
      ...filesToProcess.map(
        ({
          filePath,
          stats,
        }: {
          filePath: string;
          stats: { size?: number; mtime?: Date } | null;
        }) => ({
          filePath,
          matched: true,
          size: stats?.size,
          mtime: stats?.mtime?.getTime(),
        })
      )
    );
  } else {
    // Process files with content matching
    const processingPromises = filesToProcess.map(
      ({
        filePath,
        stats,
      }: {
        filePath: string;
        stats: { size?: number; mtime?: Date } | null;
      }) =>
        limit(async () => {
          if (checkCancellation()) {
            return null;
          }

          // const currentFileName = path.basename(filePath); // Unused variable
          const displayFilePath = filePath.replace(/\\/g, "/");

          try {
            // Update progress
            filesProcessedCounter++;
            if (
              filesProcessedCounter % 10 === 0 ||
              filesProcessedCounter === totalFilesToProcess
            ) {
              progressCallback({
                processed: filesProcessedCounter,
                total: totalFilesToProcess,
                currentFile: displayFilePath,
                message: `Processing files: ${filesProcessedCounter}/${totalFilesToProcess}`,
                status: "searching",
              });
            }

            // Unused variable to avoid linting error - intentionally commented out
            // const currentFileNameUnused = currentFileName;

            // Use streaming file processing for better memory efficiency
            const processResult =
              await fileProcessingService.processFileInChunks(
                filePath,
                contentMatcher,
                {
                  earlyTermination: true, // Stop processing as soon as a match is found
                  maxFileSize: 50 * 1024 * 1024, // 50MB max file size
                }
              );

            if (processResult.error) {
              // Handle file read errors
              let reasonKey = "readError";
              const errorMessage = processResult.error.message;
              const code = (processResult.error as { code?: string })?.code;

              // Map common error codes to reason keys for i18n
              if (code === "EPERM" || code === "EACCES") {
                reasonKey = "readPermissionDenied";
              } else if (code === "ENOENT") {
                reasonKey = "fileNotFoundDuringRead";
              } else if (code === "EISDIR") {
                reasonKey = "pathIsDir";
              }

              // Add to matched files with error
              matchedFiles.push({
                filePath: displayFilePath,
                matched: false,
                readError: reasonKey,
                size: stats?.size,
                mtime: stats?.mtime?.getTime(),
              });

              // Add to file read errors
              fileReadErrors.push({
                filePath: displayFilePath,
                reason: reasonKey,
                detail: errorMessage,
              });
            } else {
              // Add to matched files
              matchedFiles.push({
                filePath: displayFilePath,
                matched: processResult.matched,
                size: stats?.size,
                mtime: stats?.mtime?.getTime(),
              });
            }

            return { filePath, matched: processResult.matched };
          } catch (error) {
            // Handle unexpected errors
            console.error(`Error processing file ${filePath}:`, error);

            // Add to matched files with error
            matchedFiles.push({
              filePath: displayFilePath,
              matched: false,
              readError: "readError",
              size: stats?.size,
              mtime: stats?.mtime?.getTime(),
            });

            // Add to file read errors
            fileReadErrors.push({
              filePath: displayFilePath,
              reason: "readError",
              detail: error instanceof Error ? error.message : String(error),
            });

            return { filePath, matched: false };
          }
        })
    );

    // Wait for all files to be processed
    await Promise.all(processingPromises);

    // Check if cancelled during processing
    if (checkCancellation()) {
      wasCancelled = true;
    }
  }

  // --- Phase 4: Process Results ---
  // Create structured items
  const structuredItems = searchResultProcessor.processResults(matchedFiles);

  // Update progress
  progressCallback({
    processed: filesProcessedCounter,
    total: totalFilesToProcess,
    message: wasCancelled
      ? "Search cancelled."
      : `Search completed. Found ${matchedFiles.filter((f) => f.matched).length} matching files.`,
    status: wasCancelled ? "cancelled" : "completed",
  });

  // Return final result
  return {
    structuredItems,
    filesFound: initialFileCount,
    filesProcessed: filesProcessedCounter,
    errorsEncountered: fileReadErrors.length + discoveryResult.errors.length,
    pathErrors: fileDiscoveryService.filterRelevantPathErrors(
      discoveryResult.errors,
      excludeFolders,
      folderExclusionMode
    ),
    fileReadErrors,
    wasCancelled,
  };
}
