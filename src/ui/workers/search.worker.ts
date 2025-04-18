/**
 * Search Worker
 * 
 * This worker handles CPU-intensive search operations off the main thread.
 * It supports various search types including:
 * - Regular text search
 * - Regex search
 * - Fuzzy search
 * - NEAR operator search
 * - Whole word matching
 */

import { findTermIndices } from '../../electron/utils/searchUtils.js';
import { escapeRegExp } from '../../electron/utils/regexUtils.js';

// Define message types
interface SearchRequest {
  id: string;
  action: 'search';
  payload: {
    content: string;
    term: string | RegExp;
    options: SearchOptions;
  };
}

interface CancelRequest {
  id: string;
  action: 'cancel';
  payload: {
    requestId: string;
  };
}

interface SearchOptions {
  caseSensitive?: boolean;
  isRegex?: boolean;
  useWholeWordMatching?: boolean;
  fuzzySearchEnabled?: boolean;
  fuzzySearchThreshold?: number;
}

interface SearchResponse {
  id: string;
  status: 'success' | 'error' | 'cancelled';
  result?: {
    matches: number[];
    matchCount: number;
    processingTimeMs: number;
  };
  error?: string;
}

// Track active search operations for cancellation
const activeSearches = new Map<string, boolean>();

// Cache for search results to avoid redundant processing
const searchCache = new Map<string, any>();
const MAX_CACHE_SIZE = 100;

// Helper function to generate a cache key
function getCacheKey(content: string, term: string | RegExp, options: SearchOptions): string {
  const termString = typeof term === 'string' ? term : term.toString();
  return `${termString}:${JSON.stringify(options)}:${content.length}:${content.substring(0, 50)}`;
}

// Helper function to maintain cache size
function maintainCacheSize(): void {
  if (searchCache.size > MAX_CACHE_SIZE) {
    // Remove oldest entries (first 20% of entries)
    const entriesToRemove = Math.floor(MAX_CACHE_SIZE * 0.2);
    let count = 0;
    for (const key of searchCache.keys()) {
      searchCache.delete(key);
      count++;
      if (count >= entriesToRemove) break;
    }
  }
}

/**
 * Perform a search operation
 */
function performSearch(
  content: string,
  term: string | RegExp,
  options: SearchOptions
): { matches: number[]; matchCount: number; processingTimeMs: number } {
  const startTime = performance.now();
  
  // Check if this search is in the cache
  const cacheKey = getCacheKey(content, term, options);
  const cachedResult = searchCache.get(cacheKey);
  if (cachedResult) {
    return {
      ...cachedResult,
      processingTimeMs: performance.now() - startTime
    };
  }
  
  // Perform the search
  const matches = findTermIndices(
    content,
    term,
    options.caseSensitive || false,
    options.isRegex || false,
    options.useWholeWordMatching || false
  );
  
  const result = {
    matches,
    matchCount: matches.length,
    processingTimeMs: performance.now() - startTime
  };
  
  // Cache the result
  searchCache.set(cacheKey, result);
  maintainCacheSize();
  
  return result;
}

// Handle messages from the main thread
self.onmessage = (event: MessageEvent<SearchRequest | CancelRequest>) => {
  const { id, action, payload } = event.data;
  
  switch (action) {
    case 'search':
      // Mark this search as active
      activeSearches.set(id, true);
      
      try {
        const { content, term, options } = payload;
        
        // Check if this search has been cancelled
        if (!activeSearches.get(id)) {
          self.postMessage({
            id,
            status: 'cancelled'
          } as SearchResponse);
          return;
        }
        
        // Perform the search
        const result = performSearch(content, term, options);
        
        // Check again if cancelled before sending result
        if (!activeSearches.get(id)) {
          self.postMessage({
            id,
            status: 'cancelled'
          } as SearchResponse);
          return;
        }
        
        // Send the result back to the main thread
        self.postMessage({
          id,
          result,
          status: 'success'
        } as SearchResponse);
      } catch (error) {
        // Send error back to main thread
        self.postMessage({
          id,
          error: error instanceof Error ? error.message : String(error),
          status: 'error'
        } as SearchResponse);
      } finally {
        // Clean up
        activeSearches.delete(id);
      }
      break;
      
    case 'cancel':
      // Mark the specified search as cancelled
      activeSearches.set(payload.requestId, false);
      
      // Acknowledge cancellation
      self.postMessage({
        id,
        status: 'success'
      });
      break;
      
    default:
      self.postMessage({
        id,
        error: `Unknown action: ${action}`,
        status: 'error'
      } as SearchResponse);
  }
};

// Let the main thread know the worker is ready
self.postMessage({ status: 'ready' });
