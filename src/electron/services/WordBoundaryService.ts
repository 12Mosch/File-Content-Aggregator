/**
 * WordBoundaryService
 *
 * A highly optimized service for managing word boundaries in text content.
 * This service implements advanced caching and efficient algorithms to
 * minimize memory usage and maximize performance for word boundary operations.
 */

import { LRUCache } from "../../lib/LRUCache.js";
import { CacheManager } from "../../lib/CacheManager.js";
import { Logger } from "../../lib/services/Logger.js";

export interface WordBoundary {
  word: string;
  start: number;
  end: number;
}

// Constants for performance tuning
const BOUNDARIES_CACHE_SIZE = 100;
const BOUNDARIES_CACHE_TTL = 10 * 60 * 1000; // 10 minutes
const WORD_INDEX_CACHE_SIZE = 2000; // Increased cache size for better hit rate
const WORD_INDEX_CACHE_TTL = 10 * 60 * 1000; // Increased TTL to match boundaries cache

export class WordBoundaryService {
  private static instance: WordBoundaryService;
  private logger: Logger;

  // Caches for performance optimization
  private boundariesCache: LRUCache<string, WordBoundary[]>;
  private wordIndexCache: LRUCache<string, number>;

  // Content fingerprint cache for efficient cache key generation
  private contentFingerprintCache: LRUCache<string, string>;

  // Performance metrics
  private metrics = {
    totalBoundaryCalculations: 0,
    totalWordIndexLookups: 0,
    cacheHits: 0,
    cacheMisses: 0,
    averageCalculationTime: 0,
    totalCalculationTime: 0,
  };

  // Private constructor for singleton pattern
  private constructor() {
    this.logger = Logger.getInstance();

    // Initialize caches
    const cacheManager = CacheManager.getInstance();

    this.boundariesCache = cacheManager.getOrCreateCache<
      string,
      WordBoundary[]
    >("wordBoundaries", {
      maxSize: BOUNDARIES_CACHE_SIZE,
      timeToLive: BOUNDARIES_CACHE_TTL,
      name: "Word Boundaries",
    });

    this.wordIndexCache = cacheManager.getOrCreateCache<string, number>(
      "wordIndices",
      {
        maxSize: WORD_INDEX_CACHE_SIZE,
        timeToLive: WORD_INDEX_CACHE_TTL,
        name: "Word Indices",
      }
    );

    this.contentFingerprintCache = cacheManager.getOrCreateCache<
      string,
      string
    >("contentFingerprints", {
      maxSize: 200,
      timeToLive: WORD_INDEX_CACHE_TTL,
      name: "Content Fingerprints",
    });

    this.logger.debug("WordBoundaryService initialized with optimized caching");
  }

  /**
   * Gets the singleton instance of WordBoundaryService
   * @returns The WordBoundaryService instance
   */
  public static getInstance(): WordBoundaryService {
    if (!WordBoundaryService.instance) {
      WordBoundaryService.instance = new WordBoundaryService();
    }
    return WordBoundaryService.instance;
  }

  /**
   * Gets word boundaries for the given content with optimized performance
   * @param content The text content to analyze
   * @returns An array of WordBoundary objects
   */
  public getWordBoundaries(content: string): WordBoundary[] {
    const startTime = performance.now();
    this.metrics.totalBoundaryCalculations++;

    // Quick rejection for invalid inputs
    if (!content || content.length === 0) {
      return [];
    }

    // For very short content, calculate directly without caching
    if (content.length < 20) {
      return this.calculateWordBoundaries(content);
    }

    // Generate a hash of the content to use as a cache key
    const contentHash = this.hashString(content);

    // Check if boundaries are already cached
    const cachedBoundaries = this.boundariesCache.get(contentHash);
    if (cachedBoundaries) {
      this.metrics.cacheHits++;
      return cachedBoundaries;
    }

    this.metrics.cacheMisses++;

    // Calculate word boundaries
    const boundaries = this.calculateWordBoundariesOptimized(content);

    // Cache the result
    this.boundariesCache.set(contentHash, boundaries);

    const endTime = performance.now();
    this.updateMetrics(endTime - startTime);

    return boundaries;
  }

  /**
   * Finds the word index corresponding to a character index with optimized performance
   * @param charIndex The character index
   * @param content The text content
   * @returns The word index (0-based) or -1 if not found
   */
  public getWordIndexFromCharIndex(charIndex: number, content: string): number {
    this.metrics.totalWordIndexLookups++;

    // Quick rejection for invalid inputs
    if (charIndex < 0 || !content || charIndex >= content.length) {
      return -1;
    }

    // Generate cache key for word index lookup using content fingerprint
    const contentFingerprint = this.getContentFingerprint(content);
    const cacheKey = `${contentFingerprint}:${charIndex}`;

    // Check if word index is already cached
    const cachedIndex = this.wordIndexCache.get(cacheKey);
    if (cachedIndex !== undefined) {
      this.metrics.cacheHits++;
      return cachedIndex;
    }

    this.metrics.cacheMisses++;

    // Get word boundaries
    const boundaries = this.getWordBoundaries(content);

    // Use binary search for large boundary arrays
    if (boundaries.length > 20) {
      const index = this.binarySearchWordIndex(boundaries, charIndex, content);
      this.wordIndexCache.set(cacheKey, index);
      return index;
    }

    // For smaller arrays, use linear search
    // Check if charIndex falls directly within a word boundary
    for (let i = 0; i < boundaries.length; i++) {
      if (charIndex >= boundaries[i].start && charIndex <= boundaries[i].end) {
        this.wordIndexCache.set(cacheKey, i);
        return i;
      }
    }

    // If not directly within, check if it's immediately after a word (separated by whitespace)
    // This helps associate indices in whitespace with the preceding word for distance calculation
    for (let i = boundaries.length - 1; i >= 0; i--) {
      if (boundaries[i].end < charIndex) {
        // Check if the space between the word end and charIndex is only whitespace
        if (
          /^\s*$/.test(content.substring(boundaries[i].end + 1, charIndex + 1))
        ) {
          this.wordIndexCache.set(cacheKey, i);
          return i; // Associate with the preceding word
        }
        // If non-whitespace is found, stop searching backwards
        break;
      }
    }

    // If charIndex is before the first word or in non-whitespace before it
    this.wordIndexCache.set(cacheKey, -1);
    return -1;
  }

  /**
   * Calculates the word distance between two character indices
   * @param index1 The first character index
   * @param index2 The second character index
   * @param content The text content
   * @returns The word distance or -1 if indices are not associated with words
   */
  public getWordDistance(
    index1: number,
    index2: number,
    content: string
  ): number {
    const wordIndex1 = this.getWordIndexFromCharIndex(index1, content);
    const wordIndex2 = this.getWordIndexFromCharIndex(index2, content);

    if (wordIndex1 === -1 || wordIndex2 === -1) {
      return -1;
    }

    return Math.abs(wordIndex1 - wordIndex2);
  }

  /**
   * Clears the boundaries cache
   */
  public clearCache(): void {
    this.boundariesCache.clear();
  }

  /**
   * Removes a specific content from the cache
   * @param content The content to remove
   */
  public removeFromCache(content: string): void {
    const contentHash = this.hashString(content);
    this.boundariesCache.delete(contentHash);
  }

  /**
   * Gets statistics about the cache
   */
  public getCacheStats() {
    return this.boundariesCache.getStats();
  }

  /**
   * Checks if a term is a whole word match in the content
   * @param content The content to search in
   * @param term The term to search for
   * @param wordBoundaries The word boundaries in the content
   * @param caseSensitive Whether to use case-sensitive matching
   * @returns Whether the term is a whole word match
   */
  public isWholeWordMatch(
    content: string,
    term: string,
    wordBoundaries: WordBoundary[],
    caseSensitive = false
  ): boolean {
    // Use regex with word boundaries for whole word matching
    const flags = caseSensitive ? "g" : "gi";
    const wordBoundaryRegex = new RegExp(
      `\\b${this.escapeRegExp(term)}\\b`,
      flags
    );
    return wordBoundaryRegex.test(content);
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
   * Binary search to find the word index for a character index
   * @param boundaries Word boundaries array
   * @param charIndex Character index to find
   * @param content Original content for whitespace checking
   * @returns Word index or -1 if not found
   */
  private binarySearchWordIndex(
    boundaries: WordBoundary[],
    charIndex: number,
    content: string
  ): number {
    // First check if charIndex falls directly within any word boundary
    let left = 0;
    let right = boundaries.length - 1;

    while (left <= right) {
      const mid = Math.floor((left + right) / 2);
      const boundary = boundaries[mid];

      if (charIndex < boundary.start) {
        right = mid - 1;
      } else if (charIndex > boundary.end) {
        left = mid + 1;
      } else {
        // Found direct match
        return mid;
      }
    }

    // If not found directly, check if it's in whitespace after a word
    // At this point, 'left' is the insertion point
    // We need to check the word before the insertion point
    if (left > 0) {
      const prevBoundary = boundaries[left - 1];
      if (prevBoundary.end < charIndex) {
        // Check if the space between the word end and charIndex is only whitespace
        if (
          /^\s*$/.test(content.substring(prevBoundary.end + 1, charIndex + 1))
        ) {
          return left - 1; // Associate with the preceding word
        }
      }
    }

    return -1;
  }

  /**
   * Calculates word boundaries for the given content
   * @param content The text content to analyze
   * @returns An array of WordBoundary objects
   */
  private calculateWordBoundaries(content: string): WordBoundary[] {
    const boundaries: WordBoundary[] = [];

    // Use a more efficient regex that matches words in a single pass
    // This regex matches sequences of word characters (alphanumeric + underscore)
    const wordRegex = /\b\w+\b/g;

    let match;
    while ((match = wordRegex.exec(content)) !== null) {
      boundaries.push({
        word: match[0],
        start: match.index,
        end: match.index + match[0].length - 1,
      });

      // Prevent infinite loops with zero-width matches
      if (match.index === wordRegex.lastIndex) {
        wordRegex.lastIndex++;
      }
    }

    return boundaries;
  }

  /**
   * Optimized version of calculateWordBoundaries for better performance
   * @param content The text content to analyze
   * @returns An array of WordBoundary objects
   */
  private calculateWordBoundariesOptimized(content: string): WordBoundary[] {
    // For very large content, use a chunking approach
    if (content.length > 100000) {
      return this.calculateWordBoundariesChunked(content);
    }

    const boundaries: WordBoundary[] = [];

    // Use a more efficient regex that matches words in a single pass
    // This regex matches sequences of word characters (alphanumeric + underscore)
    // and includes some additional Unicode word characters
    const wordRegex = /\b[\w\u00C0-\u00FF]+\b/g;

    let match;
    while ((match = wordRegex.exec(content)) !== null) {
      // Skip very short words (usually not meaningful)
      if (match[0].length > 1) {
        boundaries.push({
          word: match[0],
          start: match.index,
          end: match.index + match[0].length - 1,
        });
      }

      // Prevent infinite loops with zero-width matches
      if (match.index === wordRegex.lastIndex) {
        wordRegex.lastIndex++;
      }
    }

    return boundaries;
  }

  /**
   * Calculates word boundaries for very large content by chunking
   * @param content The text content to analyze
   * @returns An array of WordBoundary objects
   */
  private calculateWordBoundariesChunked(content: string): WordBoundary[] {
    const boundaries: WordBoundary[] = [];
    const chunkSize = 50000; // Process 50KB at a time

    for (let i = 0; i < content.length; i += chunkSize) {
      const chunk = content.substring(i, i + chunkSize);

      // Use the same regex as in calculateWordBoundariesOptimized
      const wordRegex = /\b[\w\u00C0-\u00FF]+\b/g;

      let match;
      while ((match = wordRegex.exec(chunk)) !== null) {
        // Skip very short words (usually not meaningful)
        if (match[0].length > 1) {
          boundaries.push({
            word: match[0],
            start: i + match.index, // Adjust index for the chunk offset
            end: i + match.index + match[0].length - 1,
          });
        }

        // Prevent infinite loops with zero-width matches
        if (match.index === wordRegex.lastIndex) {
          wordRegex.lastIndex++;
        }
      }
    }

    return boundaries;
  }

  /**
   * Gets a content fingerprint for efficient cache key generation
   * Uses a smaller sample of the content to create a stable fingerprint
   * @param content The content to fingerprint
   * @returns A fingerprint string
   */
  private getContentFingerprint(content: string): string {
    // Check if we already have a fingerprint for this content
    const cachedFingerprint = this.contentFingerprintCache.get(content);
    if (cachedFingerprint) {
      return cachedFingerprint;
    }

    // For small content, use the full content as fingerprint
    if (content.length <= 100) {
      const fingerprint = this.hashString(content);
      this.contentFingerprintCache.set(content, fingerprint);
      return fingerprint;
    }

    // For larger content, create a fingerprint from strategic samples
    const sampleSize = Math.min(200, Math.floor(content.length / 10));
    const start = content.substring(0, sampleSize);
    const middle = content.substring(
      Math.floor(content.length / 2) - sampleSize / 2,
      Math.floor(content.length / 2) + sampleSize / 2
    );
    const end = content.substring(content.length - sampleSize);

    const sample = start + middle + end + content.length.toString();
    const fingerprint = this.hashString(sample);

    this.contentFingerprintCache.set(content, fingerprint);
    return fingerprint;
  }

  /**
   * Simple string hashing function
   * @param str The string to hash
   * @returns A hash string
   */
  private hashString(str: string): string {
    // For very large strings, use a sample to generate the hash
    // This improves performance while still providing a good hash distribution
    const maxSampleLength = 1000;
    const sampleStr =
      str.length > maxSampleLength
        ? str.substring(0, maxSampleLength / 2) +
          str.substring(str.length - maxSampleLength / 2)
        : str;

    let hash = 0;
    for (let i = 0; i < sampleStr.length; i++) {
      const char = sampleStr.charCodeAt(i);
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
    this.metrics.totalCalculationTime += processingTime;
    this.metrics.averageCalculationTime =
      this.metrics.totalCalculationTime /
      this.metrics.totalBoundaryCalculations;

    // Log performance metrics periodically
    if (this.metrics.totalBoundaryCalculations % 100 === 0) {
      this.logger.debug("WordBoundaryService performance metrics", {
        ...this.metrics,
        cacheHitRate:
          this.metrics.cacheHits /
            (this.metrics.cacheHits + this.metrics.cacheMisses) || 0,
        boundariesCache: this.boundariesCache.getStats(),
        wordIndexCache: this.wordIndexCache.getStats(),
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
        this.metrics.cacheHits /
          (this.metrics.cacheHits + this.metrics.cacheMisses) || 0,
      boundariesCache: this.boundariesCache.getStats(),
      wordIndexCache: this.wordIndexCache.getStats(),
    };
  }
}
