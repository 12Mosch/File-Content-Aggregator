/**
 * String Utility Functions
 *
 * Utility functions for string manipulation and processing.
 */

import { AppError } from "../errors";

/**
 * Escape special characters in a string for use in a regular expression
 * @param string String to escape
 * @returns Escaped string
 */
export function escapeRegExp(string: string): string {
  return string.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); // $& means the whole matched string
}

/**
 * Create a safe regular expression from a pattern and flags
 * @param pattern Regex pattern
 * @param flags Regex flags
 * @returns RegExp object or null if invalid
 */
export function createSafeRegex(
  pattern: string,
  flags: string = ""
): RegExp | null {
  try {
    return new RegExp(pattern, flags);
  } catch (error) {
    console.error(`Invalid regex pattern: ${pattern}`, error);
    return null;
  }
}

/**
 * Parse a regex literal string (e.g., "/pattern/flags") into a RegExp object
 * @param str String to parse
 * @returns RegExp object or null if invalid
 */
export function parseRegexLiteral(str: string): RegExp | null {
  if (!str) return null;

  // Check if the string is a regex literal (e.g., "/pattern/flags")
  const regexMatch = /^\/(.+)\/([gimyus]*)$/.exec(str);
  if (!regexMatch) return null;

  try {
    const pattern = regexMatch[1];
    const flags = regexMatch[2];
    return new RegExp(pattern, flags);
  } catch (error) {
    console.error(`Invalid regex literal: ${str}`, error);
    return null;
  }
}

/**
 * Test if a string is a valid regular expression
 * @param pattern Regex pattern to test
 * @returns True if valid, false otherwise
 */
export function isValidRegex(pattern: string): boolean {
  try {
    new RegExp(pattern);
    return true;
  } catch (_error) {
    return false;
  }
}

/**
 * Create a regular expression from a string pattern, handling various formats
 * @param pattern String pattern
 * @param options Options for creating the regex
 * @returns RegExp object
 */
export function createRegexFromPattern(
  pattern: string,
  options: {
    caseSensitive?: boolean;
    wholeWord?: boolean;
    isLiteral?: boolean;
  } = {}
): RegExp {
  const {
    caseSensitive = false,
    wholeWord = false,
    isLiteral = false,
  } = options;

  // If it's already a regex literal (e.g., "/pattern/flags"), parse it
  if (!isLiteral) {
    const regexLiteral = parseRegexLiteral(pattern);
    if (regexLiteral) {
      // Ensure it has the global flag
      const flags = regexLiteral.flags.includes("g")
        ? regexLiteral.flags
        : regexLiteral.flags + "g";

      return new RegExp(regexLiteral.source, flags);
    }
  }

  // Otherwise, treat it as a plain string pattern
  let processedPattern = escapeRegExp(pattern);

  // Add word boundaries if whole word matching is enabled
  if (wholeWord) {
    processedPattern = `\\b${processedPattern}\\b`;
  }

  // Create the regex with appropriate flags
  const flags = caseSensitive ? "g" : "gi";
  return new RegExp(processedPattern, flags);
}

/**
 * Truncate a string to a maximum length, adding an ellipsis if truncated
 * @param str String to truncate
 * @param maxLength Maximum length
 * @param ellipsis Ellipsis string
 * @returns Truncated string
 */
export function truncate(
  str: string,
  maxLength: number,
  ellipsis = "..."
): string {
  if (str.length <= maxLength) return str;
  return str.substring(0, maxLength - ellipsis.length) + ellipsis;
}

/**
 * Extract a snippet of text around a match
 * @param text Full text
 * @param matchIndex Index of the match
 * @param contextLength Number of characters to include before and after the match
 * @param matchLength Length of the match
 * @returns Text snippet
 */
export function extractSnippet(
  text: string,
  matchIndex: number,
  contextLength = 50,
  matchLength = 1
): string {
  if (!text) return "";

  const start = Math.max(0, matchIndex - contextLength);
  const end = Math.min(text.length, matchIndex + matchLength + contextLength);

  let snippet = text.substring(start, end);

  // Add ellipsis if we truncated the text
  if (start > 0) snippet = "..." + snippet;
  if (end < text.length) snippet = snippet + "...";

  return snippet;
}

/**
 * Normalize a string for case-insensitive comparison
 * @param str String to normalize
 * @returns Normalized string
 */
export function normalizeString(str: string): string {
  return str.toLowerCase().trim();
}

/**
 * Check if a string contains another string, with case sensitivity option
 * @param text Text to search in
 * @param search Text to search for
 * @param caseSensitive Whether to use case-sensitive comparison
 * @returns True if the text contains the search string
 */
export function containsString(
  text: string,
  search: string,
  caseSensitive = false
): boolean {
  if (!text || !search) return false;

  if (caseSensitive) {
    return text.includes(search);
  } else {
    return text.toLowerCase().includes(search.toLowerCase());
  }
}

/**
 * Find all occurrences of a string in text
 * @param text Text to search in
 * @param search Text to search for
 * @param caseSensitive Whether to use case-sensitive comparison
 * @returns Array of match indices
 */
export function findAllOccurrences(
  text: string,
  search: string,
  caseSensitive = false
): number[] {
  if (!text || !search) return [];

  const indices: number[] = [];
  const searchText = caseSensitive ? text : text.toLowerCase();
  const searchTerm = caseSensitive ? search : search.toLowerCase();

  let index = -1;
  while ((index = searchText.indexOf(searchTerm, index + 1)) !== -1) {
    indices.push(index);
  }

  return indices;
}

/**
 * Split a string into lines
 * @param text Text to split
 * @returns Array of lines
 */
export function splitLines(text: string): string[] {
  if (!text) return [];
  return text.split(/\r?\n/);
}

/**
 * Join lines into a string with the specified line ending
 * @param lines Lines to join
 * @param lineEnding Line ending to use
 * @returns Joined string
 */
export function joinLines(lines: string[], lineEnding = "\n"): string {
  return lines.join(lineEnding);
}

/**
 * Get the line and column for a position in text
 * @param text Text to analyze
 * @param position Position in the text
 * @returns Line and column information
 */
export function getLineAndColumn(
  text: string,
  position: number
): { line: number; column: number } {
  if (!text || position < 0 || position > text.length) {
    throw AppError.validationError("Invalid position", "position", position);
  }

  const lines = splitLines(text.substring(0, position));
  const line = lines.length;
  const column = lines[lines.length - 1]?.length + 1 || 1;

  return { line, column };
}
