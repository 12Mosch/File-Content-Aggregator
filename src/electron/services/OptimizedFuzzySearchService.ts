/**
 * OptimizedFuzzySearchService
 *
 * An optimized service for performing fuzzy searches with improved performance.
 * This service uses a more efficient approach to fuzzy matching with smart
 * early termination and optimized caching.
 */

import { LRUCache } from "../../lib/LRUCache.js";
import { Logger } from "../../lib/services/Logger.js";
import { getProfiler } from "../../lib/utils/Profiler.js";
import Fuse from "fuse.js";

// Constants for optimization
const MIN_TERM_LENGTH = 3;
const MATCH_THRESHOLD = 0.4;
const RESULT_CACHE_SIZE = 2000; // Increased cache size for better hit rates
const NORMALIZED_STRING_CACHE_SIZE = 1000;
const MAX_CONTENT_LENGTH_FOR_FUSE = 10000; // Limit for using Fuse.js

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

// Interface for cache statistics
export interface CacheStatistics {
  resultCache: {
    size: number;
  };
  normalizedStringCache: {
    size: number;
  };
  fuseInstances: {
    size: number;
  };
}

interface FuzzySearchMetrics {
  totalSearches: number;
  cacheHits: number;
  cacheMisses: number;
  exactMatches: number;
  fuzzyMatches: number;
  noMatches: number;
  averageProcessingTime: number;
  totalProcessingTime: number;
}

/**
 * Optimized implementation of fuzzy search service
 */
export class OptimizedFuzzySearchService {
  private resultCache: LRUCache<string, FuzzySearchResult>;
  private metrics: FuzzySearchMetrics;
  private logger: Logger;
  private profiler = getProfiler();

  // Pre-initialize Fuse.js instance for common configurations
  private readonly fuseInstances: Map<string, Fuse<string>>;

  constructor() {
    this.resultCache = new LRUCache<string, FuzzySearchResult>(
      RESULT_CACHE_SIZE
    );
    this.fuseInstances = new Map();
    this.logger = Logger.getInstance();
    this.metrics = {
      totalSearches: 0,
      cacheHits: 0,
      cacheMisses: 0,
      exactMatches: 0,
      fuzzyMatches: 0,
      noMatches: 0,
      averageProcessingTime: 0,
      totalProcessingTime: 0,
    };
  }

  /**
   * Performs a fuzzy search with optimized performance
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
    const profileId = this.profiler.start(
      "OptimizedFuzzySearchService.search",
      {
        contentLength: content.length,
        termLength: term.length,
      }
    );

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
      this.profiler.end(profileId);
      return { isMatch: false, processingTimeMs: 0 };
    }

    // Skip fuzzy search for very short terms
    if (term.length < MIN_TERM_LENGTH) {
      // For very short terms, just do a simple string search
      const isMatch = this.performExactSearch(
        content,
        term,
        isCaseSensitive,
        useWholeWordMatching
      );

      const result: FuzzySearchResult = {
        isMatch,
        processingTimeMs: performance.now() - startTime,
      };

      if (isMatch) {
        this.metrics.exactMatches++;
        // Add match positions for exact matches
        if (includeScore) {
          result.matchPositions = this.findExactMatchPositions(
            content,
            term,
            isCaseSensitive,
            useWholeWordMatching
          );
        }
      } else {
        this.metrics.noMatches++;
      }

      this.profiler.end(profileId);
      return result;
    }

    // Generate cache key based on content hash, term, and options
    const cacheKey = this.generateCacheKey(content, term, options);

    // Check result cache first
    const cachedResult = this.resultCache.get(cacheKey);
    if (cachedResult) {
      this.metrics.cacheHits++;
      this.profiler.end(profileId);
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
      this.metrics.exactMatches++;

      const endTime = performance.now();
      const processingTime = endTime - startTime;
      this.updateMetrics(processingTime);

      this.profiler.end(profileId);
      return {
        ...exactMatchResult,
        processingTimeMs: processingTime,
      };
    }

    // Optimization: For large content, use a more efficient approach
    if (content.length > MAX_CONTENT_LENGTH_FOR_FUSE) {
      const result = this.performOptimizedFuzzySearch(
        content,
        term,
        isCaseSensitive,
        useWholeWordMatching,
        includeScore
      );

      // Cache the result
      this.resultCache.set(cacheKey, result);

      const endTime = performance.now();
      const processingTime = endTime - startTime;
      this.updateMetrics(processingTime);

      if (result.isMatch) {
        this.metrics.fuzzyMatches++;
      } else {
        this.metrics.noMatches++;
      }

      this.profiler.end(profileId);
      return {
        ...result,
        processingTimeMs: processingTime,
      };
    }

    try {
      // Get or create a Fuse instance with optimized settings
      const fuseOptions = {
        includeScore,
        threshold,
        ignoreLocation: true,
        useExtendedSearch: false, // Disable extended search for performance
        ignoreFieldNorm: true,
        isCaseSensitive,
        // Optimized settings
        distance: Math.min(100, Math.max(10, Math.floor(term.length * 2))), // Dynamic distance based on term length
        findAllMatches: false,
        minMatchCharLength: Math.max(2, Math.floor(term.length * 0.6)), // Require more matching characters
        location: 0,
        shouldSort: false, // Don't sort results (we only need to know if there's a match)
      };

      // Generate a configuration key for the fuse instance
      const configKey = JSON.stringify({
        threshold,
        isCaseSensitive,
        includeScore,
      });

      // Get or create a Fuse instance
      let fuse = this.fuseInstances.get(configKey);

      if (!fuse) {
        // Create a new Fuse instance if not in cache
        fuse = new Fuse([""], fuseOptions);
        this.fuseInstances.set(configKey, fuse);
      }

      // Set the new content
      fuse.setCollection([content]);

      // Perform the search
      const searchResults = fuse.search(term);

      // Process the results
      let result: FuzzySearchResult;

      if (
        searchResults.length > 0 &&
        searchResults[0]?.score !== undefined &&
        searchResults[0].score < 0.6
      ) {
        // Found a match
        result = {
          isMatch: true,
          score: searchResults[0].score,
        };

        // Find match positions if needed
        if (includeScore) {
          result.matchPositions = this.findOptimizedMatchPositions(
            content,
            term,
            isCaseSensitive,
            useWholeWordMatching
          );
        }

        // If whole word matching is enabled, verify it's a whole word
        if (useWholeWordMatching && result.isMatch) {
          result.isMatch = this.isWholeWordMatch(
            content,
            term,
            isCaseSensitive
          );
        }

        this.metrics.fuzzyMatches++;
      } else {
        // No match found
        result = {
          isMatch: false,
          score: searchResults.length > 0 ? searchResults[0].score : 1.0,
        };

        this.metrics.noMatches++;
      }

      // Cache the result
      this.resultCache.set(cacheKey, result);

      const endTime = performance.now();
      const processingTime = endTime - startTime;
      this.updateMetrics(processingTime);

      this.profiler.end(profileId);
      return {
        ...result,
        processingTimeMs: processingTime,
      };
    } catch (error) {
      this.logger.error("Error in fuzzy search:", { error });

      const result: FuzzySearchResult = {
        isMatch: false,
        processingTimeMs: performance.now() - startTime,
      };

      this.profiler.end(profileId);
      return result;
    }
  }

  /**
   * Normalizes a string based on case sensitivity
   * Uses simple caching for better performance
   */
  private normalizeString(str: string, isCaseSensitive: boolean): string {
    if (isCaseSensitive) return str;

    // For very short strings, just convert directly
    if (str.length < 10) return str.toLowerCase();

    // Use a simple cache key
    const cacheKey = str.length < 100 ? str : str.substring(0, 50) + str.length;

    // Check cache
    if (this.normalizedStringCache.has(cacheKey)) {
      return this.normalizedStringCache.get(cacheKey)!;
    }

    const normalized = str.toLowerCase();

    // Cache the result
    this.normalizedStringCache.set(cacheKey, normalized);

    // Manage cache size with a simple approach
    if (this.normalizedStringCache.size > NORMALIZED_STRING_CACHE_SIZE) {
      // Clear half the cache when it gets too large
      const keys = Array.from(this.normalizedStringCache.keys());
      for (let i = 0; i < keys.length / 2; i++) {
        this.normalizedStringCache.delete(keys[i]);
      }
    }

    return normalized;
  }

  /**
   * Performs an exact search (non-fuzzy)
   */
  private performExactSearch(
    content: string,
    term: string,
    isCaseSensitive: boolean,
    useWholeWordMatching: boolean
  ): boolean {
    if (useWholeWordMatching) {
      const pattern = `\\b${this.escapeRegExp(term)}\\b`;
      const flags = isCaseSensitive ? "g" : "gi";
      const wordBoundaryRegex = this.getRegExp(pattern, flags);
      return wordBoundaryRegex.test(content);
    } else {
      if (isCaseSensitive) {
        return content.includes(term);
      } else {
        // Use normalized strings for case-insensitive search
        const normalizedContent = this.normalizeString(
          content,
          isCaseSensitive
        );
        const normalizedTerm = this.normalizeString(term, isCaseSensitive);
        return normalizedContent.includes(normalizedTerm);
      }
    }
  }

  /**
   * Checks for an exact match with optimized performance
   */
  private checkExactMatch(
    content: string,
    term: string,
    isCaseSensitive: boolean,
    useWholeWordMatching: boolean
  ): FuzzySearchResult | null {
    // Normalize content and term based on case sensitivity
    const normalizedContent = this.normalizeString(content, isCaseSensitive);
    const normalizedTerm = this.normalizeString(term, isCaseSensitive);

    // Check for exact match
    if (useWholeWordMatching) {
      // Create a RegExp object with the word boundary pattern
      const regexPattern = `\\b${this.escapeRegExp(normalizedTerm)}\\b`;
      const flags = isCaseSensitive ? "g" : "g";

      // Use a cached RegExp
      const wordBoundaryRegex = this.getRegExp(regexPattern, flags);

      if (wordBoundaryRegex.test(normalizedContent)) {
        // Find all matches
        const matches: number[] = [];
        let match;

        // Reset regex
        wordBoundaryRegex.lastIndex = 0;

        while ((match = wordBoundaryRegex.exec(normalizedContent)) !== null) {
          matches.push(match.index);
        }

        return {
          isMatch: true,
          score: 0, // Perfect match
          matchPositions: matches,
        };
      }
    } else {
      // For non-word-boundary matches, use string.indexOf for better performance
      const index = normalizedContent.indexOf(normalizedTerm);

      if (index !== -1) {
        // Find all occurrences
        const matches: number[] = [];
        let pos = 0;

        while ((pos = normalizedContent.indexOf(normalizedTerm, pos)) !== -1) {
          matches.push(pos);
          pos += normalizedTerm.length;
        }

        return {
          isMatch: true,
          score: 0, // Perfect match
          matchPositions: matches,
        };
      }
    }

    return null;
  }

  /**
   * Performs an optimized fuzzy search for large content
   */
  private performOptimizedFuzzySearch(
    content: string,
    term: string,
    isCaseSensitive: boolean,
    useWholeWordMatching: boolean,
    includeScore: boolean
  ): FuzzySearchResult {
    // Normalize content and term based on case sensitivity
    const normalizedContent = this.normalizeString(content, isCaseSensitive);
    const normalizedTerm = this.normalizeString(term, isCaseSensitive);

    // Quick check: try to find an exact substring match first
    // This can save a lot of processing time
    if (normalizedContent.includes(normalizedTerm)) {
      // If we need whole word matching, verify it's a whole word
      if (
        !useWholeWordMatching ||
        this.isWholeWordMatch(content, term, isCaseSensitive)
      ) {
        // For exact matches, we can use a simpler approach to find positions
        const matchPositions = includeScore
          ? this.findExactMatchPositions(
              content,
              term,
              isCaseSensitive,
              useWholeWordMatching
            )
          : [];

        return {
          isMatch: true,
          score: 0, // Perfect match
          matchPositions: includeScore ? matchPositions : undefined,
        };
      }
    }

    // Calculate maximum allowed distance for fuzzy matching
    const maxDistance = Math.floor(normalizedTerm.length * 0.3); // Allow up to 30% difference

    // For very large content, use a sampling approach
    if (normalizedContent.length > 50000) {
      return this.performSampledFuzzySearch(
        normalizedContent,
        normalizedTerm,
        content,
        term,
        isCaseSensitive,
        useWholeWordMatching,
        includeScore,
        maxDistance
      );
    }

    // For medium to large content, use a chunked approach
    // Split content into chunks for more efficient processing
    const chunkSize = 2000; // Larger chunks for fewer iterations
    const chunks: string[] = [];

    for (let i = 0; i < normalizedContent.length; i += chunkSize) {
      chunks.push(normalizedContent.substring(i, i + chunkSize));
    }

    // Process each chunk
    let isMatch = false;
    const matchPositions: number[] = [];

    // Pre-compute term characteristics for faster comparison
    const termFirstChar = normalizedTerm[0];
    const termLastChar = normalizedTerm[normalizedTerm.length - 1];
    const termLength = normalizedTerm.length;
    const minWordLength = Math.floor(termLength * 0.7);
    const maxWordLength = Math.ceil(termLength * 1.3);

    // Use a Set to track processed words and avoid redundant calculations
    const processedWords = new Set<string>();

    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      const chunkOffset = i * chunkSize;

      // Quick check: if chunk is too short, skip
      if (chunk.length < termLength) {
        continue;
      }

      // Split chunk into words for word-based matching
      // Use a more efficient regex that handles multiple whitespace characters
      const words = chunk.split(/\s+/);
      let wordOffset = 0;

      for (const word of words) {
        // Skip words that are too different in length
        if (word.length < minWordLength || word.length > maxWordLength) {
          wordOffset += word.length + 1; // +1 for space
          continue;
        }

        // Skip words we've already processed
        if (processedWords.has(word)) {
          wordOffset += word.length + 1;
          continue;
        }

        processedWords.add(word);

        // Quick check: first or last character should match for better performance
        if (
          word[0] === termFirstChar ||
          word[word.length - 1] === termLastChar
        ) {
          // Calculate similarity
          const distance = this.levenshteinDistance(word, normalizedTerm);

          // If distance is small enough, consider it a match
          if (distance <= maxDistance) {
            const position = chunkOffset + wordOffset;

            // If whole word matching is enabled, verify it's a whole word
            if (
              !useWholeWordMatching ||
              this.isWholeWordMatch(content, word, isCaseSensitive)
            ) {
              isMatch = true;

              if (includeScore) {
                matchPositions.push(position);
              } else {
                // If we don't need positions and we found a match, we can return early
                return { isMatch: true };
              }
            }
          }
        }

        wordOffset += word.length + 1; // +1 for space
      }
    }

    return {
      isMatch,
      score: isMatch ? 0.5 : 1.0, // Approximate score
      matchPositions: includeScore ? matchPositions : undefined,
    };
  }

  /**
   * Performs a sampled fuzzy search for very large content
   * This is an optimization for extremely large content where processing the entire content would be too slow
   */
  private performSampledFuzzySearch(
    normalizedContent: string,
    normalizedTerm: string,
    originalContent: string,
    originalTerm: string,
    isCaseSensitive: boolean,
    useWholeWordMatching: boolean,
    includeScore: boolean,
    maxDistance: number
  ): FuzzySearchResult {
    // For very large content, we'll sample words from the content
    // rather than processing the entire content
    const termLength = normalizedTerm.length;
    const minWordLength = Math.floor(termLength * 0.7);
    const maxWordLength = Math.ceil(termLength * 1.3);

    // Extract a sample of words that are similar in length to the term
    const wordSampleSize = 1000;
    const wordRegex = /\b\w+\b/g;
    let match;
    const words: string[] = [];
    const positions: number[] = [];

    // Sample words from different parts of the content
    const contentLength = normalizedContent.length;
    const samplePoints = 10;
    const sampleSize = Math.min(5000, Math.floor(contentLength / samplePoints));

    for (let i = 0; i < samplePoints; i++) {
      const startPos = Math.floor((i / samplePoints) * contentLength);
      const sampleContent = normalizedContent.substring(
        startPos,
        startPos + sampleSize
      );

      // Reset regex for each sample
      wordRegex.lastIndex = 0;

      while (
        (match = wordRegex.exec(sampleContent)) !== null &&
        words.length < wordSampleSize
      ) {
        const word = match[0];
        if (word.length >= minWordLength && word.length <= maxWordLength) {
          words.push(word);
          positions.push(startPos + match.index);
        }
      }

      if (words.length >= wordSampleSize) break;
    }

    // Process the sampled words
    let isMatch = false;
    const matchPositions: number[] = [];

    // Pre-compute term characteristics for faster comparison
    const termFirstChar = normalizedTerm[0];
    const termLastChar = normalizedTerm[normalizedTerm.length - 1];

    // Use a Set to track processed words and avoid redundant calculations
    const processedWords = new Set<string>();

    for (let i = 0; i < words.length; i++) {
      const word = words[i];

      // Skip words we've already processed
      if (processedWords.has(word)) continue;

      processedWords.add(word);

      // Quick check: first or last character should match for better performance
      if (word[0] === termFirstChar || word[word.length - 1] === termLastChar) {
        // Calculate similarity
        const distance = this.levenshteinDistance(word, normalizedTerm);

        // If distance is small enough, consider it a match
        if (distance <= maxDistance) {
          // If whole word matching is enabled, verify it's a whole word
          if (
            !useWholeWordMatching ||
            this.isWholeWordMatch(originalContent, word, isCaseSensitive)
          ) {
            isMatch = true;

            if (includeScore) {
              matchPositions.push(positions[i]);
            } else {
              // If we don't need positions and we found a match, we can return early
              return { isMatch: true };
            }
          }
        }
      }
    }

    return {
      isMatch,
      score: isMatch ? 0.5 : 1.0, // Approximate score
      matchPositions: includeScore ? matchPositions : undefined,
    };
  }

  /**
   * Finds exact match positions in the content
   */
  private findExactMatchPositions(
    content: string,
    term: string,
    isCaseSensitive: boolean,
    useWholeWordMatching: boolean
  ): number[] {
    const positions: number[] = [];

    if (useWholeWordMatching) {
      const pattern = `\\b${this.escapeRegExp(term)}\\b`;
      const flags = isCaseSensitive ? "g" : "gi";
      const wordBoundaryRegex = this.getRegExp(pattern, flags);

      let match;
      while ((match = wordBoundaryRegex.exec(content)) !== null) {
        positions.push(match.index);
      }
    } else {
      const normalizedContent = isCaseSensitive
        ? content
        : content.toLowerCase();
      const normalizedTerm = isCaseSensitive ? term : term.toLowerCase();

      let pos = 0;
      while ((pos = normalizedContent.indexOf(normalizedTerm, pos)) !== -1) {
        positions.push(pos);
        pos += normalizedTerm.length;
      }
    }

    return positions;
  }

  /**
   * Finds optimized match positions for fuzzy matches
   */
  private findOptimizedMatchPositions(
    content: string,
    term: string,
    isCaseSensitive: boolean,
    useWholeWordMatching: boolean
  ): number[] {
    // For small content, use a simpler approach
    if (content.length < 1000) {
      return this.findSimpleMatchPositions(
        content,
        term,
        isCaseSensitive,
        useWholeWordMatching
      );
    }

    // For larger content, use a more efficient word-based approach
    const normalizedContent = isCaseSensitive ? content : content.toLowerCase();
    const normalizedTerm = isCaseSensitive ? term : term.toLowerCase();

    const positions: number[] = [];
    const words = normalizedContent.split(/\s+/);
    let position = 0;

    // Calculate maximum allowed distance for fuzzy matching
    const maxDistance = Math.floor(normalizedTerm.length * 0.3); // Allow up to 30% difference

    for (const word of words) {
      // Skip words that are too different in length
      if (
        word.length < normalizedTerm.length * 0.7 ||
        word.length > normalizedTerm.length * 1.3
      ) {
        position += word.length + 1; // +1 for space
        continue;
      }

      // Quick check: first and last character should match for better performance
      if (
        word[0] === normalizedTerm[0] ||
        word[word.length - 1] === normalizedTerm[normalizedTerm.length - 1]
      ) {
        // Calculate similarity
        const distance = this.levenshteinDistance(word, normalizedTerm);

        // If distance is small enough, consider it a match
        if (distance <= maxDistance) {
          // If whole word matching is enabled, verify it's a whole word
          if (
            !useWholeWordMatching ||
            this.isWholeWordMatch(content, word, isCaseSensitive)
          ) {
            positions.push(position);
          }
        }
      }

      position += word.length + 1; // +1 for space
    }

    return positions;
  }

  /**
   * Finds simple match positions for small content
   */
  private findSimpleMatchPositions(
    content: string,
    term: string,
    isCaseSensitive: boolean,
    useWholeWordMatching: boolean
  ): number[] {
    const normalizedContent = isCaseSensitive ? content : content.toLowerCase();
    const normalizedTerm = isCaseSensitive ? term : term.toLowerCase();

    const positions: number[] = [];

    // For very short content, just do a sliding window search
    for (
      let i = 0;
      i <= normalizedContent.length - normalizedTerm.length;
      i++
    ) {
      const substring = normalizedContent.substring(
        i,
        i + normalizedTerm.length
      );

      // Calculate similarity
      let matchCount = 0;
      for (let j = 0; j < normalizedTerm.length; j++) {
        if (substring[j] === normalizedTerm[j]) {
          matchCount++;
        }
      }

      // If similarity is high enough, consider it a match
      const similarity = matchCount / normalizedTerm.length;
      if (similarity >= 0.7) {
        // If whole word matching is enabled, verify it's a whole word
        if (
          !useWholeWordMatching ||
          this.isWholeWordMatch(content, substring, isCaseSensitive)
        ) {
          positions.push(i);
        }
      }
    }

    return positions;
  }

  /**
   * Checks if a match is a whole word
   */
  private isWholeWordMatch(
    content: string,
    term: string,
    isCaseSensitive: boolean
  ): boolean {
    const pattern = `\\b${this.escapeRegExp(term)}\\b`;
    const flags = isCaseSensitive ? "g" : "gi";
    const wordBoundaryRegex = this.getRegExp(pattern, flags);

    return wordBoundaryRegex.test(content);
  }

  // Caches for performance optimization
  private normalizedStringCache = new Map<string, string>();

  private levenshteinDistance(a: string, b: string): number {
    // Ensure a is the shorter string for consistent behavior
    if (a.length > b.length) {
      [a, b] = [b, a];
    }

    // Early return for empty strings
    if (a.length === 0) return b.length;
    if (b.length === 0) return a.length;

    // Early return for identical strings
    if (a === b) return 0;

    // Early return for strings with very different lengths
    const lengthDiff = Math.abs(a.length - b.length);
    if (lengthDiff > Math.floor(Math.max(a.length, b.length) * 0.3)) {
      return lengthDiff;
    }

    // Quick check for common prefixes and suffixes
    let i = 0;
    while (i < a.length && i < b.length && a[i] === b[i]) {
      i++;
    }

    let j = 0;
    while (
      j < a.length - i &&
      j < b.length - i &&
      a[a.length - 1 - j] === b[b.length - 1 - j]
    ) {
      j++;
    }

    // If we've matched everything, return the length difference
    if (i + j === Math.min(a.length, b.length)) {
      return lengthDiff;
    }

    // If the strings are very short after removing common parts, use a simpler approach
    if (a.length - i - j <= 2 || b.length - i - j <= 2) {
      let diff = 0;
      for (let k = i; k < a.length - j; k++) {
        if (k - i < b.length - i - j) {
          if (a[k] !== b[k - i + i]) {
            diff++;
          }
        } else {
          diff++;
        }
      }
      diff += Math.abs(a.length - i - j - (b.length - i - j));

      return diff;
    }

    // For longer strings, use the optimized matrix approach
    // Extract the middle parts that differ
    const aMiddle = a.substring(i, a.length - j);
    const bMiddle = b.substring(i, b.length - j);

    // Use a single array for better memory efficiency
    const row = new Uint16Array(bMiddle.length + 1);

    // Initialize the first row
    for (let i = 0; i <= bMiddle.length; i++) {
      row[i] = i;
    }

    // Fill in the rest of the matrix
    for (let i = 1; i <= aMiddle.length; i++) {
      let prev = i;

      for (let j = 1; j <= bMiddle.length; j++) {
        const val =
          aMiddle[i - 1] === bMiddle[j - 1]
            ? row[j - 1]
            : Math.min(row[j - 1] + 1, prev + 1, row[j] + 1);
        row[j - 1] = prev;
        prev = val;
      }

      row[bMiddle.length] = prev;
    }

    return row[bMiddle.length];
  }

  /**
   * Generates a cache key for the search
   * Uses a simple approach for better performance
   */
  private generateCacheKey(
    content: string,
    term: string,
    options: FuzzySearchOptions
  ): string {
    // Use a simple hash-based approach
    const contentHash = this.hashString(content);

    // Include term and options in the key
    const key = {
      contentHash,
      term,
      isCaseSensitive: options.isCaseSensitive || false,
      threshold: options.threshold || MATCH_THRESHOLD,
      useWholeWordMatching: options.useWholeWordMatching || false,
    };

    return JSON.stringify(key);
  }

  /**
   * Computes a simple hash of a string
   */
  private hashString(str: string): string {
    let hash = 0;

    // Use only a sample of the string for very large strings
    const sampleSize = 1000;
    const step =
      str.length > sampleSize ? Math.floor(str.length / sampleSize) : 1;

    for (let i = 0; i < str.length; i += step) {
      const char = str.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash |= 0; // Convert to 32bit integer
    }

    return hash.toString(36);
  }

  /**
   * Gets or creates a RegExp object
   */
  private getRegExp(pattern: string, flags: string): RegExp {
    return new RegExp(pattern, flags);
  }

  /**
   * Escapes special characters in a string for use in a regular expression
   */
  private escapeRegExp(str: string): string {
    return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }

  /**
   * Updates metrics with the latest processing time
   */
  private updateMetrics(processingTime: number): void {
    this.metrics.totalProcessingTime += processingTime;
    this.metrics.averageProcessingTime =
      this.metrics.totalProcessingTime / this.metrics.totalSearches;
  }

  /**
   * Gets the current metrics
   */
  public getMetrics(): FuzzySearchMetrics {
    return { ...this.metrics };
  }

  /**
   * Resets the metrics
   */
  public resetMetrics(): void {
    this.metrics = {
      totalSearches: 0,
      cacheHits: 0,
      cacheMisses: 0,
      exactMatches: 0,
      fuzzyMatches: 0,
      noMatches: 0,
      averageProcessingTime: 0,
      totalProcessingTime: 0,
    };
  }

  /**
   * Clears all caches
   */
  public clearCaches(): void {
    this.resultCache.clear();
    this.normalizedStringCache.clear();
    this.fuseInstances.clear();

    this.logger.debug("All caches cleared");
  }

  /**
   * Gets cache statistics
   */
  public getCacheStats(): CacheStatistics {
    return {
      resultCache: {
        size: this.resultCache.size(),
      },
      normalizedStringCache: {
        size: this.normalizedStringCache.size,
      },
      fuseInstances: {
        size: this.fuseInstances.size,
      },
    };
  }
}
