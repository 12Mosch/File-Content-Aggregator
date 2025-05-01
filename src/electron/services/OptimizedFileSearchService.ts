/**
 * Optimized File Search Service
 *
 * This service provides file search functionality with optimized memory usage.
 * It uses streaming file processing and efficient caching to improve performance.
 */

// Path module is used indirectly in file operations
import _path from "path";
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
} from "./index.js";

// Import utilities
import { AppError } from "../../lib/errors.js";
import { Logger } from "../../lib/services/Logger.js";
import { ConfigService } from "../../lib/services/ConfigService.js";
import { updateBooleanSearchSettings } from "../utils/booleanExpressionUtils.js";

// Import types
import {
  SearchParams,
  SearchResult,
  ProgressCallback,
  CancellationChecker,
  FileReadError,
} from "../types.js";

// Concurrency limit for file operations
const FILE_OPERATION_CONCURRENCY_LIMIT = 20;

/**
 * Optimized File Search Service
 */
export class OptimizedFileSearchService {
  private static instance: OptimizedFileSearchService;
  private logger: Logger;
  private config: ConfigService;

  // Search settings
  private fuzzySearchBooleanEnabled = true;
  private fuzzySearchNearEnabled = true;
  private wholeWordMatchingEnabled = false;

  /**
   * Get the singleton instance
   */
  public static getInstance(): OptimizedFileSearchService {
    if (!OptimizedFileSearchService.instance) {
      OptimizedFileSearchService.instance = new OptimizedFileSearchService();
    }
    return OptimizedFileSearchService.instance;
  }

  /**
   * Private constructor (use getInstance)
   */
  private constructor() {
    this.logger = Logger.getInstance();
    this.config = ConfigService.getInstance();

    // Initialize settings from config
    this.fuzzySearchBooleanEnabled = this.config.get<boolean>(
      "search.fuzzySearchBooleanEnabled",
      true
    );
    this.fuzzySearchNearEnabled = this.config.get<boolean>(
      "search.fuzzySearchNearEnabled",
      true
    );
    this.wholeWordMatchingEnabled = this.config.get<boolean>(
      "search.wholeWordMatchingEnabled",
      false
    );

    // Update boolean expression settings
    this.updateSearchSettings(
      this.fuzzySearchBooleanEnabled,
      this.fuzzySearchNearEnabled,
      this.wholeWordMatchingEnabled
    );
  }

  /**
   * Updates the search settings
   * @param booleanEnabled Whether fuzzy search is enabled for boolean queries
   * @param nearEnabled Whether fuzzy search is enabled for NEAR operator
   * @param wholeWordEnabled Whether whole word matching is enabled
   */
  public updateSearchSettings(
    booleanEnabled: boolean,
    nearEnabled: boolean,
    wholeWordEnabled: boolean
  ): void {
    this.fuzzySearchBooleanEnabled = booleanEnabled;
    this.fuzzySearchNearEnabled = nearEnabled;
    this.wholeWordMatchingEnabled = wholeWordEnabled;

    // Update config
    this.config.set("search.fuzzySearchBooleanEnabled", booleanEnabled);
    this.config.set("search.fuzzySearchNearEnabled", nearEnabled);
    this.config.set("search.wholeWordMatchingEnabled", wholeWordEnabled);

    // Update the settings in the boolean expression utilities
    updateBooleanSearchSettings(booleanEnabled, nearEnabled, wholeWordEnabled);

    this.logger.info(
      `Search settings updated: Boolean=${booleanEnabled}, NEAR=${nearEnabled}, WholeWord=${wholeWordEnabled}`
    );
  }

  /**
   * Main search function
   * @param params Search parameters
   * @param progressCallback Callback for progress updates
   * @param checkCancellation Function to check if the search should be cancelled
   * @returns Search results
   */
  public async searchFiles(
    params: SearchParams,
    progressCallback: ProgressCallback,
    checkCancellation: CancellationChecker
  ): Promise<SearchResult> {
    try {
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
        wholeWordMatching = this.wholeWordMatchingEnabled,
      } = params;

      // Initialize result variables
      const fileReadErrors: FileReadError[] = [];
      let wasCancelled = false;

      // Ensure p-limit is loaded correctly
      if (typeof pLimit !== "function") {
        this.logger.error("pLimit was not loaded correctly", {
          type: typeof pLimit,
          value: pLimit,
        });

        throw AppError.configError(
          "Internal error: Concurrency limiter failed to load."
        );
      }

      // Create a concurrency limiter
      const limit = pLimit(FILE_OPERATION_CONCURRENCY_LIMIT);

      // --- Phase 1: File Discovery ---
      this.logger.debug("Starting file discovery phase", { searchPaths });

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

      // --- Phase 2: Prepare Content Matcher ---
      this.logger.debug("Preparing content matcher", {
        contentSearchTerm,
        contentSearchMode,
      });

      const initialFileCount = discoveryResult.files.length;
      const filesToProcess = discoveryResult.files;
      const totalFilesToProcess = filesToProcess.length;

      progressCallback({
        processed: 0,
        total: totalFilesToProcess,
        message: `Found ${totalFilesToProcess} files. Preparing to process...`,
        status: "searching",
      });

      // Prepare content matcher if a search term is provided
      let contentMatcher:
        | ((content: string) => Promise<boolean> | boolean)
        | null = null;
      let parseOrRegexError = false;
      let parseErrorMessage = "Unknown parsing error";

      if (contentSearchTerm) {
        const matcherResult = contentMatchingService.createMatcher(
          contentSearchTerm,
          contentSearchMode as ContentSearchMode,
          {
            caseSensitive,
            wholeWordMatching,
            fuzzySearchEnabled: this.fuzzySearchBooleanEnabled,
            fuzzySearchNearEnabled: this.fuzzySearchNearEnabled,
          }
        );

        if (matcherResult.error) {
          parseOrRegexError = true;
          parseErrorMessage = matcherResult.error;
          this.logger.error("Error creating content matcher", {
            error: matcherResult.error,
          });
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

      // Add memory usage check to prevent out-of-memory errors
      const memoryUsage = process.memoryUsage();
      if (memoryUsage.heapUsed > 1.5 * 1024 * 1024 * 1024) {
        // 1.5GB heap usage
        this.logger.warn("High memory usage detected before file processing", {
          heapUsed: Math.round(memoryUsage.heapUsed / (1024 * 1024)) + "MB",
          rss: Math.round(memoryUsage.rss / (1024 * 1024)) + "MB",
        });

        // Force garbage collection if available (Node.js with --expose-gc flag)
        if (global.gc) {
          this.logger.info("Forcing garbage collection");
          global.gc();
        }
      }

      // --- Phase 3: Process Files ---
      this.logger.debug("Starting file processing phase", {
        totalFiles: totalFilesToProcess,
      });

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

              const displayFilePath = filePath.replace(/\\/g, "/");

              try {
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
                  fileReadErrors.push({
                    filePath: displayFilePath,
                    error:
                      processResult.error instanceof Error
                        ? processResult.error.message
                        : String(processResult.error),
                  });

                  return {
                    filePath: displayFilePath,
                    matched: false,
                    readError:
                      processResult.error instanceof Error
                        ? processResult.error.message
                        : String(processResult.error),
                    size: stats?.size,
                    mtime: stats?.mtime?.getTime(),
                  };
                }

                return {
                  filePath: displayFilePath,
                  matched: processResult.matched,
                  content: processResult.content,
                  size: stats?.size,
                  mtime: stats?.mtime?.getTime(),
                };
              } catch (error) {
                const errorMessage =
                  error instanceof Error ? error.message : String(error);

                fileReadErrors.push({
                  filePath: displayFilePath,
                  error: errorMessage,
                });

                this.logger.error(
                  `Error processing file: ${displayFilePath}`,
                  error
                );

                return {
                  filePath: displayFilePath,
                  matched: false,
                  readError: errorMessage,
                  size: stats?.size,
                  mtime: stats?.mtime?.getTime(),
                };
              }
            })
        );

        let filesProcessedCounter = 0;
        const updateInterval = Math.max(
          1,
          Math.floor(totalFilesToProcess / 100)
        ); // Update every 1% of files

        // Process files in batches and update progress
        for (let i = 0; i < processingPromises.length; i += 100) {
          if (checkCancellation()) {
            wasCancelled = true;
            break;
          }

          // Check memory usage periodically to prevent OOM errors
          if (i > 0 && i % 500 === 0) {
            const memoryUsage = process.memoryUsage();
            const heapUsedMB = Math.round(memoryUsage.heapUsed / (1024 * 1024));

            // Log memory usage for monitoring
            this.logger.debug("Memory usage during file processing", {
              heapUsedMB,
              rssMB: Math.round(memoryUsage.rss / (1024 * 1024)),
              filesProcessed: filesProcessedCounter,
              totalFiles: totalFilesToProcess,
            });

            // If memory usage is getting high, force GC if available and slow down processing
            if (heapUsedMB > 1200) {
              // 1.2GB
              this.logger.warn("High memory usage during file processing", {
                heapUsedMB,
              });

              // Force garbage collection if available
              if (global.gc) {
                this.logger.info(
                  "Forcing garbage collection during processing"
                );
                global.gc();

                // Small delay to allow GC to complete and memory to be freed
                await new Promise((resolve) => setTimeout(resolve, 500));
              }
            }
          }

          const batch = processingPromises.slice(i, i + 100);
          const results = await Promise.all(batch);

          // Filter out null results (from cancelled operations)
          const validResults = results.filter(
            (result): result is NonNullable<typeof result> => result !== null
          );

          matchedFiles.push(...validResults);
          filesProcessedCounter += batch.length;

          if (
            filesProcessedCounter % updateInterval === 0 ||
            filesProcessedCounter === totalFilesToProcess
          ) {
            progressCallback({
              processed: filesProcessedCounter,
              total: totalFilesToProcess,
              message: `Processed ${filesProcessedCounter} of ${totalFilesToProcess} files...`,
              status: "searching",
            });
          }
        }

        if (wasCancelled) {
          progressCallback({
            processed: filesProcessedCounter,
            total: totalFilesToProcess,
            message: "Search cancelled during file processing.",
            status: "cancelled",
          });

          return {
            structuredItems: [],
            filesFound: initialFileCount,
            filesProcessed: filesProcessedCounter,
            errorsEncountered:
              fileReadErrors.length + discoveryResult.errors.length,
            pathErrors: fileDiscoveryService.filterRelevantPathErrors(
              discoveryResult.errors,
              excludeFolders,
              folderExclusionMode
            ),
            fileReadErrors,
            wasCancelled,
          };
        }
      }

      // --- Phase 4: Process Results ---
      this.logger.debug("Processing search results", {
        matchedFiles: matchedFiles.length,
      });

      progressCallback({
        processed: totalFilesToProcess,
        total: totalFilesToProcess,
        message: "Processing results...",
        status: "completed",
      });

      // Process the results into a structured format
      const structuredItems = searchResultProcessor.processResults(
        matchedFiles,
        {
          contentSearchTerm,
          contentSearchMode,
          caseSensitive,
          wholeWordMatching,
        }
      );

      // Return final result
      return {
        structuredItems,
        filesFound: initialFileCount,
        filesProcessed: totalFilesToProcess,
        errorsEncountered:
          fileReadErrors.length + discoveryResult.errors.length,
        pathErrors: fileDiscoveryService.filterRelevantPathErrors(
          discoveryResult.errors,
          excludeFolders,
          folderExclusionMode
        ),
        fileReadErrors,
        wasCancelled,
      };
    } catch (error) {
      // Handle unexpected errors
      this.logger.error("Unexpected error during search", error);

      throw AppError.fromUnknown(
        error,
        "An unexpected error occurred during the search operation"
      );
    }
  }
}
