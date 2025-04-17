# Whole Word Matching Tests

This document describes the tests for the whole word matching functionality in the File Content Aggregator application.

## Overview

Whole word matching allows users to search for terms that match only complete words, not substrings within words. For example, searching for "log" with whole word matching enabled will match "log" but not "catalog" or "logging".

## Unit Tests

The whole word matching unit tests verify that the application correctly applies whole word matching to search terms. These tests are implemented in `tests/unit/search/wholeWordMatching.test.ts`.

### Basic Functionality

These tests verify the core functionality of whole word matching:

- **Matching Whole Words Only**: Tests that when whole word matching is enabled, only complete words are matched, not substrings within words.
- **Case Sensitivity**: Tests that whole word matching respects the case sensitivity setting.
- **Special Characters and Punctuation**: Tests that whole word matching correctly handles words adjacent to punctuation marks.
- **Regex Patterns**: Tests that whole word matching is not applied to regex patterns (regex patterns should use `\b` word boundaries explicitly).

### Edge Cases

These tests verify that whole word matching handles various edge cases correctly:

- **Empty Content**: Tests that searching in empty content returns no matches.
- **Empty Search Term**: Tests that searching with an empty term returns no matches.
- **Words at Boundaries**: Tests that whole word matching correctly identifies words at the beginning and end of content.
- **Single-Character Words**: Tests that whole word matching works correctly with single-character words.

## Implementation Details

The whole word matching functionality is implemented in the `findTermIndices` function in `src/electron/fileSearchService.ts`. When whole word matching is enabled, the function uses a regular expression with word boundary markers (`\b`) to match only complete words.

The implementation:

1. Checks if whole word matching is enabled
2. If enabled, creates a regex with word boundary markers (`\b`) around the search term
3. Uses this regex to find all occurrences of the term as whole words
4. If not enabled, uses standard substring search

## Running the Tests

You can run the whole word matching tests using the following command:

```bash
npm test -- tests/unit/search/wholeWordMatching.test.ts
```

## Related Features

The whole word matching functionality is related to several other search features:

- **Simple Term Search**: Whole word matching applies to simple term searches.
- **Boolean Query Terms**: Whole word matching applies to terms within Boolean expressions.
- **NEAR Operator Terms**: Whole word matching applies to terms within the NEAR operator.
- **Regex Patterns**: Whole word matching does not apply to regex patterns. Use `\b` word boundaries in your regex pattern instead.

## User Interface

Users can enable or disable whole word matching in the Settings modal. The setting is off by default, meaning that by default, search terms will match substrings within words.

## Best Practices

When implementing or modifying the whole word matching functionality:

1. Ensure that word boundary detection works correctly with various punctuation marks and special characters.
2. Make sure the setting is properly persisted and loaded from the application's settings store.
3. Clearly document the behavior in the user interface to avoid confusion.
4. Consider the performance implications of using regex-based word boundary matching for very large files.
