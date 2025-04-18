/**
 * Search Service
 *
 * Provides an interface for performing search operations using worker threads.
 * Handles communication with the worker pool and manages search state.
 */

import { WorkerPool } from "./WorkerPool.js";
import { v4 as uuidv4 } from "uuid";

// Define search options interface
export interface SearchOptions {
  caseSensitive?: boolean;
  isRegex?: boolean;
  useWholeWordMatching?: boolean;
  fuzzySearchEnabled?: boolean;
  fuzzySearchThreshold?: number;
}

// Define search result interface
export interface SearchResult {
  matches: number[];
  matchCount: number;
  processingTimeMs: number;
}

// Define search progress interface
export interface SearchProgress {
  filesProcessed: number;
  totalFiles: number;
  currentFile?: string;
  matchesFound: number;
  elapsedTimeMs: number;
}

// Define search event types
export type SearchEventType = "progress" | "complete" | "error" | "cancelled";

// Define search event listener
export type SearchEventListener = (
  type: SearchEventType,
  data: SearchProgress | SearchResult | Error
) => void;

export class SearchService {
  private static instance: SearchService;
  private workerPool: WorkerPool;
  private activeSearches = new Map<
    string,
    {
      listeners: Map<string, SearchEventListener>;
      files: string[];
      currentIndex: number;
      startTime: number;
      matchesFound: number;
      results: Map<string, SearchResult>;
    }
  >();

  /**
   * Get the singleton instance
   */
  public static getInstance(): SearchService {
    if (!SearchService.instance) {
      SearchService.instance = new SearchService();
    }
    return SearchService.instance;
  }

  /**
   * Private constructor (use getInstance)
   */
  private constructor() {
    // Create worker pool with search worker
    this.workerPool = new WorkerPool(
      new URL("../workers/search.worker.js", import.meta.url).href,
      2, // Initial workers
      navigator.hardwareConcurrency || 4 // Max workers
    );
  }

  /**
   * Start a new search operation
   * @param files List of file contents to search
   * @param term Search term
   * @param options Search options
   * @returns Search ID for tracking and cancellation
   */
  public startSearch(
    files: Array<{ filePath: string; content: string }>,
    term: string | RegExp,
    options: SearchOptions
  ): string {
    const searchId = uuidv4();

    // Set up search state
    this.activeSearches.set(searchId, {
      listeners: new Map(),
      files: files.map((f) => f.filePath),
      currentIndex: 0,
      startTime: performance.now(),
      matchesFound: 0,
      results: new Map(),
    });

    // Start processing files
    this.processNextFile(searchId, files, term, options);

    return searchId;
  }

  /**
   * Process the next file in the search
   */
  private processNextFile(
    searchId: string,
    files: Array<{ filePath: string; content: string }>,
    term: string | RegExp,
    options: SearchOptions
  ): void {
    const searchState = this.activeSearches.get(searchId);
    if (!searchState) return; // Search was cancelled

    // Check if we've processed all files
    if (searchState.currentIndex >= files.length) {
      this.completeSearch(searchId);
      return;
    }

    const currentFile = files[searchState.currentIndex];

    // Notify progress
    this.notifyListeners(searchId, "progress", {
      filesProcessed: searchState.currentIndex,
      totalFiles: files.length,
      currentFile: currentFile.filePath,
      matchesFound: searchState.matchesFound,
      elapsedTimeMs: performance.now() - searchState.startTime,
    });

    // Execute search in worker
    this.workerPool
      .execute("search", {
        content: currentFile.content,
        term,
        options,
      })
      .then((response: unknown) => {
        const typedResponse = response as { result?: SearchResult };
        // Check if search is still active
        const state = this.activeSearches.get(searchId);
        if (!state) return; // Search was cancelled

        // Store result
        if (typedResponse.result) {
          state.results.set(currentFile.filePath, typedResponse.result);
          state.matchesFound += typedResponse.result.matchCount;
        }

        // Move to next file
        state.currentIndex++;
        this.processNextFile(searchId, files, term, options);
      })
      .catch((error) => {
        // Check if search is still active
        const state = this.activeSearches.get(searchId);
        if (!state) return; // Search was cancelled

        // If it's a cancellation, ignore
        if (error.message === "Task was cancelled") {
          return;
        }

        // Notify error
        this.notifyListeners(searchId, "error", error);

        // Continue with next file
        state.currentIndex++;
        this.processNextFile(searchId, files, term, options);
      });
  }

  /**
   * Complete a search operation
   */
  private completeSearch(searchId: string): void {
    const searchState = this.activeSearches.get(searchId);
    if (!searchState) return;

    // Calculate total processing time
    const totalTime = performance.now() - searchState.startTime;

    // Notify completion
    this.notifyListeners(searchId, "complete", {
      filesProcessed: searchState.files.length,
      totalFiles: searchState.files.length,
      matchesFound: searchState.matchesFound,
      elapsedTimeMs: totalTime,
    });

    // Clean up
    this.activeSearches.delete(searchId);
  }

  /**
   * Cancel an active search
   * @param searchId The ID of the search to cancel
   */
  public cancelSearch(searchId: string): void {
    const searchState = this.activeSearches.get(searchId);
    if (!searchState) return;

    // Notify cancellation
    this.notifyListeners(searchId, "cancelled", {
      filesProcessed: searchState.currentIndex,
      totalFiles: searchState.files.length,
      matchesFound: searchState.matchesFound,
      elapsedTimeMs: performance.now() - searchState.startTime,
    });

    // Clean up
    this.activeSearches.delete(searchId);
  }

  /**
   * Get results for a specific file
   * @param searchId The ID of the search
   * @param filePath The path of the file
   */
  public getFileResults(
    searchId: string,
    filePath: string
  ): SearchResult | undefined {
    const searchState = this.activeSearches.get(searchId);
    if (!searchState) return undefined;

    return searchState.results.get(filePath);
  }

  /**
   * Get all results for a search
   * @param searchId The ID of the search
   */
  public getAllResults(
    searchId: string
  ): Map<string, SearchResult> | undefined {
    const searchState = this.activeSearches.get(searchId);
    if (!searchState) return undefined;

    return new Map(searchState.results);
  }

  /**
   * Add a listener for search events
   * @param searchId The ID of the search
   * @param listener The listener function
   * @returns Listener ID for removal
   */
  public addListener(searchId: string, listener: SearchEventListener): string {
    const searchState = this.activeSearches.get(searchId);
    if (!searchState) return "";

    const listenerId = uuidv4();
    searchState.listeners.set(listenerId, listener);
    return listenerId;
  }

  /**
   * Remove a listener
   * @param searchId The ID of the search
   * @param listenerId The ID of the listener
   */
  public removeListener(searchId: string, listenerId: string): void {
    const searchState = this.activeSearches.get(searchId);
    if (!searchState) return;

    searchState.listeners.delete(listenerId);
  }

  /**
   * Notify all listeners of an event
   */
  private notifyListeners(
    searchId: string,
    type: SearchEventType,
    data: SearchProgress | SearchResult | Error
  ): void {
    const searchState = this.activeSearches.get(searchId);
    if (!searchState) return;

    for (const listener of searchState.listeners.values()) {
      try {
        listener(type, data);
      } catch (error) {
        console.error("Error in search listener:", error);
      }
    }
  }

  /**
   * Get statistics about the worker pool
   */
  public getWorkerStats() {
    return this.workerPool.getStats();
  }

  /**
   * Clean up resources
   */
  public dispose(): void {
    // Cancel all active searches
    for (const searchId of this.activeSearches.keys()) {
      this.cancelSearch(searchId);
    }

    // Terminate worker pool
    this.workerPool.terminate();
  }
}
