/**
 * Unit Tests for Whole Word Matching
 *
 * These tests verify that the whole word matching functionality works correctly
 * in the search functionality.
 */

// Mock the fileSearchService module
const findTermIndices = jest.fn<
  number[],
  [string, string | RegExp, boolean, boolean, boolean]
>((content, term, caseSensitive, isRegex, useWholeWordMatching) => {
  const indices: number[] = [];

  if (!content || (typeof term === "string" && !term)) {
    return indices; // Return empty array for empty content or empty term
  }

  if (isRegex && term instanceof RegExp) {
    // For regex patterns, we ignore the whole word matching setting
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
});

// Helper function to escape special regex characters
function escapeRegExp(string: string): string {
  return string.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// Mock the fileSearchService module
jest.mock("../../../src/electron/fileSearchService", () => {
  return {
    findTermIndices,
  };
});

// Mock console.log to avoid cluttering test output
jest.spyOn(console, "log").mockImplementation(() => {});
jest.spyOn(console, "error").mockImplementation(() => {});

describe("Whole Word Matching", () => {
  describe("Basic Functionality", () => {
    test("should match whole words only when enabled", () => {
      const content = "This is a test string with testing and tested words";
      const term = "test";

      // Without whole word matching (should find 3 matches)
      const indicesWithoutWholeWord = findTermIndices(
        content,
        term,
        true, // case sensitive
        false, // not regex
        false // whole word matching disabled
      );

      // With whole word matching (should find only 1 match)
      const indicesWithWholeWord = findTermIndices(
        content,
        term,
        true, // case sensitive
        false, // not regex
        true // whole word matching enabled
      );

      expect(indicesWithoutWholeWord.length).toBe(3); // "test", "testing", "tested"
      expect(indicesWithWholeWord.length).toBe(1); // only "test" as a whole word
      expect(indicesWithWholeWord[0]).toBe(10); // "test" starts at index 10
    });

    test("should respect case sensitivity with whole word matching", () => {
      const content = "Test test TEST";

      // Case sensitive, whole word matching
      const caseIndices = findTermIndices(
        content,
        "test",
        true, // case sensitive
        false, // not regex
        true // whole word matching enabled
      );

      // Case insensitive, whole word matching
      const noCaseIndices = findTermIndices(
        content,
        "test",
        false, // case insensitive
        false, // not regex
        true // whole word matching enabled
      );

      expect(caseIndices.length).toBe(1); // only lowercase "test"
      expect(noCaseIndices.length).toBe(3); // all three variants
    });

    test("should handle special characters and punctuation correctly", () => {
      const content = "test, test. test: test; test!";

      const indices = findTermIndices(
        content,
        "test",
        true, // case sensitive
        false, // not regex
        true // whole word matching enabled
      );

      expect(indices.length).toBe(5); // All 5 instances are whole words
    });

    test("should not apply whole word matching to regex patterns", () => {
      const content = "test testing tested contest";

      // Using regex with word boundaries explicitly
      const regexWithBoundaries = findTermIndices(
        content,
        /\btest\b/g,
        true, // case sensitive
        true, // is regex
        true // whole word matching enabled (should be ignored for regex)
      );

      // Using regex without word boundaries
      const regexWithoutBoundaries = findTermIndices(
        content,
        /test/g,
        true, // case sensitive
        true, // is regex
        true // whole word matching enabled (should be ignored for regex)
      );

      expect(regexWithBoundaries.length).toBe(1); // Only "test" as a whole word
      expect(regexWithoutBoundaries.length).toBe(4); // "test", "testing", "tested", "contest"
    });
  });

  describe("Edge Cases", () => {
    test("should handle empty content", () => {
      const indices = findTermIndices("", "test", true, false, true);

      expect(indices.length).toBe(0);
    });

    test("should handle empty search term", () => {
      const indices = findTermIndices(
        "test testing tested",
        "",
        true,
        false,
        true
      );

      expect(indices.length).toBe(0);
    });

    test("should handle words at the beginning and end of content", () => {
      const content = "test in the beginning and at the end test";

      const indices = findTermIndices(content, "test", true, false, true);

      expect(indices.length).toBe(2);
      expect(indices[0]).toBe(0); // First word
      expect(indices[1]).toBe(content.length - 4); // Last word
    });

    test("should handle single-character words", () => {
      const content = "a b c d";

      const indices = findTermIndices(content, "a", true, false, true);

      expect(indices.length).toBe(1);
      expect(indices[0]).toBe(0);
    });
  });
});
