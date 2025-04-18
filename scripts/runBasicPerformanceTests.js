/**
 * Basic performance tests that don't rely on Jest
 */

import { performance } from 'perf_hooks';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import os from 'os';

// Get __dirname equivalent in ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configuration
const RESULTS_DIR = path.join(__dirname, '../performance-results');

// Helper function to measure memory usage
function getMemoryUsage() {
  if (typeof process !== 'undefined' && process.memoryUsage) {
    const { heapUsed, heapTotal } = process.memoryUsage();
    return { heapUsed, heapTotal };
  }
  return { heapUsed: 0, heapTotal: 0 };
}

// Helper function to generate large content
function generateLargeContent(size) {
  const sampleText =
    'This is a sample text with some keywords like test, example, and performance. ';
  return sampleText.repeat(size);
}

// Helper function to save test results
async function saveTestResults(testName, results) {
  try {
    await fs.mkdir(RESULTS_DIR, { recursive: true });
    const filePath = path.join(RESULTS_DIR, `${testName}-${new Date().toISOString().replace(/:/g, '-')}.json`);
    await fs.writeFile(filePath, JSON.stringify(results, null, 2));
    console.log(`Results saved to ${filePath}`);
    return filePath;
  } catch (error) {
    console.error('Error saving test results:', error instanceof Error ? error.message : String(error));
    return null;
  }
}

// Simple implementation of string search for testing
function findStringMatches(content, term, caseSensitive = false) {
  const indices = [];
  let startIndex = 0;
  let index;
  
  if (caseSensitive) {
    while ((index = content.indexOf(term, startIndex)) !== -1) {
      indices.push(index);
      startIndex = index + 1;
    }
  } else {
    const lowerContent = content.toLowerCase();
    const lowerTerm = term.toLowerCase();
    
    while ((index = lowerContent.indexOf(lowerTerm, startIndex)) !== -1) {
      indices.push(index);
      startIndex = index + 1;
    }
  }
  
  return indices;
}

// Simple implementation of regex search for testing
function findRegexMatches(content, pattern) {
  const indices = [];
  
  // Ensure the regex has the global flag
  const regex = new RegExp(
    pattern.source,
    pattern.flags.includes('g') ? pattern.flags : pattern.flags + 'g'
  );
  
  let match;
  while ((match = regex.exec(content)) !== null) {
    indices.push(match.index);
    // Prevent infinite loops with zero-width matches
    if (match.index === regex.lastIndex) {
      regex.lastIndex++;
    }
  }
  
  return indices;
}

// Run string search performance test
async function runStringSearchTest() {
  console.log('\n=== String Search Performance Test ===');
  
  const testSizes = [1000, 5000, 10000];
  const results = [];
  
  for (const size of testSizes) {
    const content = generateLargeContent(size);
    const contentSizeMB = content.length / 1024 / 1024;
    
    // Measure memory before
    const memBefore = getMemoryUsage();
    
    // Measure execution time
    const startTime = performance.now();
    const matches = findStringMatches(content, 'test');
    const endTime = performance.now();
    
    // Measure memory after
    const memAfter = getMemoryUsage();
    
    // Calculate metrics
    const executionTime = endTime - startTime;
    const memoryUsed = (memAfter.heapUsed - memBefore.heapUsed) / 1024 / 1024;
    
    results.push({
      contentSize: `${contentSizeMB.toFixed(2)} MB`,
      executionTime: `${executionTime.toFixed(2)} ms`,
      memoryUsed: `${memoryUsed.toFixed(2)} MB`,
      matchesFound: matches.length
    });
    
    // Log results
    console.log(`String search (${contentSizeMB.toFixed(2)} MB): ${executionTime.toFixed(2)} ms, Memory: ${memoryUsed.toFixed(2)} MB, Matches: ${matches.length}`);
  }
  
  // Save results
  return await saveTestResults('string-search-performance', results);
}

// Run regex search performance test
async function runRegexSearchTest() {
  console.log('\n=== Regex Search Performance Test ===');
  
  const testSizes = [1000, 5000, 10000];
  const results = [];
  
  for (const size of testSizes) {
    const content = generateLargeContent(size);
    const contentSizeMB = content.length / 1024 / 1024;
    
    // Measure memory before
    const memBefore = getMemoryUsage();
    
    // Measure execution time
    const startTime = performance.now();
    const matches = findRegexMatches(content, /test|example/g);
    const endTime = performance.now();
    
    // Measure memory after
    const memAfter = getMemoryUsage();
    
    // Calculate metrics
    const executionTime = endTime - startTime;
    const memoryUsed = (memAfter.heapUsed - memBefore.heapUsed) / 1024 / 1024;
    
    results.push({
      contentSize: `${contentSizeMB.toFixed(2)} MB`,
      executionTime: `${executionTime.toFixed(2)} ms`,
      memoryUsed: `${memoryUsed.toFixed(2)} MB`,
      matchesFound: matches.length
    });
    
    // Log results
    console.log(`Regex search (${contentSizeMB.toFixed(2)} MB): ${executionTime.toFixed(2)} ms, Memory: ${memoryUsed.toFixed(2)} MB, Matches: ${matches.length}`);
  }
  
  // Save results
  return await saveTestResults('regex-search-performance', results);
}

// Run memory usage test
async function runMemoryUsageTest() {
  console.log('\n=== Memory Usage Test ===');
  
  // Generate very large content
  const content = generateLargeContent(25000);
  const contentSizeMB = content.length / 1024 / 1024;
  
  // Measure memory before
  const memBefore = getMemoryUsage();
  
  // Perform a memory-intensive operation
  const startTime = performance.now();
  
  // Split and join the content multiple times
  let processedContent = content;
  for (let i = 0; i < 5; i++) {
    const lines = processedContent.split('\n');
    processedContent = lines.join('\n');
  }
  
  const endTime = performance.now();
  
  // Measure memory after
  const memAfter = getMemoryUsage();
  
  // Calculate metrics
  const executionTime = endTime - startTime;
  const memoryUsed = (memAfter.heapUsed - memBefore.heapUsed) / 1024 / 1024;
  
  const results = {
    contentSize: `${contentSizeMB.toFixed(2)} MB`,
    executionTime: `${executionTime.toFixed(2)} ms`,
    memoryUsed: `${memoryUsed.toFixed(2)} MB`,
    memoryRatio: `${(memoryUsed / contentSizeMB).toFixed(2)}x content size`
  };
  
  // Log results
  console.log(`Memory test (${contentSizeMB.toFixed(2)} MB): ${executionTime.toFixed(2)} ms, Memory: ${memoryUsed.toFixed(2)} MB`);
  
  // Save results
  return await saveTestResults('memory-usage', results);
}

// Run system info test
async function saveSystemInfo() {
  console.log('\n=== System Information ===');
  
  const systemInfo = {
    platform: os.platform(),
    release: os.release(),
    cpus: os.cpus().map(cpu => ({
      model: cpu.model,
      speed: `${cpu.speed} MHz`
    })),
    totalMemory: `${(os.totalmem() / 1024 / 1024 / 1024).toFixed(2)} GB`,
    freeMemory: `${(os.freemem() / 1024 / 1024 / 1024).toFixed(2)} GB`,
    nodeVersion: process.version,
    timestamp: new Date().toISOString()
  };
  
  console.log(`Platform: ${systemInfo.platform} ${systemInfo.release}`);
  console.log(`CPU: ${systemInfo.cpus[0].model}`);
  console.log(`Memory: ${systemInfo.totalMemory}`);
  console.log(`Node.js: ${systemInfo.nodeVersion}`);
  
  // Save system information
  return await saveTestResults('system-info', systemInfo);
}

// Run all tests
async function runAllTests() {
  console.log('=== Running Performance Tests ===');
  console.log(`Started at: ${new Date().toISOString()}`);
  
  const startTime = performance.now();
  
  // Save system info
  const systemInfoFile = await saveSystemInfo();
  
  // Run tests
  const stringSearchFile = await runStringSearchTest();
  const regexSearchFile = await runRegexSearchTest();
  const memoryUsageFile = await runMemoryUsageTest();
  
  const endTime = performance.now();
  const totalTime = (endTime - startTime) / 1000; // in seconds
  
  console.log('\n=== Performance Tests Completed ===');
  console.log(`Total execution time: ${totalTime.toFixed(2)} seconds`);
  console.log('\nResults saved to:');
  console.log(`- System Info: ${systemInfoFile}`);
  console.log(`- String Search: ${stringSearchFile}`);
  console.log(`- Regex Search: ${regexSearchFile}`);
  console.log(`- Memory Usage: ${memoryUsageFile}`);
}

// Run the tests
runAllTests().catch(error => {
  console.error('Error running tests:', error);
  process.exit(1);
});
