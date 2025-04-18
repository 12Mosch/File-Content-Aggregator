# Performance Testing Suite

This directory contains performance tests for the File Content Aggregator application. These tests are designed to measure the performance of various components and operations, establish baseline metrics, and detect potential performance issues.

## Available Tests

### 1. Search Performance Tests (`searchPerformance.test.ts`)

Tests the performance of search operations with different content sizes and query types:

- Simple term search
- Boolean query evaluation
- NEAR operator evaluation
- Fuzzy search

### 2. UI Performance Tests (`uiPerformance.test.ts`)

Tests the rendering performance of UI components:

- Initial render time with different result set sizes
- Interaction performance (filtering, expanding items)

### 3. Memory Leak Detection Tests (`memoryLeakDetection.test.ts`)

Tests for potential memory leaks:

- Memory usage in repeated search operations
- Memory usage in word boundary cache

## Running the Tests

You can run all performance tests using the following npm script:

```bash
npm run test:performance
```

This will run all tests and generate a comprehensive report in the `performance-results` directory.

To run individual tests:

```bash
# Run search performance tests
npx jest tests/performance/searchPerformance.test.ts --runInBand --detectOpenHandles

# Run UI performance tests
npx jest tests/performance/uiPerformance.test.ts --runInBand

# Run memory leak detection tests
npx jest tests/performance/memoryLeakDetection.test.ts --runInBand --detectOpenHandles
```

## Analyzing Results

The test results are saved as JSON files in the `performance-results` directory. You can use the following scripts to analyze the results:

### Compare Performance Before/After Refactoring

```bash
npm run test:compare performance-results/before-file.json performance-results/after-file.json
```

### Analyze Code Complexity

```bash
npm run test:complexity
```

## Success Metrics

The refactoring plan defines the following success metrics:

1. **Performance Improvements:**

   - 50% reduction in search time for large file sets
   - 30% reduction in memory usage
   - Smoother UI experience with no blocking operations

2. **Code Quality:**
   - Improved test coverage
   - Reduced complexity metrics
   - Better separation of concerns

Use the comparison script to evaluate whether these metrics have been achieved after implementing the refactoring plan.

## Notes for Running Tests

- For memory leak detection tests, run with the `--expose-gc` flag to enable garbage collection:

  ```bash
  NODE_OPTIONS=--expose-gc npx jest tests/performance/memoryLeakDetection.test.ts
  ```

- For UI tests, ensure that the DOM environment is properly configured in your Jest setup.

- Performance can vary based on system load. For consistent results, close other applications and run tests multiple times to get an average.
