/**
 * Test script for comparing the performance of the original and further optimized fuzzy search implementations
 */

import { OptimizedFuzzySearchService } from "../dist-electron/electron/services/index.js";
import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";

// Get the current directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Test cases with varying complexity
const testCases = [
  {
    name: "Exact match - short term",
    content: "This is a test string with some test words.",
    term: "test",
    options: { isCaseSensitive: false },
  },
  {
    name: "Exact match - long term",
    content: "This string contains internationalization as a long word.",
    term: "internationalization",
    options: { isCaseSensitive: false },
  },
  {
    name: "Fuzzy match - slight misspelling",
    content: "This is a test string with some tst words.",
    term: "test",
    options: { isCaseSensitive: false },
  },
  {
    name: "Fuzzy match - transposed characters",
    content: "This is a test string with some tseting words.",
    term: "testing",
    options: { isCaseSensitive: false },
  },
  {
    name: "Whole word matching - exact",
    content: "This is a test string with some testing words.",
    term: "test",
    options: { isCaseSensitive: false, useWholeWordMatching: true },
  },
  {
    name: "Whole word matching - fuzzy",
    content: "This is a test string with some tst words.",
    term: "test",
    options: { isCaseSensitive: false, useWholeWordMatching: true },
  },
  {
    name: "Case sensitive matching",
    content: "This is a Test string with some test words.",
    term: "Test",
    options: { isCaseSensitive: true },
  },
  {
    name: "Long content - small term",
    content: fs.readFileSync(
      path.join(__dirname, "../src/electron/services/NearOperatorService.ts"),
      "utf8"
    ),
    term: "fuzzy",
    options: { isCaseSensitive: false },
  },
  {
    name: "Long content - medium term",
    content: fs.readFileSync(
      path.join(__dirname, "../src/electron/services/NearOperatorService.ts"),
      "utf8"
    ),
    term: "performance",
    options: { isCaseSensitive: false },
  },
  {
    name: "Long content - rare term",
    content: fs.readFileSync(
      path.join(__dirname, "../src/electron/services/NearOperatorService.ts"),
      "utf8"
    ),
    term: "internationalization",
    options: { isCaseSensitive: false },
  },
  {
    name: "Very long content - common term",
    content:
      fs.readFileSync(
        path.join(
          __dirname,
          "../src/electron/services/OptimizedFuzzySearchService.ts"
        ),
        "utf8"
      ) +
      fs.readFileSync(
        path.join(__dirname, "../src/electron/services/NearOperatorService.ts"),
        "utf8"
      ),
    term: "search",
    options: { isCaseSensitive: false },
  },
  {
    name: "Very long content - rare term",
    content:
      fs.readFileSync(
        path.join(
          __dirname,
          "../src/electron/services/OptimizedFuzzySearchService.ts"
        ),
        "utf8"
      ) +
      fs.readFileSync(
        path.join(__dirname, "../src/electron/services/NearOperatorService.ts"),
        "utf8"
      ),
    term: "optimization",
    options: { isCaseSensitive: false },
  },
  {
    name: "Repeated searches - same content and term",
    content: "This is a test string that will be searched multiple times.",
    term: "test",
    options: { isCaseSensitive: false },
    repeat: 10,
  },
  {
    name: "Repeated searches - same content, different terms",
    content: "This string contains multiple words that will be searched.",
    terms: ["string", "contains", "multiple", "words", "searched"],
    options: { isCaseSensitive: false },
  },
  {
    name: "Multiple case-insensitive searches",
    content: "This STRING contains MIXED case words that will BE searched.",
    terms: ["string", "MIXED", "Be", "SEARCHED"],
    options: { isCaseSensitive: false },
  },
];

// Run the test cases
async function runTests() {
  console.log("Starting fuzzy search performance comparison...");
  console.log("=================================================");

  // Create service instances
  const optimizedService = new OptimizedFuzzySearchService();

  // Results storage
  const results = {
    original: {
      totalTime: 0,
      successCount: 0,
      failCount: 0,
    },
    optimized: {
      totalTime: 0,
      successCount: 0,
      failCount: 0,
    },
    comparison: [],
  };

  // Process each test case
  for (const testCase of testCases) {
    console.log(`\nTest case: ${testCase.name}`);

    if (testCase.terms) {
      // Multiple terms test case
      console.log(`Terms: ${JSON.stringify(testCase.terms)}`);
      console.log(`Content length: ${testCase.content.length} characters`);
      console.log(`Options: ${JSON.stringify(testCase.options)}`);

      let originalTotalTime = 0;
      let optimizedTotalTime = 0;
      let originalMatches = 0;
      let optimizedMatches = 0;

      // Test each term
      for (const term of testCase.terms) {
        // Test original implementation
        const originalStart = performance.now();
        const originalResult = originalService.search(
          testCase.content,
          term,
          testCase.options
        );
        const originalEnd = performance.now();
        originalTotalTime += originalEnd - originalStart;
        if (originalResult.isMatch) originalMatches++;

        // Test optimized implementation
        const optimizedStart = performance.now();
        const optimizedResult = optimizedService.search(
          testCase.content,
          term,
          testCase.options
        );
        const optimizedEnd = performance.now();
        optimizedTotalTime += optimizedEnd - optimizedStart;
        if (optimizedResult.isMatch) optimizedMatches++;
      }

      // Calculate improvement
      const improvement =
        ((originalTotalTime - optimizedTotalTime) / originalTotalTime) * 100;

      // Update results
      results.original.totalTime += originalTotalTime;
      results.optimized.totalTime += optimizedTotalTime;

      if (originalMatches === testCase.terms.length) {
        results.original.successCount++;
      } else {
        results.original.failCount++;
      }

      if (optimizedMatches === testCase.terms.length) {
        results.optimized.successCount++;
      } else {
        results.optimized.failCount++;
      }

      results.comparison.push({
        testCase: testCase.name,
        originalTime: originalTotalTime,
        optimizedTime: optimizedTotalTime,
        improvement,
        originalMatches,
        optimizedMatches,
        totalTerms: testCase.terms.length,
        matchesSame: originalMatches === optimizedMatches,
      });

      // Print results for this test case
      console.log(
        `Original implementation: ${originalTotalTime.toFixed(2)}ms (Matches: ${originalMatches}/${testCase.terms.length})`
      );
      console.log(
        `Optimized implementation: ${optimizedTotalTime.toFixed(2)}ms (Matches: ${optimizedMatches}/${testCase.terms.length})`
      );
      console.log(`Improvement: ${improvement.toFixed(2)}%`);
      console.log(
        `Match results are ${originalMatches === optimizedMatches ? "consistent" : "DIFFERENT"}`
      );
    } else if (testCase.repeat) {
      // Repeated search test case
      console.log(
        `Term: "${testCase.term}" (repeated ${testCase.repeat} times)`
      );
      console.log(`Content length: ${testCase.content.length} characters`);
      console.log(`Options: ${JSON.stringify(testCase.options)}`);

      // Test original implementation
      const originalStart = performance.now();
      let originalMatches = 0;
      for (let i = 0; i < testCase.repeat; i++) {
        const originalResult = originalService.search(
          testCase.content,
          testCase.term,
          testCase.options
        );
        if (originalResult.isMatch) originalMatches++;
      }
      const originalEnd = performance.now();
      const originalTime = originalEnd - originalStart;

      // Test optimized implementation
      const optimizedStart = performance.now();
      let optimizedMatches = 0;
      for (let i = 0; i < testCase.repeat; i++) {
        const optimizedResult = optimizedService.search(
          testCase.content,
          testCase.term,
          testCase.options
        );
        if (optimizedResult.isMatch) optimizedMatches++;
      }
      const optimizedEnd = performance.now();
      const optimizedTime = optimizedEnd - optimizedStart;

      // Calculate improvement
      const improvement = ((originalTime - optimizedTime) / originalTime) * 100;

      // Update results
      results.original.totalTime += originalTime;
      results.optimized.totalTime += optimizedTime;

      if (originalMatches > 0) {
        results.original.successCount++;
      } else {
        results.original.failCount++;
      }

      if (optimizedMatches > 0) {
        results.optimized.successCount++;
      } else {
        results.optimized.failCount++;
      }

      results.comparison.push({
        testCase: testCase.name,
        originalTime,
        optimizedTime,
        improvement,
        originalMatch: originalMatches > 0,
        optimizedMatch: optimizedMatches > 0,
        matchesSame: originalMatches > 0 === optimizedMatches > 0,
      });

      // Print results for this test case
      console.log(
        `Original implementation: ${originalTime.toFixed(2)}ms (Matches: ${originalMatches}/${testCase.repeat})`
      );
      console.log(
        `Optimized implementation: ${optimizedTime.toFixed(2)}ms (Matches: ${optimizedMatches}/${testCase.repeat})`
      );
      console.log(`Improvement: ${improvement.toFixed(2)}%`);
      console.log(
        `Match results are ${originalMatches > 0 === optimizedMatches > 0 ? "consistent" : "DIFFERENT"}`
      );
    } else {
      // Standard test case
      console.log(`Term: "${testCase.term}"`);
      console.log(`Content length: ${testCase.content.length} characters`);
      console.log(`Options: ${JSON.stringify(testCase.options)}`);

      // Test original implementation
      const originalStart = performance.now();
      const originalResult = originalService.search(
        testCase.content,
        testCase.term,
        testCase.options
      );
      const originalEnd = performance.now();
      const originalTime = originalEnd - originalStart;

      // Test optimized implementation
      const optimizedStart = performance.now();
      const optimizedResult = optimizedService.search(
        testCase.content,
        testCase.term,
        testCase.options
      );
      const optimizedEnd = performance.now();
      const optimizedTime = optimizedEnd - optimizedStart;

      // Calculate improvement
      const improvement = ((originalTime - optimizedTime) / originalTime) * 100;

      // Update results
      results.original.totalTime += originalTime;
      results.optimized.totalTime += optimizedTime;

      if (originalResult.isMatch) {
        results.original.successCount++;
      } else {
        results.original.failCount++;
      }

      if (optimizedResult.isMatch) {
        results.optimized.successCount++;
      } else {
        results.optimized.failCount++;
      }

      results.comparison.push({
        testCase: testCase.name,
        originalTime,
        optimizedTime,
        improvement,
        originalMatch: originalResult.isMatch,
        optimizedMatch: optimizedResult.isMatch,
        matchesSame: originalResult.isMatch === optimizedResult.isMatch,
      });

      // Print results for this test case
      console.log(
        `Original implementation: ${originalTime.toFixed(2)}ms (Match: ${originalResult.isMatch})`
      );
      console.log(
        `Optimized implementation: ${optimizedTime.toFixed(2)}ms (Match: ${optimizedResult.isMatch})`
      );
      console.log(`Improvement: ${improvement.toFixed(2)}%`);
      console.log(
        `Match results are ${originalResult.isMatch === optimizedResult.isMatch ? "consistent" : "DIFFERENT"}`
      );
    }
  }

  // Print overall results
  console.log("\n=================================================");
  console.log("Overall Results:");
  console.log("=================================================");
  console.log(
    `Original implementation total time: ${results.original.totalTime.toFixed(2)}ms`
  );
  console.log(
    `Optimized implementation total time: ${results.optimized.totalTime.toFixed(2)}ms`
  );

  const overallImprovement =
    ((results.original.totalTime - results.optimized.totalTime) /
      results.original.totalTime) *
    100;
  console.log(`Overall improvement: ${overallImprovement.toFixed(2)}%`);

  console.log(
    `\nOriginal implementation matches: ${results.original.successCount}/${testCases.length}`
  );
  console.log(
    `Optimized implementation matches: ${results.optimized.successCount}/${testCases.length}`
  );

  const inconsistentResults = results.comparison.filter((r) => !r.matchesSame);
  if (inconsistentResults.length > 0) {
    console.log("\nWARNING: Inconsistent match results detected:");
    inconsistentResults.forEach((r) => {
      console.log(
        `- ${r.testCase}: Original: ${r.originalMatch}, Optimized: ${r.optimizedMatch}`
      );
    });
  } else {
    console.log("\nAll match results are consistent between implementations.");
  }

  // Print detailed comparison
  console.log("\n=================================================");
  console.log("Detailed Comparison:");
  console.log("=================================================");
  console.log(
    "Test Case | Original Time | Optimized Time | Improvement | Match Consistency"
  );
  console.log(
    "---------|--------------|---------------|------------|------------------"
  );

  results.comparison.forEach((r) => {
    console.log(
      `${r.testCase.padEnd(20)} | ` +
        `${r.originalTime.toFixed(2).padStart(12)}ms | ` +
        `${r.optimizedTime.toFixed(2).padStart(13)}ms | ` +
        `${r.improvement.toFixed(2).padStart(10)}% | ` +
        `${r.matchesSame ? "Consistent" : "DIFFERENT"}`
    );
  });

  // Save results to file
  const timestamp = new Date().toISOString().replace(/:/g, "-");
  const resultsPath = path.join(
    __dirname,
    "../performance-results",
    `further-optimized-fuzzy-search-comparison-${timestamp}.json`
  );

  // Ensure directory exists
  if (!fs.existsSync(path.dirname(resultsPath))) {
    fs.mkdirSync(path.dirname(resultsPath), { recursive: true });
  }

  // Save the results
  fs.writeFileSync(resultsPath, JSON.stringify(results, null, 2));
  console.log(`\nResults saved to: ${resultsPath}`);
}

// Run the tests
runTests().catch((error) => {
  console.error("Error running tests:", error);
  process.exit(1);
});
