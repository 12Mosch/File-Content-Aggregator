# Performance Tests

This document describes the performance tests for the File Content Aggregator application.

## Overview

Performance testing is critical for ensuring that the application remains responsive and efficient, even when dealing with large files, complex search queries, or extensive result sets. The performance tests are designed to:

1. Identify performance bottlenecks
2. Establish performance baselines
3. Prevent performance regressions
4. Ensure the application meets performance requirements

## Test Categories

The performance tests are organized into two main categories:

1. **Unit Performance Tests** - Test the performance of individual functions and components
2. **Integration Performance Tests** - Test the performance of the end-to-end search process and UI

## Unit Performance Tests

Unit performance tests focus on the performance of individual functions and components, particularly those that are performance-critical or that handle large inputs.

### Search Performance Tests

Located in `tests/unit/search/searchPerformance.test.ts`, these tests verify that search operations perform efficiently with:

- Large content (multiple MB)
- Complex search queries
- Various search modes (term, regex, boolean expressions, NEAR operator)

#### Term Matching Performance

These tests verify that the `findTermIndices` function efficiently finds term occurrences in large content:

- Simple term search in large content
- Regex pattern matching in large content

#### Complex Query Performance

These tests verify that the `evaluateSearchExpression` function efficiently evaluates complex search expressions:

- Boolean expressions with many terms
- NEAR expressions with various distance values

#### Memory Usage

These tests verify that search operations maintain reasonable memory usage:

- Memory usage with very large content
- Memory usage with complex search expressions

## Integration Performance Tests

Integration performance tests focus on the performance of the end-to-end search process and UI, particularly with large result sets.

### End-to-End Performance Tests

Located in `tests/integration/search/endToEndPerformance.test.ts`, these tests verify that:

- The application remains responsive during large searches
- Progress is reported at regular intervals
- Cancellation is handled promptly
- The UI efficiently handles large result sets

#### Application Responsiveness

These tests verify that the application remains responsive during large searches:

- Progress reporting during large searches
- Cancellation handling during large searches

#### UI Performance with Large Result Sets

These tests verify that the UI efficiently handles large result sets:

- Handling very large result sets (100,000+ items)
- Efficient filtering and sorting of large result sets

## Running Performance Tests

Performance tests can be run using the following commands:

```bash
# Run all tests, including performance tests
npm test

# Run only unit performance tests
npm test -- tests/unit/search/searchPerformance.test.ts

# Run only integration performance tests
npm test -- tests/integration/search/endToEndPerformance.test.ts
```

## Performance Metrics

The performance tests measure and log the following metrics:

- **Execution Time** - Time taken to complete an operation
- **Memory Usage** - Memory consumed during an operation
- **Progress Updates** - Frequency and timing of progress updates
- **Result Processing Time** - Time taken to process and prepare results for display

## Performance Thresholds

The performance tests include thresholds for acceptable performance:

- Term search in 1MB content should complete in less than 1 second
- Regex search in 1MB content should complete in less than 2 seconds
- Boolean expression evaluation should complete in less than 3 seconds
- NEAR expression evaluation should complete in less than 3 seconds
- Memory usage should be less than 3x the content size
- UI processing of 100,000 results should complete in less than 5 seconds

These thresholds may need adjustment based on the actual performance characteristics of the application and the hardware it runs on.

## Performance Optimization Strategies

Based on the performance test results, the following optimization strategies may be applied:

1. **Algorithmic Improvements** - Use more efficient algorithms for search operations
2. **Caching** - Cache intermediate results to avoid redundant calculations
3. **Lazy Loading** - Load and process data only when needed
4. **Virtualization** - Use virtualized lists to efficiently render large result sets
5. **Web Workers** - Offload CPU-intensive operations to web workers
6. **Memory Management** - Optimize memory usage to reduce garbage collection overhead

## Related Tests

In addition to the dedicated performance tests, performance aspects are also tested in:

- [Search Pipeline Tests](./search-pipeline-tests.md) - Tests for the end-to-end search process
- [Highlighting Tests](./highlighting-tests.md) - Tests for term highlighting in search results
- [Fuzzy Search Tests](./fuzzy-search-tests.md) - Tests for fuzzy search functionality
- [Regex Search Tests](./regex-search-tests.md) - Tests for regex search functionality
- [NEAR Operator Tests](./near-operator-tests.md) - Tests for NEAR operator functionality
