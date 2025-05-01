/**
 * Boundary tests for ContentMatchingService
 *
 * These tests verify that the ContentMatchingService correctly handles edge cases
 * and boundary conditions.
 */

import { ContentMatchingService } from "../../mocks/electron/ContentMatchingService.mock";

// Mock the dependencies
jest.mock("../../../src/electron/services/FuzzySearchService.js", () => {
  return {
    FuzzySearchService: {
      getInstance: jest.fn().mockReturnValue({
        search: jest.fn().mockImplementation((content, term) => {
          return {
            isMatch: content.toLowerCase().includes(term.toLowerCase()),
            score: 0.1,
          };
        }),
      }),
    },
  };
});

jest.mock("../../../src/electron/services/NearOperatorService.js", () => {
  return {
    NearOperatorService: {
      getInstance: jest.fn().mockReturnValue({
        evaluateNear: jest
          .fn()
          .mockImplementation((content, term1, term2, _distance) => {
            return (
              content.includes(term1.toString()) &&
              content.includes(term2.toString())
            );
          }),
      }),
    },
  };
});

jest.mock("../../../src/electron/services/WordBoundaryService.js", () => {
  return {
    WordBoundaryService: {
      getInstance: jest.fn().mockReturnValue({
        getWordBoundaries: jest.fn().mockImplementation((_content) => {
          return [];
        }),
        removeFromCache: jest.fn(),
      }),
    },
  };
});

// Mock jsep for boolean expression parsing
jest.mock("jsep", () => {
  return jest.fn().mockImplementation((expr) => {
    if (expr === "invalid expression") {
      throw new Error("Invalid expression");
    }
    return { type: "Literal", value: expr };
  });
});

// Mock the boolean expression utils
jest.mock("../../../src/electron/utils/booleanExpressionUtils.js", () => {
  return {
    evaluateBooleanAst: jest.fn().mockImplementation((ast, content) => {
      if (ast.value === "error") {
        throw new Error("Evaluation error");
      }
      return content.includes(ast.value);
    }),
  };
});

// Mock the regex utils
jest.mock("../../../src/electron/utils/regexUtils.js", () => {
  return {
    createSafeRegex: jest.fn().mockImplementation((pattern, flags) => {
      if (pattern === "invalid regex") {
        return null;
      }
      try {
        return new RegExp(pattern, flags);
      } catch (_error) {
        return null;
      }
    }),
  };
});

describe("ContentMatchingService Boundary Tests", () => {
  let contentMatchingService: ContentMatchingService;

  beforeEach(() => {
    // Reset all mocks before each test
    jest.clearAllMocks();

    // Get the singleton instance
    contentMatchingService = ContentMatchingService.getInstance();
  });

  describe("Edge Cases for createMatcher", () => {
    test("should handle empty content", async () => {
      const { matcher } = contentMatchingService.createMatcher("test", "term");
      if (matcher) {
        const result = await matcher("");
        expect(result).toBe(false);
      } else {
        fail("Matcher should not be null");
      }
    });

    test("should handle very long search terms", () => {
      const longTerm = "a".repeat(1000);
      const result = contentMatchingService.createMatcher(longTerm, "term");
      expect(result.matcher).toBeDefined();
      expect(result.error).toBeNull();
    });

    test("should handle search terms with special characters", () => {
      const specialTerm = "test!@#$%^&*()_+{}|:<>?";
      const result = contentMatchingService.createMatcher(specialTerm, "term");
      expect(result.matcher).toBeDefined();
      expect(result.error).toBeNull();
    });

    test("should handle unicode characters in search terms", () => {
      const unicodeTerm = "测试";
      const result = contentMatchingService.createMatcher(unicodeTerm, "term");
      expect(result.matcher).toBeDefined();
      expect(result.error).toBeNull();
    });
  });

  describe("Edge Cases for matchContent", () => {
    test("should handle empty content", async () => {
      const result = await contentMatchingService.matchContent(
        "",
        "test",
        "term"
      );
      expect(result.matched).toBe(false);
    });

    test("should handle null-like content", async () => {
      // @ts-expect-error - Testing with invalid input
      const result = await contentMatchingService.matchContent(
        null,
        "test",
        "term"
      );
      expect(result.matched).toBe(false);
    });

    test("should handle very large content", async () => {
      const largeContent = "a".repeat(1000000);
      const result = await contentMatchingService.matchContent(
        largeContent,
        "test",
        "term"
      );
      expect(result.matched).toBe(false);
    });

    test("should handle content with exactly maxContentSize", async () => {
      const content = "a".repeat(500);
      const result = await contentMatchingService.matchContent(
        content,
        "test",
        "term",
        { maxContentSize: 500 }
      );
      expect(result.matched).toBe(false);
      expect(result.error).toBeUndefined();
    });

    test("should handle content with exactly maxContentSize + 1", async () => {
      const content = "a".repeat(501);
      const result = await contentMatchingService.matchContent(
        content,
        "test",
        "term",
        { maxContentSize: 500 }
      );
      expect(result.matched).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  describe("Edge Cases for findMatchPositions", () => {
    test("should handle empty content", () => {
      const positions = contentMatchingService.findMatchPositions("", "test");
      expect(positions).toEqual([]);
    });

    test("should handle empty search term", () => {
      const positions = contentMatchingService.findMatchPositions(
        "content",
        ""
      );
      expect(positions).toEqual([]);
    });

    test("should handle term at the beginning of content", () => {
      const positions = contentMatchingService.findMatchPositions(
        "test content",
        "test"
      );
      expect(positions).toEqual([0]);
    });

    test("should handle term at the end of content", () => {
      const positions = contentMatchingService.findMatchPositions(
        "content test",
        "test"
      );
      expect(positions).toEqual([8]);
    });

    test("should handle term that is the entire content", () => {
      const positions = contentMatchingService.findMatchPositions(
        "test",
        "test"
      );
      expect(positions).toEqual([0]);
    });

    test("should handle overlapping matches", () => {
      const positions = contentMatchingService.findMatchPositions(
        "abababa",
        "aba"
      );
      expect(positions).toEqual([0, 2, 4]);
    });

    test("should handle regex with zero-width assertions", () => {
      const positions = contentMatchingService.findMatchPositions(
        "test1 test2 test3",
        "/test\\d(?=\\s)/g"
      );
      expect(positions.length).toBe(2); // Should match "test1" and "test2" but not "test3"
    });
  });

  describe("Whole Word Matching Edge Cases", () => {
    test("should handle word boundaries at the beginning of content", () => {
      const positions = contentMatchingService.findMatchPositions(
        "test content",
        "test",
        { wholeWordMatching: true }
      );
      expect(positions).toEqual([0]);
    });

    test("should handle word boundaries at the end of content", () => {
      const positions = contentMatchingService.findMatchPositions(
        "content test",
        "test",
        { wholeWordMatching: true }
      );
      expect(positions).toEqual([8]);
    });

    test("should not match substrings within words", () => {
      const positions = contentMatchingService.findMatchPositions(
        "testing",
        "test",
        { wholeWordMatching: true }
      );
      expect(positions).toEqual([]);
    });

    test("should handle punctuation as word boundaries", () => {
      const positions = contentMatchingService.findMatchPositions(
        "This is a test. Another test!",
        "test",
        { wholeWordMatching: true }
      );
      expect(positions).toEqual([10, 24]);
    });

    test("should handle special characters adjacent to words", () => {
      const positions = contentMatchingService.findMatchPositions(
        "(test) [test] {test}",
        "test",
        { wholeWordMatching: true }
      );
      expect(positions).toEqual([1, 8, 15]);
    });
  });

  describe("Case Sensitivity Edge Cases", () => {
    test("should handle mixed case in content with case-insensitive search", () => {
      const positions = contentMatchingService.findMatchPositions(
        "Test TEST test",
        "test",
        { caseSensitive: false }
      );
      expect(positions).toEqual([0, 5, 10]);
    });

    test("should handle mixed case in content with case-sensitive search", () => {
      const positions = contentMatchingService.findMatchPositions(
        "Test TEST test",
        "test",
        { caseSensitive: true }
      );
      expect(positions).toEqual([10]);
    });

    test("should handle mixed case in search term with case-insensitive search", () => {
      const positions = contentMatchingService.findMatchPositions(
        "test test test",
        "TeSt",
        { caseSensitive: false }
      );
      expect(positions).toEqual([0, 5, 10]);
    });

    test("should handle mixed case in search term with case-sensitive search", () => {
      const positions = contentMatchingService.findMatchPositions(
        "test Test TEST",
        "Test",
        { caseSensitive: true }
      );
      expect(positions).toEqual([5]);
    });
  });

  describe("Regex Pattern Edge Cases", () => {
    test("should handle regex with capturing groups", () => {
      const positions = contentMatchingService.findMatchPositions(
        "test123 test456",
        "/(test)(\\d+)/g"
      );
      expect(positions.length).toBe(2);
    });

    test("should handle regex with alternation", () => {
      const positions = contentMatchingService.findMatchPositions(
        "foo bar baz",
        "/(foo|bar|baz)/g"
      );
      expect(positions.length).toBe(3);
    });

    test("should handle regex with quantifiers", () => {
      const positions = contentMatchingService.findMatchPositions(
        "a aa aaa aaaa",
        "/a{2,3}/g"
      );
      expect(positions.length).toBe(3); // Should match "aa" in "aa", "aaa" in "aaa", and "aaa" in "aaaa"
    });

    test("should handle regex with character classes", () => {
      const positions = contentMatchingService.findMatchPositions(
        "a1 b2 c3 d4",
        "/[a-c]\\d/g"
      );
      expect(positions.length).toBe(3); // Should match "a1", "b2", "c3" but not "d4"
    });

    test("should handle regex with escaped special characters", () => {
      const positions = contentMatchingService.findMatchPositions(
        "a.b*c+d",
        "/a\\.b\\*c\\+d/g"
      );
      expect(positions.length).toBe(1);
    });
  });
});
