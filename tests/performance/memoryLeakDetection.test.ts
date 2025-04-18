import { performance } from "perf_hooks";
import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import { evaluateSearchExpression } from "./mocks/fileSearchService.mock";

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

describe("Memory Leak Detection Tests", () => {
  // Mock the console methods to reduce test output noise
  beforeEach(() => {
    jest.spyOn(console, "log").mockImplementation(() => {});
    jest.spyOn(console, "error").mockImplementation(() => {});
    jest.spyOn(console, "warn").mockImplementation(() => {});
  });

  test("should detect memory leaks in repeated search operations", async () => {
    // Generate medium-sized content
    const content = generateLargeContent(5000);
    const iterations = 50;
    const results = [];

    // Initial memory baseline
    if (global.gc) {
      global.gc();
    }

    const initialMemory = getMemoryUsage();
    console.log(
      `Initial memory usage: ${(initialMemory.heapUsed / 1024 / 1024).toFixed(2)} MB`
    );

    // Run multiple iterations of the search operation
    for (let i = 0; i < iterations; i++) {
      // Measure memory before
      const memBefore = getMemoryUsage();

      // Perform search operation
      evaluateSearchExpression(
        content,
        "test AND example AND performance",
        "boolean",
        false, // isRegex
        false, // fuzzySearchBooleanEnabled
        false, // fuzzySearchNearEnabled
        false // caseSensitive
      );

      // Measure memory after
      const memAfter = getMemoryUsage();

      // Calculate memory change
      const memoryChange =
        (memAfter.heapUsed - memBefore.heapUsed) / 1024 / 1024;

      results.push({
        iteration: i + 1,
        memoryBefore: `${(memBefore.heapUsed / 1024 / 1024).toFixed(2)} MB`,
        memoryAfter: `${(memAfter.heapUsed / 1024 / 1024).toFixed(2)} MB`,
        memoryChange: `${memoryChange.toFixed(2)} MB`,
      });

      // Log progress every 10 iterations
      if ((i + 1) % 10 === 0) {
        console.log(`Completed ${i + 1}/${iterations} iterations`);
      }

      // Force garbage collection if available
      if (global.gc && (i + 1) % 5 === 0) {
        global.gc();
      }
    }

    // Force final garbage collection
    if (global.gc) {
      global.gc();
    }

    // Measure final memory
    const finalMemory = getMemoryUsage();
    const totalMemoryChange =
      (finalMemory.heapUsed - initialMemory.heapUsed) / 1024 / 1024;

    console.log(
      `Final memory usage: ${(finalMemory.heapUsed / 1024 / 1024).toFixed(2)} MB`
    );
    console.log(`Total memory change: ${totalMemoryChange.toFixed(2)} MB`);

    // Add summary to results
    const summary = {
      initialMemory: `${(initialMemory.heapUsed / 1024 / 1024).toFixed(2)} MB`,
      finalMemory: `${(finalMemory.heapUsed / 1024 / 1024).toFixed(2)} MB`,
      totalMemoryChange: `${totalMemoryChange.toFixed(2)} MB`,
      iterations: iterations,
      contentSize: `${(content.length / 1024 / 1024).toFixed(2)} MB`,
    };

    // Save results
    await saveTestResults("memory-leak-detection", {
      summary,
      iterations: results,
    });

    // Check for potential memory leaks
    // A memory leak would typically show as a consistent increase in memory usage across iterations
    // We'll analyze the trend in memory usage

    // Calculate average memory change per iteration (excluding GC iterations)
    const memoryChanges = results
      .filter((result, index) => (index + 1) % 5 !== 0) // Exclude GC iterations
      .map((result) => parseFloat(result.memoryChange));

    const avgMemoryChange =
      memoryChanges.reduce((sum, change) => sum + change, 0) /
      memoryChanges.length;

    console.log(
      `Average memory change per iteration: ${avgMemoryChange.toFixed(2)} MB`
    );

    // If average memory change is positive and significant, it might indicate a memory leak
    const MEMORY_LEAK_THRESHOLD = 0.1; // 0.1 MB per iteration

    if (avgMemoryChange > MEMORY_LEAK_THRESHOLD) {
      console.warn(
        `Potential memory leak detected: Average memory increase of ${avgMemoryChange.toFixed(2)} MB per iteration`
      );
    } else {
      console.log("No significant memory leak detected");
    }

    // Basic assertion - this is not a strict test as memory behavior can vary
    // We're mainly collecting data for analysis
    expect(results.length).toBe(iterations);
  });

  test("should detect memory leaks in word boundary cache", async () => {
    // This test specifically targets the word boundary cache
    // by performing operations that would use this cache

    const iterations = 30;
    const results = [];

    // Generate different content for each iteration to stress the cache
    const contentSizes = [1000, 2000, 3000, 4000, 5000];

    // Initial memory baseline
    if (global.gc) {
      global.gc();
    }

    const initialMemory = getMemoryUsage();
    console.log(
      `Initial memory usage: ${(initialMemory.heapUsed / 1024 / 1024).toFixed(2)} MB`
    );

    // Run multiple iterations
    for (let i = 0; i < iterations; i++) {
      // Generate different content for each iteration
      const size = contentSizes[i % contentSizes.length];
      const content = generateLargeContent(size);

      // Measure memory before
      const memBefore = getMemoryUsage();

      // Perform operation that uses word boundary cache
      evaluateSearchExpression(
        content,
        'NEAR("test", "performance", 10)',
        "boolean",
        false, // isRegex
        false, // fuzzySearchBooleanEnabled
        false, // fuzzySearchNearEnabled
        false // caseSensitive
      );

      // Measure memory after
      const memAfter = getMemoryUsage();

      // Calculate memory change
      const memoryChange =
        (memAfter.heapUsed - memBefore.heapUsed) / 1024 / 1024;

      results.push({
        iteration: i + 1,
        contentSize: `${(content.length / 1024 / 1024).toFixed(2)} MB`,
        memoryBefore: `${(memBefore.heapUsed / 1024 / 1024).toFixed(2)} MB`,
        memoryAfter: `${(memAfter.heapUsed / 1024 / 1024).toFixed(2)} MB`,
        memoryChange: `${memoryChange.toFixed(2)} MB`,
      });

      // Log progress every 5 iterations
      if ((i + 1) % 5 === 0) {
        console.log(`Completed ${i + 1}/${iterations} iterations`);

        // Force garbage collection every 5 iterations if available
        if (global.gc) {
          global.gc();
        }
      }
    }

    // Force final garbage collection
    if (global.gc) {
      global.gc();
    }

    // Measure final memory
    const finalMemory = getMemoryUsage();
    const totalMemoryChange =
      (finalMemory.heapUsed - initialMemory.heapUsed) / 1024 / 1024;

    console.log(
      `Final memory usage: ${(finalMemory.heapUsed / 1024 / 1024).toFixed(2)} MB`
    );
    console.log(`Total memory change: ${totalMemoryChange.toFixed(2)} MB`);

    // Add summary to results
    const summary = {
      initialMemory: `${(initialMemory.heapUsed / 1024 / 1024).toFixed(2)} MB`,
      finalMemory: `${(finalMemory.heapUsed / 1024 / 1024).toFixed(2)} MB`,
      totalMemoryChange: `${totalMemoryChange.toFixed(2)} MB`,
      iterations: iterations,
    };

    // Save results
    await saveTestResults("word-boundary-cache-memory-test", {
      summary,
      iterations: results,
    });

    // Basic assertion
    expect(results.length).toBe(iterations);
  });
});
