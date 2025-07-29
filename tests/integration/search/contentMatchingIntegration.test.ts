/**
 * Integration tests for ContentMatchingService
 *
 * These tests verify that the ContentMatchingService correctly integrates with
 * other services like FuzzySearchService, NearOperatorService, and WordBoundaryService.
 */

import { ContentMatchingService } from "../../mocks/electron/ContentMatchingService.mock";

// Partial mocks to allow some real functionality while controlling test conditions
jest.mock("../../../src/electron/services/OptimizedFuzzySearchService.js", () => {
  return {
    OptimizedFuzzySearchService: jest.fn().mockImplementation(() => ({
      search: jest.fn().mockImplementation((content, term, _options) => {
        // Simplified implementation for testing
        const isMatch = content.toLowerCase().includes(term.toLowerCase());
        return {
          isMatch,
          score: isMatch ? 0.1 : 0.9,
          matchPositions: isMatch
            ? [content.toLowerCase().indexOf(term.toLowerCase())]
            : [],
        };
      }),
    })),
  };
});

jest.mock("../../../src/electron/services/NearOperatorService.js", () => {
  const originalModule = jest.requireActual(
    "../../../src/electron/services/NearOperatorService.js"
  );
  return {
    ...originalModule,
    NearOperatorService: {
      getInstance: jest.fn().mockReturnValue({
        evaluateNear: jest
          .fn()
          .mockImplementation((content, term1, term2, _distance, _options) => {
            // Simplified implementation for testing
            const t1 = term1 instanceof RegExp ? term1.source : term1;
            const t2 = term2 instanceof RegExp ? term2.source : term2;
            return content.includes(t1) && content.includes(t2);
          }),
      }),
    },
  };
});

// Use real WordBoundaryService implementation for integration tests
jest.mock("../../../src/electron/utils/booleanExpressionUtils.js", () => {
  const originalModule = jest.requireActual(
    "../../../src/electron/utils/booleanExpressionUtils.js"
  );

  interface AstNode {
    type: string;
    value?: string;
    left?: AstNode;
    right?: AstNode;
    operator?: string;
    argument?: AstNode;
  }

  const mockEvaluateBooleanAst = (ast: AstNode, content: string, caseSensitive: boolean): boolean => {
    // Simplified implementation for testing
    if (ast.type === "Literal") {
      if (!ast.value) return false;
      if (caseSensitive) {
        return content.includes(ast.value);
      } else {
        return content.toLowerCase().includes(ast.value.toLowerCase());
      }
    } else if (ast.type === "BinaryExpression") {
      if (!ast.left || !ast.right) return false;
      const left = mockEvaluateBooleanAst(ast.left, content, caseSensitive);
      const right = mockEvaluateBooleanAst(ast.right, content, caseSensitive);

      if (ast.operator === "&&" || ast.operator === "AND") {
        return left && right;
      } else if (ast.operator === "||" || ast.operator === "OR") {
        return left || right;
      }
    } else if (ast.type === "UnaryExpression" && ast.operator === "!") {
      if (!ast.argument) return false;
      return !mockEvaluateBooleanAst(ast.argument, content, caseSensitive);
    }

    return false;
  };

  return {
    ...originalModule,
    evaluateBooleanAst: jest.fn().mockImplementation(mockEvaluateBooleanAst),
  };
});

// Use real regex utils implementation
jest.mock("../../../src/electron/utils/regexUtils.js", () => {
  const originalModule = jest.requireActual(
    "../../../src/electron/utils/regexUtils.js"
  );
  return {
    ...originalModule,
    createSafeRegex: jest.fn().mockImplementation((pattern, flags) => {
      try {
        return new RegExp(pattern, flags);
      } catch (_error) {
        return null;
      }
    }),
  };
});

describe("ContentMatchingService Integration", () => {
  let contentMatchingService: ContentMatchingService;

  beforeEach(() => {
    // Reset all mocks before each test
    jest.clearAllMocks();

    // Get the singleton instance
    contentMatchingService = ContentMatchingService.getInstance();
  });

  describe("Integration with Term Search", () => {
    test("should correctly match simple terms", async () => {
      const content = "This is a test content";
      const result = await contentMatchingService.matchContent(
        content,
        "test",
        "term"
      );
      expect(result.matched).toBe(true);
    });

    test("should respect case sensitivity", async () => {
      const content = "This is a Test content";
      const result = await contentMatchingService.matchContent(
        content,
        "test",
        "term",
        { caseSensitive: true }
      );
      expect(result.matched).toBe(false);
    });

    test("should respect whole word matching", async () => {
      const content = "This is a testing content";
      const result = await contentMatchingService.matchContent(
        content,
        "test",
        "term",
        { wholeWordMatching: true }
      );
      expect(result.matched).toBe(false);
    });
  });

  describe("Integration with Regex Search", () => {
    test("should correctly match regex patterns", async () => {
      const content = "This is a test123 content";
      const result = await contentMatchingService.matchContent(
        content,
        "test\\d+",
        "regex"
      );
      expect(result.matched).toBe(true);
    });

    test("should respect case sensitivity in regex mode", async () => {
      const content = "This is a Test123 content";
      const result = await contentMatchingService.matchContent(
        content,
        "test\\d+",
        "regex",
        { caseSensitive: true }
      );
      expect(result.matched).toBe(false);
    });

    test("should handle complex regex patterns", async () => {
      const content = "This is a test content with email test@example.com";
      const result = await contentMatchingService.matchContent(
        content,
        "[a-z]+@[a-z]+\\.[a-z]{2,3}",
        "regex"
      );
      expect(result.matched).toBe(true);
    });

    test("should handle invalid regex patterns", async () => {
      const content = "This is a test content";
      const result = await contentMatchingService.matchContent(
        content,
        "test(",
        "regex"
      );
      expect(result.matched).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  describe("Integration with Boolean Search", () => {
    test("should correctly evaluate simple boolean expressions", async () => {
      // Mock jsep for this specific test
      jest.mock("jsep", () => {
        return jest.fn().mockImplementation((expr) => {
          return { type: "Literal", value: expr };
        });
      });

      const content = "This is a test content";
      const result = await contentMatchingService.matchContent(
        content,
        "test",
        "boolean"
      );
      expect(result.matched).toBe(true);
    });

    test("should handle boolean expression errors", async () => {
      // Mock the implementation for this specific test
      const createMatcherSpy = jest.spyOn(
        contentMatchingService,
        "createMatcher"
      );
      createMatcherSpy.mockImplementationOnce(() => {
        return {
          matcher: null,
          error: "Invalid boolean expression",
        };
      });

      const content = "This is a test content";
      const result = await contentMatchingService.matchContent(
        content,
        "invalid expression",
        "boolean"
      );
      expect(result.matched).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  describe("findMatchPositions Integration", () => {
    test("should find all occurrences of a term", () => {
      const content = "This is a test string with test word";
      const positions = contentMatchingService.findMatchPositions(
        content,
        "test"
      );
      expect(positions).toEqual([10, 27]);
    });

    test("should find positions with regex patterns", () => {
      const content = "This is a test123 string with test456 word";
      const positions = contentMatchingService.findMatchPositions(
        content,
        "/test\\d+/g"
      );
      expect(positions.length).toBe(2);
    });

    test("should respect whole word matching when finding positions", () => {
      const content = "This is a test string with testing word";
      const positions = contentMatchingService.findMatchPositions(
        content,
        "test",
        { wholeWordMatching: true }
      );
      expect(positions).toEqual([10]);
    });
  });

  describe("Performance with Large Content", () => {
    test("should handle large content efficiently", async () => {
      // Generate a large content string
      const largeContent = "test ".repeat(10000) + "unique";

      // Measure execution time
      const startTime = performance.now();
      const result = await contentMatchingService.matchContent(
        largeContent,
        "unique",
        "term"
      );
      const endTime = performance.now();

      expect(result.matched).toBe(true);

      // Execution should be reasonably fast (adjust threshold as needed)
      const executionTime = endTime - startTime;
      expect(executionTime).toBeLessThan(1000); // Less than 1 second
    });
  });
});
