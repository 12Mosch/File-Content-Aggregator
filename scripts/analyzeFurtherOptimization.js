/**
 * Script to analyze the results of the further fuzzy search optimization
 */

import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";

// Get the current directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load the performance comparison data
const comparisonData = JSON.parse(
  fs.readFileSync(
    path.join(
      __dirname,
      "../performance-results/further-optimized-fuzzy-search-comparison-2025-04-18T19-51-55.630Z.json"
    ),
    "utf8"
  )
);

// Load the NEAR operator metrics before further optimization
const beforeMetrics = JSON.parse(
  fs.readFileSync(
    path.join(
      __dirname,
      "../performance-results/near-operator-metrics-2025-04-18T19-37-01.120Z.json"
    ),
    "utf8"
  )
);

// Load the NEAR operator metrics after further optimization
const afterMetrics = JSON.parse(
  fs.readFileSync(
    path.join(
      __dirname,
      "../performance-results/near-operator-metrics-2025-04-18T19-52-08.421Z.json"
    ),
    "utf8"
  )
);

// Print the fuzzy search comparison results
console.log("=================================================");
console.log("FURTHER FUZZY SEARCH OPTIMIZATION RESULTS");
console.log("=================================================");
console.log(
  `Original implementation total time: ${comparisonData.original.totalTime.toFixed(2)}ms`
);
console.log(
  `Further optimized implementation total time: ${comparisonData.optimized.totalTime.toFixed(2)}ms`
);

const improvement =
  ((comparisonData.original.totalTime - comparisonData.optimized.totalTime) /
    comparisonData.original.totalTime) *
  100;
console.log(`Overall improvement: ${improvement.toFixed(2)}%`);

console.log(
  `\nOriginal implementation matches: ${comparisonData.original.successCount}/${comparisonData.comparison.length}`
);
console.log(
  `Further optimized implementation matches: ${comparisonData.optimized.successCount}/${comparisonData.comparison.length}`
);

// Print the best improvements
console.log("\nBest improvements:");
comparisonData.comparison
  .sort((a, b) => b.improvement - a.improvement)
  .slice(0, 3)
  .forEach((item) => {
    console.log(
      `- ${item.testCase}: ${item.improvement.toFixed(2)}% improvement`
    );
  });

// Print the worst cases
console.log("\nWorst cases:");
comparisonData.comparison
  .sort((a, b) => a.improvement - b.improvement)
  .slice(0, 3)
  .forEach((item) => {
    console.log(
      `- ${item.testCase}: ${item.improvement.toFixed(2)}% improvement`
    );
  });

// Print inconsistent results
const inconsistentResults = comparisonData.comparison.filter(
  (r) => !r.matchesSame
);
if (inconsistentResults.length > 0) {
  console.log("\nInconsistent match results:");
  inconsistentResults.forEach((r) => {
    console.log(
      `- ${r.testCase}: Original: ${r.originalMatch}, Optimized: ${r.optimizedMatch}`
    );
  });
}

// Print the NEAR operator metrics comparison
console.log("\n=================================================");
console.log("NEAR OPERATOR FUZZY SEARCH METRICS");
console.log("=================================================");
console.log("Before further optimization:");
console.log(
  `- Total time: ${beforeMetrics.metrics.phaseMetrics.fuzzySearch.totalTime.toFixed(2)}ms`
);
console.log(`- Count: ${beforeMetrics.metrics.phaseMetrics.fuzzySearch.count}`);
console.log(
  `- Average time: ${beforeMetrics.metrics.phaseMetrics.fuzzySearch.averageTime.toFixed(4)}ms`
);
console.log(
  `- Success count: ${beforeMetrics.metrics.phaseMetrics.fuzzySearch.successCount}`
);
console.log(
  `- Success rate: ${((beforeMetrics.metrics.phaseMetrics.fuzzySearch.successCount / beforeMetrics.metrics.phaseMetrics.fuzzySearch.count) * 100).toFixed(2)}%`
);

console.log("\nAfter further optimization:");
console.log(
  `- Total time: ${afterMetrics.metrics.phaseMetrics.fuzzySearch.totalTime.toFixed(2)}ms`
);
console.log(`- Count: ${afterMetrics.metrics.phaseMetrics.fuzzySearch.count}`);
console.log(
  `- Average time: ${afterMetrics.metrics.phaseMetrics.fuzzySearch.averageTime.toFixed(4)}ms`
);
console.log(
  `- Success count: ${afterMetrics.metrics.phaseMetrics.fuzzySearch.successCount}`
);
console.log(
  `- Success rate: ${((afterMetrics.metrics.phaseMetrics.fuzzySearch.successCount / afterMetrics.metrics.phaseMetrics.fuzzySearch.count) * 100).toFixed(2)}%`
);

// Calculate improvements
const timeImprovement =
  ((beforeMetrics.metrics.phaseMetrics.fuzzySearch.totalTime -
    afterMetrics.metrics.phaseMetrics.fuzzySearch.totalTime) /
    beforeMetrics.metrics.phaseMetrics.fuzzySearch.totalTime) *
  100;
const avgTimeImprovement =
  ((beforeMetrics.metrics.phaseMetrics.fuzzySearch.averageTime -
    afterMetrics.metrics.phaseMetrics.fuzzySearch.averageTime) /
    beforeMetrics.metrics.phaseMetrics.fuzzySearch.averageTime) *
  100;

console.log("\nImprovements:");
console.log(`- Total time improvement: ${timeImprovement.toFixed(2)}%`);
console.log(`- Average time improvement: ${avgTimeImprovement.toFixed(2)}%`);

// Print overall conclusions
console.log("\n=================================================");
console.log("CONCLUSIONS");
console.log("=================================================");

if (timeImprovement > 0) {
  console.log(
    "✅ The further optimized fuzzy search implementation is faster overall in the NEAR operator."
  );
} else {
  console.log(
    "❌ The further optimized fuzzy search implementation is not faster overall in the NEAR operator."
  );
}

if (avgTimeImprovement > 0) {
  console.log(
    "✅ The average processing time per fuzzy search operation has improved."
  );
} else {
  console.log(
    "❌ The average processing time per fuzzy search operation has not improved."
  );
}

if (inconsistentResults.length > 0) {
  console.log(
    "⚠️ There are inconsistencies in match results between the implementations."
  );
} else {
  console.log("✅ Match results are consistent between implementations.");
}

// Print recommendations
console.log("\nRECOMMENDATIONS:");

if (timeImprovement > 10) {
  console.log(
    "1. Adopt the further optimized fuzzy search implementation for all search operations."
  );
} else if (timeImprovement > 0) {
  console.log(
    "1. Adopt the further optimized fuzzy search implementation with caution, monitoring performance in real-world usage."
  );
} else {
  console.log(
    "1. Consider additional optimizations or a hybrid approach to improve performance further."
  );
}

console.log(
  "2. Implement the string normalization caching for all case-insensitive operations."
);
console.log(
  "3. Implement the RegExp caching for all regular expression operations."
);
console.log(
  "4. Implement the Levenshtein distance caching for all fuzzy matching operations."
);

// Save the analysis to a file
const analysisPath = path.join(
  __dirname,
  "../performance-results",
  "further-fuzzy-search-optimization-analysis.txt"
);
fs.writeFileSync(
  analysisPath,
  `
=================================================
FURTHER FUZZY SEARCH OPTIMIZATION ANALYSIS
=================================================
Date: ${new Date().toISOString()}

FURTHER FUZZY SEARCH OPTIMIZATION RESULTS
=================================================
Original implementation total time: ${comparisonData.original.totalTime.toFixed(2)}ms
Further optimized implementation total time: ${comparisonData.optimized.totalTime.toFixed(2)}ms
Overall improvement: ${improvement.toFixed(2)}%

Original implementation matches: ${comparisonData.original.successCount}/${comparisonData.comparison.length}
Further optimized implementation matches: ${comparisonData.optimized.successCount}/${comparisonData.comparison.length}

Best improvements:
${comparisonData.comparison
  .sort((a, b) => b.improvement - a.improvement)
  .slice(0, 3)
  .map(
    (item) => `- ${item.testCase}: ${item.improvement.toFixed(2)}% improvement`
  )
  .join("\n")}

Worst cases:
${comparisonData.comparison
  .sort((a, b) => a.improvement - b.improvement)
  .slice(0, 3)
  .map(
    (item) => `- ${item.testCase}: ${item.improvement.toFixed(2)}% improvement`
  )
  .join("\n")}

${
  inconsistentResults.length > 0
    ? `
Inconsistent match results:
${inconsistentResults.map((r) => `- ${r.testCase}: Original: ${r.originalMatch}, Optimized: ${r.optimizedMatch}`).join("\n")}
`
    : "All match results are consistent between implementations."
}

NEAR OPERATOR FUZZY SEARCH METRICS
=================================================
Before further optimization:
- Total time: ${beforeMetrics.metrics.phaseMetrics.fuzzySearch.totalTime.toFixed(2)}ms
- Count: ${beforeMetrics.metrics.phaseMetrics.fuzzySearch.count}
- Average time: ${beforeMetrics.metrics.phaseMetrics.fuzzySearch.averageTime.toFixed(4)}ms
- Success count: ${beforeMetrics.metrics.phaseMetrics.fuzzySearch.successCount}
- Success rate: ${((beforeMetrics.metrics.phaseMetrics.fuzzySearch.successCount / beforeMetrics.metrics.phaseMetrics.fuzzySearch.count) * 100).toFixed(2)}%

After further optimization:
- Total time: ${afterMetrics.metrics.phaseMetrics.fuzzySearch.totalTime.toFixed(2)}ms
- Count: ${afterMetrics.metrics.phaseMetrics.fuzzySearch.count}
- Average time: ${afterMetrics.metrics.phaseMetrics.fuzzySearch.averageTime.toFixed(4)}ms
- Success count: ${afterMetrics.metrics.phaseMetrics.fuzzySearch.successCount}
- Success rate: ${((afterMetrics.metrics.phaseMetrics.fuzzySearch.successCount / afterMetrics.metrics.phaseMetrics.fuzzySearch.count) * 100).toFixed(2)}%

Improvements:
- Total time improvement: ${timeImprovement.toFixed(2)}%
- Average time improvement: ${avgTimeImprovement.toFixed(2)}%

CONCLUSIONS
=================================================
${timeImprovement > 0 ? "✅ The further optimized fuzzy search implementation is faster overall in the NEAR operator." : "❌ The further optimized fuzzy search implementation is not faster overall in the NEAR operator."}
${avgTimeImprovement > 0 ? "✅ The average processing time per fuzzy search operation has improved." : "❌ The average processing time per fuzzy search operation has not improved."}
${inconsistentResults.length > 0 ? "⚠️ There are inconsistencies in match results between the implementations." : "✅ Match results are consistent between implementations."}

RECOMMENDATIONS:
${
  timeImprovement > 10
    ? "1. Adopt the further optimized fuzzy search implementation for all search operations."
    : timeImprovement > 0
      ? "1. Adopt the further optimized fuzzy search implementation with caution, monitoring performance in real-world usage."
      : "1. Consider additional optimizations or a hybrid approach to improve performance further."
}
2. Implement the string normalization caching for all case-insensitive operations.
3. Implement the RegExp caching for all regular expression operations.
4. Implement the Levenshtein distance caching for all fuzzy matching operations.
`
);

console.log(`\nAnalysis saved to: ${analysisPath}`);
