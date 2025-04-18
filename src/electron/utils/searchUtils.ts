/**
 * Search Utilities
 * 
 * Utility functions for searching content.
 */

/**
 * Finds all occurrences of a term in content
 * @param content The content to search in
 * @param term The term to search for
 * @param caseSensitive Whether to use case-sensitive matching
 * @param isRegex Whether the term is a regular expression
 * @param useWholeWordMatching Whether to match whole words only
 * @returns An array of match positions
 */
export function findTermIndices(
  content: string,
  term: string | RegExp,
  caseSensitive = false,
  isRegex = false,
  useWholeWordMatching = false
): number[] {
  const indices: number[] = [];

  if (!content || (typeof term === "string" && !term)) {
    return indices; // Return empty array for empty content or empty term
  }

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
}

/**
 * Escapes special characters in a string for use in a RegExp
 * @param string The string to escape
 * @returns The escaped string
 */
function escapeRegExp(string: string): string {
  return string.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
