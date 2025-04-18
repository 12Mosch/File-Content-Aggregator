/**
 * Test script for comparing the performance of the original and optimized fuzzy search implementations
 */

import { FuzzySearchService } from "../dist-electron/electron/services/FuzzySearchService.js";
import { OptimizedFuzzySearchService } from "../dist-electron/electron/services/OptimizedFuzzySearchService.js";
import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";
import { execSync } from "child_process";

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
];

// Run the test cases
async function runTests() {
  console.log("Starting fuzzy search performance comparison...");
  console.log("=================================================");

  // Create service instances
  const originalService = new FuzzySearchService();
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
    `fuzzy-search-comparison-${timestamp}.json`
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
