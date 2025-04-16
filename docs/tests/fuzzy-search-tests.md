# Fuzzy Search Tests

This document describes the testing approach for the fuzzy search functionality in the File Content Aggregator application.

## Overview

Fuzzy search allows users to find content even when there are slight variations or misspellings in the search terms. The application uses the Fuse.js library to implement fuzzy search capabilities in various search contexts.

## Configuration Tests

The fuzzy search configuration tests verify that the application correctly applies user settings for fuzzy search functionality. These tests are implemented in `tests/unit/search/fuzzySearchConfig.test.ts`.

### Test Categories

#### Fuzzy Search Settings

These tests verify that the application correctly enables or disables fuzzy search based on user settings:

- **Boolean Query Mode**: Tests that fuzzy search can be enabled/disabled for Boolean queries
- **NEAR Function**: Tests that fuzzy search can be enabled/disabled for the NEAR operator

#### Threshold Settings

These tests verify that the application correctly applies threshold settings for fuzzy matching:

- **Threshold Application**: Tests that the configured threshold (0.4) is correctly applied to Fuse.js
- **Match Acceptance**: Tests that matches with scores below the acceptance threshold (0.6) are accepted
- **Match Rejection**: Tests that matches with scores above the acceptance threshold are rejected

#### Minimum Character Length

These tests verify that fuzzy search is only applied to terms of sufficient length:

- **Short Terms**: Tests that fuzzy search is not applied to terms shorter than 3 characters
- **Sufficient Length**: Tests that fuzzy search is applied to terms with 3 or more characters

#### Case Sensitivity

These tests verify that the case sensitivity setting is correctly applied to fuzzy search:

- **Case-Sensitive Search**: Tests that case is respected when case sensitivity is enabled
- **Case-Insensitive Search**: Tests that case is ignored when case sensitivity is disabled

## Implementation Details

### Mocking Strategy

The tests use Jest's mocking capabilities to:

1. Mock the Fuse.js library to verify it's called with the correct parameters
2. Mock the search results to test different score scenarios
3. Mock console.log/error to prevent test output clutter

### Test Setup

Each test:

1. Sets up the fuzzy search configuration using `updateFuzzySearchSettings`
2. Creates a test environment with appropriate content and search terms
3. Executes the search functionality
4. Verifies that Fuse.js is called with the expected parameters or that the search results are as expected

## Running the Tests

To run the fuzzy search configuration tests:

```bash
npm run test -- tests/unit/search/fuzzySearchConfig.test.ts
```

To run all fuzzy search related tests:

```bash
npm run test -- tests/unit/search
```

## Fuzzy Search Matching Tests

The fuzzy search matching tests verify that the application correctly identifies matches with various types of term variations and misspellings. These tests are implemented in `tests/unit/search/fuzzySearchMatching.test.ts`.

### Test Categories

#### Slight Misspellings

These tests verify that the fuzzy search correctly matches terms with slight misspellings:

- **Basic Misspellings**: Tests matching terms with common misspellings (e.g., "exmaple" for "example")
- **Word Boundary Misspellings**: Tests matching terms with misspellings at the beginning or end of words

#### Character Transpositions

These tests verify that the fuzzy search correctly matches terms with transposed characters:

- **Single Transposition**: Tests matching terms with a single pair of transposed characters (e.g., "funciton" for "function")
- **Multiple Transpositions**: Tests matching terms with multiple transposed characters

#### Missing Characters

These tests verify that the fuzzy search correctly matches terms with missing characters:

- **Single Missing Character**: Tests matching terms with a single missing character (e.g., "calcuate" for "calculate")
- **Multiple Missing Characters**: Tests matching terms with multiple missing characters if similarity is high enough

#### Extra Characters

These tests verify that the fuzzy search correctly matches terms with extra characters:

- **Single Extra Character**: Tests matching terms with a single extra character (e.g., "calculatee" for "calculate")
- **Multiple Extra Characters**: Tests matching terms with multiple extra characters if similarity is high enough

#### Term Length Handling

These tests verify that the fuzzy search correctly handles terms of different lengths:

- **Very Short Terms**: Tests that fuzzy search is not applied to terms shorter than 3 characters
- **Minimum Length Terms**: Tests that fuzzy search is applied to terms with exactly 3 characters
- **Very Long Terms**: Tests that fuzzy search works correctly with very long terms

#### Integration with Fuse.js

These tests verify that the application's fuzzy search implementation works correctly with the Fuse.js library:

- **Fuse.js Integration**: Tests that both Fuse.js and the application's custom fuzzy matching function find the same matches

### Implementation Details

The tests use Jest's mocking capabilities to expose the internal `findApproximateMatchIndices` function, which is used to locate the positions of fuzzy-matched terms in the content.

### Running the Tests

To run the fuzzy search matching tests:

```bash
npm run test -- tests/unit/search/fuzzySearchMatching.test.ts
```

## Integration Tests

The fuzzy search integration tests verify that fuzzy search works correctly within the complete search pipeline. These tests are implemented in `tests/integration/search/fuzzySearch.test.ts`.

### Test Categories

#### Fuzzy Search in Content Query Mode

These tests verify that fuzzy search works correctly in Content Query mode:

- **Slight Misspellings**: Tests that the search pipeline finds matches for terms with slight misspellings (e.g., "tst" for "test")
- **Extra Characters**: Tests that the search pipeline finds matches for terms with extra characters (e.g., "tesst" for "test")
- **Disabled Fuzzy Search**: Tests that fuzzy matches are not found when fuzzy search is disabled

#### Fuzzy Search in Boolean Query Mode

These tests verify that fuzzy search works correctly in Boolean Query mode:

- **Boolean Expressions with Misspelled Terms**: Tests that the search pipeline correctly evaluates Boolean expressions containing misspelled terms

#### Fuzzy Search in NEAR Operator

These tests verify that fuzzy search works correctly with the NEAR operator:

- **NEAR Expressions with Misspelled Terms**: Tests that the search pipeline correctly evaluates NEAR expressions containing misspelled terms

#### Multiple Terms and Performance

These tests verify additional aspects of fuzzy search:

- **Multiple Misspelled Terms**: Tests that the search pipeline correctly handles multiple misspelled terms in a single query
- **Performance Comparison**: Tests that measure the performance impact of enabling fuzzy search

### Implementation Details

The integration tests use a mock implementation of the `searchFiles` function to simulate the behavior of the search pipeline with fuzzy search. The mock implementation:

1. Returns predefined search results
2. Simulates fuzzy matching for misspelled terms
3. Tracks whether fuzzy matching was used for each match
4. Simulates different behavior based on the search mode and fuzzy search settings

### Running the Tests

To run the fuzzy search integration tests:

```bash
npm run test -- tests/integration/search/fuzzySearch.test.ts
```

## Related Tests

The fuzzy search tests are divided into multiple categories that cover different aspects of fuzzy search functionality:

- **Fuzzy Search Configuration**: Tests for settings and configuration aspects (implemented in `tests/unit/search/fuzzySearchConfig.test.ts`)
- **Fuzzy Search Matching**: Tests for the actual matching behavior with various types of term variations (implemented in `tests/unit/search/fuzzySearchMatching.test.ts`)
- **Fuzzy Search in Search Pipeline**: Integration tests for fuzzy search in the complete search process (implemented in `tests/integration/search/fuzzySearch.test.ts`)
- **Highlighting with Fuzzy Matches**: Tests for highlighting terms found via fuzzy search (implemented in `tests/unit/ui/highlightHtmlUtils.fuzzy.test.ts` and `tests/unit/ui/HighlightMatches.test.tsx`)
