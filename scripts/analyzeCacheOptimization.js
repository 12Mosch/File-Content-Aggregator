/**
 * Script to analyze the results of the cache optimization
 */

import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

// Get the current directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load the cache hit rate data
const cacheHitRateData = JSON.parse(
  fs.readFileSync(
    path.join(__dirname, '../performance-results/cache-hit-rates-2025-04-18T20-06-27.028Z.json'),
    'utf8'
  )
);

// Load the NEAR operator metrics before cache optimization
const beforeMetrics = JSON.parse(
  fs.readFileSync(
    path.join(__dirname, '../performance-results/near-operator-metrics-2025-04-18T19-52-08.421Z.json'),
    'utf8'
  )
);

// Load the NEAR operator metrics after cache optimization
const afterMetrics = JSON.parse(
  fs.readFileSync(
    path.join(__dirname, '../performance-results/near-operator-metrics-2025-04-18T20-08-57.842Z.json'),
    'utf8'
  )
);

// Print the cache hit rate results
console.log('=================================================');
console.log('CACHE OPTIMIZATION RESULTS');
console.log('=================================================');
console.log('Cache Hit Rates:');
console.log(`- Result Cache: ${(cacheHitRateData.resultCache.hitRate * 100).toFixed(2)}% (${cacheHitRateData.resultCache.hits} hits, ${cacheHitRateData.resultCache.misses} misses)`);
console.log(`- Normalized String Cache: ${(cacheHitRateData.normalizedStringCache.hitRate * 100).toFixed(2)}% (${cacheHitRateData.normalizedStringCache.hits} hits, ${cacheHitRateData.normalizedStringCache.misses} misses)`);
console.log(`- Levenshtein Cache: ${(cacheHitRateData.levenshteinCache.hitRate * 100).toFixed(2)}% (${cacheHitRateData.levenshteinCache.hits} hits, ${cacheHitRateData.levenshteinCache.misses} misses)`);
console.log(`- RegExp Cache: ${(cacheHitRateData.regexCache.hitRate * 100).toFixed(2)}% (${cacheHitRateData.regexCache.hits} hits, ${cacheHitRateData.regexCache.misses} misses)`);

// Print the NEAR operator metrics comparison
console.log('\n=================================================');
console.log('NEAR OPERATOR FUZZY SEARCH METRICS');
console.log('=================================================');
console.log('Before cache optimization:');
console.log(`- Total time: ${beforeMetrics.metrics.phaseMetrics.fuzzySearch.totalTime.toFixed(2)}ms`);
console.log(`- Count: ${beforeMetrics.metrics.phaseMetrics.fuzzySearch.count}`);
console.log(`- Average time: ${beforeMetrics.metrics.phaseMetrics.fuzzySearch.averageTime.toFixed(4)}ms`);
console.log(`- Success count: ${beforeMetrics.metrics.phaseMetrics.fuzzySearch.successCount}`);
console.log(`- Success rate: ${(beforeMetrics.metrics.phaseMetrics.fuzzySearch.successCount / beforeMetrics.metrics.phaseMetrics.fuzzySearch.count * 100).toFixed(2)}%`);

console.log('\nAfter cache optimization:');
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
  console.log('✅ The cache optimization has improved overall fuzzy search performance.');
} else {
  console.log('❌ The cache optimization has not improved overall fuzzy search performance.');
  console.log('   This could be due to the overhead of cache management or other factors.');
}

if (cacheHitRateData.resultCache.hitRate > 0.5) {
  console.log('✅ The result cache has a good hit rate, which should improve performance over time.');
} else {
  console.log('⚠️ The result cache hit rate is lower than expected. Further optimization may be needed.');
}

if (cacheHitRateData.normalizedStringCache.hitRate > 0.5) {
  console.log('✅ The normalized string cache has a good hit rate, which should reduce string processing overhead.');
} else {
  console.log('⚠️ The normalized string cache hit rate is lower than expected. Further optimization may be needed.');
}

// Print recommendations
console.log('\nRECOMMENDATIONS:');

if (timePercentage > 0) {
  console.log('1. Consider simplifying the cache implementation to reduce overhead.');
  console.log('2. Profile the cache operations to identify bottlenecks.');
  console.log('3. Consider using a more efficient data structure for caching.');
} else {
  console.log('1. Continue to monitor cache hit rates in real-world usage.');
  console.log('2. Consider pre-warming caches for frequently used terms and patterns.');
  console.log('3. Implement more sophisticated cache eviction strategies based on usage patterns.');
}

// Save the analysis to a file
const analysisPath = path.join(__dirname, '../performance-results', 'cache-optimization-analysis.txt');
fs.writeFileSync(analysisPath, `
=================================================
CACHE OPTIMIZATION ANALYSIS
=================================================
Date: ${new Date().toISOString()}

CACHE HIT RATES
=================================================
- Result Cache: ${(cacheHitRateData.resultCache.hitRate * 100).toFixed(2)}% (${cacheHitRateData.resultCache.hits} hits, ${cacheHitRateData.resultCache.misses} misses)
- Normalized String Cache: ${(cacheHitRateData.normalizedStringCache.hitRate * 100).toFixed(2)}% (${cacheHitRateData.normalizedStringCache.hits} hits, ${cacheHitRateData.normalizedStringCache.misses} misses)
- Levenshtein Cache: ${(cacheHitRateData.levenshteinCache.hitRate * 100).toFixed(2)}% (${cacheHitRateData.levenshteinCache.hits} hits, ${cacheHitRateData.levenshteinCache.misses} misses)
- RegExp Cache: ${(cacheHitRateData.regexCache.hitRate * 100).toFixed(2)}% (${cacheHitRateData.regexCache.hits} hits, ${cacheHitRateData.regexCache.misses} misses)

NEAR OPERATOR FUZZY SEARCH METRICS
=================================================
Before cache optimization:
- Total time: ${beforeMetrics.metrics.phaseMetrics.fuzzySearch.totalTime.toFixed(2)}ms
- Count: ${beforeMetrics.metrics.phaseMetrics.fuzzySearch.count}
- Average time: ${beforeMetrics.metrics.phaseMetrics.fuzzySearch.averageTime.toFixed(4)}ms
- Success count: ${beforeMetrics.metrics.phaseMetrics.fuzzySearch.successCount}
- Success rate: ${(beforeMetrics.metrics.phaseMetrics.fuzzySearch.successCount / beforeMetrics.metrics.phaseMetrics.fuzzySearch.count * 100).toFixed(2)}%

After cache optimization:
- Total time: ${afterMetrics.metrics.phaseMetrics.fuzzySearch.totalTime.toFixed(2)}ms
- Count: ${afterMetrics.metrics.phaseMetrics.fuzzySearch.count}
- Average time: ${afterMetrics.metrics.phaseMetrics.fuzzySearch.averageTime.toFixed(4)}ms
- Success count: ${afterMetrics.metrics.phaseMetrics.fuzzySearch.successCount}
- Success rate: ${(afterMetrics.metrics.phaseMetrics.fuzzySearch.successCount / afterMetrics.metrics.phaseMetrics.fuzzySearch.count * 100).toFixed(2)}%

Differences:
- Total time: ${timeDiff.toFixed(2)}ms (${timePercentage > 0 ? '+' : ''}${timePercentage.toFixed(2)}%)
- Average time: ${avgTimeDiff.toFixed(4)}ms (${avgTimePercentage > 0 ? '+' : ''}${avgTimePercentage.toFixed(2)}%)

CACHE SIZES
=================================================
- Result Cache: ${cacheHitRateData.resultCache.size} entries
- Normalized String Cache: ${cacheHitRateData.normalizedStringCache.size} entries
- Levenshtein Cache: ${cacheHitRateData.levenshteinCache.size} entries
- RegExp Cache: ${cacheHitRateData.regexCache.size} entries
- Frequent Terms Cache: ${cacheHitRateData.frequentTermsCache.size} entries
- Frequent Content Cache: ${cacheHitRateData.frequentContentCache.size} entries
- Search Pattern Cache: ${cacheHitRateData.searchPatternCache.size} entries

CONCLUSIONS
=================================================
${timePercentage <= 0 
  ? '✅ The cache optimization has improved overall fuzzy search performance.' 
  : '❌ The cache optimization has not improved overall fuzzy search performance.\n   This could be due to the overhead of cache management or other factors.'}

${cacheHitRateData.resultCache.hitRate > 0.5
  ? '✅ The result cache has a good hit rate, which should improve performance over time.'
  : '⚠️ The result cache hit rate is lower than expected. Further optimization may be needed.'}

${cacheHitRateData.normalizedStringCache.hitRate > 0.5
  ? '✅ The normalized string cache has a good hit rate, which should reduce string processing overhead.'
  : '⚠️ The normalized string cache hit rate is lower than expected. Further optimization may be needed.'}

RECOMMENDATIONS
=================================================
${timePercentage > 0
  ? '1. Consider simplifying the cache implementation to reduce overhead.\n2. Profile the cache operations to identify bottlenecks.\n3. Consider using a more efficient data structure for caching.'
  : '1. Continue to monitor cache hit rates in real-world usage.\n2. Consider pre-warming caches for frequently used terms and patterns.\n3. Implement more sophisticated cache eviction strategies based on usage patterns.'}
`);

console.log(`\nAnalysis saved to: ${analysisPath}`);
