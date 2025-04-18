/**
 * NearOperatorService
 *
 * A highly optimized service for evaluating NEAR operations in search queries.
 * This service implements advanced algorithms for efficiently evaluating
 * proximity between terms with minimal memory usage and maximum performance.
 */

import { WordBoundaryService } from "./WordBoundaryService.js";
import {
  FuzzySearchService,
  FuzzySearchOptions,
} from "./FuzzySearchService.js";
import { Logger } from "../../lib/services/Logger.js";
import { CacheManager } from "../../lib/CacheManager.js";
import { LRUCache } from "../../lib/LRUCache.js";
import { getProfiler } from "../../lib/utils/Profiler.js";

export interface NearOperatorOptions {
  caseSensitive?: boolean;
  fuzzySearchEnabled?: boolean;
  wholeWordMatchingEnabled?: boolean;
}

// Constants for performance tuning
const TERM_INDICES_CACHE_SIZE = 200;
const TERM_INDICES_CACHE_TTL = 5 * 60 * 1000; // 5 minutes
const PROXIMITY_CACHE_SIZE = 500;
const PROXIMITY_CACHE_TTL = 10 * 60 * 1000; // 10 minutes

export class NearOperatorService {
  private static instance: NearOperatorService;
  private wordBoundaryService: WordBoundaryService;
  private fuzzySearchService: FuzzySearchService;
  private logger: Logger;

  // Caches for performance optimization
  private termIndicesCache: LRUCache<string, number[]>;
  private proximityCache: LRUCache<string, boolean>;

  // Performance metrics
  private metrics = {
    totalEvaluations: 0,
    cacheHits: 0,
    cacheMisses: 0,
    averageEvaluationTime: 0,
    totalEvaluationTime: 0,
    earlyTerminations: 0,
  };

  // Private constructor for singleton pattern
  private constructor() {
    this.wordBoundaryService = WordBoundaryService.getInstance();
    this.fuzzySearchService = FuzzySearchService.getInstance();
    this.logger = Logger.getInstance();

    // Initialize caches
    const cacheManager = CacheManager.getInstance();

    this.termIndicesCache = cacheManager.getOrCreateCache<string, number[]>(
      "nearOperatorTermIndices",
      {
        maxSize: TERM_INDICES_CACHE_SIZE,
        timeToLive: TERM_INDICES_CACHE_TTL,
        name: "NEAR Operator Term Indices",
      }
    );

    this.proximityCache = cacheManager.getOrCreateCache<string, boolean>(
      "nearOperatorProximity",
      {
        maxSize: PROXIMITY_CACHE_SIZE,
        timeToLive: PROXIMITY_CACHE_TTL,
        name: "NEAR Operator Proximity Results",
      }
    );

    this.logger.debug("NearOperatorService initialized with optimized caching");
  }

  /**
   * Gets the singleton instance of NearOperatorService
   * @returns The NearOperatorService instance
   */
  public static getInstance(): NearOperatorService {
    if (!NearOperatorService.instance) {
      NearOperatorService.instance = new NearOperatorService();
    }
    return NearOperatorService.instance;
  }

  /**
   * Evaluates a NEAR operation between two terms with optimized performance
   * @param content The content to search in
   * @param term1 The first term (string or RegExp)
   * @param term2 The second term (string or RegExp)
   * @param distance The maximum word distance between terms
   * @param options Search options
   * @returns True if the terms are found within the specified distance
   */
  public evaluateNear(
    content: string,
    term1: string | RegExp,
    term2: string | RegExp,
    distance: number,
    options: NearOperatorOptions = {}
  ): boolean {
    const profiler = getProfiler();
    const profileId = profiler.start("NearOperatorService.evaluateNear");

    const startTime = performance.now();
    this.metrics.totalEvaluations++;

    const {
      caseSensitive = false,
      fuzzySearchEnabled = false,
      wholeWordMatchingEnabled = false,
    } = options;

    // Quick rejection for invalid inputs
    if (!content || distance < 0) {
      return false;
    }

    // Quick check for very short content
    if (content.length < 10) {
      this.metrics.earlyTerminations++;
      return false;
    }

    // Generate cache key for the entire operation
    const proximityKey = this.generateProximityCacheKey(
      content,
      term1,
      term2,
      distance,
      options
    );

    // Check proximity cache first
    const cachedResult = this.proximityCache.get(proximityKey);
    if (cachedResult !== undefined) {
      this.metrics.cacheHits++;
      return cachedResult;
    }

    this.metrics.cacheMisses++;

    // Find indices of both terms with caching
    let indices1 = this.getCachedTermIndices(
      content,
      term1,
      caseSensitive,
      term1 instanceof RegExp,
      wholeWordMatchingEnabled
    );

    let indices2 = this.getCachedTermIndices(
      content,
      term2,
      caseSensitive,
      term2 instanceof RegExp,
      wholeWordMatchingEnabled
    );

    // If exact match fails for either term, try fuzzy search for string terms
    if (
      indices1.length === 0 &&
      !(term1 instanceof RegExp) &&
      typeof term1 === "string" &&
      term1.length >= 3 &&
      fuzzySearchEnabled
    ) {
      const fuzzyOptions: FuzzySearchOptions = {
        isCaseSensitive: caseSensitive,
        useWholeWordMatching: wholeWordMatchingEnabled,
      };

      const fuzzyResult = this.fuzzySearchService.search(
        content,
        term1,
        fuzzyOptions
      );

      if (
        fuzzyResult.isMatch &&
        fuzzyResult.matchPositions &&
        fuzzyResult.matchPositions.length > 0
      ) {
        indices1 = fuzzyResult.matchPositions;
      }
    }

    if (
      indices2.length === 0 &&
      !(term2 instanceof RegExp) &&
      typeof term2 === "string" &&
      term2.length >= 3 &&
      fuzzySearchEnabled
    ) {
      const fuzzyOptions: FuzzySearchOptions = {
        isCaseSensitive: caseSensitive,
        useWholeWordMatching: wholeWordMatchingEnabled,
      };

      const fuzzyResult = this.fuzzySearchService.search(
        content,
        term2,
        fuzzyOptions
      );

      if (
        fuzzyResult.isMatch &&
        fuzzyResult.matchPositions &&
        fuzzyResult.matchPositions.length > 0
      ) {
        indices2 = fuzzyResult.matchPositions;
      }
    }

    // Early termination if either term is not found
    if (indices1.length === 0 || indices2.length === 0) {
      this.metrics.earlyTerminations++;
      this.proximityCache.set(proximityKey, false);

      const endTime = performance.now();
      this.updateMetrics(endTime - startTime);

      return false;
    }

    // Optimize by sorting indices and using early termination
    if (!this.isSorted(indices1)) {
      indices1.sort((a, b) => a - b);
    }

    if (!this.isSorted(indices2)) {
      indices2.sort((a, b) => a - b);
    }

    // Check word distance between occurrences using a more efficient algorithm
    const result = this.checkProximityOptimized(
      indices1,
      indices2,
      distance,
      content
    );

    // Cache the result
    this.proximityCache.set(proximityKey, result);

    const endTime = performance.now();
    this.updateMetrics(endTime - startTime);

    // End profiling
    profiler.end(profileId);

    return result;
  }

  /**
   * Finds all occurrences of a term in content
   * @param content The content to search in
   * @param term The term to search for (string or RegExp)
   * @param caseSensitive Whether the search is case-sensitive
   * @param isRegex Whether the term is a RegExp
   * @param useWholeWordMatching Whether to match whole words only
   * @returns An array of character indices where the term is found
   */
  private findTermIndices(
    content: string,
    term: string | RegExp,
    caseSensitive: boolean = false,
    isRegex: boolean = false,
    useWholeWordMatching: boolean = false
  ): number[] {
    const profiler = getProfiler();
    const profileId = profiler.start("NearOperatorService.findTermIndices");

    const indices: number[] = [];

    if (isRegex && term instanceof RegExp) {
      // Ensure the regex has the global flag for iterative searching
      const flags = term.flags.includes("g") ? term.flags : term.flags + "g";
      const regex = new RegExp(term.source, flags);

      let match;
      while ((match = regex.exec(content)) !== null) {
        indices.push(match.index);

        // Prevent infinite loops with zero-width matches
        if (match.index === regex.lastIndex) {
          regex.lastIndex++;
        }
      }
    } else if (typeof term === "string") {
      if (useWholeWordMatching) {
        // Use regex with word boundaries for whole word matching
        const flags = caseSensitive ? "g" : "gi";
        const escapedTerm = this.escapeRegExp(term);
        const wordBoundaryRegex = new RegExp(`\\b${escapedTerm}\\b`, flags);

        let match;
        while ((match = wordBoundaryRegex.exec(content)) !== null) {
          indices.push(match.index);

          // Prevent infinite loops with zero-width matches
          if (match.index === wordBoundaryRegex.lastIndex) {
            wordBoundaryRegex.lastIndex++;
          }
        }
      } else {
        // Simple string search
        let startIndex = 0;
        let index;

        if (caseSensitive) {
          while ((index = content.indexOf(term, startIndex)) !== -1) {
            indices.push(index);
            startIndex = index + 1;
          }
        } else {
          const lowerContent = content.toLowerCase();
          const lowerTerm = term.toLowerCase();

          while ((index = lowerContent.indexOf(lowerTerm, startIndex)) !== -1) {
            indices.push(index);
            startIndex = index + 1;
          }
        }
      }
    }

    profiler.end(profileId);
    return indices;
  }

  /**
   * Gets cached term indices or calculates them if not cached
   * @param content The content to search in
   * @param term The term to search for
   * @param caseSensitive Whether the search is case-sensitive
   * @param isRegex Whether the term is a RegExp
   * @param useWholeWordMatching Whether to match whole words only
   * @returns An array of character indices where the term is found
   */
  private getCachedTermIndices(
    content: string,
    term: string | RegExp,
    caseSensitive: boolean = false,
    isRegex: boolean = false,
    useWholeWordMatching: boolean = false
  ): number[] {
    // Generate cache key for term indices
    const cacheKey = this.generateTermIndicesCacheKey(
      content,
      term,
      caseSensitive,
      isRegex,
      useWholeWordMatching
    );

    // Check cache first
    const cachedIndices = this.termIndicesCache.get(cacheKey);
    if (cachedIndices) {
      return cachedIndices;
    }

    // Calculate indices
    const indices = this.findTermIndices(
      content,
      term,
      caseSensitive,
      isRegex,
      useWholeWordMatching
    );

    // Cache the result
    this.termIndicesCache.set(cacheKey, indices);

    return indices;
  }

  /**
   * Optimized version of checkProximity with better performance
   * @param indices1 Sorted array of indices for the first term
   * @param indices2 Sorted array of indices for the second term
   * @param maxDistance Maximum word distance allowed
   * @param content The text content
   * @returns True if any pair is within the specified distance
   */
  private checkProximityOptimized(
    indices1: number[],
    indices2: number[],
    maxDistance: number,
    content: string
  ): boolean {
    const profiler = getProfiler();
    const profileId = profiler.start(
      "NearOperatorService.checkProximityOptimized"
    );
    // Early termination optimization:
    // If we have many indices, first check if any character indices are close enough
    // This avoids expensive word boundary calculations for obviously distant terms
    if (indices1.length > 5 && indices2.length > 5) {
      // Estimate average word length (typically 5-7 characters in English)
      const avgWordLength = 6;
      const maxCharDistance = maxDistance * avgWordLength * 2; // Conservative estimate

      // Use a more efficient algorithm for checking character distance
      if (
        !this.areAnyIndicesWithinDistance(indices1, indices2, maxCharDistance)
      ) {
        this.metrics.earlyTerminations++;
        profiler.end(profileId);
        return false;
      }
    }

    // For very large index sets, use sampling to improve performance
    const sampleSize = 50;
    const sampledIndices1 =
      indices1.length > sampleSize
        ? this.sampleIndices(indices1, sampleSize)
        : indices1;

    // For each index in the first set
    for (const index1 of sampledIndices1) {
      const wordIndex1 = this.wordBoundaryService.getWordIndexFromCharIndex(
        index1,
        content
      );
      if (wordIndex1 === -1) continue;

      // Binary search optimization for the second set
      // Find the closest indices in the second set
      // Estimate average word length (typically 5-7 characters in English)
      const estimatedAvgWordLength = 6;
      const closestIndices = this.findClosestIndicesOptimized(
        indices2,
        index1,
        maxDistance * estimatedAvgWordLength * 2
      );

      for (const index2 of closestIndices) {
        const wordIndex2 = this.wordBoundaryService.getWordIndexFromCharIndex(
          index2,
          content
        );
        if (wordIndex2 === -1) continue;

        // Check if the word distance is within the limit
        const wordDist = Math.abs(wordIndex1 - wordIndex2);
        if (wordDist <= maxDistance) {
          profiler.end(profileId);
          return true;
        }
      }
    }

    profiler.end(profileId);
    return false;
  }

  /**
   * Finds the indices in a sorted array that are closest to a target value
   * @param sortedIndices Sorted array of indices
   * @param targetIndex The target index to find closest values to
   * @returns Array of closest indices (limited to a reasonable number)
   */
  private findClosestIndices(
    sortedIndices: number[],
    targetIndex: number
  ): number[] {
    if (sortedIndices.length <= 10) {
      return sortedIndices; // Just return all for small arrays
    }

    // Binary search to find the insertion point
    let left = 0;
    let right = sortedIndices.length - 1;

    while (left <= right) {
      const mid = Math.floor((left + right) / 2);
      if (sortedIndices[mid] < targetIndex) {
        left = mid + 1;
      } else {
        right = mid - 1;
      }
    }

    // Now left is the insertion point
    // Collect indices around the insertion point
    const result: number[] = [];
    const maxToCollect = 10; // Reasonable limit

    // Collect indices before and after the insertion point
    let before = right;
    let after = left;

    // Alternately add from before and after until we have enough
    while (
      result.length < maxToCollect &&
      (before >= 0 || after < sortedIndices.length)
    ) {
      if (before >= 0) {
        result.push(sortedIndices[before--]);
      }
      if (after < sortedIndices.length && result.length < maxToCollect) {
        result.push(sortedIndices[after++]);
      }
    }

    return result;
  }

  /**
   * Optimized version of findClosestIndices that only returns indices within a maximum distance
   * @param sortedIndices Sorted array of indices
   * @param targetIndex The target index to find closest values to
   * @param maxDistance Maximum distance to consider
   * @returns Array of closest indices within the maximum distance
   */
  private findClosestIndicesOptimized(
    sortedIndices: number[],
    targetIndex: number,
    maxDistance: number
  ): number[] {
    if (sortedIndices.length <= 10) {
      // For small arrays, filter by distance directly
      return sortedIndices.filter(
        (index) => Math.abs(index - targetIndex) <= maxDistance
      );
    }

    // Binary search to find the insertion point
    let left = 0;
    let right = sortedIndices.length - 1;

    while (left <= right) {
      const mid = Math.floor((left + right) / 2);
      if (sortedIndices[mid] < targetIndex) {
        left = mid + 1;
      } else {
        right = mid - 1;
      }
    }

    // Now left is the insertion point
    // Collect indices around the insertion point that are within maxDistance
    const result: number[] = [];
    const maxToCollect = 20; // Increased limit for better coverage

    // Collect indices before and after the insertion point
    let before = right;
    let after = left;

    // Alternately add from before and after until we have enough or exceed distance
    while (
      result.length < maxToCollect &&
      (before >= 0 || after < sortedIndices.length)
    ) {
      if (before >= 0) {
        const index = sortedIndices[before];
        if (Math.abs(index - targetIndex) <= maxDistance) {
          result.push(index);
        } else if (targetIndex - index > maxDistance) {
          // If we've gone too far back, stop looking in this direction
          before = -1;
          continue;
        }
        before--;
      }

      if (after < sortedIndices.length && result.length < maxToCollect) {
        const index = sortedIndices[after];
        if (Math.abs(index - targetIndex) <= maxDistance) {
          result.push(index);
        } else if (index - targetIndex > maxDistance) {
          // If we've gone too far forward, stop looking in this direction
          after = sortedIndices.length;
          continue;
        }
        after++;
      }
    }

    return result;
  }

  /**
   * Checks if any pair of indices from two sets are within the specified distance
   * using an efficient algorithm
   * @param indices1 Sorted array of indices for the first term
   * @param indices2 Sorted array of indices for the second term
   * @param maxDistance Maximum character distance allowed
   * @returns True if any pair is within the specified distance
   */
  private areAnyIndicesWithinDistance(
    indices1: number[],
    indices2: number[],
    maxDistance: number
  ): boolean {
    const profiler = getProfiler();
    const profileId = profiler.start(
      "NearOperatorService.areAnyIndicesWithinDistance"
    );
    // Use a sliding window approach for better performance
    let i = 0;
    let j = 0;

    while (i < indices1.length && j < indices2.length) {
      const diff = indices1[i] - indices2[j];

      if (Math.abs(diff) <= maxDistance) {
        profiler.end(profileId);
        return true;
      }

      // Move the pointer that will reduce the difference
      if (diff > 0) {
        j++;
      } else {
        i++;
      }
    }

    profiler.end(profileId);
    return false;
  }

  /**
   * Samples indices from an array for better performance with large datasets
   * @param indices Array of indices to sample from
   * @param sampleSize Number of samples to take
   * @returns Sampled array of indices
   */
  private sampleIndices(indices: number[], sampleSize: number): number[] {
    if (indices.length <= sampleSize) return indices;

    const result: number[] = [];
    const step = Math.max(1, Math.floor(indices.length / sampleSize));

    // Take evenly spaced samples
    for (let i = 0; i < indices.length; i += step) {
      result.push(indices[i]);
      if (result.length >= sampleSize) break;
    }

    return result;
  }

  /**
   * Checks if an array is already sorted in ascending order
   * @param arr The array to check
   * @returns True if the array is sorted
   */
  private isSorted(arr: number[]): boolean {
    for (let i = 1; i < arr.length; i++) {
      if (arr[i] < arr[i - 1]) return false;
    }
    return true;
  }

  /**
   * Generates a cache key for term indices
   * @param content The content to search in
   * @param term The term to search for
   * @param caseSensitive Whether the search is case-sensitive
   * @param isRegex Whether the term is a RegExp
   * @param useWholeWordMatching Whether to match whole words only
   * @returns A cache key string
   */
  private generateTermIndicesCacheKey(
    content: string,
    term: string | RegExp,
    caseSensitive: boolean,
    isRegex: boolean,
    useWholeWordMatching: boolean
  ): string {
    // Use a hash of the content to avoid storing the entire content in the key
    const contentHash = this.hashString(content);

    // Convert term to string representation
    const termStr =
      isRegex && term instanceof RegExp
        ? `${term.source}:${term.flags}`
        : String(term);

    return `${contentHash}:${termStr}:${caseSensitive}:${isRegex}:${useWholeWordMatching}`;
  }

  /**
   * Generates a cache key for proximity checking
   * @param content The content to search in
   * @param term1 The first term
   * @param term2 The second term
   * @param distance The maximum distance
   * @param options Search options
   * @returns A cache key string
   */
  private generateProximityCacheKey(
    content: string,
    term1: string | RegExp,
    term2: string | RegExp,
    distance: number,
    options: NearOperatorOptions
  ): string {
    // Use a hash of the content to avoid storing the entire content in the key
    const contentHash = this.hashString(content);

    // Convert terms to string representations
    const term1Str =
      term1 instanceof RegExp
        ? `${term1.source}:${term1.flags}`
        : String(term1);

    const term2Str =
      term2 instanceof RegExp
        ? `${term2.source}:${term2.flags}`
        : String(term2);

    return `${contentHash}:${term1Str}:${term2Str}:${distance}:${options.caseSensitive}:${options.fuzzySearchEnabled}:${options.wholeWordMatchingEnabled}`;
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
   * Updates performance metrics
   * @param processingTime Processing time in milliseconds
   */
  private updateMetrics(processingTime: number): void {
    this.metrics.totalEvaluationTime += processingTime;
    this.metrics.averageEvaluationTime =
      this.metrics.totalEvaluationTime / this.metrics.totalEvaluations;

    // Log performance metrics periodically
    if (this.metrics.totalEvaluations % 100 === 0) {
      this.logger.debug("NearOperatorService performance metrics", {
        ...this.metrics,
        cacheHitRate: this.metrics.cacheHits / this.metrics.totalEvaluations,
        termIndicesCache: this.termIndicesCache.getStats(),
        proximityCache: this.proximityCache.getStats(),
      });

      // Save profiling data to a file for analysis
      this.saveProfilingData();
    }
  }

  /**
   * Save profiling data to a file for analysis
   */
  private saveProfilingData(): void {
    try {
      const profiler = getProfiler();
      if (profiler.isEnabled()) {
        const timestamp = new Date().toISOString().replace(/:/g, "-");
        const path = require("path");
        const fs = require("fs");
        const reportPath = path.resolve(
          process.cwd(),
          "performance-results",
          `near-operator-profile-${timestamp}.json`
        );

        // Ensure directory exists
        const dirPath = path.dirname(reportPath);
        if (!fs.existsSync(dirPath)) {
          fs.mkdirSync(dirPath, { recursive: true });
        }

        // Save the report
        profiler
          .saveReport(reportPath)
          .then(() => {
            this.logger.debug(
              `NearOperatorService profile saved to ${reportPath}`
            );
          })
          .catch((err) => {
            this.logger.error(
              "Failed to save NearOperatorService profile",
              err
            );
          });
      }
    } catch (error) {
      this.logger.error("Error saving profiling data", error);
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
        this.metrics.totalEvaluations > 0
          ? this.metrics.cacheHits / this.metrics.totalEvaluations
          : 0,
      termIndicesCache: this.termIndicesCache.getStats(),
      proximityCache: this.proximityCache.getStats(),
    };
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
