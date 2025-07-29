/**
 * Performance tests for ContentMatchingService
 *
 * These tests verify that the ContentMatchingService performs efficiently
 * with large inputs and various search modes.
 */

import { ContentMatchingService } from "../../mocks/electron/ContentMatchingService.mock";
import * as fs from "fs";
import * as path from "path";

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

// Helper function to generate large content
function generateLargeContent(size: number): string {
  const words = [
    "lorem",
    "ipsum",
    "dolor",
    "sit",
    "amet",
    "consectetur",
    "adipiscing",
    "elit",
  ];
  let content = "";

  for (let i = 0; i < size; i++) {
    const randomWord = words[Math.floor(Math.random() * words.length)];
    content += randomWord + " ";

    // Add a newline every 10 words for readability
    if (i % 10 === 9) {
      content += "\n";
    }
  }

  return content;
}

describe("ContentMatchingService Performance Tests", () => {
  let contentMatchingService: ContentMatchingService;

  // Set a longer timeout for performance tests
  jest.setTimeout(30000);

  beforeEach(() => {
    // Reset all mocks before each test
    jest.clearAllMocks();

    // Get the singleton instance
    contentMatchingService = ContentMatchingService.getInstance();
  });

  describe("Performance with Large Content", () => {
    test("should efficiently match term in large content", async () => {
      // Generate a large content string (approximately 1MB)
      const largeContent = generateLargeContent(100000);

      // Add a unique term near the end
      const uniqueTerm = "uniqueSearchTerm";
      const contentWithTerm =
        largeContent + uniqueTerm + largeContent.substring(0, 1000);

      // Measure execution time
      const startTime = performance.now();
      const result = await contentMatchingService.matchContent(
        contentWithTerm,
        uniqueTerm,
        "term"
      );
      const endTime = performance.now();

      expect(result.matched).toBe(true);

      // Log performance metrics
      const executionTime = endTime - startTime;
      console.log(`Term search execution time: ${executionTime.toFixed(2)}ms`);

      // Execution should be reasonably fast (adjust threshold as needed)
      expect(executionTime).toBeLessThan(1000); // Less than 1 second
    });

    test("should efficiently match regex in large content", async () => {
      // Generate a large content string (approximately 1MB)
      const largeContent = generateLargeContent(100000);

      // Add a unique pattern near the end
      const uniquePattern = "unique123Pattern";
      const contentWithPattern =
        largeContent + uniquePattern + largeContent.substring(0, 1000);

      // Measure execution time
      const startTime = performance.now();
      const result = await contentMatchingService.matchContent(
        contentWithPattern,
        "unique\\d+Pattern",
        "regex"
      );
      const endTime = performance.now();

      expect(result.matched).toBe(true);

      // Log performance metrics
      const executionTime = endTime - startTime;
      console.log(`Regex search execution time: ${executionTime.toFixed(2)}ms`);

      // Execution should be reasonably fast (adjust threshold as needed)
      expect(executionTime).toBeLessThan(2000); // Less than 2 seconds
    });

    test("should efficiently find match positions in large content", () => {
      // Generate a large content string (approximately 500KB)
      const largeContent = generateLargeContent(50000);

      // Add multiple occurrences of a term
      const searchTerm = "findme";
      let contentWithTerms = largeContent;

      // Add the term at known positions
      const positions = [1000, 10000, 25000, 40000];
      positions.forEach((pos) => {
        if (pos < contentWithTerms.length) {
          contentWithTerms =
            contentWithTerms.substring(0, pos) +
            searchTerm +
            contentWithTerms.substring(pos);
        }
      });

      // Measure execution time
      const startTime = performance.now();
      const foundPositions = contentMatchingService.findMatchPositions(
        contentWithTerms,
        searchTerm
      );
      const endTime = performance.now();

      // Verify that all occurrences were found
      expect(foundPositions.length).toBe(positions.length);

      // Log performance metrics
      const executionTime = endTime - startTime;
      console.log(
        `Find positions execution time: ${executionTime.toFixed(2)}ms`
      );

      // Execution should be reasonably fast (adjust threshold as needed)
      expect(executionTime).toBeLessThan(1000); // Less than 1 second
    });
  });

  describe("Performance with Different Search Modes", () => {
    // Create a medium-sized content for these tests
    const mediumContent = generateLargeContent(10000);

    test("should efficiently handle term search mode", async () => {
      const iterations = 100;
      const terms = ["lorem", "ipsum", "dolor", "sit", "amet"];

      const startTime = performance.now();

      for (let i = 0; i < iterations; i++) {
        const term = terms[i % terms.length];
        await contentMatchingService.matchContent(mediumContent, term, "term");
      }

      const endTime = performance.now();
      const totalTime = endTime - startTime;
      const avgTime = totalTime / iterations;

      console.log(
        `Average term search time (${iterations} iterations): ${avgTime.toFixed(2)}ms`
      );
      expect(avgTime).toBeLessThan(50); // Average less than 50ms per search
    });

    test("should efficiently handle regex search mode", async () => {
      const iterations = 50;
      const patterns = [
        "lor[a-z]+",
        "ip[a-z]+m",
        "do[a-z]+r",
        "s[a-z]t",
        "am[a-z]+t",
      ];

      const startTime = performance.now();

      for (let i = 0; i < iterations; i++) {
        const pattern = patterns[i % patterns.length];
        await contentMatchingService.matchContent(
          mediumContent,
          pattern,
          "regex"
        );
      }

      const endTime = performance.now();
      const totalTime = endTime - startTime;
      const avgTime = totalTime / iterations;

      console.log(
        `Average regex search time (${iterations} iterations): ${avgTime.toFixed(2)}ms`
      );
      expect(avgTime).toBeLessThan(100); // Average less than 100ms per search
    });

    test("should efficiently handle whole word matching", async () => {
      const iterations = 50;
      const terms = ["lorem", "ipsum", "dolor", "sit", "amet"];

      const startTime = performance.now();

      for (let i = 0; i < iterations; i++) {
        const term = terms[i % terms.length];
        await contentMatchingService.matchContent(mediumContent, term, "term", {
          wholeWordMatching: true,
        });
      }

      const endTime = performance.now();
      const totalTime = endTime - startTime;
      const avgTime = totalTime / iterations;

      console.log(
        `Average whole word search time (${iterations} iterations): ${avgTime.toFixed(2)}ms`
      );
      expect(avgTime).toBeLessThan(50); // Average less than 50ms per search
    });
  });

  describe("Performance with Real Files", () => {
    let realFileContent: string;

    beforeAll(() => {
      try {
        // Try to load a real source file for testing
        const filePath = path.join(
          process.cwd(),
          "src/electron/services/ContentMatchingService.ts"
        );
        realFileContent = fs.readFileSync(filePath, "utf8");
      } catch (_error) {
        // If file can't be loaded, generate a substitute
        console.warn(
          "Could not load real file, using generated content instead"
        );
        realFileContent = generateLargeContent(5000);
      }
    });

    test("should efficiently search in real file content", async () => {
      const terms = [
        "ContentMatchingService",
        "createMatcher",
        "matchContent",
        "findMatchPositions",
        "escapeRegExp",
      ];

      const results: boolean[] = [];
      const startTime = performance.now();

      for (const term of terms) {
        const result = await contentMatchingService.matchContent(
          realFileContent,
          term,
          "term"
        );
        results.push(result.matched);
      }

      const endTime = performance.now();
      const totalTime = endTime - startTime;
      const avgTime = totalTime / terms.length;

      console.log(
        `Average search time in real file (${terms.length} terms): ${avgTime.toFixed(2)}ms`
      );
      expect(avgTime).toBeLessThan(50); // Average less than 50ms per search

      // Verify that all terms were found
      expect(results.every((r) => r === true)).toBe(true);
    });

    test("should efficiently find positions in real file content", () => {
      const term = "matcher";

      const startTime = performance.now();
      const positions = contentMatchingService.findMatchPositions(
        realFileContent,
        term
      );
      const endTime = performance.now();

      const executionTime = endTime - startTime;
      console.log(
        `Find positions in real file execution time: ${executionTime.toFixed(2)}ms`
      );

      expect(executionTime).toBeLessThan(50); // Less than 50ms
      expect(positions.length).toBeGreaterThan(0);
    });
  });
});
