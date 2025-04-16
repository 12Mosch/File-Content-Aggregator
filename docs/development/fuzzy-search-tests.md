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

## Related Tests

The fuzzy search configuration tests focus on the settings and configuration aspects of fuzzy search. Other aspects of fuzzy search are covered in:

- **Fuzzy Search Matching**: Tests for the actual matching behavior with various types of term variations
- **Fuzzy Search in Search Pipeline**: Integration tests for fuzzy search in the complete search process
- **Highlighting with Fuzzy Matches**: Tests for highlighting terms found via fuzzy search
