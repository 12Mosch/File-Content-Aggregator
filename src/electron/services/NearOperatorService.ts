/**
 * NearOperatorService
 *
 * A service for efficiently evaluating NEAR operations in search queries.
 * This service optimizes the evaluation of proximity between terms.
 */

import { WordBoundaryService } from "./WordBoundaryService.js";
import {
  FuzzySearchService,
  FuzzySearchOptions,
} from "./FuzzySearchService.js";

export interface NearOperatorOptions {
  caseSensitive?: boolean;
  fuzzySearchEnabled?: boolean;
  wholeWordMatchingEnabled?: boolean;
}

export class NearOperatorService {
  private static instance: NearOperatorService;
  private wordBoundaryService: WordBoundaryService;
  private fuzzySearchService: FuzzySearchService;

  // Private constructor for singleton pattern
  private constructor() {
    this.wordBoundaryService = WordBoundaryService.getInstance();
    this.fuzzySearchService = FuzzySearchService.getInstance();
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
   * Evaluates a NEAR operation between two terms
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
    const {
      caseSensitive = false,
      fuzzySearchEnabled = false,
      wholeWordMatchingEnabled = false,
    } = options;

    if (!content || distance < 0) {
      return false;
    }

    // Find indices of both terms
    let indices1 = this.findTermIndices(
      content,
      term1,
      caseSensitive,
      term1 instanceof RegExp,
      wholeWordMatchingEnabled
    );

    let indices2 = this.findTermIndices(
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
      return false;
    }

    // Optimize by sorting indices and using early termination
    indices1.sort((a, b) => a - b);
    indices2.sort((a, b) => a - b);

    // Check word distance between occurrences using a more efficient algorithm
    return this.checkProximity(indices1, indices2, distance, content);
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

    return indices;
  }

  /**
   * Checks if any pair of indices from two sets are within the specified word distance
   * @param indices1 Sorted array of indices for the first term
   * @param indices2 Sorted array of indices for the second term
   * @param maxDistance Maximum word distance allowed
   * @param content The text content
   * @returns True if any pair is within the specified distance
   */
  private checkProximity(
    indices1: number[],
    indices2: number[],
    maxDistance: number,
    content: string
  ): boolean {
    // Early termination optimization:
    // If we have many indices, first check if any character indices are close enough
    // This avoids expensive word boundary calculations for obviously distant terms
    if (indices1.length > 10 && indices2.length > 10) {
      // Estimate average word length (typically 5-7 characters in English)
      const avgWordLength = 6;
      const maxCharDistance = maxDistance * avgWordLength * 2; // Conservative estimate

      // Check if any pair of indices are within the estimated character distance
      let closeEnough = false;
      for (const index1 of indices1) {
        for (const index2 of indices2) {
          if (Math.abs(index1 - index2) <= maxCharDistance) {
            closeEnough = true;
            break;
          }
        }
        if (closeEnough) break;
      }

      // If no indices are even close in character distance, we can return false early
      if (!closeEnough) {
        return false;
      }
    }

    // For each index in the first set
    for (const index1 of indices1) {
      const wordIndex1 = this.wordBoundaryService.getWordIndexFromCharIndex(
        index1,
        content
      );
      if (wordIndex1 === -1) continue;

      // Binary search optimization for the second set
      // Find the closest indices in the second set
      const closestIndices = this.findClosestIndices(indices2, index1);

      for (const index2 of closestIndices) {
        const wordIndex2 = this.wordBoundaryService.getWordIndexFromCharIndex(
          index2,
          content
        );
        if (wordIndex2 === -1) continue;

        // Check if the word distance is within the limit
        const wordDist = Math.abs(wordIndex1 - wordIndex2);
        if (wordDist <= maxDistance) {
          return true;
        }
      }
    }

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
   * Escapes special characters in a string for use in a RegExp
   * @param string The string to escape
   * @returns The escaped string
   */
  private escapeRegExp(string: string): string {
    return string.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }
}
