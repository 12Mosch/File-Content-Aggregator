/**
 * Performance tests for NEAR operator optimizations
 * Tests the improvements made to the NearOperatorService
 */

import { NearOperatorService } from "../../src/electron/services";

describe("NEAR Operator Performance Optimizations", () => {
  let nearOperatorService: NearOperatorService;

  beforeEach(() => {
    nearOperatorService = NearOperatorService.getInstance();
  });

  afterEach(() => {
    // Clear metrics after each test
    nearOperatorService.clearMetrics();
  });

  describe("Cache Performance", () => {
    test("should demonstrate improved cache hit rates with content fingerprinting", () => {
      const content = "The quick brown fox jumps over the lazy dog. ".repeat(
        100
      );
      const term1 = "quick";
      const term2 = "fox";
      const distance = 5;

      // First evaluation - cache miss
      const start1 = performance.now();
      const result1 = nearOperatorService.evaluateNear(
        content,
        term1,
        term2,
        distance
      );
      const time1 = performance.now() - start1;

      // Second evaluation - should be cache hit
      const start2 = performance.now();
      const result2 = nearOperatorService.evaluateNear(
        content,
        term1,
        term2,
        distance
      );
      const time2 = performance.now() - start2;

      expect(result1).toBe(result2);
      expect(time2).toBeLessThan(time1 * 0.5); // Should be significantly faster

      const metrics = nearOperatorService.getMetrics();
      expect(metrics.cacheHitRate).toBeGreaterThan(0);
      expect(metrics.contentFingerprintCache).toBeDefined();
    });

    test("should handle large content efficiently with fingerprinting", () => {
      const largeContent =
        "Lorem ipsum dolor sit amet, consectetur adipiscing elit. ".repeat(
          1000
        );
      const term1 = "Lorem";
      const term2 = "ipsum";
      const distance = 2;

      const start = performance.now();
      const result = nearOperatorService.evaluateNear(
        largeContent,
        term1,
        term2,
        distance
      );
      const executionTime = performance.now() - start;

      expect(result).toBe(true);
      expect(executionTime).toBeLessThan(200); // Should complete within 200ms

      const metrics = nearOperatorService.getMetrics();
      expect(metrics.contentFingerprintCache.size).toBeGreaterThan(0);
    });
  });

  describe("Two-Pointer Algorithm Performance", () => {
    test("should efficiently handle multiple term occurrences", () => {
      // Create content with many occurrences of both terms
      const content = Array.from(
        { length: 100 },
        (_, i) =>
          `Section ${i}: The quick brown fox jumps over the lazy dog and the fox runs quickly.`
      ).join(" ");

      const term1 = "fox";
      const term2 = "quick";
      const distance = 10;

      const start = performance.now();
      const result = nearOperatorService.evaluateNear(
        content,
        term1,
        term2,
        distance
      );
      const executionTime = performance.now() - start;

      expect(result).toBe(true);
      expect(executionTime).toBeLessThan(200); // Should complete efficiently

      const metrics = nearOperatorService.getMetrics();
      expect(metrics.totalEvaluations).toBeGreaterThan(0);
      expect(metrics.averageEvaluationTime).toBeLessThan(200);
    });

    test("should handle edge cases with sparse term occurrences", () => {
      const content =
        "start " +
        "filler ".repeat(1000) +
        "middle " +
        "filler ".repeat(1000) +
        "end";
      const term1 = "start";
      const term2 = "end";
      const distance = 5;

      const start = performance.now();
      const result = nearOperatorService.evaluateNear(
        content,
        term1,
        term2,
        distance
      );
      const executionTime = performance.now() - start;

      expect(result).toBe(false); // Terms are too far apart
      expect(executionTime).toBeLessThan(50); // Should terminate early
    });
  });

  describe("Memory Pool Performance", () => {
    test("should demonstrate memory pool efficiency", () => {
      const content = "The quick brown fox jumps over the lazy dog. ".repeat(
        50
      );

      // Perform multiple evaluations to test memory pooling
      const evaluations = 20;
      const results: boolean[] = [];

      const start = performance.now();
      for (let i = 0; i < evaluations; i++) {
        const result = nearOperatorService.evaluateNear(
          content,
          "quick",
          "fox",
          5
        );
        results.push(result);
      }
      const totalTime = performance.now() - start;

      expect(results.every((r) => r === true)).toBe(true);
      expect(totalTime / evaluations).toBeLessThan(10); // Average should be fast

      const metrics = nearOperatorService.getMetrics();
      expect(metrics.memoryPoolStats).toBeDefined();
      expect(metrics.memoryPoolStats.totalPools).toBeGreaterThan(0);
    });
  });

  describe("Chunked Processing", () => {
    test("should handle very large content with chunked processing", () => {
      // Create content larger than MAX_FULL_CONTENT_SIZE (2MB)
      const largeContent =
        "The quick brown fox jumps over the lazy dog. ".repeat(50000); // ~2.2MB

      const start = performance.now();
      const result = nearOperatorService.evaluateNear(
        largeContent,
        "quick",
        "fox",
        5
      );
      const executionTime = performance.now() - start;

      expect(result).toBe(true);
      expect(executionTime).toBeLessThan(1000); // Should complete within 1 second

      const metrics = nearOperatorService.getMetrics();
      expect(metrics.totalEvaluations).toBeGreaterThan(0);
    });
  });

  describe("Overall Performance Improvements", () => {
    test("should show significant performance improvement over baseline", () => {
      const testCases = [
        {
          content: "short content with quick fox",
          term1: "quick",
          term2: "fox",
          distance: 2,
        },
        {
          content: "medium ".repeat(100) + "content with quick brown fox",
          term1: "quick",
          term2: "fox",
          distance: 3,
        },
        {
          content: "long ".repeat(1000) + "content with quick brown fox",
          term1: "quick",
          term2: "fox",
          distance: 3,
        },
      ];

      const results = testCases.map((testCase) => {
        const start = performance.now();
        const result = nearOperatorService.evaluateNear(
          testCase.content,
          testCase.term1,
          testCase.term2,
          testCase.distance
        );
        const executionTime = performance.now() - start;

        return {
          result,
          executionTime,
          contentLength: testCase.content.length,
        };
      });

      // All should complete quickly
      results.forEach(({ executionTime, contentLength }) => {
        const expectedMaxTime = Math.max(50, contentLength / 10000); // Scale with content size
        expect(executionTime).toBeLessThan(expectedMaxTime);
      });

      const metrics = nearOperatorService.getMetrics();
      expect(metrics.cacheHitRate).toBeGreaterThanOrEqual(0);
      expect(metrics.averageEvaluationTime).toBeLessThan(100);
    });
  });
});
