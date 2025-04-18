/**
 * ContentMatchingService
 *
 * A service for efficiently matching content against search terms.
 * This service optimizes memory usage and performance for content matching operations.
 */

import {
  FuzzySearchService,
  NearOperatorService,
  WordBoundaryService,
} from "./index.js";
import { evaluateBooleanAst } from "../utils/booleanExpressionUtils.js";
import { createSafeRegex } from "../utils/regexUtils.js";

// Import jsep for boolean expression parsing
import module from "node:module";
const require = module.createRequire(import.meta.url);
const jsep = require("jsep");

// Define interfaces for the service
export type ContentSearchMode = "term" | "regex" | "boolean";

export interface ContentMatchingOptions {
  caseSensitive?: boolean;
  wholeWordMatching?: boolean;
  fuzzySearchEnabled?: boolean;
  fuzzySearchNearEnabled?: boolean;
  _fuzzySearchEnabled?: boolean;
  _fuzzySearchNearEnabled?: boolean;
  maxContentSize?: number;
}

export interface MatchResult {
  matched: boolean;
  matchPositions?: number[];
  error?: Error;
}

export class ContentMatchingService {
  private static instance: ContentMatchingService;

  // Services
  private fuzzySearchService: FuzzySearchService;
  private nearOperatorService: NearOperatorService;
  private wordBoundaryService: WordBoundaryService;

  // Private constructor for singleton pattern
  private constructor() {
    this.fuzzySearchService = FuzzySearchService.getInstance();
    this.nearOperatorService = NearOperatorService.getInstance();
    this.wordBoundaryService = WordBoundaryService.getInstance();
  }

  /**
   * Gets the singleton instance of ContentMatchingService
   * @returns The ContentMatchingService instance
   */
  public static getInstance(): ContentMatchingService {
    if (!ContentMatchingService.instance) {
      ContentMatchingService.instance = new ContentMatchingService();
    }
    return ContentMatchingService.instance;
  }

  /**
   * Creates a content matcher function based on the search mode and term
   * @param searchTerm The search term
   * @param searchMode The search mode (term, regex, or boolean)
   * @param options Matching options
   * @returns A function that takes content and returns whether it matches
   */
  public createMatcher(
    searchTerm: string,
    searchMode: ContentSearchMode,
    options: ContentMatchingOptions = {}
  ): { matcher: ((content: string) => boolean) | null; error: string | null } {
    const {
      caseSensitive = false,
      wholeWordMatching = false,
      // Unused options, but kept for API compatibility
      _fuzzySearchEnabled = true,
      _fuzzySearchNearEnabled = true,
    } = options;

    // If no search term, return null matcher
    if (!searchTerm) {
      return { matcher: null, error: null };
    }

    try {
      switch (searchMode) {
        case "regex": {
          const flags = caseSensitive ? "" : "i";
          const regex = createSafeRegex(searchTerm, flags);

          if (regex) {
            return {
              matcher: (content) => regex.test(content),
              error: null,
            };
          } else {
            return {
              matcher: null,
              error: `Invalid regular expression pattern: ${searchTerm}`,
            };
          }
        }

        case "boolean": {
          try {
            // Parse the boolean expression
            const parsedAst = jsep(searchTerm);

            // Create matcher function that evaluates the AST
            return {
              matcher: (content) => {
                // Clear cache for this specific content before evaluation
                this.wordBoundaryService.removeFromCache(content);

                // Global variables are set in fileSearchService.ts
                // We don't need to set them here

                // Evaluate the AST

                return evaluateBooleanAst(parsedAst, content, caseSensitive);
              },
              error: null,
            };
          } catch (parseError: unknown) {
            // Handle boolean query parsing errors
            let errorDetail = "Unknown parsing error";

            if (parseError instanceof Error) {
              errorDetail = parseError.message;
            } else {
              errorDetail = String(parseError);
            }

            return {
              matcher: null,
              error: `Error parsing boolean query: ${errorDetail}`,
            };
          }
        }

        case "term":
        default: {
          // Simple term matching
          // Remove quotes if the term is quoted
          let term = searchTerm;
          if (term.startsWith('"') && term.endsWith('"')) {
            term = term.substring(1, term.length - 1);
          }

          if (wholeWordMatching) {
            // Use regex with word boundaries for whole word matching
            const flags = caseSensitive ? "g" : "gi";
            const wordBoundaryRegex = new RegExp(
              `\\b${this.escapeRegExp(term)}\\b`,
              flags
            );

            return {
              matcher: (content) => wordBoundaryRegex.test(content),
              error: null,
            };
          } else if (caseSensitive) {
            return {
              matcher: (content) => content.includes(term),
              error: null,
            };
          } else {
            const termLower = term.toLowerCase();
            return {
              matcher: (content) => content.toLowerCase().includes(termLower),
              error: null,
            };
          }
        }
      }
    } catch (error) {
      return {
        matcher: null,
        error: `Error creating matcher: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  }

  /**
   * Matches content against a search term
   * @param content The content to match
   * @param searchTerm The search term
   * @param searchMode The search mode (term, regex, or boolean)
   * @param options Matching options
   * @returns The match result
   */
  public matchContent(
    content: string,
    searchTerm: string,
    searchMode: ContentSearchMode,
    options: ContentMatchingOptions = {}
  ): MatchResult {
    // Check if content is too large
    const maxContentSize = options.maxContentSize || Number.MAX_SAFE_INTEGER;
    if (content.length > maxContentSize) {
      return {
        matched: false,
        error: new Error(
          `Content is too large: ${content.length} bytes (max: ${maxContentSize} bytes)`
        ),
      };
    }

    // Create matcher
    const { matcher, error } = this.createMatcher(
      searchTerm,
      searchMode,
      options
    );

    if (error) {
      return {
        matched: false,
        error: new Error(error),
      };
    }

    if (!matcher) {
      // No matcher means no search term, so everything matches
      return { matched: true };
    }

    try {
      // Match content
      const matched = matcher(content);
      return { matched };
    } catch (matchError) {
      return {
        matched: false,
        error:
          matchError instanceof Error
            ? matchError
            : new Error(String(matchError)),
      };
    }
  }

  /**
   * Finds all occurrences of a term in content
   * @param content The content to search in
   * @param term The term to search for
   * @param options Matching options
   * @returns An array of match positions
   */
  public findMatchPositions(
    content: string,
    term: string,
    options: ContentMatchingOptions = {}
  ): number[] {
    const { caseSensitive = false, wholeWordMatching = false } = options;

    const positions: number[] = [];

    // Check if term is a regex
    const regexMatch = /^\/(.+)\/([gimuy]*)$/.exec(term);
    if (regexMatch) {
      const pattern = regexMatch[1];
      const flags = regexMatch[2] + (regexMatch[2].includes("g") ? "" : "g");

      try {
        const regex = new RegExp(pattern, flags);
        let match;

        while ((match = regex.exec(content)) !== null) {
          positions.push(match.index);

          // Prevent infinite loops with zero-width matches
          if (match.index === regex.lastIndex) {
            regex.lastIndex++;
          }
        }
      } catch (error) {
        console.error("Error creating regex:", error);
      }
    } else if (wholeWordMatching) {
      // Use regex with word boundaries for whole word matching
      const flags = caseSensitive ? "g" : "gi";
      const wordBoundaryRegex = new RegExp(
        `\\b${this.escapeRegExp(term)}\\b`,
        flags
      );

      let match;
      while ((match = wordBoundaryRegex.exec(content)) !== null) {
        positions.push(match.index);

        // Prevent infinite loops with zero-width matches
        if (match.index === wordBoundaryRegex.lastIndex) {
          wordBoundaryRegex.lastIndex++;
        }
      }
    } else {
      // Standard substring search
      const searchTerm = caseSensitive ? term : term.toLowerCase();
      const searchContent = caseSensitive ? content : content.toLowerCase();

      let index = -1;
      while ((index = searchContent.indexOf(searchTerm, index + 1)) !== -1) {
        positions.push(index);
      }
    }

    return positions;
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
