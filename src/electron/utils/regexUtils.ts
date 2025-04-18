/**
 * Regex utility functions
 */

/**
 * Creates a safe regular expression from a pattern and flags.
 * Returns null if the pattern is invalid.
 * @param pattern The regex pattern
 * @param flags The regex flags
 * @returns A RegExp object or null if invalid
 */
export function createSafeRegex(
  pattern: string,
  flags: string = ""
): RegExp | null {
  try {
    return new RegExp(pattern, flags);
  } catch (_error) {
    console.error(`Invalid regex pattern: ${pattern}`);
    return null;
  }
}

/**
 * Parses a regex literal string (e.g., "/pattern/flags") into a RegExp object.
 * Returns null if the string is not a valid regex literal.
 * @param str The string to parse
 * @returns A RegExp object or null
 */
export function parseRegexLiteral(str: string): RegExp | null {
  if (!str) return null;

  // Check if the string is a regex literal (e.g., "/pattern/flags")
  const regexMatch = /^\/(.+)\/([gimuy]*)$/.exec(str);
  if (!regexMatch) return null;

  try {
    const pattern = regexMatch[1];
    const flags = regexMatch[2];
    return new RegExp(pattern, flags);
  } catch (_error) {
    console.error(`Invalid regex literal: ${str}`);
    return null;
  }
}

/**
 * Escapes special characters in a string for use in a regular expression.
 * @param string The string to escape
 * @returns The escaped string
 */
export function escapeRegExp(string: string): string {
  return string.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); // $& means the whole matched string
}

/**
 * Tests if a string is a valid regular expression.
 * @param pattern The regex pattern to test
 * @returns True if the pattern is a valid regex, false otherwise
 */
export function isValidRegex(pattern: string): boolean {
  try {
    new RegExp(pattern);
    return true;
  } catch (_error) {
    return false;
  }
}
