# Regex Search Integration Tests

This document describes the integration tests for regex search functionality in the File Content Aggregator application.

## Overview

The regex search integration tests verify that regular expression patterns work correctly within the search pipeline, particularly in Boolean expressions and with the NEAR operator. These tests focus on the integration of regex pattern parsing, validation, and matching within the search process.

The tests are located in `tests/integration/search/regexSearch.test.ts`.

## Test Categories

The regex search integration tests are organized into three main categories:

1. **Regex in Boolean Query expressions** - Tests regex patterns with Boolean operators (AND, OR, NOT)
2. **Regex with NEAR operator** - Tests regex patterns within NEAR proximity searches
3. **Performance with complex regex patterns** - Tests the efficiency of complex regex pattern matching

## Test Implementation

Like other integration tests, these tests use Jest's mocking capabilities to simulate the search process without depending on the actual file system. The tests mock the `searchFiles` function to return predefined results based on the search parameters.

## Test Scenarios

### Regex in Boolean Query Expressions

These tests verify that regex patterns work correctly with Boolean operators:

- **Regex with AND operator** - Tests searching with regex patterns on both sides of an AND operator
- **Regex with OR operator** - Tests searching with regex patterns on both sides of an OR operator
- **Regex with NOT operator** - Tests searching with a negated regex pattern

### Regex with NEAR Operator

These tests verify that regex patterns work correctly within NEAR proximity searches:

- **NEAR with regex patterns** - Tests NEAR with regex patterns for both terms
- **NEAR with mixed term types** - Tests NEAR with a combination of regex patterns and plain text terms

### Performance with Complex Regex Patterns

These tests verify that complex regex patterns are handled efficiently:

- **Complex regex pattern performance** - Tests searching with a complex regex pattern that includes character classes, quantifiers, and lookahead/lookbehind assertions

## Running the Tests

To run the regex search integration tests:

```bash
# Run all integration tests
npm run test:integration

# Run only the regex search tests
npm test -- tests/integration/search/regexSearch.test.ts
```

## Test Coverage

The regex search integration tests cover the following aspects of the regex search functionality:

- Integration of regex patterns with Boolean operators
- Integration of regex patterns with the NEAR operator
- Performance considerations for complex regex patterns

These tests complement the unit tests for regex pattern validation and matching, providing end-to-end verification that regex functionality works correctly within the search pipeline.

## Related Tests

In addition to the regex search integration tests, there are other tests related to regex functionality:

- [Regex Pattern Validation Tests](./regex-validation-tests.md): Unit tests for validating regex patterns and handling invalid patterns
- [Regex Pattern Matching Tests](./regex-matching-tests.md): Unit tests for regex pattern matching with different regex features
