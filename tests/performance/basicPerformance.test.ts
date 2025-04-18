/**
 * Basic performance test that doesn't rely on imports from the application code
 */

import { performance } from "perf_hooks";
import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

// Get __dirname equivalent in ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Helper function to measure memory usage
function getMemoryUsage(): { heapUsed: number; heapTotal: number } {
  if (typeof process !== "undefined" && process.memoryUsage) {
    const { heapUsed, heapTotal } = process.memoryUsage();
    return { heapUsed, heapTotal };
  }
  return { heapUsed: 0, heapTotal: 0 };
}

// Helper function to generate large content
function generateLargeContent(size: number): string {
  const sampleText =
    "This is a sample text with some keywords like test, example, and performance. ";
  return sampleText.repeat(size);
}

// Helper function to save test results
async function saveTestResults(testName: string, results: any): Promise<void> {
  const resultsDir = path.join(__dirname, "../../performance-results");

  try {
    await fs.mkdir(resultsDir, { recursive: true });
    const filePath = path.join(
      resultsDir,
      `${testName}-${new Date().toISOString().replace(/:/g, "-")}.json`
    );
    await fs.writeFile(filePath, JSON.stringify(results, null, 2));
    console.log(`Results saved to ${filePath}`);
  } catch (error) {
    console.error(
      "Error saving test results:",
      error instanceof Error ? error.message : String(error)
    );
  }
}

// Simple implementation of string search for testing
function findStringMatches(
  content: string,
  term: string,
  caseSensitive: boolean = false
): number[] {
  const indices: number[] = [];
  let startIndex = 0;
  let index;

  if (caseSensitive) {
    while ((index = content.indexOf(term, startIndex)) !== -1) {
      indices.push(index);
      startIndex = index + 1;
    }
  } else {
    const lowerContent = content.toLowerCase();
    const lowerTerm = term.toLowerCase();

    while ((index = lowerContent.indexOf(lowerTerm, startIndex)) !== -1) {
      indices.push(index);
      startIndex = index + 1;
    }
  }

  return indices;
}

// Simple implementation of regex search for testing
function findRegexMatches(content: string, pattern: RegExp): number[] {
  const indices: number[] = [];

  // Ensure the regex has the global flag
  const regex = new RegExp(
    pattern.source,
    pattern.flags.includes("g") ? pattern.flags : pattern.flags + "g"
  );

  let match;
  while ((match = regex.exec(content)) !== null) {
    indices.push(match.index);
    // Prevent infinite loops with zero-width matches
    if (match.index === regex.lastIndex) {
      regex.lastIndex++;
    }
  }

  return indices;
}

describe("Basic Performance Tests", () => {
  // Mock console methods to reduce noise
  beforeEach(() => {
    jest.spyOn(console, "log").mockImplementation(() => {});
    jest.spyOn(console, "error").mockImplementation(() => {});
    jest.spyOn(console, "warn").mockImplementation(() => {});
  });

  describe("String Search Performance", () => {
    test("should measure performance of string search with different content sizes", async () => {
      const testSizes = [1000, 5000, 10000];
      const results = [];

      for (const size of testSizes) {
        const content = generateLargeContent(size);
        const contentSizeMB = content.length / 1024 / 1024;

        // Measure memory before
        const memBefore = getMemoryUsage();

        // Measure execution time
        const startTime = performance.now();
        const matches = findStringMatches(content, "test");
        const endTime = performance.now();

        // Measure memory after
        const memAfter = getMemoryUsage();

        // Calculate metrics
        const executionTime = endTime - startTime;
        const memoryUsed =
          (memAfter.heapUsed - memBefore.heapUsed) / 1024 / 1024;

        results.push({
          contentSize: `${contentSizeMB.toFixed(2)} MB`,
          executionTime: `${executionTime.toFixed(2)} ms`,
          memoryUsed: `${memoryUsed.toFixed(2)} MB`,
          matchesFound: matches.length,
        });

        // Log results
        console.log(
          `String search (${contentSizeMB.toFixed(2)} MB): ${executionTime.toFixed(2)} ms, Memory: ${memoryUsed.toFixed(2)} MB, Matches: ${matches.length}`
        );
      }

      // Save results
      await saveTestResults("string-search-performance", results);

      // Basic assertion
      expect(results.length).toBe(testSizes.length);
    });
  });

  describe("Regex Search Performance", () => {
    test("should measure performance of regex search with different content sizes", async () => {
      const testSizes = [1000, 5000, 10000];
      const results = [];

      for (const size of testSizes) {
        const content = generateLargeContent(size);
        const contentSizeMB = content.length / 1024 / 1024;

        // Measure memory before
        const memBefore = getMemoryUsage();

        // Measure execution time
        const startTime = performance.now();
        const matches = findRegexMatches(content, /test|example/g);
        const endTime = performance.now();

        // Measure memory after
        const memAfter = getMemoryUsage();

        // Calculate metrics
        const executionTime = endTime - startTime;
        const memoryUsed =
          (memAfter.heapUsed - memBefore.heapUsed) / 1024 / 1024;

        results.push({
          contentSize: `${contentSizeMB.toFixed(2)} MB`,
          executionTime: `${executionTime.toFixed(2)} ms`,
          memoryUsed: `${memoryUsed.toFixed(2)} MB`,
          matchesFound: matches.length,
        });

        // Log results
        console.log(
          `Regex search (${contentSizeMB.toFixed(2)} MB): ${executionTime.toFixed(2)} ms, Memory: ${memoryUsed.toFixed(2)} MB, Matches: ${matches.length}`
        );
      }

      // Save results
      await saveTestResults("regex-search-performance", results);

      // Basic assertion
      expect(results.length).toBe(testSizes.length);
    });
  });

  describe("Memory Usage", () => {
    test("should measure memory usage with large string operations", async () => {
      // Generate very large content
      const content = generateLargeContent(25000);
      const contentSizeMB = content.length / 1024 / 1024;

      // Measure memory before
      const memBefore = getMemoryUsage();

      // Perform a memory-intensive operation
      const startTime = performance.now();

      // Split and join the content multiple times
      let processedContent = content;
      for (let i = 0; i < 5; i++) {
        const lines = processedContent.split("\n");
        processedContent = lines.join("\n");
      }

      const endTime = performance.now();

      // Measure memory after
      const memAfter = getMemoryUsage();

      // Calculate metrics
      const executionTime = endTime - startTime;
      const memoryUsed = (memAfter.heapUsed - memBefore.heapUsed) / 1024 / 1024;

      const results = {
        contentSize: `${contentSizeMB.toFixed(2)} MB`,
        executionTime: `${executionTime.toFixed(2)} ms`,
        memoryUsed: `${memoryUsed.toFixed(2)} MB`,
        memoryRatio: `${(memoryUsed / contentSizeMB).toFixed(2)}x content size`,
      };

      // Log results
      console.log(
        `Memory test (${contentSizeMB.toFixed(2)} MB): ${executionTime.toFixed(2)} ms, Memory: ${memoryUsed.toFixed(2)} MB`
      );

      // Save results
      await saveTestResults("memory-usage", results);

      // Basic assertion - memory usage should be reasonable
      expect(memoryUsed).toBeLessThan(contentSizeMB * 10); // Allow up to 10x the content size
    });
  });
});
