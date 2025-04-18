/**
 * Test script for comparing cache hit rates before and after enhancements
 */

import { OptimizedFuzzySearchService } from "../dist-electron/electron/services/OptimizedFuzzySearchService.js";
import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";

// Get the current directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Test cases with varying complexity
const testCases = [
  {
    name: "Repeated searches - same content and term",
    content: "This is a test string that will be searched multiple times.",
    term: "test",
    options: { isCaseSensitive: false },
    repeat: 10
  },
  {
    name: "Repeated searches - same content, different terms",
    content: "This string contains multiple words that will be searched.",
    terms: ["string", "contains", "multiple", "words", "searched"],
    options: { isCaseSensitive: false },
    repeat: 3
  },
  {
    name: "Multiple case-insensitive searches",
    content: "This STRING contains MIXED case words that will BE searched.",
    terms: ["string", "MIXED", "Be", "SEARCHED"],
    options: { isCaseSensitive: false },
    repeat: 3
  },
  {
    name: "Whole word matching - repeated",
    content: "This is a test string with some testing words.",
    term: "test",
    options: { isCaseSensitive: false, useWholeWordMatching: true },
    repeat: 5
  },
  {
    name: "Long content - repeated searches",
    content: fs.readFileSync(path.join(__dirname, "../src/electron/services/NearOperatorService.ts"), "utf8"),
    terms: ["fuzzy", "search", "performance", "optimization", "cache"],
    options: { isCaseSensitive: false },
    repeat: 2
  },
  {
    name: "Similar terms - different casing",
    content: "This is a test string with some testing words.",
    terms: ["test", "Test", "TEST", "tEsT", "teST"],
    options: { isCaseSensitive: false },
    repeat: 2
  },
  {
    name: "Similar content - different terms",
    contents: [
      "This is a test string that will be searched.",
      "This is a test string that will be analyzed.",
      "This is a test string that will be processed.",
      "This is a test string that will be examined.",
      "This is a test string that will be inspected."
    ],
    term: "test",
    options: { isCaseSensitive: false },
    repeat: 2
  },
  {
    name: "Regex pattern caching",
    content: "This is a test string with some testing words.",
    terms: ["\\btest\\b", "\\bstring\\b", "\\bwords\\b", "\\bsome\\b", "\\btesting\\b"],
    options: { isCaseSensitive: false, useWholeWordMatching: true },
    repeat: 3
  },
  {
    name: "Levenshtein distance caching",
    content: "This is a test string with some testing words.",
    terms: ["test", "tset", "tets", "ttes", "ttse"],
    options: { isCaseSensitive: false },
    repeat: 2
  },
  {
    name: "String normalization caching",
    content: "This STRING contains MIXED case words that will BE searched.",
    terms: ["string", "mixed", "case", "words", "be", "searched"],
    options: { isCaseSensitive: false },
    repeat: 3
  }
];

// Run the test cases
async function runTests() {
  console.log("Starting cache hit rate tests...");
  console.log("=================================================");
  
  // Create service instance
  const service = new OptimizedFuzzySearchService();
  
  // Process each test case
  for (const testCase of testCases) {
    console.log(`\nTest case: ${testCase.name}`);
    
    // Clear caches before each test case
    service.clearCaches();
    
    if (testCase.terms && !testCase.contents) {
      // Multiple terms test case
      console.log(`Terms: ${JSON.stringify(testCase.terms)}`);
      console.log(`Content length: ${testCase.content.length} characters`);
      console.log(`Options: ${JSON.stringify(testCase.options)}`);
      console.log(`Repeat: ${testCase.repeat || 1} times`);
      
      // Run the test multiple times to measure cache hit rates
      for (let r = 0; r < (testCase.repeat || 1); r++) {
        for (const term of testCase.terms) {
          service.search(
            testCase.content,
            term,
            testCase.options
          );
        }
      }
    } else if (testCase.contents && !testCase.terms) {
      // Multiple contents test case
      console.log(`Term: "${testCase.term}"`);
      console.log(`Number of content variations: ${testCase.contents.length}`);
      console.log(`Options: ${JSON.stringify(testCase.options)}`);
      console.log(`Repeat: ${testCase.repeat || 1} times`);
      
      // Run the test multiple times to measure cache hit rates
      for (let r = 0; r < (testCase.repeat || 1); r++) {
        for (const content of testCase.contents) {
          service.search(
            content,
            testCase.term,
            testCase.options
          );
        }
      }
    } else if (testCase.repeat) {
      // Repeated search test case
      console.log(`Term: "${testCase.term}" (repeated ${testCase.repeat} times)`);
      console.log(`Content length: ${testCase.content.length} characters`);
      console.log(`Options: ${JSON.stringify(testCase.options)}`);
      
      // Run the test multiple times to measure cache hit rates
      for (let i = 0; i < testCase.repeat; i++) {
        service.search(
          testCase.content,
          testCase.term,
          testCase.options
        );
      }
    }
    
    // Get cache statistics
    const cacheStats = service.getCacheStats();
    
    // Print cache statistics
    console.log("\nCache Statistics:");
    console.log(`- Result Cache: ${cacheStats.resultCache.hits} hits, ${cacheStats.resultCache.misses} misses, ${(cacheStats.resultCache.hitRate * 100).toFixed(2)}% hit rate`);
    console.log(`- Normalized String Cache: ${cacheStats.normalizedStringCache.hits} hits, ${cacheStats.normalizedStringCache.misses} misses, ${(cacheStats.normalizedStringCache.hitRate * 100).toFixed(2)}% hit rate`);
    console.log(`- Levenshtein Cache: ${cacheStats.levenshteinCache.hits} hits, ${cacheStats.levenshteinCache.misses} misses, ${(cacheStats.levenshteinCache.hitRate * 100).toFixed(2)}% hit rate`);
    console.log(`- RegExp Cache: ${cacheStats.regexCache.hits} hits, ${cacheStats.regexCache.misses} misses, ${(cacheStats.regexCache.hitRate * 100).toFixed(2)}% hit rate`);
  }
  
  // Run a comprehensive test with all test cases combined
  console.log("\n=================================================");
  console.log("Comprehensive Test (All Test Cases Combined)");
  console.log("=================================================");
  
  // Clear caches before the comprehensive test
  service.clearCaches();
  
  // Run all test cases in sequence
  for (const testCase of testCases) {
    if (testCase.terms && !testCase.contents) {
      // Multiple terms test case
      for (let r = 0; r < (testCase.repeat || 1); r++) {
        for (const term of testCase.terms) {
          service.search(
            testCase.content,
            term,
            testCase.options
          );
        }
      }
    } else if (testCase.contents && !testCase.terms) {
      // Multiple contents test case
      for (let r = 0; r < (testCase.repeat || 1); r++) {
        for (const content of testCase.contents) {
          service.search(
            content,
            testCase.term,
            testCase.options
          );
        }
      }
    } else if (testCase.repeat) {
      // Repeated search test case
      for (let i = 0; i < testCase.repeat; i++) {
        service.search(
          testCase.content,
          testCase.term,
          testCase.options
        );
      }
    }
  }
  
  // Get cache statistics for the comprehensive test
  const comprehensiveCacheStats = service.getCacheStats();
  
  // Print cache statistics for the comprehensive test
  console.log("\nComprehensive Cache Statistics:");
  console.log(`- Result Cache: ${comprehensiveCacheStats.resultCache.hits} hits, ${comprehensiveCacheStats.resultCache.misses} misses, ${(comprehensiveCacheStats.resultCache.hitRate * 100).toFixed(2)}% hit rate`);
  console.log(`- Normalized String Cache: ${comprehensiveCacheStats.normalizedStringCache.hits} hits, ${comprehensiveCacheStats.normalizedStringCache.misses} misses, ${(comprehensiveCacheStats.normalizedStringCache.hitRate * 100).toFixed(2)}% hit rate`);
  console.log(`- Levenshtein Cache: ${comprehensiveCacheStats.levenshteinCache.hits} hits, ${comprehensiveCacheStats.levenshteinCache.misses} misses, ${(comprehensiveCacheStats.levenshteinCache.hitRate * 100).toFixed(2)}% hit rate`);
  console.log(`- RegExp Cache: ${comprehensiveCacheStats.regexCache.hits} hits, ${comprehensiveCacheStats.regexCache.misses} misses, ${(comprehensiveCacheStats.regexCache.hitRate * 100).toFixed(2)}% hit rate`);
  
  // Print cache sizes
  console.log("\nCache Sizes:");
  console.log(`- Result Cache: ${comprehensiveCacheStats.resultCache.size} entries`);
  console.log(`- Normalized String Cache: ${comprehensiveCacheStats.normalizedStringCache.size} entries`);
  console.log(`- Levenshtein Cache: ${comprehensiveCacheStats.levenshteinCache.size} entries`);
  console.log(`- RegExp Cache: ${comprehensiveCacheStats.regexCache.size} entries`);
  console.log(`- Frequent Terms Cache: ${comprehensiveCacheStats.frequentTermsCache.size} entries`);
  console.log(`- Frequent Content Cache: ${comprehensiveCacheStats.frequentContentCache.size} entries`);
  console.log(`- Search Pattern Cache: ${comprehensiveCacheStats.searchPatternCache.size} entries`);
  
  // Save results to file
  const timestamp = new Date().toISOString().replace(/:/g, "-");
  const resultsPath = path.join(__dirname, "../performance-results", `cache-hit-rates-${timestamp}.json`);
  
  // Ensure directory exists
  if (!fs.existsSync(path.dirname(resultsPath))) {
    fs.mkdirSync(path.dirname(resultsPath), { recursive: true });
  }
  
  // Save the results
  fs.writeFileSync(resultsPath, JSON.stringify(comprehensiveCacheStats, null, 2));
  console.log(`\nResults saved to: ${resultsPath}`);
}

// Run the tests
runTests().catch(error => {
  console.error("Error running tests:", error);
  process.exit(1);
});
