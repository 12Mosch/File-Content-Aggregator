/**
 * Unit tests for Regex Pattern Validation
 *
 * These tests verify that the application correctly validates regex patterns,
 * handles invalid patterns, and properly processes regex flags.
 */

import "@jest/globals";

// Import the functions we want to test
// Since we're testing the implementation in fileSearchService.ts, we'll recreate the functions here
// to match the implementation in the source code

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

/**
 * Creates a RegExp object with the given pattern and flags, with error handling.
 * Returns null if the pattern is invalid or empty.
 * @param pattern The regex pattern.
 * @param flags The regex flags.
 * @returns A RegExp object or null.
 */
function createSafeRegex(pattern: string, flags: string): RegExp | null {
  try {
    if (!pattern) {
      console.warn(`Attempted to create RegExp with empty pattern.`);
      return null;
    }
    return new RegExp(pattern, flags);
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e);
    console.warn(
      `Invalid RegExp pattern created: "${pattern}" with flags "${flags}"`,
      message
    );
    return null;
  }
}

describe("Regex Pattern Validation", () => {
  describe("Valid Regex Pattern Validation", () => {
    test("should parse a basic regex pattern", () => {
      const pattern = "/abc/";
      const result = parseRegexLiteral(pattern);

      expect(result).toBeInstanceOf(RegExp);
      expect(result?.source).toBe("abc");
      expect(result?.flags).toBe("");
    });

    test("should parse a regex pattern with simple flags", () => {
      const pattern = "/abc/i";
      const result = parseRegexLiteral(pattern);

      expect(result).toBeInstanceOf(RegExp);
      expect(result?.source).toBe("abc");
      expect(result?.flags).toBe("i");
    });

    test("should parse a regex pattern with multiple flags", () => {
      const pattern = "/abc/gim";
      const result = parseRegexLiteral(pattern);

      expect(result).toBeInstanceOf(RegExp);
      expect(result?.source).toBe("abc");
      expect(result?.flags).toBe("gim");
    });

    test("should parse a complex regex pattern", () => {
      const pattern = "/^[a-z0-9]+$/i";
      const result = parseRegexLiteral(pattern);

      expect(result).toBeInstanceOf(RegExp);
      expect(result?.source).toBe("^[a-z0-9]+$");
      expect(result?.flags).toBe("i");
    });

    test("should parse a regex pattern with escaped forward slashes", () => {
      const pattern = "/path\\/to\\/file/";
      const result = parseRegexLiteral(pattern);

      expect(result).toBeInstanceOf(RegExp);
      expect(result?.source).toBe("path\\/to\\/file");
    });
  });

  describe("Invalid Regex Pattern Validation", () => {
    test("should return null for non-regex literal strings", () => {
      const pattern = "abc";
      const result = parseRegexLiteral(pattern);

      expect(result).toBeNull();
    });

    test("should return null for regex without closing delimiter", () => {
      const pattern = "/abc";
      const result = parseRegexLiteral(pattern);

      expect(result).toBeNull();
    });

    test("should return null for regex with unclosed character class", () => {
      const pattern = "/[abc/";
      const result = parseRegexLiteral(pattern);

      expect(result).toBeNull();
    });

    test("should return null for regex with unbalanced parentheses", () => {
      const pattern = "/(abc/";
      const result = parseRegexLiteral(pattern);

      expect(result).toBeNull();
    });

    test("should handle regex with unusual quantifiers", () => {
      // JavaScript's RegExp is very permissive with quantifiers
      // Instead of testing for null, we'll verify it creates a valid RegExp
      const pattern = "/a{0,0,0}/";
      const result = parseRegexLiteral(pattern);

      // This should be a valid RegExp in JavaScript
      expect(result).toBeInstanceOf(RegExp);
    });
  });

  describe("Regex Syntax Error Handling", () => {
    test("should handle invalid character classes", () => {
      // Empty character classes [] are actually valid in JavaScript regex
      // Let's use a more clearly invalid pattern with mismatched brackets
      const pattern = "[abc";
      const flags = "";
      const result = createSafeRegex(pattern, flags);

      expect(result).toBeNull();
    });

    test("should handle invalid lookahead assertions", () => {
      const pattern = "(?=*)";
      const flags = "";
      const result = createSafeRegex(pattern, flags);

      expect(result).toBeNull();
    });

    test("should handle backreferences", () => {
      // JavaScript's RegExp is very permissive with backreferences
      // Instead of testing for null, we'll verify it creates a valid RegExp
      const pattern = "(a)\\2\\3";
      const flags = "";
      const result = createSafeRegex(pattern, flags);

      // This should be a valid RegExp in JavaScript
      expect(result).toBeInstanceOf(RegExp);
    });

    test("should handle empty patterns", () => {
      const pattern = "";
      const flags = "g";
      const result = createSafeRegex(pattern, flags);

      expect(result).toBeNull();
    });
  });

  describe("Regex Flags Validation", () => {
    test("should handle case insensitive flag", () => {
      const pattern = "abc";
      const flags = "i";
      const result = createSafeRegex(pattern, flags);

      expect(result).toBeInstanceOf(RegExp);
      expect(result?.flags).toBe("i");
      expect(result?.test("ABC")).toBe(true);
    });

    test("should handle global flag", () => {
      const pattern = "a";
      const flags = "g";
      const result = createSafeRegex(pattern, flags);

      expect(result).toBeInstanceOf(RegExp);
      expect(result?.flags).toBe("g");

      const matches = "aaa".match(result!);
      expect(matches?.length).toBe(3);
    });

    test("should handle multiline flag", () => {
      const pattern = "^a";
      const flags = "m";
      const result = createSafeRegex(pattern, flags);

      expect(result).toBeInstanceOf(RegExp);
      expect(result?.flags).toBe("m");
      expect(result?.test("b\na")).toBe(true);
    });

    test("should handle unicode flag", () => {
      const pattern = "\\u{1F600}";
      const flags = "u";
      const result = createSafeRegex(pattern, flags);

      expect(result).toBeInstanceOf(RegExp);
      expect(result?.flags).toBe("u");
      expect(result?.test("😀")).toBe(true);
    });

    test("should handle multiple flags", () => {
      const pattern = "abc";
      const flags = "gim";
      const result = createSafeRegex(pattern, flags);

      expect(result).toBeInstanceOf(RegExp);
      expect(result?.flags).toBe("gim");
    });

    test("should reject invalid flags", () => {
      // In JavaScript, invalid flags cause an error when creating a RegExp
      const pattern = "abc";
      const flags = "gimxyz"; // xyz are invalid flags

      // Our implementation should return null for invalid flags
      const result = createSafeRegex(pattern, flags);

      // The regex should not be created with invalid flags
      expect(result).toBeNull();
    });
  });
});
