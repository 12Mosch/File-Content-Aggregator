/**
 * Script to compare the performance of the simplified caching implementation
 */

import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

// Get the current directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load the NEAR operator metrics before simplification
const beforeMetrics = JSON.parse(
  fs.readFileSync(
    path.join(__dirname, '../performance-results/near-operator-metrics-2025-04-18T20-08-57.842Z.json'),
    'utf8'
  )
);

// Load the NEAR operator metrics after simplification
const afterMetrics = JSON.parse(
  fs.readFileSync(
    path.join(__dirname, '../performance-results/near-operator-metrics-2025-04-18T20-19-52.486Z.json'),
    'utf8'
  )
);

// Print the NEAR operator metrics comparison
console.log('=================================================');
console.log('NEAR OPERATOR FUZZY SEARCH METRICS');
console.log('=================================================');
console.log('Before simplification:');
console.log(`- Total time: ${beforeMetrics.metrics.phaseMetrics.fuzzySearch.totalTime.toFixed(2)}ms`);
console.log(`- Count: ${beforeMetrics.metrics.phaseMetrics.fuzzySearch.count}`);
console.log(`- Average time: ${beforeMetrics.metrics.phaseMetrics.fuzzySearch.averageTime.toFixed(4)}ms`);
console.log(`- Success count: ${beforeMetrics.metrics.phaseMetrics.fuzzySearch.successCount}`);
console.log(`- Success rate: ${(beforeMetrics.metrics.phaseMetrics.fuzzySearch.successCount / beforeMetrics.metrics.phaseMetrics.fuzzySearch.count * 100).toFixed(2)}%`);

console.log('\nAfter simplification:');
console.log(`- Total time: ${afterMetrics.metrics.phaseMetrics.fuzzySearch.totalTime.toFixed(2)}ms`);
console.log(`- Count: ${afterMetrics.metrics.phaseMetrics.fuzzySearch.count}`);
console.log(`- Average time: ${afterMetrics.metrics.phaseMetrics.fuzzySearch.averageTime.toFixed(4)}ms`);
console.log(`- Success count: ${afterMetrics.metrics.phaseMetrics.fuzzySearch.successCount}`);
console.log(`- Success rate: ${(afterMetrics.metrics.phaseMetrics.fuzzySearch.successCount / afterMetrics.metrics.phaseMetrics.fuzzySearch.count * 100).toFixed(2)}%`);

// Calculate differences
const timeDiff = afterMetrics.metrics.phaseMetrics.fuzzySearch.totalTime - beforeMetrics.metrics.phaseMetrics.fuzzySearch.totalTime;
const timePercentage = (timeDiff / beforeMetrics.metrics.phaseMetrics.fuzzySearch.totalTime * 100);
const avgTimeDiff = afterMetrics.metrics.phaseMetrics.fuzzySearch.averageTime - beforeMetrics.metrics.phaseMetrics.fuzzySearch.averageTime;
const avgTimePercentage = (avgTimeDiff / beforeMetrics.metrics.phaseMetrics.fuzzySearch.averageTime * 100);

console.log('\nDifferences:');
console.log(`- Total time: ${timeDiff.toFixed(2)}ms (${timePercentage > 0 ? '+' : ''}${timePercentage.toFixed(2)}%)`);
console.log(`- Average time: ${avgTimeDiff.toFixed(4)}ms (${avgTimePercentage > 0 ? '+' : ''}${avgTimePercentage.toFixed(2)}%)`);

// Print overall conclusions
console.log('\n=================================================');
console.log('CONCLUSIONS');
console.log('=================================================');

if (timePercentage <= 0) {
  console.log('✅ The simplified caching approach has improved overall fuzzy search performance.');
} else {
  console.log('❌ The simplified caching approach has not improved overall fuzzy search performance.');
}

// Print recommendations
console.log('\nRECOMMENDATIONS:');

if (timePercentage > 0) {
  console.log('1. Revert to the original implementation without the complex caching mechanisms.');
  console.log('2. Focus on optimizing the core search algorithm rather than caching.');
  console.log('3. Consider using a simpler approach with fewer caches and less overhead.');
} else {
  console.log('1. Continue to monitor performance in real-world usage.');
  console.log('2. Consider further simplifications to reduce overhead.');
  console.log('3. Focus on optimizing the most frequently used code paths.');
}

// Save the analysis to a file
const analysisPath = path.join(__dirname, '../performance-results', 'simplified-caching-analysis.txt');
fs.writeFileSync(analysisPath, `
=================================================
SIMPLIFIED CACHING ANALYSIS
=================================================
Date: ${new Date().toISOString()}

NEAR OPERATOR FUZZY SEARCH METRICS
=================================================
Before simplification:
- Total time: ${beforeMetrics.metrics.phaseMetrics.fuzzySearch.totalTime.toFixed(2)}ms
- Count: ${beforeMetrics.metrics.phaseMetrics.fuzzySearch.count}
- Average time: ${beforeMetrics.metrics.phaseMetrics.fuzzySearch.averageTime.toFixed(4)}ms
- Success count: ${beforeMetrics.metrics.phaseMetrics.fuzzySearch.successCount}
- Success rate: ${(beforeMetrics.metrics.phaseMetrics.fuzzySearch.successCount / beforeMetrics.metrics.phaseMetrics.fuzzySearch.count * 100).toFixed(2)}%

After simplification:
- Total time: ${afterMetrics.metrics.phaseMetrics.fuzzySearch.totalTime.toFixed(2)}ms
- Count: ${afterMetrics.metrics.phaseMetrics.fuzzySearch.count}
- Average time: ${afterMetrics.metrics.phaseMetrics.fuzzySearch.averageTime.toFixed(4)}ms
- Success count: ${afterMetrics.metrics.phaseMetrics.fuzzySearch.successCount}
- Success rate: ${(afterMetrics.metrics.phaseMetrics.fuzzySearch.successCount / afterMetrics.metrics.phaseMetrics.fuzzySearch.count * 100).toFixed(2)}%

Differences:
- Total time: ${timeDiff.toFixed(2)}ms (${timePercentage > 0 ? '+' : ''}${timePercentage.toFixed(2)}%)
- Average time: ${avgTimeDiff.toFixed(4)}ms (${avgTimePercentage > 0 ? '+' : ''}${avgTimePercentage.toFixed(2)}%)

CONCLUSIONS
=================================================
${timePercentage <= 0 
  ? '✅ The simplified caching approach has improved overall fuzzy search performance.' 
  : '❌ The simplified caching approach has not improved overall fuzzy search performance.'}

RECOMMENDATIONS
=================================================
${timePercentage > 0
  ? '1. Revert to the original implementation without the complex caching mechanisms.\n2. Focus on optimizing the core search algorithm rather than caching.\n3. Consider using a simpler approach with fewer caches and less overhead.'
  : '1. Continue to monitor performance in real-world usage.\n2. Consider further simplifications to reduce overhead.\n3. Focus on optimizing the most frequently used code paths.'}
`);

console.log(`\nAnalysis saved to: ${analysisPath}`);
