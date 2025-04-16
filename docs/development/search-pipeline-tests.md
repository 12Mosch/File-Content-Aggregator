# Search Pipeline Integration Tests

This document describes the integration tests for the search pipeline in the File Content Aggregator application.

## Overview

The search pipeline integration tests verify that the entire search process works correctly from end to end. These tests focus on the `searchFiles` function in `fileSearchService.ts`, which orchestrates the entire search process.

The tests are located in `tests/integration/search/searchPipeline.test.ts`.

## Test Categories

The integration tests are organized into four main categories:

1. **End-to-end search process** - Tests the search functionality with different query types
2. **Search cancellation** - Tests the ability to cancel an ongoing search
3. **Progress reporting** - Tests that progress is reported correctly during the search
4. **Error handling** - Tests that errors are handled gracefully

## Test Implementation

The tests use Jest's mocking capabilities to mock the file system and other dependencies:

- `fs.promises.readFile` is mocked to return predefined content for test files
- `fs.promises.stat` is mocked to simulate file and directory structures
- `fast-glob` is mocked to return a predefined list of files
- `p-limit` is mocked to simplify concurrency handling

This approach allows the tests to run quickly and reliably without depending on the actual file system.

## Test Scenarios

### End-to-end Search Process

These tests verify that the search process works correctly with different types of queries:

- **Simple term query** - Tests searching for a simple term
- **Boolean query** - Tests searching with boolean expressions (AND, OR, NOT)
- **Regex query** - Tests searching with regular expressions
- **NEAR operator** - Tests searching with the NEAR proximity operator

### Search Cancellation

These tests verify that the search process can be cancelled at different stages:

- **Cancellation before file discovery** - Tests cancelling before any files are discovered
- **Cancellation during file processing** - Tests cancelling while files are being processed

### Progress Reporting

These tests verify that progress is reported correctly during the search:

- **Progress updates** - Tests that progress updates are sent during the search
- **File count accuracy** - Tests that the reported file counts are accurate

### Error Handling

These tests verify that errors are handled gracefully:

- **File read errors** - Tests handling of errors when reading files
- **Path errors** - Tests handling of errors when accessing paths
- **Invalid regex patterns** - Tests handling of invalid regex patterns

## Running the Tests

To run the search pipeline integration tests:

```bash
# Run all integration tests
npm run test:integration

# Run only the search pipeline tests
npm test -- tests/integration/search/searchPipeline.test.ts
```

## Test Coverage

The search pipeline integration tests cover the following aspects of the search functionality:

- File discovery and filtering
- Content searching with different query types
- Progress reporting
- Error handling
- Cancellation

These tests complement the unit tests for individual components of the search functionality, providing end-to-end verification that the components work together correctly.

## Related Tests

In addition to the main search pipeline tests, there are specialized integration tests for specific search features:

- [Fuzzy Search Integration Tests](./fuzzy-search-tests.md#integration-tests): Tests specifically focused on fuzzy search functionality within the search pipeline
