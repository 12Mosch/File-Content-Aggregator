/**
 * Script to run all performance tests and generate a comprehensive report
 * 
 * Usage: node scripts/runPerformanceTests.js
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

// Configuration
const RESULTS_DIR = path.join(__dirname, '../performance-results');
const REPORT_FILE = path.join(RESULTS_DIR, `performance-report-${new Date().toISOString().replace(/:/g, '-')}.md`);

// Ensure results directory exists
if (!fs.existsSync(RESULTS_DIR)) {
  fs.mkdirSync(RESULTS_DIR, { recursive: true });
}

// Record start time
const startTime = new Date();

console.log('='.repeat(80));
console.log('RUNNING PERFORMANCE TESTS');
console.log('='.repeat(80));
console.log(`Started at: ${startTime.toISOString()}`);
console.log('');

// Run tests
try {
  // Run search performance tests
  console.log('Running search performance tests...');
  execSync('npx jest tests/performance/searchPerformance.test.ts --runInBand --detectOpenHandles', { 
    stdio: 'inherit',
    env: { ...process.env, NODE_OPTIONS: '--expose-gc' }
  });
  
  // Run UI performance tests
  console.log('\nRunning UI performance tests...');
  execSync('npx jest tests/performance/uiPerformance.test.ts --runInBand', { 
    stdio: 'inherit' 
  });
  
  // Run memory leak detection tests
  console.log('\nRunning memory leak detection tests...');
  execSync('npx jest tests/performance/memoryLeakDetection.test.ts --runInBand --detectOpenHandles', { 
    stdio: 'inherit',
    env: { ...process.env, NODE_OPTIONS: '--expose-gc' }
  });
  
  // Run code complexity analysis
  console.log('\nAnalyzing code complexity...');
  execSync('node scripts/analyzeCodeComplexity.js src', { 
    stdio: 'inherit' 
  });
  
  // Record end time
  const endTime = new Date();
  const duration = (endTime - startTime) / 1000; // in seconds
  
  console.log('\n' + '='.repeat(80));
  console.log(`All tests completed in ${duration.toFixed(2)} seconds`);
  console.log('='.repeat(80));
  
  // Generate report
  generateReport(startTime, endTime, duration);
  
  console.log(`\nPerformance report generated: ${REPORT_FILE}`);
} catch (error) {
  console.error('Error running performance tests:', error);
  process.exit(1);
}

/**
 * Generate a comprehensive performance report
 */
function generateReport(startTime, endTime, duration) {
  // Get all result files
  const resultFiles = fs.readdirSync(RESULTS_DIR)
    .filter(file => file.endsWith('.json'))
    .map(file => path.join(RESULTS_DIR, file));
  
  // Get the most recent files of each type
  const latestResults = {};
  
  for (const file of resultFiles) {
    const baseName = path.basename(file).split('-').slice(0, -1).join('-');
    const stats = fs.statSync(file);
    
    if (!latestResults[baseName] || stats.mtime > latestResults[baseName].mtime) {
      latestResults[baseName] = {
        file,
        mtime: stats.mtime
      };
    }
  }
  
  // Generate report content
  let report = `# Performance Test Report\n\n`;
  report += `Generated: ${new Date().toISOString()}\n\n`;
  report += `## System Information\n\n`;
  
  // Add system info
  const systemInfo = getSystemInfo();
  report += `- **Platform**: ${systemInfo.platform} ${systemInfo.release}\n`;
  report += `- **CPU**: ${systemInfo.cpu}\n`;
  report += `- **Memory**: ${systemInfo.memory}\n`;
  report += `- **Node.js**: ${systemInfo.nodeVersion}\n\n`;
  
  report += `## Test Summary\n\n`;
  report += `- **Start Time**: ${startTime.toISOString()}\n`;
  report += `- **End Time**: ${endTime.toISOString()}\n`;
  report += `- **Duration**: ${duration.toFixed(2)} seconds\n\n`;
  
  // Add results for each test type
  for (const [testType, { file }] of Object.entries(latestResults)) {
    try {
      const data = JSON.parse(fs.readFileSync(file, 'utf8'));
      
      report += `## ${formatTestName(testType)}\n\n`;
      report += `Source: [${path.basename(file)}](${path.basename(file)})\n\n`;
      
      // Format based on test type
      if (testType.includes('search-performance')) {
        report += formatSearchPerformanceResults(data);
      } else if (testType.includes('ui-performance')) {
        report += formatUIPerformanceResults(data);
      } else if (testType.includes('memory-leak')) {
        report += formatMemoryLeakResults(data);
      } else if (testType.includes('complexity')) {
        report += formatComplexityResults(data);
      } else {
        // Generic formatting for other result types
        report += '```json\n';
        report += JSON.stringify(data, null, 2);
        report += '\n```\n\n';
      }
    } catch (error) {
      report += `Error processing results: ${error.message}\n\n`;
    }
  }
  
  report += `## Conclusion\n\n`;
  report += `This report provides baseline performance metrics for the application. `;
  report += `After implementing the refactoring plan, run these tests again and compare the results `;
  report += `to measure improvements in performance and code quality.\n\n`;
  report += `Use the \`comparePerformance.js\` script to compare before/after results:\n\n`;
  report += `\`\`\`bash\n`;
  report += `node scripts/comparePerformance.js <before-file> <after-file>\n`;
  report += `\`\`\`\n`;
  
  // Write report to file
  fs.writeFileSync(REPORT_FILE, report);
}

/**
 * Format search performance results for the report
 */
function formatSearchPerformanceResults(data) {
  let output = '';
  
  if (Array.isArray(data)) {
    output += '### Performance Metrics\n\n';
    output += '| Content Size | Execution Time | Memory Used | Result |\n';
    output += '|--------------|----------------|-------------|--------|\n';
    
    for (const result of data) {
      output += `| ${result.contentSize} | ${result.executionTime} | ${result.memoryUsed} | ${result.result} |\n`;
    }
    
    output += '\n';
  }
  
  return output;
}

/**
 * Format UI performance results for the report
 */
function formatUIPerformanceResults(data) {
  let output = '';
  
  if (Array.isArray(data)) {
    output += '### UI Rendering Metrics\n\n';
    output += '| Item Count | Render Time |\n';
    output += '|------------|-------------|\n';
    
    for (const result of data) {
      output += `| ${result.itemCount} | ${result.renderTime} |\n`;
    }
    
    output += '\n';
  }
  
  return output;
}

/**
 * Format memory leak detection results for the report
 */
function formatMemoryLeakResults(data) {
  let output = '';
  
  if (data && data.summary) {
    output += '### Memory Usage Summary\n\n';
    output += `- **Initial Memory**: ${data.summary.initialMemory}\n`;
    output += `- **Final Memory**: ${data.summary.finalMemory}\n`;
    output += `- **Total Memory Change**: ${data.summary.totalMemoryChange}\n`;
    output += `- **Iterations**: ${data.summary.iterations}\n\n`;
    
    if (data.iterations && data.iterations.length > 0) {
      output += '### Memory Change Trend\n\n';
      output += '```\n';
      
      // Create a simple ASCII chart of memory usage
      const memoryValues = data.iterations.map(item => parseFloat(item.memoryChange));
      const maxValue = Math.max(...memoryValues);
      const minValue = Math.min(...memoryValues);
      const range = maxValue - minValue;
      const chartHeight = 10;
      
      for (let i = 0; i < data.iterations.length; i++) {
        const value = parseFloat(data.iterations[i].memoryChange);
        const normalizedValue = range === 0 ? 0 : ((value - minValue) / range) * chartHeight;
        const barLength = Math.round(normalizedValue);
        
        output += `Iteration ${String(i + 1).padStart(2, ' ')}: ${'█'.repeat(barLength)} ${value.toFixed(2)} MB\n`;
      }
      
      output += '```\n\n';
    }
  }
  
  return output;
}

/**
 * Format code complexity results for the report
 */
function formatComplexityResults(data) {
  let output = '';
  
  if (data && data.summary) {
    output += '### Code Complexity Summary\n\n';
    output += `- **Total Files**: ${data.summary.totalFiles}\n`;
    output += `- **Total Functions**: ${data.summary.totalFunctions}\n`;
    output += `- **Average Complexity**: ${data.summary.averageComplexity}\n`;
    output += `- **High Complexity Functions**: ${data.summary.highComplexityFunctions}\n\n`;
    
    if (data.files && data.files.length > 0) {
      output += '### Most Complex Files\n\n';
      output += '| File | Average Complexity | Functions |\n';
      output += '|------|-------------------|----------|\n';
      
      // Show top 5 most complex files
      const topFiles = data.files.slice(0, 5);
      for (const file of topFiles) {
        output += `| ${file.path} | ${file.averageComplexity} | ${file.totalFunctions} |\n`;
      }
      
      output += '\n';
      
      // Show most complex functions
      output += '### Most Complex Functions\n\n';
      output += '| Function | File | Complexity | Line |\n';
      output += '|----------|------|------------|------|\n';
      
      // Get top 10 most complex functions across all files
      const allFunctions = [];
      for (const file of data.files) {
        for (const fn of file.functions) {
          allFunctions.push({
            name: fn.name,
            file: file.path,
            complexity: fn.complexity,
            line: fn.line
          });
        }
      }
      
      // Sort by complexity (highest first)
      allFunctions.sort((a, b) => b.complexity - a.complexity);
      
      // Show top 10
      const topFunctions = allFunctions.slice(0, 10);
      for (const fn of topFunctions) {
        output += `| ${fn.name} | ${fn.file} | ${fn.complexity} | ${fn.line} |\n`;
      }
      
      output += '\n';
    }
  }
  
  return output;
}

/**
 * Format test name for display
 */
function formatTestName(testName) {
  return testName
    .split('-')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

/**
 * Get system information
 */
function getSystemInfo() {
  const cpus = os.cpus();
  const cpu = cpus.length > 0 ? cpus[0].model : 'Unknown';
  
  return {
    platform: os.platform(),
    release: os.release(),
    cpu: cpu,
    memory: `${Math.round(os.totalmem() / (1024 * 1024 * 1024))} GB`,
    nodeVersion: process.version
  };
}
