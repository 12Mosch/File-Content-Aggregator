# Core Search Functionality Tests

This document describes the unit tests for the core search functionality in the File Content Aggregator application.

## Overview

The core search functionality is tested through three main test files:

1. `tests/unit/search/searchTermParsing.test.ts` - Tests for search term parsing
2. `tests/unit/search/searchTermEvaluation.test.ts` - Tests for search term evaluation
3. `tests/unit/search/fileFiltering.test.ts` - Tests for file filtering

## Search Term Parsing Tests

These tests verify that the application correctly parses different types of search terms:

- **Simple Term Parsing**

  - Parsing of simple terms
  - Parsing of quoted terms

- **Regex Pattern Parsing**

  - Parsing of regex patterns
  - Parsing of regex patterns with flags
  - Handling of invalid regex patterns

- **Boolean Expression Parsing**

  - Parsing of AND expressions
  - Parsing of OR expressions
  - Parsing of NOT expressions
  - Parsing of complex boolean expressions

- **NEAR Operator Parsing**

  - Parsing of NEAR function calls
  - Parsing of NEAR with regex patterns

- **Invalid Syntax Handling**
  - Handling of unbalanced parentheses
  - Handling of invalid operators

## Search Term Evaluation Tests

These tests verify that the application correctly evaluates search terms against content:

- **Exact Term Matching**

  - Matching exact terms in content
  - Finding all indices of a term in content

- **Case Sensitivity**

  - Case-insensitive matching by default
  - Respecting case sensitivity when enabled
  - Matching exact case when case-sensitive

- **Regex Pattern Matching**

  - Matching regex patterns in content
  - Not matching regex patterns that don't match content
  - Respecting regex flags

- **Boolean Expression Evaluation**

  - Evaluating AND expressions
  - Evaluating OR expressions
  - Evaluating NOT expressions
  - Evaluating complex boolean expressions
  - Short-circuiting AND evaluation
  - Short-circuiting OR evaluation

- **NEAR Operator Evaluation**

  - Evaluating NEAR with terms in proximity
  - Not matching NEAR with terms too far apart
  - Evaluating NEAR with regex patterns
  - Respecting term order in NEAR
  - Handling NEAR with terms spanning multiple lines

- **Fuzzy Matching**
  - Matching with fuzzy search when exact match fails
  - Not matching with fuzzy search when score is too high
  - Not matching with fuzzy search when no results

## File Filtering Tests

These tests verify that the application correctly filters files based on various criteria:

- **File Extension Filtering**

  - Matching files with specified extensions
  - Not matching files with different extensions
  - Handling extensions with and without dots

- **File Path Inclusion/Exclusion**

  - Excluding files matching exact pattern
  - Excluding files matching glob pattern
  - Excluding files matching regex pattern
  - Not excluding files not matching any pattern

- **Directory Exclusion**

  - Excluding directory with 'contains' mode
  - Excluding directory with 'startsWith' mode
  - Excluding directory with 'endsWith' mode
  - Excluding directory with 'exact' mode
  - Not excluding directory not matching pattern

- **File Size Filtering**

  - Filtering files by minimum size
  - Filtering files by maximum size
  - Filtering files by size range
  - Excluding files outside size range

- **File Date Filtering**

  - Filtering files by modified after date
  - Filtering files by modified before date
  - Filtering files by date range
  - Excluding files outside date range

- **Maximum Depth Filtering**
  - Respecting maximum depth setting
  - Including files within maximum depth

## Running the Tests

To run the core search functionality tests:

```bash
# Run all core search tests
npm test -- tests/unit/search

# Run specific test file
npm test -- tests/unit/search/searchTermParsing.test.ts
npm test -- tests/unit/search/searchTermEvaluation.test.ts
npm test -- tests/unit/search/fileFiltering.test.ts
```

## Test Implementation Notes

The tests use mocked implementations of the core search functions to avoid dependencies on the Electron environment. This allows the tests to run in a Node.js environment without requiring an Electron context.

The main functions being tested are:

- `parseRegexLiteral` - Parses regex literals from strings
- `evaluateBooleanAst` - Evaluates boolean expressions against content
- `findTermIndices` - Finds all indices of a term in content
- `isDirectoryExcluded` - Checks if a directory should be excluded based on patterns

These functions are mocked in the test files to provide controlled behavior for testing specific scenarios.
