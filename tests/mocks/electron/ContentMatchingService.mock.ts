/**
 * Mock implementation of ContentMatchingService for tests
 */

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

  // Private constructor for singleton pattern
  private constructor() {}

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
  ): {
    matcher: ((content: string) => Promise<boolean>) | null;
    error: string | null;
  } {
    const { caseSensitive = false, wholeWordMatching = false } = options;

    // If no search term, return null matcher
    if (!searchTerm) {
      return { matcher: null, error: null };
    }

    if (searchTerm === "invalid regex" && searchMode === "regex") {
      return { matcher: null, error: "Invalid regex pattern" };
    }

    if (searchTerm === "invalid expression" && searchMode === "boolean") {
      return { matcher: null, error: "Invalid boolean expression" };
    }

    // Create a simple matcher for testing
    if (searchMode === "term") {
      if (wholeWordMatching) {
        const wordBoundaryRegex = new RegExp(
          `\\b${this.escapeRegExp(searchTerm)}\\b`,
          caseSensitive ? "g" : "gi"
        );
        return {
          matcher: async (content) => {
            await Promise.resolve();
            return wordBoundaryRegex.test(content);
          },
          error: null,
        };
      } else if (caseSensitive) {
        return {
          matcher: async (content) => {
            await Promise.resolve();
            return content.includes(searchTerm);
          },
          error: null,
        };
      } else {
        const termLower = searchTerm.toLowerCase();
        return {
          matcher: async (content) => {
            await Promise.resolve();
            return content.toLowerCase().includes(termLower);
          },
          error: null,
        };
      }
    } else if (searchMode === "regex") {
      try {
        const flags = caseSensitive ? "" : "i";
        const regex = new RegExp(searchTerm, flags);
        return {
          matcher: async (content) => {
            await Promise.resolve();
            return regex.test(content);
          },
          error: null,
        };
      } catch (_error) {
        return {
          matcher: null,
          error: `Invalid regular expression pattern: ${searchTerm}`,
        };
      }
    } else if (searchMode === "boolean") {
      // Simple boolean implementation for testing
      return {
        matcher: async (content) => {
          await Promise.resolve();
          return content.includes(searchTerm);
        },
        error: null,
      };
    }

    return { matcher: null, error: "Unknown search mode" };
  }

  /**
   * Matches content against a search term
   * @param content The content to match
   * @param searchTerm The search term
   * @param searchMode The search mode (term, regex, or boolean)
   * @param options Matching options
   * @returns The match result
   */
  public async matchContent(
    content: string,
    searchTerm: string,
    searchMode: ContentSearchMode,
    options: ContentMatchingOptions = {}
  ): Promise<MatchResult> {
    // Check if content is too large
    const maxContentSize = options.maxContentSize || Number.MAX_SAFE_INTEGER;
    if (content && content.length > maxContentSize) {
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
      const matched = await matcher(content);
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

    if (!content || !term) {
      return [];
    }

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
      } catch (_error) {
        // Return empty array for invalid regex
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
