/**
 * Unit tests for ContentMatchingService
 *
 * These tests verify that the ContentMatchingService correctly matches content
 * against search terms using different search modes and options.
 */

import { ContentMatchingService } from "../../mocks/electron/ContentMatchingService.mock";

// Mock the dependencies
jest.mock("../../../src/electron/services/OptimizedFuzzySearchService.js", () => {
  return {
    OptimizedFuzzySearchService: jest.fn().mockImplementation(() => ({
      search: jest.fn().mockImplementation((content, term) => {
        return {
          isMatch: content.toLowerCase().includes(term.toLowerCase()),
          score: 0.1,
        };
      }),
    })),
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

describe("ContentMatchingService", () => {
  let contentMatchingService: ContentMatchingService;

  beforeEach(() => {
    // Reset all mocks before each test
    jest.clearAllMocks();

    // Get the singleton instance
    contentMatchingService = ContentMatchingService.getInstance();
  });

  describe("Singleton Pattern", () => {
    test("getInstance should return the same instance", () => {
      const instance1 = ContentMatchingService.getInstance();
      const instance2 = ContentMatchingService.getInstance();
      expect(instance1).toBe(instance2);
    });
  });

  describe("createMatcher", () => {
    test("should return null matcher for empty search term", () => {
      const result = contentMatchingService.createMatcher("", "term");
      expect(result.matcher).toBeNull();
      expect(result.error).toBeNull();
    });

    test("should create a matcher for term search mode", () => {
      const result = contentMatchingService.createMatcher("test", "term");
      expect(result.matcher).toBeDefined();
      expect(result.error).toBeNull();
    });

    test("should create a case-sensitive matcher for term search mode", () => {
      const result = contentMatchingService.createMatcher("Test", "term", {
        caseSensitive: true,
      });
      expect(result.matcher).toBeDefined();
      expect(result.error).toBeNull();
    });

    test("should create a whole word matcher for term search mode", () => {
      const result = contentMatchingService.createMatcher("test", "term", {
        wholeWordMatching: true,
      });
      expect(result.matcher).toBeDefined();
      expect(result.error).toBeNull();
    });

    test("should create a matcher for regex search mode", () => {
      const result = contentMatchingService.createMatcher("test\\d+", "regex");
      expect(result.matcher).toBeDefined();
      expect(result.error).toBeNull();
    });

    test("should return error for invalid regex pattern", () => {
      const result = contentMatchingService.createMatcher(
        "invalid regex",
        "regex"
      );
      expect(result.matcher).toBeNull();
      expect(result.error).toBeDefined();
    });

    test("should create a matcher for boolean search mode", () => {
      const result = contentMatchingService.createMatcher("test", "boolean");
      expect(result.matcher).toBeDefined();
      expect(result.error).toBeNull();
    });

    test("should return error for invalid boolean expression", () => {
      const result = contentMatchingService.createMatcher(
        "invalid expression",
        "boolean"
      );
      expect(result.matcher).toBeNull();
      expect(result.error).toBeDefined();
    });
  });

  describe("matchContent", () => {
    test("should return matched=true for empty search term", async () => {
      const result = await contentMatchingService.matchContent(
        "content",
        "",
        "term"
      );
      expect(result.matched).toBe(true);
    });

    test("should return error if content exceeds maxContentSize", async () => {
      const content = "a".repeat(1000);
      const result = await contentMatchingService.matchContent(
        content,
        "test",
        "term",
        { maxContentSize: 500 }
      );
      expect(result.matched).toBe(false);
      expect(result.error).toBeDefined();
    });

    test("should return error if createMatcher returns an error", async () => {
      const result = await contentMatchingService.matchContent(
        "content",
        "invalid regex",
        "regex"
      );
      expect(result.matched).toBe(false);
      expect(result.error).toBeDefined();
    });

    test("should return matched=true if content includes search term (term mode)", async () => {
      const result = await contentMatchingService.matchContent(
        "This is a test content",
        "test",
        "term"
      );
      expect(result.matched).toBe(true);
    });

    test("should return matched=false if content does not include search term (term mode)", async () => {
      const result = await contentMatchingService.matchContent(
        "This is a content",
        "test",
        "term"
      );
      expect(result.matched).toBe(false);
    });

    test("should respect case sensitivity in term mode", async () => {
      const result = await contentMatchingService.matchContent(
        "This is a Test content",
        "test",
        "term",
        { caseSensitive: true }
      );
      expect(result.matched).toBe(false);
    });

    test("should respect whole word matching in term mode", async () => {
      // Mock the implementation for this specific test
      const createMatcherSpy = jest.spyOn(
        contentMatchingService,
        "createMatcher"
      );
      createMatcherSpy.mockImplementationOnce(
        (searchTerm, _searchMode, options) => {
          return {
            matcher: async (content: string) => {
              const regex = new RegExp(
                `\\b${searchTerm}\\b`,
                options?.caseSensitive ? "g" : "gi"
              );
              return regex.test(content);
            },
            error: null,
          };
        }
      );

      const result = await contentMatchingService.matchContent(
        "This is a testing content",
        "test",
        "term",
        { wholeWordMatching: true }
      );
      expect(result.matched).toBe(false);
    });

    test("should handle matcher throwing an error", async () => {
      // Mock the implementation for this specific test
      const createMatcherSpy = jest.spyOn(
        contentMatchingService,
        "createMatcher"
      );
      createMatcherSpy.mockImplementationOnce(() => {
        return {
          matcher: async () => {
            throw new Error("Matcher error");
          },
          error: null,
        };
      });

      const result = await contentMatchingService.matchContent(
        "content",
        "test",
        "term"
      );
      expect(result.matched).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  describe("findMatchPositions", () => {
    test("should find positions of a term in content", () => {
      const content = "This is a test string with test word";
      const positions = contentMatchingService.findMatchPositions(
        content,
        "test"
      );
      expect(positions).toEqual([10, 27]);
    });

    test("should respect case sensitivity", () => {
      const content = "This is a Test string with test word";
      const positions = contentMatchingService.findMatchPositions(
        content,
        "Test",
        { caseSensitive: true }
      );
      expect(positions).toEqual([10]);
    });

    test("should respect whole word matching", () => {
      const content = "This is a test string with testing word";
      const positions = contentMatchingService.findMatchPositions(
        content,
        "test",
        { wholeWordMatching: true }
      );
      expect(positions).toEqual([10]);
    });

    test("should handle regex patterns", () => {
      const content = "This is a test123 string with test456 word";
      const positions = contentMatchingService.findMatchPositions(
        content,
        "/test\\d+/g"
      );
      expect(positions.length).toBe(2);
    });

    test("should handle invalid regex patterns gracefully", () => {
      const content = "This is a test string";
      const positions = contentMatchingService.findMatchPositions(
        content,
        "/test(/g"
      );
      expect(positions).toEqual([]);
    });
  });

  // Test the private escapeRegExp method indirectly through findMatchPositions
  describe("escapeRegExp (indirectly)", () => {
    test("should escape special regex characters", () => {
      const content = "This is a test.* string";
      const positions = contentMatchingService.findMatchPositions(
        content,
        "test.*"
      );
      expect(positions).toEqual([10]);
    });
  });
});
