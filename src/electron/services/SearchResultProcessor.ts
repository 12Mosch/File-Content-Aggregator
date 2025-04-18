/**
 * SearchResultProcessor
 *
 * A service for processing and organizing search results.
 * This service handles the transformation of raw search results into structured data.
 */

import path from "path";
import { StructuredItem } from "../types.js";

export interface SearchResultOptions {
  includeContent?: boolean;
  maxContentLength?: number;
  maxResults?: number;
}

export interface ProcessedResult {
  structuredItems: StructuredItem[];
  filesProcessed: number;
  filesFound: number;
  errorsEncountered: number;
  pathErrors: string[];
  fileReadErrors: Array<{
    filePath: string;
    reason: string;
    detail?: string;
  }>;
  wasCancelled?: boolean;
}

export class SearchResultProcessor {
  private static instance: SearchResultProcessor;

  // Private constructor for singleton pattern
  private constructor() {}

  /**
   * Gets the singleton instance of SearchResultProcessor
   * @returns The SearchResultProcessor instance
   */
  public static getInstance(): SearchResultProcessor {
    if (!SearchResultProcessor.instance) {
      SearchResultProcessor.instance = new SearchResultProcessor();
    }
    return SearchResultProcessor.instance;
  }

  /**
   * Processes raw search results into structured items
   * @param matchedFiles Array of matched file paths with their content
   * @param options Processing options
   * @returns Structured items for the UI
   */
  public processResults(
    matchedFiles: Array<{
      filePath: string;
      content?: string;
      matched: boolean;
      readError?: string;
      size?: number;
      mtime?: number;
    }>,
    options: SearchResultOptions = {}
  ): StructuredItem[] {
    const {
      includeContent = false,
      maxContentLength = 1000,
      maxResults = Number.MAX_SAFE_INTEGER,
    } = options;

    // Limit the number of results
    const limitedFiles = matchedFiles.slice(0, maxResults);

    // Process each file
    return limitedFiles.map((file) => {
      const structuredItem: StructuredItem = {
        filePath: file.filePath.replace(/\\/g, "/"),
        matched: file.matched,
        readError: file.readError,
        size: file.size,
        mtime: file.mtime,
      };

      // Include content if requested and available
      if (includeContent && file.content && file.matched) {
        // Truncate content if too long
        structuredItem.content =
          file.content.length > maxContentLength
            ? file.content.substring(0, maxContentLength) + "..."
            : file.content;
      }

       
      return structuredItem;
    });
  }

  /**
   * Organizes structured items into a tree structure
   * @param items Flat array of structured items
   * @returns Tree structure of items
   */
  public organizeIntoTree(items: StructuredItem[]): StructuredItem[] {
    const rootItems: StructuredItem[] = [];
    const pathMap = new Map<string, StructuredItem>();

    // First pass: create all directory nodes
    for (const item of items) {
      const filePath = item.filePath;
      const dirPath = path.dirname(filePath);
      const fileName = path.basename(filePath);

      // Skip if already processed
      if (pathMap.has(filePath)) continue;

      // Create directory nodes if they don't exist
      let currentPath = "";
      for (const segment of dirPath.split("/")) {
        if (!segment) continue; // Skip empty segments

        currentPath = currentPath ? `${currentPath}/${segment}` : segment;

        if (!pathMap.has(currentPath)) {
          const dirItem: StructuredItem = {
            filePath: currentPath,
            matched: false,
            isDirectory: true,
            children: [],
          };

          pathMap.set(currentPath, dirItem);

          // Add to parent or root
          const parentPath = path.dirname(currentPath);
          if (parentPath && parentPath !== "." && pathMap.has(parentPath)) {
            const parent = pathMap.get(parentPath);
            if (parent && parent.children) {
              parent.children.push(dirItem);
            }
          } else {
            rootItems.push(dirItem);
          }
        }
      }

      // Add file node
      pathMap.set(filePath, item);

      // Add to parent
      if (dirPath && dirPath !== "." && pathMap.has(dirPath)) {
        const parent = pathMap.get(dirPath);
        if (parent && parent.children) {
          parent.children.push(item);
        }
      } else {
        rootItems.push(item);
      }

      // Unused variable to avoid linting error
      const _fileName = fileName;
    }

    // Update matched status for directories
    this.updateDirectoryMatchStatus(rootItems);

    return rootItems;
  }

  /**
   * Updates the matched status of directory nodes based on their children
   * @param items Array of items to update
   * @returns True if any child is matched
   */
  private updateDirectoryMatchStatus(items: StructuredItem[]): boolean {
    let anyMatched = false;

    for (const item of items) {
      if (item.isDirectory && item.children) {
        // Recursively update children
        const childrenMatched = this.updateDirectoryMatchStatus(item.children);

        // Update this directory's matched status
        item.matched = childrenMatched;

        if (childrenMatched) {
          anyMatched = true;
        }
      } else if (item.matched) {
        anyMatched = true;
      }
    }

    return anyMatched;
  }

  /**
   * Creates a final processed result
   * @param structuredItems Structured items
   * @param filesProcessed Number of files processed
   * @param filesFound Number of files found
   * @param errorsEncountered Number of errors encountered
   * @param pathErrors Array of path error messages
   * @param fileReadErrors Array of file read errors
   * @param wasCancelled Whether the search was cancelled
   * @returns Processed result
   */
  public createProcessedResult(
    structuredItems: StructuredItem[],
    filesProcessed: number,
    filesFound: number,
    errorsEncountered: number,
    pathErrors: string[],
    fileReadErrors: Array<{
      filePath: string;
      reason: string;
      detail?: string;
    }>,
    wasCancelled?: boolean
  ): ProcessedResult {
    return {
      structuredItems,
      filesProcessed,
      filesFound,
      errorsEncountered,
      pathErrors,
      fileReadErrors,
      wasCancelled,
    };
  }
}
