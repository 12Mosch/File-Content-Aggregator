/**
 * FileProcessingService
 *
 * A service for efficiently processing files with optimized memory usage.
 * This service implements streaming file processing to reduce memory consumption
 * and improve performance when dealing with large files.
 */

import { createReadStream } from "fs";
import { promises as fsPromises } from "fs";
import { LRUCache } from "../../lib/LRUCache.js";
import { MemoryMonitor } from "../../lib/services/MemoryMonitor.js";
import { Logger } from "../../lib/services/Logger.js";
import { CacheManager } from "../../lib/CacheManager.js";

// Define interfaces for the service
export interface FileProcessingOptions {
  chunkSize?: number;
  encoding?: BufferEncoding;
  earlyTermination?: boolean;
  maxFileSize?: number;
}

export interface FileStats {
  size: number;
  mtime: Date;
  isDirectory: boolean;
}

export interface FileReadResult {
  content: string | null;
  error: Error | null;
  stats: FileStats | null;
}

export interface StreamProcessResult {
  matched: boolean;
  error: Error | null;
  content?: string;
  matchedChunks?: string[];
  matchPositions?: number[];
}

export class FileProcessingService {
  private static instance: FileProcessingService;

  // Cache for file stats to avoid redundant stat calls
  private statsCache: LRUCache<string, FileStats>;

  // Cache for small file contents to improve performance for frequently accessed files
  private contentCache: LRUCache<string, string>;

  // Default options
  private readonly DEFAULT_CHUNK_SIZE = 64 * 1024; // 64KB
  private readonly DEFAULT_ENCODING: BufferEncoding = "utf8";
  private readonly MAX_CACHE_FILE_SIZE = 1024 * 1024; // 1MB - only cache files smaller than this
  private readonly MAX_CONTENT_CACHE_MEMORY = 50 * 1024 * 1024; // 50MB max for content cache
  private readonly MAX_STATS_CACHE_MEMORY = 10 * 1024 * 1024; // 10MB max for stats cache

  // Services
  private memoryMonitor: MemoryMonitor;
  private logger: Logger;

  // Private constructor for singleton pattern
  private constructor() {
    this.logger = Logger.getInstance();
    this.memoryMonitor = MemoryMonitor.getInstance();

    // Try to get caches from the cache manager first
    const cacheManager = CacheManager.getInstance();

    this.statsCache = cacheManager.getOrCreateCache<string, FileStats>(
      "fileStats",
      {
        maxSize: 500,
        timeToLive: 5 * 60 * 1000, // 5 minutes
        name: "File Stats Cache",
      }
    );

    this.contentCache = cacheManager.getOrCreateCache<string, string>(
      "fileContent",
      {
        maxSize: 100,
        timeToLive: 2 * 60 * 1000, // 2 minutes
        name: "File Content Cache",
      }
    );

    // Set memory limits
    this.statsCache.setMaxMemorySize(this.MAX_STATS_CACHE_MEMORY);
    this.contentCache.setMaxMemorySize(this.MAX_CONTENT_CACHE_MEMORY);

    // Set up memory pressure handling
    this.setupMemoryPressureHandling();

    this.logger.debug(
      "FileProcessingService initialized with optimized memory management"
    );
  }

  /**
   * Gets the singleton instance of FileProcessingService
   * @returns The FileProcessingService instance
   */
  public static getInstance(): FileProcessingService {
    if (!FileProcessingService.instance) {
      FileProcessingService.instance = new FileProcessingService();
    }
    return FileProcessingService.instance;
  }

  /**
   * Gets file stats with caching
   * @param filePath The path to the file
   * @returns A promise that resolves to the file stats or null if an error occurs
   */
  public async getFileStats(filePath: string): Promise<FileStats | null> {
    // Check cache first
    const cachedStats = this.statsCache.get(filePath);
    if (cachedStats) {
      return cachedStats;
    }

    try {
      const stats = await fsPromises.stat(filePath);
      const fileStats: FileStats = {
        size: stats.size,
        mtime: stats.mtime,
        isDirectory: stats.isDirectory(),
      };

      // Cache the result
      this.statsCache.set(filePath, fileStats);

      return fileStats;
    } catch (error) {
      console.error(`Error getting stats for file ${filePath}:`, error);
      return null;
    }
  }

  /**
   * Reads a file with optimized memory usage
   * @param filePath The path to the file
   * @param options Options for file reading
   * @returns A promise that resolves to the file content or null if an error occurs
   */
  public async readFile(
    filePath: string,
    options: FileProcessingOptions = {}
  ): Promise<FileReadResult> {
    const result: FileReadResult = {
      content: null,
      error: null,
      stats: null,
    };

    try {
      // Get file stats first
      const stats = await this.getFileStats(filePath);
      result.stats = stats;

      if (!stats) {
        throw new Error(`Could not get stats for file: ${filePath}`);
      }

      if (stats.isDirectory) {
        throw new Error(`Path is a directory: ${filePath}`);
      }

      // Check if file is too large
      const maxFileSize = options.maxFileSize || Number.MAX_SAFE_INTEGER;
      if (stats.size > maxFileSize) {
        throw new Error(
          `File is too large: ${stats.size} bytes (max: ${maxFileSize} bytes)`
        );
      }

      // Check if file is in cache (only for small files)
      if (stats.size <= this.MAX_CACHE_FILE_SIZE) {
        const cachedContent = this.contentCache.get(filePath);
        if (cachedContent) {
          result.content = cachedContent;
          return result;
        }
      }

      // Read the file
      const content = await fsPromises.readFile(filePath, {
        encoding: options.encoding || this.DEFAULT_ENCODING,
      });

      // Cache small files
      if (stats.size <= this.MAX_CACHE_FILE_SIZE) {
        this.contentCache.set(filePath, content);
      }

      result.content = content;
      return result;
    } catch (error) {
      result.error = error instanceof Error ? error : new Error(String(error));
      return result;
    }
  }

  /**
   * Processes a file in chunks using streams
   * @param filePath The path to the file
   * @param matcher A function that returns true if the content matches
   * @param options Options for file processing
   * @returns A promise that resolves to the processing result
   */
  public async processFileInChunks(
    filePath: string,
    matcher: (chunk: string) => Promise<boolean> | boolean,
    options: FileProcessingOptions = {}
  ): Promise<StreamProcessResult> {
    const result: StreamProcessResult = {
      matched: false,
      error: null,
      matchedChunks: options.earlyTermination ? undefined : [],
    };

    // Track memory usage before processing
    const memoryBefore = this.memoryMonitor.getMemoryStats().heapUsed;

    try {
      // Get file stats first
      const stats = await this.getFileStats(filePath);

      if (!stats) {
        throw new Error(`Could not get stats for file: ${filePath}`);
      }

      if (stats.isDirectory) {
        throw new Error(`Path is a directory: ${filePath}`);
      }

      // Check if file is too large
      const maxFileSize = options.maxFileSize || Number.MAX_SAFE_INTEGER;
      if (stats.size > maxFileSize) {
        throw new Error(
          `File is too large: ${stats.size} bytes (max: ${maxFileSize} bytes)`
        );
      }

      // For very small files, it's more efficient to read the whole file at once
      if (stats.size < this.DEFAULT_CHUNK_SIZE) {
        const { content, error } = await this.readFile(filePath, options);

        if (error) {
          throw error;
        }

        if (content) {
          result.matched = await Promise.resolve(matcher(content));
          if (result.matched && !options.earlyTermination) {
            result.matchedChunks = [content];
          }
        }

        return result;
      }

      // For larger files, use optimized streaming with better memory management
      return new Promise((resolve, _reject) => {
        const chunkSize = options.chunkSize || this.DEFAULT_CHUNK_SIZE;
        const encoding = options.encoding || this.DEFAULT_ENCODING;

        const readStream = createReadStream(filePath, {
          encoding,
          highWaterMark: chunkSize,
        });

        // Use a more memory-efficient approach for buffer management
        // Instead of concatenating strings, we'll process complete lines
        let buffer = "";
        let matched = false;

        // Maximum buffer size to prevent memory issues
        const MAX_BUFFER_SIZE = 1024 * 1024; // 1MB

        // Helper function to process chunks asynchronously
        const processChunk = async (chunkStr: string) => {
          // Check if the chunk itself matches before adding to buffer
          if (!matched) {
            const isMatch = await Promise.resolve(matcher(chunkStr));
            if (isMatch) {
              matched = true;

              if (!options.earlyTermination && result.matchedChunks) {
                result.matchedChunks.push(chunkStr);
              } else if (options.earlyTermination) {
                // Early termination if requested
                readStream.destroy();
                return;
              }
            }
          }
        };

        // Helper function to process buffer when it gets too large
        const processBuffer = async () => {
          if (buffer.length > MAX_BUFFER_SIZE) {
            // Process complete lines
            const lastNewlineIndex = buffer.lastIndexOf("\n");

            if (lastNewlineIndex !== -1) {
              const completeLines = buffer.substring(0, lastNewlineIndex + 1);
              buffer = buffer.substring(lastNewlineIndex + 1);

              // Process the complete lines if we haven't found a match yet
              if (!matched && !options.earlyTermination) {
                const isMatch = await Promise.resolve(matcher(completeLines));
                if (isMatch) {
                  matched = true;
                  if (result.matchedChunks) {
                    result.matchedChunks.push(completeLines);
                  }
                }
              }
            }
          }
        };

        // Process data chunks
        readStream.on("data", (chunk) => {
          // Convert Buffer to string if needed
          const chunkStr =
            typeof chunk === "string" ? chunk : chunk.toString(encoding);

          // Process the chunk asynchronously
          void (async () => {
            await processChunk(chunkStr);
            // Add to buffer and process lines
            buffer += chunkStr;

            // Process buffer if needed
            await processBuffer();
          })();
        });

        readStream.on("end", () => {
          // Use an IIFE to handle the async operations
          void (async () => {
            // Check remaining buffer
            if (!matched && buffer.length > 0) {
              matched = await Promise.resolve(matcher(buffer));

              if (
                matched &&
                !options.earlyTermination &&
                result.matchedChunks
              ) {
                result.matchedChunks.push(buffer);
              }
            }

            // Clear buffer to free memory
            buffer = "";

            result.matched = matched;
            resolve(result);
          })();
        });

        readStream.on("error", (err) => {
          // Clean up resources
          buffer = "";
          result.error = err;
          resolve(result);
        });

        // Handle stream cleanup if the process is aborted
        readStream.on("close", () => {
          buffer = "";
        });
      });
    } catch (error) {
      result.error = error instanceof Error ? error : new Error(String(error));
      return result;
    } finally {
      // Track memory usage after processing
      const memoryAfter = this.memoryMonitor.getMemoryStats().heapUsed;
      const memoryDelta = (memoryAfter - memoryBefore) / (1024 * 1024); // MB

      // Log significant memory changes
      if (Math.abs(memoryDelta) > 5) {
        // Only log if change is more than 5MB
        this.logger.debug(
          `File processing memory change: ${memoryDelta.toFixed(2)} MB`,
          {
            filePath,
            fileSize: (await this.getFileStats(filePath))?.size,
            matched: result.matched,
          }
        );
      }
    }
  }

  /**
   * Extracts matched lines from a file
   * @param filePath The path to the file
   * @param matcher A function that returns true if the line matches
   * @param options Options for file processing
   * @returns A promise that resolves to an array of matched lines with their positions
   */
  public async extractMatchedLines(
    filePath: string,
    matcher: (line: string) => boolean,
    options: FileProcessingOptions = {}
  ): Promise<{ lines: string[]; positions: number[] }> {
    const result = {
      lines: [] as string[],
      positions: [] as number[],
    };

    // Track memory usage before processing
    const memoryBefore = this.memoryMonitor.getMemoryStats().heapUsed;

    try {
      // Get file stats first
      const stats = await this.getFileStats(filePath);

      if (!stats) {
        throw new Error(`Could not get stats for file: ${filePath}`);
      }

      if (stats.isDirectory) {
        throw new Error(`Path is a directory: ${filePath}`);
      }

      // Check if file is too large
      const maxFileSize = options.maxFileSize || Number.MAX_SAFE_INTEGER;
      if (stats.size > maxFileSize) {
        throw new Error(
          `File is too large: ${stats.size} bytes (max: ${maxFileSize} bytes)`
        );
      }

      // For very small files, it's more efficient to read the whole file at once
      if (stats.size < this.DEFAULT_CHUNK_SIZE) {
        const { content, error } = await this.readFile(filePath, options);

        if (error) {
          throw error;
        }

        if (content) {
          const lines = content.split("\n");
          let position = 0;

          for (const line of lines) {
            if (matcher(line)) {
              result.lines.push(line);
              result.positions.push(position);
            }
            position += line.length + 1; // +1 for the newline
          }
        }

        return result;
      }

      // For larger files, use optimized streaming with better memory management
      return new Promise((resolve, reject) => {
        const chunkSize = options.chunkSize || this.DEFAULT_CHUNK_SIZE;
        const encoding = options.encoding || this.DEFAULT_ENCODING;

        const readStream = createReadStream(filePath, {
          encoding,
          highWaterMark: chunkSize,
        });

        let buffer = "";
        let position = 0;

        // Maximum buffer size to prevent memory issues
        const MAX_BUFFER_SIZE = 1024 * 1024; // 1MB
        // Maximum result size to prevent memory issues with huge result sets
        const MAX_RESULT_SIZE = 10000; // Maximum number of matched lines to collect
        let resultSizeExceeded = false;

        readStream.on("data", (chunk) => {
          // If we've already exceeded the maximum result size, don't process more
          if (resultSizeExceeded) return;

          // Convert Buffer to string if needed
          const chunkStr =
            typeof chunk === "string" ? chunk : chunk.toString(encoding);
          buffer += chunkStr;

          // If buffer is getting too large, process and clear it
          if (buffer.length > MAX_BUFFER_SIZE) {
            // Process complete lines
            const lastNewlineIndex = buffer.lastIndexOf("\n");

            if (lastNewlineIndex !== -1) {
              const completeLines = buffer
                .substring(0, lastNewlineIndex + 1)
                .split("\n");
              buffer = buffer.substring(lastNewlineIndex + 1);

              // Process each complete line
              for (let i = 0; i < completeLines.length - 1; i++) {
                // -1 because the last element is empty due to the trailing newline
                const line = completeLines[i];
                if (matcher(line)) {
                  result.lines.push(line);
                  result.positions.push(position);

                  // Check if we've exceeded the maximum result size
                  if (result.lines.length >= MAX_RESULT_SIZE) {
                    resultSizeExceeded = true;
                    this.logger.warn(
                      `Maximum result size (${MAX_RESULT_SIZE} lines) exceeded for file: ${filePath}`
                    );
                    readStream.destroy();
                    break;
                  }
                }
                position += line.length + 1; // +1 for the newline
              }
            }
          } else {
            // Process complete lines
            const lines = buffer.split("\n");
            buffer = lines.pop() || "";

            // Check each line
            for (const line of lines) {
              if (matcher(line)) {
                result.lines.push(line);
                result.positions.push(position);

                // Check if we've exceeded the maximum result size
                if (result.lines.length >= MAX_RESULT_SIZE) {
                  resultSizeExceeded = true;
                  this.logger.warn(
                    `Maximum result size (${MAX_RESULT_SIZE} lines) exceeded for file: ${filePath}`
                  );
                  readStream.destroy();
                  break;
                }
              }
              position += line.length + 1; // +1 for the newline
            }
          }
        });

        readStream.on("end", () => {
          // Check remaining buffer
          if (buffer.length > 0 && !resultSizeExceeded) {
            if (matcher(buffer)) {
              result.lines.push(buffer);
              result.positions.push(position);
            }
          }

          // Clear buffer to free memory
          buffer = "";

          resolve(result);
        });

        readStream.on("error", (err) => {
          // Clean up resources
          buffer = "";
          reject(err);
        });

        // Handle stream cleanup if the process is aborted
        readStream.on("close", () => {
          buffer = "";
        });
      });
    } catch (error) {
      this.logger.error(
        `Error extracting matched lines from file ${filePath}:`,
        { error }
      );
      return result;
    } finally {
      // Track memory usage after processing
      const memoryAfter = this.memoryMonitor.getMemoryStats().heapUsed;
      const memoryDelta = (memoryAfter - memoryBefore) / (1024 * 1024); // MB

      // Log significant memory changes
      if (Math.abs(memoryDelta) > 5) {
        // Only log if change is more than 5MB
        this.logger.debug(
          `Line extraction memory change: ${memoryDelta.toFixed(2)} MB`,
          {
            filePath,
            matchedLines: result.lines.length,
          }
        );
      }
    }
  }

  /**
   * Clears all caches
   */
  public clearCaches(): void {
    this.statsCache.clear();
    this.contentCache.clear();
    this.logger.debug("File processing caches cleared");
  }

  /**
   * Gets statistics about the caches
   */
  public getCacheStats() {
    return {
      statsCache: this.statsCache.getStats(),
      contentCache: this.contentCache.getStats(),
    };
  }

  /**
   * Set up memory pressure handling
   * This will automatically trim caches when memory pressure is high
   */
  private setupMemoryPressureHandling(): void {
    this.memoryMonitor.addListener((stats) => {
      if (stats.memoryPressure === "high") {
        // Under high memory pressure, trim caches aggressively
        this.logger.debug(
          "High memory pressure detected, trimming file caches"
        );
        this.contentCache.trimToSize(
          Math.floor(this.contentCache.getMaxSize() * 0.3)
        ); // Reduce to 30%
        this.statsCache.trimToSize(
          Math.floor(this.statsCache.getMaxSize() * 0.5)
        ); // Reduce to 50%
      } else if (stats.memoryPressure === "medium") {
        // Under medium pressure, do a moderate trim
        this.logger.debug(
          "Medium memory pressure detected, trimming file content cache"
        );
        this.contentCache.trimToSize(
          Math.floor(this.contentCache.getMaxSize() * 0.7)
        ); // Reduce to 70%
      }
    });

    // Start monitoring if not already started
    if (!this.memoryMonitor.isMonitoringEnabled()) {
      this.memoryMonitor.startMonitoring();
    }
  }

  /**
   * Optimize memory usage by trimming caches if needed
   * @returns The amount of memory freed in bytes
   */
  public optimizeMemoryUsage(): number {
    let memoryFreed = 0;

    // Get current memory stats
    const memStats = this.memoryMonitor.getMemoryStats();

    // If memory pressure is high, trim caches aggressively
    if (memStats.memoryPressure === "high") {
      const contentCacheSize = this.contentCache.getEstimatedMemoryUsage();
      const statsCacheSize = this.statsCache.getEstimatedMemoryUsage();

      // Trim content cache to 30%
      const contentCacheItems = this.contentCache.size();
      const contentCacheNewSize = Math.floor(contentCacheItems * 0.3);
      const contentCacheRemoved =
        this.contentCache.trimToSize(contentCacheNewSize);

      // Trim stats cache to 50%
      const statsCacheItems = this.statsCache.size();
      const statsCacheNewSize = Math.floor(statsCacheItems * 0.5);
      const statsCacheRemoved = this.statsCache.trimToSize(statsCacheNewSize);

      // Calculate memory freed (approximate)
      const newContentCacheSize = this.contentCache.getEstimatedMemoryUsage();
      const newStatsCacheSize = this.statsCache.getEstimatedMemoryUsage();
      memoryFreed =
        contentCacheSize -
        newContentCacheSize +
        (statsCacheSize - newStatsCacheSize);

      this.logger.info("Memory optimization performed", {
        contentCacheItemsRemoved: contentCacheRemoved,
        statsCacheItemsRemoved: statsCacheRemoved,
        memoryFreedMB: (memoryFreed / (1024 * 1024)).toFixed(2),
      });
    }

    return memoryFreed;
  }
}
