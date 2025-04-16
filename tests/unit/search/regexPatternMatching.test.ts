/**
 * Unit tests for Regex Pattern Matching
 *
 * These tests verify that the application correctly matches regex patterns against content,
 * handles different regex features, and properly processes matches.
 */

import "@jest/globals";

/**
 * Finds all indices of a term in content.
 * @param content The content to search in.
 * @param term The term to search for (string or RegExp).
 * @param caseSensitive Whether the search is case-sensitive.
 * @param isRegex Whether the term is a RegExp.
 * @returns An array of indices where the term was found.
 */
function findTermIndices(
  content: string,
  term: string | RegExp,
  caseSensitive: boolean = true,
  isRegex: boolean = false
): number[] {
  const indices: number[] = [];

  if (isRegex && term instanceof RegExp) {
    // Ensure the regex has the global flag for iterative searching
    const regex = new RegExp(
      term.source,
      term.flags.includes("g") ? term.flags : term.flags + "g"
    );
    let match;
    while ((match = regex.exec(content)) !== null) {
      indices.push(match.index);
      // Prevent infinite loops with zero-width matches
      if (match.index === regex.lastIndex) {
        regex.lastIndex++;
      }
    }
  } else if (typeof term === "string") {
    const searchTerm = caseSensitive ? term : term.toLowerCase();
    const searchContent = caseSensitive ? content : content.toLowerCase();
    let i = -1;
    while ((i = searchContent.indexOf(searchTerm, i + 1)) !== -1) {
      indices.push(i);
    }
  }
  return indices;
}

/**
 * Parses a regex literal string (e.g., "/pattern/flags") into a RegExp object.
 * Returns null if the string is not a valid regex literal.
 * @param pattern The string to parse.
 * @returns A RegExp object or null.
 */
function parseRegexLiteral(pattern: string): RegExp | null {
  const regexMatch = pattern.match(/^\/(.+)\/([gimyus]*)$/);
  if (regexMatch) {
    try {
      return new RegExp(regexMatch[1], regexMatch[2]);
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e);
      console.warn(`Invalid RegExp literal format: ${pattern}`, message);
      return null;
    }
  }
  return null;
}

describe("Regex Pattern Matching", () => {
  describe("Basic Pattern Matching", () => {
    test("should match simple patterns", () => {
      const content = "This is a test string";
      const regex = /test/;

      const result = findTermIndices(content, regex, true, true);

      expect(result.length).toBe(1);
      expect(result[0]).toBe(10); // "test" starts at index 10
    });

    test("should match multiple occurrences", () => {
      const content = "test this test string test";
      const regex = /test/g;

      const result = findTermIndices(content, regex, true, true);

      expect(result.length).toBe(3);
      expect(result).toEqual([0, 10, 22]); // "test" appears at these indices
    });

    test("should handle case sensitivity", () => {
      const content = "Test this TEST string test";

      // Case sensitive
      const regexSensitive = /test/g;
      const resultSensitive = findTermIndices(
        content,
        regexSensitive,
        true,
        true
      );
      expect(resultSensitive.length).toBe(1);
      expect(resultSensitive[0]).toBe(22);

      // Case insensitive
      const regexInsensitive = /test/gi;
      const resultInsensitive = findTermIndices(
        content,
        regexInsensitive,
        false,
        true
      );
      expect(resultInsensitive.length).toBe(3);
    });

    test("should match at word boundaries", () => {
      const content = "test testing tested contest";
      const regex = /\btest\b/g; // Match "test" as a whole word

      const result = findTermIndices(content, regex, true, true);

      expect(result.length).toBe(1);
      expect(result[0]).toBe(0); // Only the standalone "test" should match
    });
  });

  describe("Character Classes", () => {
    test("should match digit character class", () => {
      const content = "abc123def456";
      const regex = /\d+/g; // Match one or more digits

      const result = findTermIndices(content, regex, true, true);

      expect(result.length).toBe(2);
      expect(result).toEqual([3, 9]); // "123" starts at index 3, "456" starts at index 9
    });

    test("should match word character class", () => {
      const content = "abc_123 !@#";
      const regex = /\w+/g; // Match one or more word characters

      const result = findTermIndices(content, regex, true, true);

      expect(result.length).toBe(1);
      expect(result[0]).toBe(0); // "abc_123" starts at index 0
    });

    test("should match custom character classes", () => {
      const content = "abc123def456";
      const regex = /[a-z]+/g; // Match one or more lowercase letters

      const result = findTermIndices(content, regex, true, true);

      expect(result.length).toBe(2);
      expect(result).toEqual([0, 6]); // "abc" starts at index 0, "def" starts at index 6
    });

    test("should match negated character classes", () => {
      const content = "abc123def456";
      const regex = /[^0-9]+/g; // Match one or more non-digits

      const result = findTermIndices(content, regex, true, true);

      expect(result.length).toBe(2);
      expect(result).toEqual([0, 6]); // "abc" starts at index 0, "def" starts at index 6
    });
  });

  describe("Quantifiers", () => {
    test("should match with * quantifier", () => {
      const content = "aaa bbb ccc";
      const regex = /a*/g; // Match zero or more 'a's

      const result = findTermIndices(content, regex, true, true);

      // This will match at the start of each non-'a' character and at the beginning
      expect(result.length).toBeGreaterThan(1);
      expect(result[0]).toBe(0); // "aaa" starts at index 0
    });

    test("should match with + quantifier", () => {
      const content = "aaa bbb ccc";
      const regex = /a+/g; // Match one or more 'a's

      const result = findTermIndices(content, regex, true, true);

      expect(result.length).toBe(1);
      expect(result[0]).toBe(0); // "aaa" starts at index 0
    });

    test("should match with ? quantifier", () => {
      const content = "color colour";
      const regex = /colou?r/g; // Match "color" or "colour"

      const result = findTermIndices(content, regex, true, true);

      expect(result.length).toBe(2);
      expect(result).toEqual([0, 6]); // "color" starts at index 0, "colour" starts at index 6
    });

    test("should match with {} quantifier", () => {
      const content = "a aa aaa aaaa";
      const regex = /a{2,3}/g; // Match 2 or 3 consecutive 'a's

      const result = findTermIndices(content, regex, true, true);

      expect(result.length).toBe(3);
      // "aa" in "aa", "aaa" in "aaa", and "aaa" in "aaaa"
      expect(result).toContain(2); // "aa" starts at index 2
      expect(result).toContain(5); // "aaa" starts at index 5
      expect(result).toContain(9); // "aaa" in "aaaa" starts at index 9
    });

    test("should match with greedy quantifiers", () => {
      const content = "<div>content</div>";
      const regex = /<.*>/g; // Greedy match - matches the entire string

      const result = findTermIndices(content, regex, true, true);

      expect(result.length).toBe(1);
      expect(result[0]).toBe(0); // Matches the entire string
    });

    test("should match with lazy quantifiers", () => {
      const content = "<div>content</div>";
      const regex = /<.*?>/g; // Lazy match - matches each tag separately

      const result = findTermIndices(content, regex, true, true);

      expect(result.length).toBe(2);
      expect(result).toEqual([0, 12]); // "<div>" starts at index 0, "</div>" starts at index 12
    });
  });

  describe("Capturing Groups", () => {
    test("should match with capturing groups", () => {
      const content = "test@example.com admin@test.org";
      const regex = /([a-z]+)@([a-z]+)\.(com|org)/g;

      const result = findTermIndices(content, regex, true, true);

      expect(result.length).toBe(2);
      expect(result).toEqual([0, 17]); // Matches both email addresses
    });

    test("should match with backreferences", () => {
      const content = "regex regex repeat repeat";
      const regex = /\b(\w+)\s+\1\b/g; // Match repeated words

      const result = findTermIndices(content, regex, true, true);

      expect(result.length).toBe(2);
      expect(result).toEqual([0, 12]); // Matches "regex regex" and "repeat repeat"
    });

    test("should match with non-capturing groups", () => {
      const content = "abc123 def456";
      const regex = /(?:[a-z]+)(\d+)/g; // Non-capturing group for letters, capturing group for digits

      const result = findTermIndices(content, regex, true, true);

      expect(result.length).toBe(2);
      expect(result).toEqual([0, 7]); // Matches "abc123" and "def456"
    });
  });

  describe("Lookahead/Lookbehind Assertions", () => {
    test("should match with positive lookahead", () => {
      const content = "password123 username";
      const regex = /\b\w+(?=\d)/g; // Match word followed by a digit

      const result = findTermIndices(content, regex, true, true);

      expect(result.length).toBe(1);
      expect(result[0]).toBe(0); // Matches "password" in "password123"
    });

    test("should match with negative lookahead", () => {
      const content = "password123 username";
      const regex = /\b\w+(?!\d)/g; // Match word not followed by a digit

      const result = findTermIndices(content, regex, true, true);

      expect(result.length).toBe(2);
      // This will match both "password" (because the lookahead only checks after the match)
      // and "username" (because it's not followed by a digit)
      expect(result).toContain(0); // Matches "password"
      expect(result).toContain(12); // Matches "username"
    });

    test("should match with positive lookbehind", () => {
      const content = "$100 €50 £75";
      const regex = /(?<=\$)\d+/g; // Match digits preceded by $

      const result = findTermIndices(content, regex, true, true);

      expect(result.length).toBe(1);
      expect(result[0]).toBe(1); // Matches "100" in "$100"
    });

    test("should match with negative lookbehind", () => {
      const content = "$100 €50 £75";
      const regex = /(?<!\$)\d+/g; // Match digits not preceded by $

      const result = findTermIndices(content, regex, true, true);

      expect(result.length).toBe(3);
      // This will match all digits not directly preceded by $
      // Including the "00" in "$100" because the lookbehind only checks the character immediately before
      expect(result).toContain(2); // Matches "00" in "$100"
      expect(result).toContain(6); // Matches "50" in "€50"
      expect(result).toContain(10); // Matches "75" in "£75"
    });
  });

  describe("Boundary Assertions", () => {
    test("should match at the beginning of a string", () => {
      const content = "test string";
      const regex = /^test/g; // Match "test" at the beginning

      const result = findTermIndices(content, regex, true, true);

      expect(result.length).toBe(1);
      expect(result[0]).toBe(0); // "test" starts at index 0
    });

    test("should match at the end of a string", () => {
      const content = "this is a test";
      const regex = /test$/g; // Match "test" at the end

      const result = findTermIndices(content, regex, true, true);

      expect(result.length).toBe(1);
      expect(result[0]).toBe(10); // "test" starts at index 10
    });

    test("should match at word boundaries", () => {
      const content = "test testing tested contest";
      const regex = /\btest\b/g; // Match "test" as a whole word

      const result = findTermIndices(content, regex, true, true);

      expect(result.length).toBe(1);
      expect(result[0]).toBe(0); // Only the standalone "test" should match
    });

    test("should match at non-word boundaries", () => {
      const content = "atestb testing tested contest";
      const regex = /\Btest\B/g; // Match "test" not at word boundaries

      const result = findTermIndices(content, regex, true, true);

      expect(result.length).toBe(1);
      expect(result[0]).toBe(1); // Matches "test" in "atestb"
    });
  });

  describe("Integration with parseRegexLiteral", () => {
    test("should parse and match regex literal", () => {
      const content = "test123";
      const regexLiteral = "/\\d+/";

      const regex = parseRegexLiteral(regexLiteral);
      expect(regex).not.toBeNull();

      const result = findTermIndices(content, regex!, true, true);

      expect(result.length).toBe(1);
      expect(result[0]).toBe(4); // "123" starts at index 4
    });

    test("should parse and match regex literal with flags", () => {
      const content = "Test TEST test";
      const regexLiteral = "/test/gi";

      const regex = parseRegexLiteral(regexLiteral);
      expect(regex).not.toBeNull();

      const result = findTermIndices(content, regex!, true, true);

      expect(result.length).toBe(3);
      expect(result).toEqual([0, 5, 10]); // Matches all three occurrences
    });

    test("should handle invalid regex literals", () => {
      const content = "test123";
      const invalidRegexLiteral = "/[unclosed/";

      const regex = parseRegexLiteral(invalidRegexLiteral);
      expect(regex).toBeNull();
    });
  });
});
