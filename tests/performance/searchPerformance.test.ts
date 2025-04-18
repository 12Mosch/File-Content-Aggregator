import { performance } from "perf_hooks";
import fs from "fs/promises";
import path from "path";
import os from "os";
import { fileURLToPath } from "url";
import {
  evaluateSearchExpression,
  findTermIndices,
} from "./mocks/fileSearchService.mock";

// Get __dirname equivalent in ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Mock the console methods to reduce test output noise
beforeEach(() => {
  jest.spyOn(console, "log").mockImplementation(() => {});
  jest.spyOn(console, "error").mockImplementation(() => {});
  jest.spyOn(console, "warn").mockImplementation(() => {});
});

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

describe("Search Performance Benchmark", () => {
  describe("Term Search Performance", () => {
    test("should measure performance of simple term search", async () => {
      // Generate test content of different sizes
      const testSizes = [1000, 5000, 10000, 25000]; // Approximately 0.2MB to 5MB
      const results = [];

      for (const size of testSizes) {
        const content = generateLargeContent(size);
        const contentSizeMB = content.length / 1024 / 1024;

        // Measure memory before
        const memBefore = getMemoryUsage();

        // Measure execution time
        const startTime = performance.now();
        const result = evaluateSearchExpression(
          content,
          "test",
          "term",
          false, // isRegex
          false, // fuzzySearchBooleanEnabled
          false, // fuzzySearchNearEnabled
          false // caseSensitive
        );
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
          result: result,
        });

        // Log results
        console.log(
          `Term search (${contentSizeMB.toFixed(2)} MB): ${executionTime.toFixed(2)} ms, Memory: ${memoryUsed.toFixed(2)} MB`
        );

        // Force garbage collection if available
        if (global.gc) {
          global.gc();
        }
      }

      // Save results
      await saveTestResults("term-search-performance", results);

      // Basic assertion to ensure test runs
      expect(results.length).toBe(testSizes.length);
    });
  });

  describe("Boolean Query Performance", () => {
    test("should measure performance of complex boolean queries", async () => {
      // Generate test content of different sizes
      const testSizes = [1000, 5000, 10000];
      const results = [];

      // Define test queries of increasing complexity
      const queries = [
        "test AND example",
        "test AND example AND performance",
        "test AND example AND performance AND (keyword OR sample)",
        "(test AND example) OR (performance AND keyword) OR (sample AND text)",
      ];

      for (const size of testSizes) {
        const content = generateLargeContent(size);
        const contentSizeMB = content.length / 1024 / 1024;

        for (const query of queries) {
          // Measure memory before
          const memBefore = getMemoryUsage();

          // Measure execution time
          const startTime = performance.now();
          const result = evaluateSearchExpression(
            content,
            query,
            "boolean",
            false, // isRegex
            false, // fuzzySearchBooleanEnabled
            false, // fuzzySearchNearEnabled
            false // caseSensitive
          );
          const endTime = performance.now();

          // Measure memory after
          const memAfter = getMemoryUsage();

          // Calculate metrics
          const executionTime = endTime - startTime;
          const memoryUsed =
            (memAfter.heapUsed - memBefore.heapUsed) / 1024 / 1024;

          results.push({
            contentSize: `${contentSizeMB.toFixed(2)} MB`,
            query: query,
            executionTime: `${executionTime.toFixed(2)} ms`,
            memoryUsed: `${memoryUsed.toFixed(2)} MB`,
            result: result,
          });

          // Log results
          console.log(
            `Boolean query "${query}" (${contentSizeMB.toFixed(2)} MB): ${executionTime.toFixed(2)} ms, Memory: ${memoryUsed.toFixed(2)} MB`
          );

          // Force garbage collection if available
          if (global.gc) {
            global.gc();
          }
        }
      }

      // Save results
      await saveTestResults("boolean-query-performance", results);

      // Basic assertion to ensure test runs
      expect(results.length).toBe(testSizes.length * queries.length);
    });
  });

  describe("NEAR Operator Performance", () => {
    test("should measure performance of NEAR operator", async () => {
      // Generate test content of different sizes
      const testSizes = [1000, 5000, 10000];
      const results = [];

      // Define test distances
      const distances = [5, 10, 20, 50];

      for (const size of testSizes) {
        const content = generateLargeContent(size);
        const contentSizeMB = content.length / 1024 / 1024;

        for (const distance of distances) {
          const query = `NEAR("test", "performance", ${distance})`;

          // Measure memory before
          const memBefore = getMemoryUsage();

          // Measure execution time
          const startTime = performance.now();
          const result = evaluateSearchExpression(
            content,
            query,
            "boolean",
            false, // isRegex
            false, // fuzzySearchBooleanEnabled
            false, // fuzzySearchNearEnabled
            false // caseSensitive
          );
          const endTime = performance.now();

          // Measure memory after
          const memAfter = getMemoryUsage();

          // Calculate metrics
          const executionTime = endTime - startTime;
          const memoryUsed =
            (memAfter.heapUsed - memBefore.heapUsed) / 1024 / 1024;

          results.push({
            contentSize: `${contentSizeMB.toFixed(2)} MB`,
            query: query,
            distance: distance,
            executionTime: `${executionTime.toFixed(2)} ms`,
            memoryUsed: `${memoryUsed.toFixed(2)} MB`,
            result: result,
          });

          // Log results
          console.log(
            `NEAR query with distance ${distance} (${contentSizeMB.toFixed(2)} MB): ${executionTime.toFixed(2)} ms, Memory: ${memoryUsed.toFixed(2)} MB`
          );

          // Force garbage collection if available
          if (global.gc) {
            global.gc();
          }
        }
      }

      // Save results
      await saveTestResults("near-operator-performance", results);

      // Basic assertion to ensure test runs
      expect(results.length).toBe(testSizes.length * distances.length);
    });
  });

  describe("Fuzzy Search Performance", () => {
    test("should measure performance of fuzzy search", async () => {
      // Generate test content of different sizes
      const testSizes = [1000, 5000, 10000];
      const results = [];

      // Define test terms with varying similarity to actual content
      const terms = ["tst", "exmple", "prformance", "smple"];

      for (const size of testSizes) {
        const content = generateLargeContent(size);
        const contentSizeMB = content.length / 1024 / 1024;

        for (const term of terms) {
          // Measure memory before
          const memBefore = getMemoryUsage();

          // Measure execution time
          const startTime = performance.now();
          const result = evaluateSearchExpression(
            content,
            term,
            "term",
            false, // isRegex
            true, // fuzzySearchBooleanEnabled
            false, // fuzzySearchNearEnabled
            false // caseSensitive
          );
          const endTime = performance.now();

          // Measure memory after
          const memAfter = getMemoryUsage();

          // Calculate metrics
          const executionTime = endTime - startTime;
          const memoryUsed =
            (memAfter.heapUsed - memBefore.heapUsed) / 1024 / 1024;

          results.push({
            contentSize: `${contentSizeMB.toFixed(2)} MB`,
            term: term,
            executionTime: `${executionTime.toFixed(2)} ms`,
            memoryUsed: `${memoryUsed.toFixed(2)} MB`,
            result: result,
          });

          // Log results
          console.log(
            `Fuzzy search for "${term}" (${contentSizeMB.toFixed(2)} MB): ${executionTime.toFixed(2)} ms, Memory: ${memoryUsed.toFixed(2)} MB`
          );

          // Force garbage collection if available
          if (global.gc) {
            global.gc();
          }
        }
      }

      // Save results
      await saveTestResults("fuzzy-search-performance", results);

      // Basic assertion to ensure test runs
      expect(results.length).toBe(testSizes.length * terms.length);
    });
  });

  describe("System Information", () => {
    test("should record system information for reference", async () => {
      const systemInfo = {
        platform: os.platform(),
        release: os.release(),
        cpus: os.cpus().map((cpu) => ({
          model: cpu.model,
          speed: `${cpu.speed} MHz`,
        })),
        totalMemory: `${(os.totalmem() / 1024 / 1024 / 1024).toFixed(2)} GB`,
        freeMemory: `${(os.freemem() / 1024 / 1024 / 1024).toFixed(2)} GB`,
        nodeVersion: process.version,
        timestamp: new Date().toISOString(),
      };

      // Save system information
      await saveTestResults("system-info", systemInfo);

      // Basic assertion to ensure test runs
      expect(systemInfo).toBeDefined();
    });
  });
});
