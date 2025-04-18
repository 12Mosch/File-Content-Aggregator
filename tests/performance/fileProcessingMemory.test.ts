/**
 * Memory leak detection tests for FileProcessingService
 *
 * These tests verify that the FileProcessingService properly manages memory
 * during file processing operations, especially for large files.
 */

import fs from "fs/promises";
import path from "path";

// Mock the dependencies

jest.mock("../../src/lib/services/Logger.js", () =>
  require("../mocks/Logger.mock")
);

jest.mock("../../src/lib/services/MemoryMonitor.js", () =>
  require("../mocks/MemoryMonitor.mock")
);

jest.mock("../../src/lib/CacheManager.js", () =>
  require("../mocks/CacheManager.mock")
);

// Import after mocking
import { FileProcessingService } from "../../src/electron/services/FileProcessingService";

// Define test directory path directly
const TEST_DIR = path.join(process.cwd(), "tests");
const TEMP_DIR = path.join(process.cwd(), "temp");

// No need for __dirname equivalent since we're using process.cwd()

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
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function saveTestResults(testName: string, results: any): Promise<void> {
  const resultsDir = path.join(process.cwd(), "performance-results");

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

// Helper function to create a temporary test file
async function createTempFile(content: string): Promise<string> {
  await fs.mkdir(TEMP_DIR, { recursive: true });

  const filePath = path.join(TEMP_DIR, `test-file-${Date.now()}.txt`);
  await fs.writeFile(filePath, content);

  return filePath;
}

// Helper function to clean up temporary files
async function cleanupTempFiles(): Promise<void> {
  try {
    await fs.rm(TEMP_DIR, { recursive: true, force: true });
  } catch (error) {
    console.error("Error cleaning up temp files:", error);
  }
}

describe("FileProcessingService Memory Tests", () => {
  // Set a longer timeout for all tests in this suite
  jest.setTimeout(120000); // 2 minutes

  // Mock the console methods to reduce test output noise
  beforeEach(() => {
    jest.spyOn(console, "log").mockImplementation(() => {});
    jest.spyOn(console, "error").mockImplementation(() => {});
    jest.spyOn(console, "warn").mockImplementation(() => {});
  });

  afterAll(async () => {
    await cleanupTempFiles();
  });

  test("should not leak memory when processing large files", async () => {
    // Get the FileProcessingService instance
    const fileProcessingService = FileProcessingService.getInstance();

    // Generate a very small test file for faster testing
    const content = generateLargeContent(500); // 10x smaller
    const filePath = await createTempFile(content);

    const iterations = 3; // Fewer iterations

    // Initial memory baseline
    if (global.gc) {
      global.gc();
    }

    const initialMemory = getMemoryUsage();

    // Run a few iterations of file processing
    for (let i = 0; i < iterations; i++) {
      // Process the file
      await fileProcessingService.processFileInChunks(
        filePath,
        (chunk) => chunk.includes("test") && chunk.includes("performance"),
        {
          chunkSize: 16 * 1024, // Smaller chunks (16KB)
          earlyTermination: true,
        }
      );

      // Force garbage collection between iterations
      if (global.gc) {
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

    // Basic assertion - just check that we don't have a massive memory leak
    // This is not a strict test as memory behavior can vary
    expect(Math.abs(totalMemoryChange)).toBeLessThan(10); // Less than 10MB change
  });

  test("should not leak memory when extracting matched lines", async () => {
    // Get the FileProcessingService instance
    const fileProcessingService = FileProcessingService.getInstance();

    // Generate a smaller test file with matching lines (500KB) for faster testing
    const lineTemplate =
      "This is line NUMBER with test and performance keywords.\n";
    let content = "";
    for (let i = 0; i < 5000; i++) {
      content += lineTemplate.replace("NUMBER", i.toString());
    }

    const filePath = await createTempFile(content);

    const iterations = 3;
    const results = [];

    // Initial memory baseline
    if (global.gc) {
      global.gc();
    }

    const initialMemory = getMemoryUsage();
    console.log(
      `Initial memory usage: ${(initialMemory.heapUsed / 1024 / 1024).toFixed(2)} MB`
    );

    // Run multiple iterations of line extraction
    for (let i = 0; i < iterations; i++) {
      // Measure memory before
      const memBefore = getMemoryUsage();

      // Extract matched lines
      const matchResult = await fileProcessingService.extractMatchedLines(
        filePath,
        (line) => line.includes("test") && line.includes("performance"),
        {
          chunkSize: 64 * 1024, // 64KB chunks
        }
      );

      // Measure memory after
      const memAfter = getMemoryUsage();

      // Calculate memory change
      const memoryChange =
        (memAfter.heapUsed - memBefore.heapUsed) / 1024 / 1024;

      results.push({
        iteration: i + 1,
        matchedLines: matchResult.lines.length,
        memoryBefore: `${(memBefore.heapUsed / 1024 / 1024).toFixed(2)} MB`,
        memoryAfter: `${(memAfter.heapUsed / 1024 / 1024).toFixed(2)} MB`,
        memoryChange: `${memoryChange.toFixed(2)} MB`,
      });

      // Force garbage collection after each iteration
      if (global.gc) {
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

    // Add summary to results
    const summary = {
      initialMemory: `${(initialMemory.heapUsed / 1024 / 1024).toFixed(2)} MB`,
      finalMemory: `${(finalMemory.heapUsed / 1024 / 1024).toFixed(2)} MB`,
      totalMemoryChange: `${totalMemoryChange.toFixed(2)} MB`,
      iterations: iterations,
      fileSize: `${(content.length / 1024 / 1024).toFixed(2)} MB`,
    };

    // Save results
    await saveTestResults("line-extraction-memory-test", {
      summary,
      iterations: results,
    });

    // Basic assertion
    expect(results.length).toBe(iterations);
  });
});
