/**
 * NearOperatorService
 *
 * A highly optimized service for evaluating NEAR operations in search queries.
 * This service implements advanced algorithms for efficiently evaluating
 * proximity between terms with minimal memory usage and maximum performance.
 */

import { WordBoundaryService } from "./WordBoundaryService.js";
import {
  OptimizedFuzzySearchService,
  FuzzySearchOptions,
} from "./OptimizedFuzzySearchService.js";
import { Logger } from "../../lib/services/Logger.js";
import { CacheManager } from "../../lib/CacheManager.js";
import { LRUCache } from "../../lib/LRUCache.js";
import { getProfiler } from "../../lib/utils/Profiler.js";
import * as fs from "fs/promises";
import * as path from "path";
import * as crypto from "crypto";

export interface NearOperatorOptions {
  caseSensitive?: boolean;
  fuzzySearchEnabled?: boolean;
  wholeWordMatchingEnabled?: boolean;
}

// Constants for performance tuning - optimized values
const TERM_INDICES_CACHE_SIZE = 1000; // Increased for better hit rates
const TERM_INDICES_CACHE_TTL = 15 * 60 * 1000; // 15 minutes
const PROXIMITY_CACHE_SIZE = 2000; // Increased for better hit rates
const PROXIMITY_CACHE_TTL = 20 * 60 * 1000; // 20 minutes
const CONTENT_FINGERPRINT_CACHE_SIZE = 500; // New cache for content fingerprints
const CONTENT_FINGERPRINT_CACHE_TTL = 30 * 60 * 1000; // 30 minutes
// Maximum content size to process in full (larger contents will use chunking)
const MAX_FULL_CONTENT_SIZE = 2 * 1024 * 1024; // 2MB - increased threshold
const CHUNK_SIZE = 64 * 1024; // 64KB chunks for large content processing
const CHUNK_OVERLAP = 1024; // 1KB overlap between chunks
// Maximum execution time before applying more aggressive optimizations
const MAX_EXECUTION_TIME_MS = 8000; // 8000ms (8 seconds) - aligned with file processing timeout
// Memory pool constants
const ARRAY_POOL_SIZE = 50; // Pool size for reusable arrays
const MAX_POOLED_ARRAY_SIZE = 1000; // Maximum size of arrays to pool

export class NearOperatorService {
  private static instance: NearOperatorService;
  private wordBoundaryService: WordBoundaryService;
  private fuzzySearchService: OptimizedFuzzySearchService;
  private logger: Logger;

  // Caches for performance optimization
  private termIndicesCache: LRUCache<string, number[]>;
  private proximityCache: LRUCache<string, boolean>;
  private contentFingerprintCache: LRUCache<string, string>;

  // Circuit breaker for problematic files
  private problematicFiles: Set<string> = new Set();
  private fileTimeoutCounts: Map<string, number> = new Map();

  // Memory pool for array reuse to reduce GC pressure
  private pooledArraySizes: Map<number, number[][]> = new Map();

  // Performance metrics
  private metrics = {
    totalEvaluations: 0,
    cacheHits: 0,
    cacheMisses: 0,
    averageEvaluationTime: 0,
    totalEvaluationTime: 0,
    earlyTerminations: 0,
    // Detailed metrics for algorithm phases
    phaseMetrics: {
      termIndicesCalculation: {
        totalTime: 0,
        count: 0,
        averageTime: 0,
      },
      fuzzySearch: {
        totalTime: 0,
        count: 0,
        averageTime: 0,
        successCount: 0,
      },
      proximityCheck: {
        totalTime: 0,
        count: 0,
        averageTime: 0,
      },
      wordBoundaryCalculation: {
        totalTime: 0,
        count: 0,
        averageTime: 0,
      },
    },
    // Memory usage metrics
    memoryMetrics: {
      peakMemoryUsage: 0,
      averageMemoryDelta: 0,
      totalMemoryDelta: 0,
      measurementCount: 0,
    },
    // Content size metrics
    contentSizeMetrics: {
      totalContentSize: 0,
      maxContentSize: 0,
      minContentSize: Number.MAX_VALUE,
      contentCount: 0,
      averageContentSize: 0,
    },
  };

  // Private constructor for singleton pattern
  private constructor() {
    this.wordBoundaryService = WordBoundaryService.getInstance();
    this.fuzzySearchService = new OptimizedFuzzySearchService();
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

    this.contentFingerprintCache = cacheManager.getOrCreateCache<
      string,
      string
    >("nearOperatorContentFingerprints", {
      maxSize: CONTENT_FINGERPRINT_CACHE_SIZE,
      timeToLive: CONTENT_FINGERPRINT_CACHE_TTL,
      name: "NEAR Operator Content Fingerprints",
    });

    // Initialize memory pools
    this.initializeMemoryPools();

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
   * Checks if a file should be skipped due to circuit breaker
   * @param filePath The file path to check
   * @returns True if the file should be skipped
   */
  public shouldSkipFile(filePath: string): boolean {
    return this.problematicFiles.has(filePath);
  }

  /**
   * Records a timeout for a file and potentially adds it to problematic files
   * @param filePath The file path that timed out
   */
  public recordFileTimeout(filePath: string): void {
    const currentCount = this.fileTimeoutCounts.get(filePath) || 0;
    const newCount = currentCount + 1;
    this.fileTimeoutCounts.set(filePath, newCount);

    // If a file times out 3 times, mark it as problematic
    if (newCount >= 3) {
      this.problematicFiles.add(filePath);
      this.logger.warn(
        `File marked as problematic due to repeated timeouts: ${filePath}`
      );
    }
  }

  /**
   * Clears caches to free memory during high memory pressure
   */
  public clearCachesForMemoryPressure(): void {
    const termIndicesCleared = this.termIndicesCache.size();
    const proximityCleared = this.proximityCache.size();
    const fingerprintCleared = this.contentFingerprintCache.size();

    this.termIndicesCache.clear();
    this.proximityCache.clear();
    this.contentFingerprintCache.clear();

    this.logger.info("Cleared NEAR operator caches due to memory pressure", {
      termIndicesCleared,
      proximityCleared,
      fingerprintCleared,
    });
  }

  /**
   * Evaluates a NEAR operation between two terms with optimized performance
   * @param content The content to search in
   * @param term1 The first term (string or RegExp)
   * @param term2 The second term (string or RegExp)
   * @param distance The maximum word distance between terms
   * @param options Search options
   * @param filePath Optional file path for circuit breaker tracking
   * @returns True if the terms are found within the specified distance
   */
  public evaluateNear(
    content: string,
    term1: string | RegExp,
    term2: string | RegExp,
    distance: number,
    options: NearOperatorOptions = {},
    filePath?: string
  ): boolean {
    const profiler = getProfiler();
    const profileId = profiler.start("NearOperatorService.evaluateNear", {
      contentLength: content.length,
      term1: term1 instanceof RegExp ? term1.toString() : term1,
      term2: term2 instanceof RegExp ? term2.toString() : term2,
      distance,
      options,
    });

    const startTime = performance.now();
    this.metrics.totalEvaluations++;

    // Track content size metrics
    this.updateContentSizeMetrics(content.length);

    // For very large content, we use more aggressive sampling to prevent timeouts
    // This is implemented in the checkProximityOptimized method via direct content length checks

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
    const termIndicesStart = performance.now();
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
    const termIndicesEnd = performance.now();
    this.updatePhaseMetrics(
      "termIndicesCalculation",
      termIndicesEnd - termIndicesStart
    );

    // If exact match fails for either term, try fuzzy search for string terms
    // but only if we have a reasonable chance of success
    const fuzzySearchStart = performance.now();
    let fuzzySearchUsed = false;

    // Only attempt fuzzy search if it's enabled and we have no exact matches
    if (
      fuzzySearchEnabled &&
      (indices1.length === 0 || indices2.length === 0)
    ) {
      // Prepare fuzzy search options once
      const fuzzyOptions: FuzzySearchOptions = {
        isCaseSensitive: caseSensitive,
        useWholeWordMatching: wholeWordMatchingEnabled,
        threshold: 0.4, // Stricter threshold for better performance
      };

      // Try fuzzy search for term1 if needed
      if (
        indices1.length === 0 &&
        !(term1 instanceof RegExp) &&
        term1.length >= 3
      ) {
        fuzzySearchUsed = true;
        this.metrics.phaseMetrics.fuzzySearch.count++;

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
          this.metrics.phaseMetrics.fuzzySearch.successCount++;
        }
      }

      // Only try fuzzy search for term2 if we have matches for term1 or term1 is a regex
      // This is an optimization to avoid unnecessary fuzzy searches
      if (
        indices2.length === 0 &&
        !(term2 instanceof RegExp) &&
        term2.length >= 3 &&
        (indices1.length > 0 || term1 instanceof RegExp)
      ) {
        fuzzySearchUsed = true;
        this.metrics.phaseMetrics.fuzzySearch.count++;

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
          this.metrics.phaseMetrics.fuzzySearch.successCount++;
        }
      }
    }

    const fuzzySearchEnd = performance.now();
    if (fuzzySearchUsed) {
      this.updatePhaseMetrics("fuzzySearch", fuzzySearchEnd - fuzzySearchStart);
    }

    // Early termination if either term has no matches after fuzzy search
    if (indices1.length === 0 || indices2.length === 0) {
      this.metrics.earlyTerminations++;
      return false;
    }

    // Check if we've already spent too much time on this evaluation
    const currentTime = performance.now();
    if (currentTime - startTime > MAX_EXECUTION_TIME_MS) {
      this.logger.debug(
        "NEAR operation timed out during term matching, using early termination"
      );
      this.metrics.earlyTerminations++;

      // Record timeout for circuit breaker if filePath is provided
      if (filePath) {
        this.recordFileTimeout(filePath);
      }

      return false;
    }

    // Early termination if either term is not found (redundant check, but keeping for safety)
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
    const proximityCheckStart = performance.now();
    const result = this.checkProximityOptimized(
      indices1,
      indices2,
      distance,
      content,
      filePath
    );
    const proximityCheckEnd = performance.now();
    this.updatePhaseMetrics(
      "proximityCheck",
      proximityCheckEnd - proximityCheckStart
    );

    // Cache the result
    this.proximityCache.set(proximityKey, result);

    const endTime = performance.now();
    const totalTime = endTime - startTime;
    this.updateMetrics(totalTime);

    // Track memory usage if available
    if (typeof process !== "undefined" && process.memoryUsage) {
      try {
        const memoryUsage = process.memoryUsage().heapUsed / (1024 * 1024); // MB
        this.updateMemoryMetrics(memoryUsage);

        // Add memory usage to profiler metadata
        profiler.end(profileId, {
          executionTime: totalTime,
          memoryUsage,
          indices1Count: indices1.length,
          indices2Count: indices2.length,
          result,
          contentLength: content.length,
          fuzzySearchUsed,
          cacheHit: false,
        });
      } catch (_error) {
        // Fallback if memory tracking fails
        profiler.end(profileId, {
          executionTime: totalTime,
          result,
          contentLength: content.length,
        });
      }
    } else {
      // End profiling without memory metrics
      profiler.end(profileId, {
        executionTime: totalTime,
        result,
        contentLength: content.length,
      });
    }

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
   * Highly optimized proximity checking with two-pointer algorithm and early termination
   * @param indices1 Sorted array of indices for the first term
   * @param indices2 Sorted array of indices for the second term
   * @param maxDistance Maximum word distance allowed
   * @param content The text content
   * @param filePath Optional file path for circuit breaker tracking
   * @returns True if any pair is within the specified distance
   */
  private checkProximityOptimized(
    indices1: number[],
    indices2: number[],
    maxDistance: number,
    content: string,
    filePath?: string
  ): boolean {
    const profiler = getProfiler();
    const profileId = profiler.start(
      "NearOperatorService.checkProximityOptimized",
      {
        indices1Count: indices1.length,
        indices2Count: indices2.length,
        maxDistance,
        contentLength: content.length,
      }
    );

    const startTime = performance.now();

    // For very large content, use chunked processing
    if (content.length > MAX_FULL_CONTENT_SIZE) {
      const result = this.checkProximityChunked(
        indices1,
        indices2,
        maxDistance,
        content
      );
      profiler.end(profileId, { chunkedProcessing: true, result });
      return result;
    }

    // Early termination optimization: character distance pre-check
    if (indices1.length > 5 && indices2.length > 5) {
      const avgWordLength = 6;
      const maxCharDistance = maxDistance * avgWordLength * 2;

      if (
        !this.areAnyIndicesWithinDistance(indices1, indices2, maxCharDistance)
      ) {
        this.metrics.earlyTerminations++;
        profiler.end(profileId, { earlyTermination: true });
        return false;
      }
    }

    // Use optimized two-pointer algorithm for better performance
    const result = this.checkProximityTwoPointer(
      indices1,
      indices2,
      maxDistance,
      content,
      startTime,
      filePath
    );

    profiler.end(profileId, {
      result,
      algorithm: "two-pointer",
      executionTime: performance.now() - startTime,
    });

    return result;
  }

  /**
   * Two-pointer algorithm for efficient proximity checking
   * @param indices1 Sorted array of indices for the first term
   * @param indices2 Sorted array of indices for the second term
   * @param maxDistance Maximum word distance allowed
   * @param content The text content
   * @param startTime Start time for timeout checking
   * @param filePath Optional file path for circuit breaker tracking
   * @returns True if any pair is within the specified distance
   */
  private checkProximityTwoPointer(
    indices1: number[],
    indices2: number[],
    maxDistance: number,
    content: string,
    startTime: number,
    filePath?: string
  ): boolean {
    // Use memory pooling for word indices arrays
    const wordIndices1 = this.getPooledArray(indices1.length);
    const wordIndices2 = this.getPooledArray(indices2.length);

    try {
      // Pre-calculate word indices for better performance
      let validIndices1 = 0;
      let validIndices2 = 0;

      // Calculate word indices for first term with timeout checking
      for (let i = 0; i < indices1.length; i++) {
        if (performance.now() - startTime > MAX_EXECUTION_TIME_MS) {
          // Record timeout for circuit breaker if filePath is provided
          if (filePath) {
            this.recordFileTimeout(filePath);
          }
          return false; // Timeout
        }

        const wordIndex = this.wordBoundaryService.getWordIndexFromCharIndex(
          indices1[i],
          content
        );
        if (wordIndex !== -1) {
          wordIndices1[validIndices1] = wordIndex;
          validIndices1++;
        }
      }

      // Calculate word indices for second term with timeout checking
      for (let i = 0; i < indices2.length; i++) {
        if (performance.now() - startTime > MAX_EXECUTION_TIME_MS) {
          // Record timeout for circuit breaker if filePath is provided
          if (filePath) {
            this.recordFileTimeout(filePath);
          }
          return false; // Timeout
        }

        const wordIndex = this.wordBoundaryService.getWordIndexFromCharIndex(
          indices2[i],
          content
        );
        if (wordIndex !== -1) {
          wordIndices2[validIndices2] = wordIndex;
          validIndices2++;
        }
      }

      // Two-pointer algorithm for proximity checking
      let i = 0,
        j = 0;
      while (i < validIndices1 && j < validIndices2) {
        if (performance.now() - startTime > MAX_EXECUTION_TIME_MS) {
          // Record timeout for circuit breaker if filePath is provided
          if (filePath) {
            this.recordFileTimeout(filePath);
          }
          return false; // Timeout
        }

        const wordDist = Math.abs(wordIndices1[i] - wordIndices2[j]);
        if (wordDist <= maxDistance) {
          return true; // Found a match within distance
        }

        // Move the pointer that will potentially reduce the distance
        if (wordIndices1[i] < wordIndices2[j]) {
          i++;
        } else {
          j++;
        }
      }

      return false;
    } finally {
      // Return arrays to pool
      this.returnArrayToPool(wordIndices1);
      this.returnArrayToPool(wordIndices2);
    }
  }

  /**
   * Chunked processing for very large content to prevent memory issues
   * @param indices1 Sorted array of indices for the first term
   * @param indices2 Sorted array of indices for the second term
   * @param maxDistance Maximum word distance allowed
   * @param content The text content
   * @returns True if any pair is within the specified distance
   */
  private checkProximityChunked(
    indices1: number[],
    indices2: number[],
    maxDistance: number,
    content: string
  ): boolean {
    // For very large content, process in chunks to avoid memory issues
    for (
      let start = 0;
      start < content.length;
      start += CHUNK_SIZE - CHUNK_OVERLAP
    ) {
      const end = Math.min(start + CHUNK_SIZE, content.length);
      const chunk = content.substring(start, end);

      // Filter indices that fall within this chunk
      const chunkIndices1 = indices1
        .filter((idx) => idx >= start && idx < end)
        .map((idx) => idx - start);
      const chunkIndices2 = indices2
        .filter((idx) => idx >= start && idx < end)
        .map((idx) => idx - start);

      if (chunkIndices1.length > 0 && chunkIndices2.length > 0) {
        const chunkResult = this.checkProximityTwoPointer(
          chunkIndices1,
          chunkIndices2,
          maxDistance,
          chunk,
          performance.now()
        );

        if (chunkResult) {
          return true;
        }
      }
    }

    return false;
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
    // Use optimized content fingerprinting
    const contentFingerprint = this.getContentFingerprint(content);

    // Convert term to string representation
    const termStr =
      isRegex && term instanceof RegExp
        ? `${term.source}:${term.flags}`
        : String(term);

    return `${contentFingerprint}:${termStr}:${caseSensitive}:${isRegex}:${useWholeWordMatching}`;
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
    // Use optimized content fingerprinting
    const contentFingerprint = this.getContentFingerprint(content);

    // Convert terms to string representations
    const term1Str =
      term1 instanceof RegExp
        ? `${term1.source}:${term1.flags}`
        : String(term1);

    const term2Str =
      term2 instanceof RegExp
        ? `${term2.source}:${term2.flags}`
        : String(term2);

    return `${contentFingerprint}:${term1Str}:${term2Str}:${distance}:${options.caseSensitive}:${options.fuzzySearchEnabled}:${options.wholeWordMatchingEnabled}`;
  }

  /**
   * Optimized content fingerprinting using crypto hash for better cache keys
   * @param content The content to fingerprint
   * @returns A content fingerprint string
   */
  private getContentFingerprint(content: string): string {
    // Check cache first
    const cached = this.contentFingerprintCache.get(content);
    if (cached) {
      return cached;
    }

    // For small content, use simple hash
    if (content.length < 1000) {
      const fingerprint = this.hashString(content);
      this.contentFingerprintCache.set(content, fingerprint);
      return fingerprint;
    }

    // For larger content, use crypto hash of a sample
    const sample =
      content.substring(0, 500) +
      content.substring(
        Math.floor(content.length / 2),
        Math.floor(content.length / 2) + 500
      ) +
      content.substring(content.length - 500);

    const fingerprint = crypto
      .createHash("md5")
      .update(sample)
      .digest("hex")
      .substring(0, 16);
    this.contentFingerprintCache.set(content, fingerprint);
    return fingerprint;
  }

  /**
   * Simple string hashing function (fallback for small content)
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
      void this.saveProfilingData();
    }
  }

  /**
   * Updates phase-specific metrics
   * @param phase The algorithm phase to update metrics for
   * @param processingTime Processing time in milliseconds
   */
  private updatePhaseMetrics(
    phase: keyof typeof this.metrics.phaseMetrics,
    processingTime: number
  ): void {
    const phaseMetric = this.metrics.phaseMetrics[phase];
    phaseMetric.totalTime += processingTime;
    phaseMetric.count++;
    phaseMetric.averageTime = phaseMetric.totalTime / phaseMetric.count;
  }

  /**
   * Updates memory usage metrics
   * @param currentMemoryUsage Current memory usage in MB
   */
  private updateMemoryMetrics(currentMemoryUsage: number): void {
    // Update peak memory usage
    if (currentMemoryUsage > this.metrics.memoryMetrics.peakMemoryUsage) {
      this.metrics.memoryMetrics.peakMemoryUsage = currentMemoryUsage;
    }

    // Calculate memory delta if we have previous measurements
    if (this.metrics.memoryMetrics.measurementCount > 0) {
      const memoryDelta =
        currentMemoryUsage - this.metrics.memoryMetrics.peakMemoryUsage;
      this.metrics.memoryMetrics.totalMemoryDelta += memoryDelta;
      this.metrics.memoryMetrics.averageMemoryDelta =
        this.metrics.memoryMetrics.totalMemoryDelta /
        this.metrics.memoryMetrics.measurementCount;
    }

    this.metrics.memoryMetrics.measurementCount++;
  }

  /**
   * Updates content size metrics
   * @param contentSize Size of the content in characters
   */
  private updateContentSizeMetrics(contentSize: number): void {
    this.metrics.contentSizeMetrics.totalContentSize += contentSize;
    this.metrics.contentSizeMetrics.contentCount++;

    if (contentSize > this.metrics.contentSizeMetrics.maxContentSize) {
      this.metrics.contentSizeMetrics.maxContentSize = contentSize;
    }

    if (contentSize < this.metrics.contentSizeMetrics.minContentSize) {
      this.metrics.contentSizeMetrics.minContentSize = contentSize;
    }

    this.metrics.contentSizeMetrics.averageContentSize =
      this.metrics.contentSizeMetrics.totalContentSize /
      this.metrics.contentSizeMetrics.contentCount;
  }

  /**
   * Save profiling data to a file for analysis
   */
  private async saveProfilingData(): Promise<void> {
    try {
      const profiler = getProfiler();
      if (profiler.isEnabled()) {
        const timestamp = new Date().toISOString().replace(/:/g, "-");
        const reportPath = path.resolve(
          process.cwd(),
          "performance-results",
          `near-operator-profile-${timestamp}.json`
        );

        // Ensure directory exists
        const dirPath = path.dirname(reportPath);
        try {
          await fs.mkdir(dirPath, { recursive: true });
        } catch (_err) {
          // Directory might already exist, ignore error
        }

        // Save detailed metrics alongside the profiler report
        const detailedMetricsPath = path.resolve(
          process.cwd(),
          "performance-results",
          `near-operator-metrics-${timestamp}.json`
        );

        // Save detailed metrics
        await fs.writeFile(
          detailedMetricsPath,
          JSON.stringify(
            {
              timestamp: new Date().toISOString(),
              metrics: this.metrics,
              cacheStats: {
                termIndicesCache: this.termIndicesCache.getStats(),
                proximityCache: this.proximityCache.getStats(),
              },
            },
            null,
            2
          ),
          "utf8"
        );

        // Save the profiler report with metrics history
        await profiler.saveReport(reportPath, true);

        this.logger.debug(
          `NearOperatorService profile saved to ${reportPath} and metrics to ${detailedMetricsPath}`
        );
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
      contentFingerprintCache: this.contentFingerprintCache.getStats(),
      memoryPoolStats: {
        totalPools: this.pooledArraySizes.size,
        poolSizes: Array.from(this.pooledArraySizes.entries()).map(
          ([size, pool]) => ({
            size,
            available: pool.length,
          })
        ),
      },
    };
  }

  /**
   * Clear performance metrics for testing
   */
  public clearMetrics(): void {
    this.metrics = {
      totalEvaluations: 0,
      cacheHits: 0,
      cacheMisses: 0,
      averageEvaluationTime: 0,
      totalEvaluationTime: 0,
      earlyTerminations: 0,
      phaseMetrics: {
        termIndicesCalculation: {
          totalTime: 0,
          count: 0,
          averageTime: 0,
        },
        fuzzySearch: {
          totalTime: 0,
          count: 0,
          averageTime: 0,
          successCount: 0,
        },
        proximityCheck: {
          totalTime: 0,
          count: 0,
          averageTime: 0,
        },
        wordBoundaryCalculation: {
          totalTime: 0,
          count: 0,
          averageTime: 0,
        },
      },
      memoryMetrics: {
        peakMemoryUsage: 0,
        averageMemoryDelta: 0,
        totalMemoryDelta: 0,
        measurementCount: 0,
      },
      contentSizeMetrics: {
        totalContentSize: 0,
        maxContentSize: 0,
        minContentSize: Number.MAX_VALUE,
        contentCount: 0,
        averageContentSize: 0,
      },
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

  /**
   * Initialize memory pools for array reuse
   */
  private initializeMemoryPools(): void {
    // Pre-populate pools with common array sizes
    const commonSizes = [10, 50, 100, 200, 500];
    for (const size of commonSizes) {
      const pool: number[][] = [];
      for (
        let i = 0;
        i < Math.min(ARRAY_POOL_SIZE / commonSizes.length, 10);
        i++
      ) {
        pool.push(new Array<number>(size).fill(0));
      }
      this.pooledArraySizes.set(size, pool);
    }
  }

  /**
   * Get a reusable array from the pool
   * @param size Approximate size needed
   * @returns A reusable array
   */
  private getPooledArray(size: number): number[] {
    if (size > MAX_POOLED_ARRAY_SIZE) {
      return new Array<number>(size).fill(0);
    }

    // Find the closest pool size
    let bestSize = size;
    for (const poolSize of this.pooledArraySizes.keys()) {
      if (poolSize >= size && poolSize < bestSize * 2) {
        bestSize = poolSize;
        break;
      }
    }

    const pool = this.pooledArraySizes.get(bestSize);
    if (pool && pool.length > 0) {
      const array = pool.pop()!;
      array.length = 0; // Clear the array
      return array;
    }

    return new Array<number>(size).fill(0);
  }

  /**
   * Return an array to the pool for reuse
   * @param array The array to return
   */
  private returnArrayToPool(array: number[]): void {
    if (array.length > MAX_POOLED_ARRAY_SIZE) {
      return; // Don't pool very large arrays
    }

    // Find appropriate pool
    let poolSize = array.length;
    for (const size of this.pooledArraySizes.keys()) {
      if (size >= array.length) {
        poolSize = size;
        break;
      }
    }

    const pool = this.pooledArraySizes.get(poolSize);
    if (pool && pool.length < ARRAY_POOL_SIZE / this.pooledArraySizes.size) {
      array.length = 0; // Clear the array
      pool.push(array);
    }
  }
}
