/**
 * FuzzySearchService
 *
 * An optimized service for performing fuzzy searches with advanced caching.
 * This service uses Fuse.js for fuzzy matching and implements multi-level caching
 * to significantly improve performance for repeated searches.
 */

import { LRUCache } from "../../lib/LRUCache.js";
import { CacheManager } from "../../lib/CacheManager.js";
import { Logger } from "../../lib/services/Logger.js";

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
  processingTimeMs?: number;
}

// Constants for performance tuning
const FUSE_CACHE_SIZE = 100;
const RESULT_CACHE_SIZE = 500;
const FUSE_CACHE_TTL = 10 * 60 * 1000; // 10 minutes
const RESULT_CACHE_TTL = 15 * 60 * 1000; // 15 minutes
const MIN_TERM_LENGTH = 2; // Minimum term length for fuzzy search
const MATCH_THRESHOLD = 0.4; // Default threshold for fuzzy matching

export class FuzzySearchService {
  private static instance: FuzzySearchService;
  private logger: Logger;

  // Cache Fuse instances to avoid recreating them for the same content
  private fuseCache: LRUCache<string, unknown>;

  // Cache search results to avoid repeating the same searches
  private resultCache: LRUCache<string, FuzzySearchResult>;

  // Performance metrics
  private metrics = {
    totalSearches: 0,
    cacheHits: 0,
    cacheMisses: 0,
    averageSearchTime: 0,
    totalSearchTime: 0,
  };

  // Private constructor for singleton pattern
  private constructor() {
    this.logger = Logger.getInstance();

    // Try to get caches from the cache manager first
    const cacheManager = CacheManager.getInstance();

    this.fuseCache = cacheManager.getOrCreateCache<string, unknown>(
      "fuzzySearchFuse",
      {
        maxSize: FUSE_CACHE_SIZE,
        timeToLive: FUSE_CACHE_TTL,
        name: "Fuzzy Search Fuse Instances",
      }
    );

    this.resultCache = cacheManager.getOrCreateCache<string, FuzzySearchResult>(
      "fuzzySearchResults",
      {
        maxSize: RESULT_CACHE_SIZE,
        timeToLive: RESULT_CACHE_TTL,
        name: "Fuzzy Search Results",
      }
    );

    this.logger.debug("FuzzySearchService initialized with optimized caching");
  }

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
   * Performs a fuzzy search with caching and performance optimizations
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
    const startTime = performance.now();
    this.metrics.totalSearches++;

    // Default options
    const {
      threshold = MATCH_THRESHOLD,
      isCaseSensitive = false,
      includeScore = true,
      useWholeWordMatching = false,
    } = options;

    // Quick rejection for invalid inputs
    if (!term || !content) {
      return { isMatch: false, processingTimeMs: 0 };
    }

    // Skip fuzzy search for very short terms
    if (term.length < MIN_TERM_LENGTH) {
      // For very short terms, just do a simple string search
      const isMatch = isCaseSensitive
        ? content.includes(term)
        : content.toLowerCase().includes(term.toLowerCase());

      const result: FuzzySearchResult = {
        isMatch,
        processingTimeMs: performance.now() - startTime,
      };

      return result;
    }

    // Generate cache key based on content, term, and options
    const cacheKey = this.generateCacheKey(content, term, options);

    // Check result cache first
    const cachedResult = this.resultCache.get(cacheKey);
    if (cachedResult) {
      this.metrics.cacheHits++;
      return {
        ...cachedResult,
        processingTimeMs: performance.now() - startTime,
      };
    }

    this.metrics.cacheMisses++;

    // Optimization: For exact matches, skip the fuzzy search
    const exactMatchResult = this.checkExactMatch(
      content,
      term,
      isCaseSensitive,
      useWholeWordMatching
    );
    if (exactMatchResult) {
      // Cache and return the exact match result
      this.resultCache.set(cacheKey, exactMatchResult);

      const endTime = performance.now();
      const processingTime = endTime - startTime;
      this.updateMetrics(processingTime);

      return {
        ...exactMatchResult,
        processingTimeMs: processingTime,
      };
    }

    try {
      // Dynamically import Fuse.js
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const Fuse = require("fuse.js");

      // Configure Fuse.js options with optimized settings
      const fuseOptions = {
        includeScore,
        threshold,
        ignoreLocation: true,
        useExtendedSearch: true,
        ignoreFieldNorm: true,
        isCaseSensitive,
        // New optimized settings
        distance: 200, // Increase search distance for better matches
        findAllMatches: false, // Only find the first match for performance
        minMatchCharLength: Math.max(2, Math.floor(term.length * 0.5)), // Minimum characters that must match
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
      const searchResults = (
        fuse as {
          search: (term: string) => Array<{ score: number }>;
        }
      ).search(term);

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
          result.matchPositions = this.findApproximateMatchIndicesOptimized(
            content,
            term,
            isCaseSensitive
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

      const endTime = performance.now();
      const processingTime = endTime - startTime;
      this.updateMetrics(processingTime);

      return {
        ...result,
        processingTimeMs: processingTime,
      };
    } catch (error) {
      this.logger.error("Error in fuzzy search:", { error });
      return {
        isMatch: false,
        processingTimeMs: performance.now() - startTime,
      };
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

  /**
   * Optimized version of findApproximateMatchIndices
   * Uses a more efficient algorithm for finding match positions
   * @param content The content to search in
   * @param term The term to search for
   * @param isCaseSensitive Whether the search is case sensitive
   * @returns An array of character indices where matches start
   */
  private findApproximateMatchIndicesOptimized(
    content: string,
    term: string,
    isCaseSensitive = false
  ): number[] {
    const indices: number[] = [];
    if (!term || term.length < MIN_TERM_LENGTH || !content) return indices;

    // Prepare content and term based on case sensitivity
    const normalizedContent = isCaseSensitive ? content : content.toLowerCase();
    const normalizedTerm = isCaseSensitive ? term : term.toLowerCase();

    // Use a sliding window approach for better performance
    const termLength = normalizedTerm.length;
    const maxMismatchCount = Math.floor(termLength * 0.3); // Allow up to 30% mismatches

    // Optimization: For short content, use a simpler approach
    if (content.length < 1000) {
      return this.findSimpleMatchIndices(
        normalizedContent,
        normalizedTerm,
        maxMismatchCount
      );
    }

    // For longer content, use a more efficient word-based approach
    // Split content into words for better fuzzy matching
    const words = normalizedContent.split(/\s+/);

    // Track the current position in the content
    let position = 0;

    for (const word of words) {
      // Skip very short words or words that are too different in length
      if (
        word.length < MIN_TERM_LENGTH ||
        word.length < termLength * 0.7 ||
        word.length > termLength * 1.3
      ) {
        position += word.length + 1; // +1 for the space
        continue;
      }

      // Quick check: first and last character should match for better performance
      if (
        word[0] === normalizedTerm[0] ||
        word[word.length - 1] === normalizedTerm[termLength - 1]
      ) {
        // Calculate Levenshtein distance for better accuracy
        const distance = this.levenshteinDistance(word, normalizedTerm);

        // If distance is small enough, consider it a match
        if (distance <= maxMismatchCount) {
          indices.push(position);
        }
      }

      position += word.length + 1; // +1 for the space
    }

    return indices;
  }

  /**
   * Finds match indices using a simple sliding window approach
   * @param content Normalized content
   * @param term Normalized term
   * @param maxMismatchCount Maximum allowed mismatches
   * @returns Array of match indices
   */
  private findSimpleMatchIndices(
    content: string,
    term: string,
    maxMismatchCount: number
  ): number[] {
    const indices: number[] = [];
    const contentLength = content.length;
    const termLength = term.length;

    // Sliding window approach
    for (let i = 0; i <= contentLength - termLength; i++) {
      let mismatchCount = 0;

      // Check each character in the window
      for (let j = 0; j < termLength; j++) {
        if (content[i + j] !== term[j]) {
          mismatchCount++;
          if (mismatchCount > maxMismatchCount) break;
        }
      }

      // If mismatches are within threshold, add to indices
      if (mismatchCount <= maxMismatchCount) {
        indices.push(i);
        // Skip ahead to avoid overlapping matches
        i += Math.max(1, Math.floor(termLength / 2));
      }
    }

    return indices;
  }

  /**
   * Calculates Levenshtein distance between two strings
   * @param a First string
   * @param b Second string
   * @returns Levenshtein distance
   */
  private levenshteinDistance(a: string, b: string): number {
    // Optimization: If strings are equal, distance is 0
    if (a === b) return 0;

    // Optimization: If length difference is too large, return max length
    const lenA = a.length;
    const lenB = b.length;
    if (Math.abs(lenA - lenB) > Math.min(lenA, lenB) * 0.5) {
      return Math.max(lenA, lenB);
    }

    // Initialize the matrix
    const matrix: number[][] = [];

    // Initialize first row
    for (let i = 0; i <= lenB; i++) {
      matrix[0] = matrix[0] || [];
      matrix[0][i] = i;
    }

    // Initialize first column
    for (let i = 0; i <= lenA; i++) {
      matrix[i] = matrix[i] || [];
      matrix[i][0] = i;
    }

    // Fill the matrix
    for (let i = 1; i <= lenA; i++) {
      for (let j = 1; j <= lenB; j++) {
        const cost = a[i - 1] === b[j - 1] ? 0 : 1;
        matrix[i][j] = Math.min(
          matrix[i - 1][j] + 1, // deletion
          matrix[i][j - 1] + 1, // insertion
          matrix[i - 1][j - 1] + cost // substitution
        );
      }
    }

    return matrix[lenA][lenB];
  }

  /**
   * Checks for an exact match before doing fuzzy search
   * @param content The content to search in
   * @param term The term to search for
   * @param isCaseSensitive Whether the search is case sensitive
   * @param useWholeWordMatching Whether to match whole words only
   * @returns A FuzzySearchResult object if there's an exact match, null otherwise
   */
  private checkExactMatch(
    content: string,
    term: string,
    isCaseSensitive = false,
    useWholeWordMatching = false
  ): FuzzySearchResult | null {
    // Prepare content and term based on case sensitivity
    const normalizedContent = isCaseSensitive ? content : content.toLowerCase();
    const normalizedTerm = isCaseSensitive ? term : term.toLowerCase();

    // Check for exact match
    if (useWholeWordMatching) {
      const wordBoundaryRegex = new RegExp(
        `\\b${this.escapeRegExp(normalizedTerm)}\\b`,
        isCaseSensitive ? "g" : "gi"
      );

      const isMatch = wordBoundaryRegex.test(normalizedContent);
      if (!isMatch) return null;

      // Find match positions
      const matchPositions: number[] = [];
      let match: RegExpExecArray | null;
      const regex = new RegExp(
        `\\b${this.escapeRegExp(normalizedTerm)}\\b`,
        isCaseSensitive ? "g" : "gi"
      );

      while ((match = regex.exec(normalizedContent)) !== null) {
        matchPositions.push(match.index);
      }

      return {
        isMatch: true,
        score: 0, // Perfect match
        matchPositions,
      };
    } else {
      // Simple string search
      const index = normalizedContent.indexOf(normalizedTerm);
      if (index === -1) return null;

      // Find all occurrences
      const matchPositions: number[] = [];
      let pos = 0;
      while ((pos = normalizedContent.indexOf(normalizedTerm, pos)) !== -1) {
        matchPositions.push(pos);
        pos += normalizedTerm.length;
      }

      return {
        isMatch: true,
        score: 0, // Perfect match
        matchPositions,
      };
    }
  }

  /**
   * Updates performance metrics
   * @param processingTime Processing time in milliseconds
   */
  private updateMetrics(processingTime: number): void {
    this.metrics.totalSearchTime += processingTime;
    this.metrics.averageSearchTime =
      this.metrics.totalSearchTime / this.metrics.totalSearches;

    // Log performance metrics periodically
    if (this.metrics.totalSearches % 100 === 0) {
      this.logger.debug("FuzzySearchService performance metrics", {
        ...this.metrics,
        cacheHitRate: this.metrics.cacheHits / this.metrics.totalSearches,
        fuseCache: this.fuseCache.getStats(),
        resultCache: this.resultCache.getStats(),
      });
    }
  }

  /**
   * Gets the current performance metrics
   * @returns Performance metrics object
   */
  public getMetrics() {
    return {
      ...this.metrics,
      cacheHitRate:
        this.metrics.totalSearches > 0
          ? this.metrics.cacheHits / this.metrics.totalSearches
          : 0,
      fuseCache: this.fuseCache.getStats(),
      resultCache: this.resultCache.getStats(),
    };
  }
}
