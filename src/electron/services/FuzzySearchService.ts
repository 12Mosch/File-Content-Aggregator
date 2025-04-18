/**
 * FuzzySearchService
 *
 * A unified service for performing fuzzy searches with caching.
 * This service uses Fuse.js for fuzzy matching and implements caching
 * to improve performance for repeated searches.
 */

import { LRUCache } from "../../lib/LRUCache.js";

// Define interfaces for the service
export interface FuzzySearchOptions {
  threshold?: number;
  isCaseSensitive?: boolean;
  includeScore?: boolean;
  useWholeWordMatching?: boolean;
}

export interface FuzzySearchResult {
  isMatch: boolean;
  score?: number;
  matchPositions?: number[];
}

export class FuzzySearchService {
  private static instance: FuzzySearchService;

  // Cache Fuse instances to avoid recreating them for the same content
  private fuseCache = new LRUCache<string, unknown>(50);

  // Cache search results to avoid repeating the same searches
  private resultCache = new LRUCache<string, FuzzySearchResult>(200);

  // Private constructor for singleton pattern
  private constructor() {}

  /**
   * Gets the singleton instance of FuzzySearchService
   * @returns The FuzzySearchService instance
   */
  public static getInstance(): FuzzySearchService {
    if (!FuzzySearchService.instance) {
      FuzzySearchService.instance = new FuzzySearchService();
    }
    return FuzzySearchService.instance;
  }

  /**
   * Performs a fuzzy search with caching
   * @param content The content to search in
   * @param term The term to search for
   * @param options Search options
   * @returns A FuzzySearchResult object
   */
  public search(
    content: string,
    term: string,
    options: FuzzySearchOptions = {}
  ): FuzzySearchResult {
    // Default options
    const {
      threshold = 0.4,
      isCaseSensitive = false,
      includeScore = true,
      useWholeWordMatching = false,
    } = options;

    // Skip fuzzy search for very short terms
    if (!term || term.length < 3 || !content) {
      return { isMatch: false };
    }

    // Generate cache key based on content, term, and options
    const cacheKey = this.generateCacheKey(content, term, options);

    // Check result cache first
    const cachedResult = this.resultCache.get(cacheKey);
    if (cachedResult) {
       
      return cachedResult;
    }

    try {
      // Dynamically import Fuse.js
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const Fuse = require("fuse.js");

      // Configure Fuse.js options
      const fuseOptions = {
        includeScore,
        threshold,
        ignoreLocation: true,
        useExtendedSearch: true,
        ignoreFieldNorm: true,
        isCaseSensitive,
      };

      // Generate a content hash for the fuse cache
      const contentHash = this.hashString(content);

      // Try to get a cached Fuse instance
      let fuse = this.fuseCache.get(contentHash);

      if (!fuse) {
        // Create a new Fuse instance if not in cache
        fuse = new Fuse([content], fuseOptions);
        this.fuseCache.set(contentHash, fuse);
      }

      // Perform the search
      const searchResults = (fuse as any).search(term);

      // Process the results
      let result: FuzzySearchResult;

      if (searchResults.length > 0 && searchResults[0].score < 0.6) {
        // Found a match
        result = {
          isMatch: true,
          score: searchResults[0].score,
        };

        // Find approximate match positions if needed
        if (includeScore) {
          result.matchPositions = this.findApproximateMatchIndices(
            content,
            term
          );
        }

        // If whole word matching is enabled, verify it's a whole word
        if (useWholeWordMatching) {
          const wordBoundaryRegex = new RegExp(
            `\\b${this.escapeRegExp(term)}\\b`,
            isCaseSensitive ? "g" : "gi"
          );

          result.isMatch = wordBoundaryRegex.test(content);
        }
      } else {
        // No match found
        result = {
          isMatch: false,
          score: searchResults.length > 0 ? searchResults[0].score : 1.0,
        };
      }

      // Cache the result
      this.resultCache.set(cacheKey, result);

      return result;
    } catch (error) {
      console.error("Error in fuzzy search:", error);
      return { isMatch: false };
    }
  }

  /**
   * Clears all caches
   */
  public clearCaches(): void {
    this.fuseCache.clear();
    this.resultCache.clear();
  }

  /**
   * Gets statistics about the caches
   */
  public getCacheStats() {
    return {
      fuseCache: this.fuseCache.getStats(),
      resultCache: this.resultCache.getStats(),
    };
  }

  /**
   * Finds approximate match positions for a term in content
   * @param content The content to search in
   * @param term The term to search for
   * @returns An array of character indices where matches start
   */
  private findApproximateMatchIndices(content: string, term: string): number[] {
    const indices: number[] = [];
    if (!term || term.length < 3 || !content) return indices;

    // Split content into words for better fuzzy matching
    const words = content.split(/\s+/);
    const termLower = term.toLowerCase();

    // Track the current position in the content
    let position = 0;

    for (const word of words) {
      // Skip very short words
      if (word.length < 3) {
        position += word.length + 1; // +1 for the space
        continue;
      }

      const wordLower = word.toLowerCase();

      // Check if this word is a potential fuzzy match
      // Simple check: at least 60% of characters match
      let matchScore = 0;
      const minLength = Math.min(termLower.length, wordLower.length);
      const maxLength = Math.max(termLower.length, wordLower.length);

      // Count matching characters (simple approach)
      for (let i = 0; i < minLength; i++) {
        if (termLower[i] === wordLower[i]) {
          matchScore++;
        }
      }

      // Calculate similarity ratio
      const similarity = matchScore / maxLength;

      // If similarity is high enough, consider it a match
      if (similarity >= 0.6) {
        indices.push(position);
      }

      position += word.length + 1; // +1 for the space
    }

    return indices;
  }

  /**
   * Generates a cache key for a search operation
   */
  private generateCacheKey(
    content: string,
    term: string,
    options: FuzzySearchOptions
  ): string {
    // Use a hash of the content to avoid storing the entire content in the key
    const contentHash = this.hashString(content);

    // Include term and options in the key
    return `${contentHash}:${term}:${options.isCaseSensitive}:${options.threshold}:${options.useWholeWordMatching}`;
  }

  /**
   * Simple string hashing function
   * @param str The string to hash
   * @returns A hash string
   */
  private hashString(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return hash.toString(36);
  }

  /**
   * Escapes special characters in a string for use in a RegExp
   * @param string The string to escape
   * @returns The escaped string
   */
  private escapeRegExp(string: string): string {
    return string.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }
}
