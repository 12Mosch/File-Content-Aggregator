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
  private statsCache = new LRUCache<string, FileStats>(100);

  // Cache for small file contents to improve performance for frequently accessed files
  private contentCache = new LRUCache<string, string>(50);

  // Default options
  private readonly DEFAULT_CHUNK_SIZE = 64 * 1024; // 64KB
  private readonly DEFAULT_ENCODING: BufferEncoding = "utf8";
  private readonly MAX_CACHE_FILE_SIZE = 1024 * 1024; // 1MB - only cache files smaller than this

  // Private constructor for singleton pattern
  private constructor() {}

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
    matcher: (chunk: string) => boolean,
    options: FileProcessingOptions = {}
  ): Promise<StreamProcessResult> {
    const result: StreamProcessResult = {
      matched: false,
      error: null,
      matchedChunks: options.earlyTermination ? undefined : [],
    };

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
          result.matched = matcher(content);
          if (result.matched && !options.earlyTermination) {
            result.matchedChunks = [content];
          }
        }

        return result;
      }

      // For larger files, use streaming
      return new Promise((resolve, _reject) => {
        const chunkSize = options.chunkSize || this.DEFAULT_CHUNK_SIZE;
        const encoding = options.encoding || this.DEFAULT_ENCODING;

        const readStream = createReadStream(filePath, {
          encoding,
          highWaterMark: chunkSize,
        });

        let buffer = "";
        let matched = false;
        const linePositions: number[] = [];
        let currentPosition = 0;

        readStream.on("data", (chunk) => {
          // Convert Buffer to string if needed
          const chunkStr = chunk.toString(encoding);
          buffer += chunkStr;

          // Process complete lines
          const lines = buffer.split("\n");
          buffer = lines.pop() || "";

          // Track line positions
          for (const line of lines) {
            linePositions.push(currentPosition);
            currentPosition += line.length + 1; // +1 for the newline
          }

          // Check if any complete chunk matches
          if (matcher(chunkStr)) {
            matched = true;

            if (!options.earlyTermination && result.matchedChunks) {
              result.matchedChunks.push(chunkStr);
            } else if (options.earlyTermination) {
              // Early termination if requested
              readStream.destroy();
            }
          }
        });

        readStream.on("end", () => {
          // Check remaining buffer
          if (!matched && buffer.length > 0) {
            matched = matcher(buffer);

            if (matched && !options.earlyTermination && result.matchedChunks) {
              result.matchedChunks.push(buffer);
            }
          }

          result.matched = matched;
          resolve(result);
        });

        readStream.on("error", (err) => {
          result.error = err;
          resolve(result);
        });
      });
    } catch (error) {
      result.error = error instanceof Error ? error : new Error(String(error));
      return result;
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

      // For larger files, use streaming
      return new Promise((resolve, reject) => {
        const chunkSize = options.chunkSize || this.DEFAULT_CHUNK_SIZE;
        const encoding = options.encoding || this.DEFAULT_ENCODING;

        const readStream = createReadStream(filePath, {
          encoding,
          highWaterMark: chunkSize,
        });

        let buffer = "";
        let position = 0;

        readStream.on("data", (chunk) => {
          // Convert Buffer to string if needed
          const chunkStr = chunk.toString(encoding);
          buffer += chunkStr;

          // Process complete lines
          const lines = buffer.split("\n");
          buffer = lines.pop() || "";

          // Check each line
          for (const line of lines) {
            if (matcher(line)) {
              result.lines.push(line);
              result.positions.push(position);
            }
            position += line.length + 1; // +1 for the newline
          }
        });

        readStream.on("end", () => {
          // Check remaining buffer
          if (buffer.length > 0) {
            if (matcher(buffer)) {
              result.lines.push(buffer);
              result.positions.push(position);
            }
          }

          resolve(result);
        });

        readStream.on("error", (err) => {
          reject(err);
        });
      });
    } catch (error) {
      console.error(
        `Error extracting matched lines from file ${filePath}:`,
        error
      );
      return result;
    }
  }

  /**
   * Clears all caches
   */
  public clearCaches(): void {
    this.statsCache.clear();
    this.contentCache.clear();
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
}
