/**
 * Search Utility Functions
 *
 * Utility functions for search operations.
 */

import { AppError } from "../errors";
import { createRegexFromPattern, escapeRegExp } from "./string";

/**
 * Find all occurrences of a term in content
 * @param content The content to search in
 * @param term The term to search for
 * @param options Search options
 * @returns An array of match positions
 */
export function findTermIndices(
  content: string,
  term: string | RegExp,
  options: {
    caseSensitive?: boolean;
    isRegex?: boolean;
    useWholeWordMatching?: boolean;
  } = {}
): number[] {
  const {
    caseSensitive = false,
    isRegex = false,
    useWholeWordMatching = false,
  } = options;
  const indices: number[] = [];

  if (!content || (typeof term === "string" && !term)) {
    return indices; // Return empty array for empty content or empty term
  }

  try {
    if (isRegex && term instanceof RegExp) {
      // For regex patterns, we use the pattern as-is
      const regex = new RegExp(
        term.source,
        term.flags.includes("g") ? term.flags : term.flags + "g"
      );

      let match;
      while ((match = regex.exec(content)) !== null) {
        indices.push(match.index);
        if (match.index === regex.lastIndex) regex.lastIndex++;
      }
    } else if (typeof term === "string") {
      if (useWholeWordMatching) {
        // Use regex with word boundaries for whole word matching
        const flags = caseSensitive ? "g" : "gi";
        const wordBoundaryRegex = new RegExp(
          `\\b${escapeRegExp(term)}\\b`,
          flags
        );

        let match;
        while ((match = wordBoundaryRegex.exec(content)) !== null) {
          indices.push(match.index);
          // Prevent infinite loops with zero-width matches
          if (match.index === wordBoundaryRegex.lastIndex) {
            wordBoundaryRegex.lastIndex++;
          }
        }
      } else {
        // Standard substring search
        const searchTerm = caseSensitive ? term : term.toLowerCase();
        const searchContent = caseSensitive ? content : content.toLowerCase();

        let i = -1;
        while ((i = searchContent.indexOf(searchTerm, i + 1)) !== -1) {
          indices.push(i);
        }
      }
    }

    return indices;
  } catch (error) {
    throw AppError.searchError(
      `Error finding term indices: ${error instanceof Error ? error.message : String(error)}`,
      { term, options }
    );
  }
}

/**
 * Check if content matches a term
 * @param content The content to check
 * @param term The term to check for
 * @param options Search options
 * @returns True if the content matches the term
 */
export function contentMatchesTerm(
  content: string,
  term: string | RegExp,
  options: {
    caseSensitive?: boolean;
    isRegex?: boolean;
    useWholeWordMatching?: boolean;
  } = {}
): boolean {
  // Use findTermIndices and check if any matches were found
  const indices = findTermIndices(content, term, options);
  return indices.length > 0;
}

/**
 * Get word boundaries in content
 * @param content The content to analyze
 * @returns An array of word boundary positions
 */
export function getWordBoundaries(content: string): number[] {
  if (!content) return [];

  const boundaries: number[] = [];
  const wordBoundaryRegex = /\b/g;

  let match;
  while ((match = wordBoundaryRegex.exec(content)) !== null) {
    boundaries.push(match.index);
    // Prevent infinite loops
    if (match.index === wordBoundaryRegex.lastIndex) {
      wordBoundaryRegex.lastIndex++;
    }
  }

  return boundaries;
}

/**
 * Check if a position is at a word boundary
 * @param position The position to check
 * @param boundaries Array of word boundary positions
 * @returns True if the position is at a word boundary
 */
export function isWordBoundary(
  position: number,
  boundaries: number[]
): boolean {
  return boundaries.includes(position);
}

/**
 * Check if a match is a whole word
 * @param content The content containing the match
 * @param term The term that matched
 * @param matchIndex The index of the match
 * @param options Search options
 * @returns True if the match is a whole word
 */
export function isWholeWordMatch(
  content: string,
  term: string,
  matchIndex: number,
  options: {
    caseSensitive?: boolean;
    boundaries?: number[];
  } = {}
): boolean {
  const { caseSensitive = false, boundaries } = options;

  // If we have pre-computed boundaries, use them
  if (boundaries) {
    const startBoundary = isWordBoundary(matchIndex, boundaries);
    const endBoundary = isWordBoundary(matchIndex + term.length, boundaries);
    return startBoundary && endBoundary;
  }

  // Otherwise, use regex to check
  const flags = caseSensitive ? "" : "i";
  const wordBoundaryRegex = new RegExp(`\\b${escapeRegExp(term)}\\b`, flags);

  return wordBoundaryRegex.test(
    content.substring(matchIndex, matchIndex + term.length + 1)
  );
}

/**
 * Find the distance between two terms in content
 * @param content The content to search in
 * @param term1 The first term
 * @param term2 The second term
 * @param options Search options
 * @returns The distance between the terms (in words) or -1 if not found
 */
export function findTermDistance(
  content: string,
  term1: string,
  term2: string,
  options: {
    caseSensitive?: boolean;
    useWholeWordMatching?: boolean;
  } = {}
): number {
  const { caseSensitive = false, useWholeWordMatching = false } = options;

  // Find all occurrences of both terms
  const term1Indices = findTermIndices(content, term1, {
    caseSensitive,
    useWholeWordMatching,
  });

  const term2Indices = findTermIndices(content, term2, {
    caseSensitive,
    useWholeWordMatching,
  });

  if (term1Indices.length === 0 || term2Indices.length === 0) {
    return -1; // One or both terms not found
  }

  // Split content into words
  const words = content.split(/\s+/);
  const wordPositions: number[] = [];

  // Calculate the position of each word in the original content
  let position = 0;
  for (const word of words) {
    wordPositions.push(position);
    position += word.length + 1; // +1 for the space
  }

  // Find the word index for each term occurrence
  const term1WordIndices = term1Indices.map((index) => {
    return wordPositions.findIndex((pos) => pos > index) - 1;
  });

  const term2WordIndices = term2Indices.map((index) => {
    return wordPositions.findIndex((pos) => pos > index) - 1;
  });

  // Find the minimum distance between any pair of occurrences
  let minDistance = Infinity;

  for (const t1Index of term1WordIndices) {
    for (const t2Index of term2WordIndices) {
      const distance = Math.abs(t1Index - t2Index);
      minDistance = Math.min(minDistance, distance);
    }
  }

  return minDistance === Infinity ? -1 : minDistance;
}

/**
 * Check if two terms are within a specified distance
 * @param content The content to search in
 * @param term1 The first term
 * @param term2 The second term
 * @param distance The maximum distance between terms
 * @param options Search options
 * @returns True if the terms are within the specified distance
 */
export function areTermsWithinDistance(
  content: string,
  term1: string,
  term2: string,
  distance: number,
  options: {
    caseSensitive?: boolean;
    useWholeWordMatching?: boolean;
  } = {}
): boolean {
  const actualDistance = findTermDistance(content, term1, term2, options);
  return actualDistance !== -1 && actualDistance <= distance;
}
