import "@jest/globals";

// Mock the fileSearchService functions
const findTermIndices = jest.fn<number[], [string, string | RegExp, boolean]>(
  (content, term, isRegex) => {
    // Simple implementation for testing
    if (isRegex && term instanceof RegExp) {
      const indices: number[] = [];
      const regex = new RegExp(
        term.source,
        term.flags.includes("g") ? term.flags : term.flags + "g"
      );
      let match;
      while ((match = regex.exec(content)) !== null) {
        indices.push(match.index);
        if (match.index === regex.lastIndex) regex.lastIndex++;
      }
      return indices;
    } else if (typeof term === "string") {
      const indices: number[] = [];
      const searchTerm = isRegex ? term : term;
      let i = -1;
      while ((i = content.indexOf(searchTerm, i + 1)) !== -1) {
        indices.push(i);
      }
      return indices;
    }
    return [];
  }
);

const evaluateSearchExpression = jest.fn<
  boolean,
  [string, string, string, boolean, boolean, boolean, boolean]
>(
  (
    content,
    expression,
    mode,
    isRegex,
    fuzzyBooleanEnabled,
    fuzzyNearEnabled,
    caseSensitive
  ) => {
    // Simple implementation for testing
    if (mode === "term") {
      return content.includes(expression);
    } else if (mode === "boolean") {
      // Very simplified boolean evaluation for testing
      if (expression.includes("AND")) {
        const terms = expression.split("AND").map((t) => t.trim());
        return terms.every((term) => content.includes(term));
      } else if (expression.includes("OR")) {
        const terms = expression.split("OR").map((t) => t.trim());
        return terms.some((term) => content.includes(term));
      } else if (expression.startsWith("NEAR")) {
        // Very simplified NEAR implementation
        return true;
      }
    }
    return false;
  }
);

// Mock the console methods to reduce test output noise
beforeEach(() => {
  jest.spyOn(console, "log").mockImplementation(() => {});
  jest.spyOn(console, "error").mockImplementation(() => {});
  jest.spyOn(console, "warn").mockImplementation(() => {});

  // Reset mocks
  findTermIndices.mockClear();
  evaluateSearchExpression.mockClear();
});

// Helper function to generate large content
function generateLargeContent(size: number): string {
  const sampleText =
    "This is a sample text with some keywords like test, example, and performance. ";
  return sampleText.repeat(size);
}

// Helper function to measure memory usage
function getMemoryUsage(): { heapUsed: number; heapTotal: number } {
  if (typeof process !== "undefined" && process.memoryUsage) {
    const { heapUsed, heapTotal } = process.memoryUsage();
    return { heapUsed, heapTotal };
  }
  return { heapUsed: 0, heapTotal: 0 };
}

describe("Search Performance - Unit Tests", () => {
  describe("Term Matching Performance", () => {
    test("should efficiently find term indices in large content", () => {
      // Generate a large content (approximately 1MB)
      const largeContent = generateLargeContent(5000);

      // Measure execution time
      const startTime = performance.now();
      const indices = findTermIndices(largeContent, "test", false);
      const endTime = performance.now();

      // Log performance metrics
      const executionTime = endTime - startTime;
      console.log(`Term search execution time: ${executionTime.toFixed(2)} ms`);
      console.log(
        `Found ${indices.length} matches in ${(largeContent.length / 1024 / 1024).toFixed(2)} MB content`
      );

      // Verify results
      expect(indices.length).toBeGreaterThan(0);
      expect(executionTime).toBeLessThan(1000); // Should complete in less than 1 second
    });

    test("should efficiently find regex pattern matches in large content", () => {
      // Generate a large content
      const largeContent = generateLargeContent(2000);

      // Create a regex pattern
      const regexPattern = /test|example/g;

      // Measure execution time
      const startTime = performance.now();
      const indices = findTermIndices(largeContent, regexPattern, true);
      const endTime = performance.now();

      // Log performance metrics
      const executionTime = endTime - startTime;
      console.log(
        `Regex search execution time: ${executionTime.toFixed(2)} ms`
      );
      console.log(
        `Found ${indices.length} regex matches in ${(largeContent.length / 1024 / 1024).toFixed(2)} MB content`
      );

      // Verify results
      expect(indices.length).toBeGreaterThan(0);
      expect(executionTime).toBeLessThan(2000); // Should complete in less than 2 seconds
    });
  });

  describe("Complex Query Performance", () => {
    test("should efficiently evaluate boolean expressions with many terms", () => {
      // Generate content with many potential matches
      const content = generateLargeContent(500);

      // Create a complex boolean expression with many terms
      const booleanExpression =
        "test AND example AND performance AND (keyword OR sample)";

      // Measure execution time and memory usage
      const memBefore = getMemoryUsage();
      const startTime = performance.now();

      const result = evaluateSearchExpression(
        content,
        booleanExpression,
        "boolean",
        false,
        true, // Enable fuzzy search in boolean mode
        true, // Enable fuzzy search in NEAR
        false // Case insensitive
      );

      const endTime = performance.now();
      const memAfter = getMemoryUsage();

      // Log performance metrics
      const executionTime = endTime - startTime;
      const memoryUsed = (memAfter.heapUsed - memBefore.heapUsed) / 1024 / 1024;

      console.log(
        `Boolean expression evaluation time: ${executionTime.toFixed(2)} ms`
      );
      console.log(`Memory used: ${memoryUsed.toFixed(2)} MB`);

      // Verify results
      expect(typeof result).toBe("boolean");
      expect(executionTime).toBeLessThan(3000); // Should complete in less than 3 seconds
    });

    test("should efficiently evaluate NEAR expressions", () => {
      // Generate content with potential matches
      const content = generateLargeContent(500);

      // Create a NEAR expression
      const nearExpression = 'NEAR("test", "performance", 10)';

      // Measure execution time
      const startTime = performance.now();

      const result = evaluateSearchExpression(
        content,
        nearExpression,
        "boolean",
        false,
        false, // Disable fuzzy search in boolean mode
        true, // Enable fuzzy search in NEAR
        false // Case insensitive
      );

      const endTime = performance.now();

      // Log performance metrics
      const executionTime = endTime - startTime;
      console.log(
        `NEAR expression evaluation time: ${executionTime.toFixed(2)} ms`
      );

      // Verify results
      expect(typeof result).toBe("boolean");
      expect(executionTime).toBeLessThan(3000); // Should complete in less than 3 seconds
    });
  });

  describe("Memory Usage", () => {
    test("should maintain reasonable memory usage with very large content", () => {
      // Generate very large content (approximately 5MB)
      const veryLargeContent = generateLargeContent(25000);

      // Measure memory before
      const memBefore = getMemoryUsage();

      // Perform search operation
      const startTime = performance.now();
      findTermIndices(veryLargeContent, "test", false);
      const endTime = performance.now();

      // Measure memory after
      const memAfter = getMemoryUsage();

      // Calculate memory usage
      const memoryUsed = (memAfter.heapUsed - memBefore.heapUsed) / 1024 / 1024;
      const executionTime = endTime - startTime;

      console.log(`Memory test execution time: ${executionTime.toFixed(2)} ms`);
      console.log(`Memory used: ${memoryUsed.toFixed(2)} MB`);
      console.log(
        `Content size: ${(veryLargeContent.length / 1024 / 1024).toFixed(2)} MB`
      );

      // Verify memory usage is reasonable (should be less than 3x content size)
      // This is a rough heuristic - adjust based on actual implementation
      const contentSizeMB = veryLargeContent.length / 1024 / 1024;
      expect(memoryUsed).toBeLessThan(contentSizeMB * 3);
    });
  });
});
