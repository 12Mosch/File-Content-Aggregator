# Highlighting Tests

This document describes the tests for the highlighting functionality in the File Content Aggregator application.

## Overview

The highlighting functionality is responsible for highlighting search terms in both HTML and plain text content. This is a critical feature that helps users quickly identify relevant parts of matched files.

## Test Structure

The highlighting tests are organized into the following categories:

### HTML Highlighting Tests

These tests verify that the `highlightTermsInHtml` function correctly highlights search terms within HTML content that has already been syntax-highlighted.

#### Basic Tests (`tests/unit/ui/highlightHtmlUtils.test.ts`)

- Tests for basic functionality like handling empty input, case sensitivity, and regex terms
- Tests for handling HTML entities and nested HTML structure
- Tests for error handling with invalid regex patterns and malformed HTML

#### Boundary Tests (`tests/unit/ui/highlightHtmlUtils.boundary.test.ts`)

- Tests for edge cases like empty search terms and very long search terms
- Tests for special characters in search terms
- Tests for quoted term extraction and different case combinations

#### Performance Tests (`tests/unit/ui/highlightHtmlUtils.performance.test.ts`)

- Tests for handling large HTML documents
- Tests for handling many search terms
- Stress tests for very large HTML with many terms (skipped by default)

#### Fuzzy Search and NEAR Operator Tests (`tests/unit/ui/highlightHtmlUtils.fuzzy.test.ts`)

- Tests for highlighting terms found via fuzzy search with:
  - Slight misspellings
  - Character transpositions
  - Missing characters
  - Extra characters
- Tests for highlighting terms found via NEAR operator with:
  - Different proximity
  - Different order
  - Terms spanning multiple lines
- Tests for highlighting with Unicode characters:
  - Japanese, Arabic, and other non-Latin scripts
  - Mixed Latin and Unicode characters
  - Emoji characters

### Plain Text Highlighting Tests

These tests verify that the `HighlightMatches` React component correctly highlights search terms in plain text content.

#### Component Tests (`tests/unit/ui/HighlightMatches.test.tsx`)

- Tests for basic functionality like handling empty input and null text
- Tests for highlighting exact matches with case sensitivity
- Tests for handling regex terms
- Tests for fuzzy search highlighting with:
  - Slight misspellings
  - Character transpositions
  - Missing characters
  - Extra characters
- Tests for NEAR operator highlighting with:
  - Different proximity
  - Different order
  - Terms spanning multiple lines
- Tests for Unicode character highlighting:
  - Japanese, Arabic, and other non-Latin scripts
  - Mixed Latin and Unicode characters
  - Emoji characters

## Integration Tests

Integration tests for highlighting are located in `tests/integration/search/highlighting.test.ts` and `tests/integration/ui/uiIntegration.test.ts`. These tests verify that the highlighting functionality works correctly in the context of the search pipeline and UI components.

### Search Highlighting Integration Tests (`tests/integration/search/highlighting.test.ts`)

- Tests for handling complex HTML with multiple term types
- Tests for handling mixed case sensitivity settings
- Tests for handling HTML with nested elements and multiple matches
- Tests for highlighting fuzzy matches in search results:
  - Handling misspelled terms
  - Matching with flexible patterns
  - Ensuring correct terms are highlighted
- Tests for highlighting NEAR operator matches in search results:
  - Highlighting terms that appear near each other
  - Handling terms in different contexts
  - Verifying both terms in NEAR expressions are highlighted

### UI Integration Tests (`tests/integration/ui/uiIntegration.test.ts`)

- Tests for highlighting search terms in HTML content previews
- Tests for highlighting search terms with Unicode characters
- Tests for integrating highlighting with the search results display

## Running the Tests

To run all highlighting tests:

```bash
npm test -- --testPathPattern=highlight
```

To run specific test files:

```bash
npm test -- --testPathPattern=tests/unit/ui/highlightHtmlUtils.fuzzy.test.ts
npm test -- --testPathPattern=tests/unit/ui/HighlightMatches.test.tsx
```

## Test Coverage

The highlighting tests cover:

1. Basic functionality for both HTML and plain text highlighting
2. Edge cases and boundary conditions
3. Performance with large inputs
4. Support for fuzzy search matches
5. Support for NEAR operator matches
6. Support for Unicode characters and special scripts
7. Integration with the search pipeline and UI components
