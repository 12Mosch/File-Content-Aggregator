/**
 * Script to analyze the results of the fuzzy search optimization
 */

import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

// Get the current directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load the performance comparison data
const comparisonData = JSON.parse(
  fs.readFileSync(
    path.join(__dirname, '../performance-results/fuzzy-search-comparison-2025-04-18T19-36-47.614Z.json'),
    'utf8'
  )
);

// Load the NEAR operator metrics before optimization
const beforeMetrics = JSON.parse(
  fs.readFileSync(
    path.join(__dirname, '../performance-results/near-operator-metrics-2025-04-18T19-25-23.824Z.json'),
    'utf8'
  )
);

// Load the NEAR operator metrics after optimization
const afterMetrics = JSON.parse(
  fs.readFileSync(
    path.join(__dirname, '../performance-results/near-operator-metrics-2025-04-18T19-37-01.120Z.json'),
    'utf8'
  )
);

// Print the fuzzy search comparison results
console.log('=================================================');
console.log('FUZZY SEARCH OPTIMIZATION RESULTS');
console.log('=================================================');
console.log(`Original implementation total time: ${comparisonData.original.totalTime.toFixed(2)}ms`);
console.log(`Optimized implementation total time: ${comparisonData.optimized.totalTime.toFixed(2)}ms`);

const improvement = (comparisonData.original.totalTime - comparisonData.optimized.totalTime) / comparisonData.original.totalTime * 100;
console.log(`Overall improvement: ${improvement.toFixed(2)}%`);

console.log(`\nOriginal implementation matches: ${comparisonData.original.successCount}/${comparisonData.comparison.length}`);
console.log(`Optimized implementation matches: ${comparisonData.optimized.successCount}/${comparisonData.comparison.length}`);

// Print the best improvements
console.log('\nBest improvements:');
comparisonData.comparison
  .sort((a, b) => b.improvement - a.improvement)
  .slice(0, 3)
  .forEach(item => {
    console.log(`- ${item.testCase}: ${item.improvement.toFixed(2)}% improvement`);
  });

// Print the worst cases
console.log('\nWorst cases:');
comparisonData.comparison
  .sort((a, b) => a.improvement - b.improvement)
  .slice(0, 3)
  .forEach(item => {
    console.log(`- ${item.testCase}: ${item.improvement.toFixed(2)}% improvement`);
  });

// Print inconsistent results
const inconsistentResults = comparisonData.comparison.filter(r => !r.matchesSame);
if (inconsistentResults.length > 0) {
  console.log('\nInconsistent match results:');
  inconsistentResults.forEach(r => {
    console.log(`- ${r.testCase}: Original: ${r.originalMatch}, Optimized: ${r.optimizedMatch}`);
  });
}

// Print the NEAR operator metrics comparison
console.log('\n=================================================');
console.log('NEAR OPERATOR FUZZY SEARCH METRICS');
console.log('=================================================');
console.log('Before optimization:');
console.log(`- Total time: ${beforeMetrics.metrics.phaseMetrics.fuzzySearch.totalTime.toFixed(2)}ms`);
console.log(`- Count: ${beforeMetrics.metrics.phaseMetrics.fuzzySearch.count}`);
console.log(`- Average time: ${beforeMetrics.metrics.phaseMetrics.fuzzySearch.averageTime.toFixed(4)}ms`);
console.log(`- Success count: ${beforeMetrics.metrics.phaseMetrics.fuzzySearch.successCount}`);
console.log(`- Success rate: ${(beforeMetrics.metrics.phaseMetrics.fuzzySearch.successCount / beforeMetrics.metrics.phaseMetrics.fuzzySearch.count * 100).toFixed(2)}%`);

console.log('\nAfter optimization:');
console.log(`- Total time: ${afterMetrics.metrics.phaseMetrics.fuzzySearch.totalTime.toFixed(2)}ms`);
console.log(`- Count: ${afterMetrics.metrics.phaseMetrics.fuzzySearch.count}`);
console.log(`- Average time: ${afterMetrics.metrics.phaseMetrics.fuzzySearch.averageTime.toFixed(4)}ms`);
console.log(`- Success count: ${afterMetrics.metrics.phaseMetrics.fuzzySearch.successCount}`);
console.log(`- Success rate: ${(afterMetrics.metrics.phaseMetrics.fuzzySearch.successCount / afterMetrics.metrics.phaseMetrics.fuzzySearch.count * 100).toFixed(2)}%`);

// Calculate improvements
const timeImprovement = (beforeMetrics.metrics.phaseMetrics.fuzzySearch.totalTime - afterMetrics.metrics.phaseMetrics.fuzzySearch.totalTime) / beforeMetrics.metrics.phaseMetrics.fuzzySearch.totalTime * 100;
const countImprovement = (beforeMetrics.metrics.phaseMetrics.fuzzySearch.count - afterMetrics.metrics.phaseMetrics.fuzzySearch.count) / beforeMetrics.metrics.phaseMetrics.fuzzySearch.count * 100;
const successRateImprovement = (afterMetrics.metrics.phaseMetrics.fuzzySearch.successCount / afterMetrics.metrics.phaseMetrics.fuzzySearch.count) - (beforeMetrics.metrics.phaseMetrics.fuzzySearch.successCount / beforeMetrics.metrics.phaseMetrics.fuzzySearch.count);

console.log('\nImprovements:');
console.log(`- Time improvement: ${timeImprovement.toFixed(2)}%`);
console.log(`- Count reduction: ${countImprovement.toFixed(2)}%`);
console.log(`- Success rate improvement: ${(successRateImprovement * 100).toFixed(2)} percentage points`);

// Print overall conclusions
console.log('\n=================================================');
console.log('CONCLUSIONS');
console.log('=================================================');

if (timeImprovement > 0) {
  console.log('✅ The optimized fuzzy search implementation is faster overall.');
} else {
  console.log('❌ The optimized fuzzy search implementation is not faster overall.');
}

if (countImprovement > 0) {
  console.log('✅ The optimized implementation reduces the number of fuzzy searches needed.');
} else {
  console.log('❌ The optimized implementation does not reduce the number of fuzzy searches.');
}

if (successRateImprovement > 0) {
  console.log('✅ The optimized implementation has a higher success rate for fuzzy searches.');
} else {
  console.log('❌ The optimized implementation does not improve the success rate for fuzzy searches.');
}

if (inconsistentResults.length > 0) {
  console.log('⚠️ There are inconsistencies in match results between the implementations.');
} else {
  console.log('✅ Match results are consistent between implementations.');
}

// Print recommendations
console.log('\nRECOMMENDATIONS:');

if (timeImprovement > 0 && successRateImprovement > 0) {
  console.log('1. Adopt the optimized fuzzy search implementation for all search operations.');
} else if (timeImprovement > 0) {
  console.log('1. Adopt the optimized fuzzy search implementation with caution, monitoring match quality.');
} else if (successRateImprovement > 0) {
  console.log('1. Further optimize the implementation for speed while maintaining the improved match quality.');
} else {
  console.log('1. Revisit the optimization approach to improve both speed and match quality.');
}

console.log('2. Implement the early termination strategy from the optimized implementation.');
console.log('3. Add the smart triggering mechanism to avoid unnecessary fuzzy searches.');
console.log('4. Improve the caching mechanism as implemented in the optimized version.');

// Save the analysis to a file
const analysisPath = path.join(__dirname, '../performance-results', 'fuzzy-search-optimization-analysis.txt');
fs.writeFileSync(analysisPath, `
=================================================
FUZZY SEARCH OPTIMIZATION ANALYSIS
=================================================
Date: ${new Date().toISOString()}

FUZZY SEARCH OPTIMIZATION RESULTS
=================================================
Original implementation total time: ${comparisonData.original.totalTime.toFixed(2)}ms
Optimized implementation total time: ${comparisonData.optimized.totalTime.toFixed(2)}ms
Overall improvement: ${improvement.toFixed(2)}%

Original implementation matches: ${comparisonData.original.successCount}/${comparisonData.comparison.length}
Optimized implementation matches: ${comparisonData.optimized.successCount}/${comparisonData.comparison.length}

Best improvements:
${comparisonData.comparison
  .sort((a, b) => b.improvement - a.improvement)
  .slice(0, 3)
  .map(item => `- ${item.testCase}: ${item.improvement.toFixed(2)}% improvement`)
  .join('\n')}

Worst cases:
${comparisonData.comparison
  .sort((a, b) => a.improvement - b.improvement)
  .slice(0, 3)
  .map(item => `- ${item.testCase}: ${item.improvement.toFixed(2)}% improvement`)
  .join('\n')}

${inconsistentResults.length > 0 ? `
Inconsistent match results:
${inconsistentResults.map(r => `- ${r.testCase}: Original: ${r.originalMatch}, Optimized: ${r.optimizedMatch}`).join('\n')}
` : 'All match results are consistent between implementations.'}

NEAR OPERATOR FUZZY SEARCH METRICS
=================================================
Before optimization:
- Total time: ${beforeMetrics.metrics.phaseMetrics.fuzzySearch.totalTime.toFixed(2)}ms
- Count: ${beforeMetrics.metrics.phaseMetrics.fuzzySearch.count}
- Average time: ${beforeMetrics.metrics.phaseMetrics.fuzzySearch.averageTime.toFixed(4)}ms
- Success count: ${beforeMetrics.metrics.phaseMetrics.fuzzySearch.successCount}
- Success rate: ${(beforeMetrics.metrics.phaseMetrics.fuzzySearch.successCount / beforeMetrics.metrics.phaseMetrics.fuzzySearch.count * 100).toFixed(2)}%

After optimization:
- Total time: ${afterMetrics.metrics.phaseMetrics.fuzzySearch.totalTime.toFixed(2)}ms
- Count: ${afterMetrics.metrics.phaseMetrics.fuzzySearch.count}
- Average time: ${afterMetrics.metrics.phaseMetrics.fuzzySearch.averageTime.toFixed(4)}ms
- Success count: ${afterMetrics.metrics.phaseMetrics.fuzzySearch.successCount}
- Success rate: ${(afterMetrics.metrics.phaseMetrics.fuzzySearch.successCount / afterMetrics.metrics.phaseMetrics.fuzzySearch.count * 100).toFixed(2)}%

Improvements:
- Time improvement: ${timeImprovement.toFixed(2)}%
- Count reduction: ${countImprovement.toFixed(2)}%
- Success rate improvement: ${(successRateImprovement * 100).toFixed(2)} percentage points

CONCLUSIONS
=================================================
${timeImprovement > 0 ? '✅ The optimized fuzzy search implementation is faster overall.' : '❌ The optimized fuzzy search implementation is not faster overall.'}
${countImprovement > 0 ? '✅ The optimized implementation reduces the number of fuzzy searches needed.' : '❌ The optimized implementation does not reduce the number of fuzzy searches.'}
${successRateImprovement > 0 ? '✅ The optimized implementation has a higher success rate for fuzzy searches.' : '❌ The optimized implementation does not improve the success rate for fuzzy searches.'}
${inconsistentResults.length > 0 ? '⚠️ There are inconsistencies in match results between the implementations.' : '✅ Match results are consistent between implementations.'}

RECOMMENDATIONS:
${timeImprovement > 0 && successRateImprovement > 0 
  ? '1. Adopt the optimized fuzzy search implementation for all search operations.' 
  : timeImprovement > 0 
    ? '1. Adopt the optimized fuzzy search implementation with caution, monitoring match quality.' 
    : successRateImprovement > 0 
      ? '1. Further optimize the implementation for speed while maintaining the improved match quality.' 
      : '1. Revisit the optimization approach to improve both speed and match quality.'}
2. Implement the early termination strategy from the optimized implementation.
3. Add the smart triggering mechanism to avoid unnecessary fuzzy searches.
4. Improve the caching mechanism as implemented in the optimized version.
`);

console.log(`\nAnalysis saved to: ${analysisPath}`);
