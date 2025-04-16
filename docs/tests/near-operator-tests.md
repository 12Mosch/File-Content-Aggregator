# NEAR Operator Tests

This document describes the tests for the NEAR operator functionality in the File Content Aggregator application.

## Overview

The NEAR operator allows users to search for terms that appear within a specified distance of each other in the content. The syntax for the NEAR operator is:

```
NEAR(term1, term2, distance)
```

Where:

- `term1` and `term2` are the search terms (can be simple terms, quoted strings, or regex patterns)
- `distance` is the maximum number of words between the terms

## Unit Tests

### NEAR Operator Parsing Tests

These tests verify that the application correctly parses NEAR operator syntax in search queries. The tests are implemented in `tests/unit/search/searchTermParsing.test.ts`.

#### Basic NEAR Syntax

- **Test**: `should parse NEAR function call`
- **Description**: Verifies that a basic NEAR function call with two simple terms and a distance is correctly parsed into an AST.
- **Example**: `NEAR("term1", "term2", 5)`

#### NEAR with Quoted Terms

- **Test**: `should parse NEAR with quoted terms containing special characters`
- **Description**: Verifies that NEAR can handle quoted terms that contain spaces and special characters.
- **Example**: `NEAR("term with spaces", "term with \"quotes\"", 3)`

#### NEAR with Regex Patterns

- **Test**: `should parse NEAR with regex patterns`
- **Description**: Verifies that NEAR can handle regex patterns as search terms.
- **Example**: `NEAR("/pattern1/", "/pattern2/", 10)`

- **Test**: `should parse NEAR with regex patterns containing flags`
- **Description**: Verifies that NEAR can handle regex patterns with flags.
- **Example**: `NEAR("/pattern1/i", "/pattern2/g", 8)`

#### Nested NEAR Operators

- **Test**: `should parse nested NEAR operators`
- **Description**: Verifies that NEAR operators can be nested within each other.
- **Example**: `NEAR(NEAR("term1", "term2", 3), "term3", 5)`

#### Complex NEAR Expressions

- **Test**: `should parse NEAR with complex nested expressions`
- **Description**: Verifies that NEAR can handle complex expressions with boolean operators as arguments.
- **Example**: `NEAR(("term1" AND "term2"), ("term3" OR "term4"), 10)`

### Invalid NEAR Syntax Handling

- **Test**: `should handle NEAR with missing arguments`
- **Description**: Verifies that the parser can handle NEAR calls with fewer than the required arguments.
- **Example**: `NEAR("term1")`

- **Test**: `should handle NEAR with incorrect argument types`
- **Description**: Verifies that the parser can handle NEAR calls with non-numeric distance values.
- **Example**: `NEAR("term1", "term2", "not-a-number")`

- **Test**: `should handle NEAR with negative distance`
- **Description**: Verifies that the parser can handle NEAR calls with negative distance values.
- **Example**: `NEAR("term1", "term2", -5)`

## NEAR Operator Evaluation Tests

These tests verify that the application correctly evaluates NEAR expressions against content. The tests are implemented in `tests/unit/search/nearOperatorEvaluation.test.ts`.

### Basic Proximity Matching

- **Test**: `should match terms that are within the specified distance`
- **Description**: Verifies that NEAR correctly matches terms that are within the specified distance.

- **Test**: `should not match terms that are too far apart`
- **Description**: Verifies that NEAR does not match terms that are farther apart than the specified distance.

- **Test**: `should match terms at exactly the specified distance`
- **Description**: Verifies that NEAR correctly matches terms that are exactly at the specified distance.

- **Test**: `should not match terms at distance greater than specified`
- **Description**: Verifies that NEAR does not match terms that are at a distance greater than specified.

### Different Distance Values

- **Test**: `should work with distance of 0 (adjacent words)`
- **Description**: Verifies that NEAR correctly handles a distance of 0, which means the words must be adjacent.

- **Test**: `should work with large distance values`
- **Description**: Verifies that NEAR correctly handles large distance values.

- **Test**: `should handle invalid distance values`
- **Description**: Verifies that NEAR correctly handles non-numeric distance values.

- **Test**: `should handle negative distance values`
- **Description**: Verifies that NEAR correctly handles negative distance values (should be treated as invalid).

### Case Sensitivity

- **Test**: `should respect case sensitivity when enabled`
- **Description**: Verifies that NEAR respects case sensitivity when it is enabled.

- **Test**: `should ignore case when case sensitivity is disabled`
- **Description**: Verifies that NEAR ignores case when case sensitivity is disabled.

### Term Order

- **Test**: `should match terms regardless of their order in content`
- **Description**: Verifies that NEAR finds terms regardless of their order in the content.

- **Test**: `should match terms in reverse order`
- **Description**: Verifies that NEAR correctly matches terms when they appear in reverse order in the content.

### Multiple Lines

- **Test**: `should match terms spanning multiple lines`
- **Description**: Verifies that NEAR can match terms that span across multiple lines.

- **Test**: `should count newlines correctly in word distance`
- **Description**: Verifies that NEAR correctly counts newlines when calculating word distance.

### Regex Patterns

- **Test**: `should match regex patterns within specified distance`
- **Description**: Verifies that NEAR can match regex patterns within the specified distance.

- **Test**: `should respect regex flags`
- **Description**: Verifies that NEAR respects regex flags when matching patterns.

### Fuzzy Matching

- **Test**: `should work with fuzzy matching enabled`
- **Description**: Verifies that NEAR works correctly with fuzzy matching enabled.

## Integration Tests

### NEAR in Search Pipeline

These tests verify that the NEAR operator works correctly within the search pipeline. The tests are implemented in `tests/integration/search/searchPipeline.test.ts` and `tests/integration/search/regexSearch.test.ts`.

- **Test**: `should search with NEAR operator containing regex patterns`
- **Description**: Verifies that the search pipeline correctly processes NEAR expressions with regex patterns.

### Fuzzy Search in NEAR Operator

These tests verify that fuzzy search works correctly with the NEAR operator. The tests are implemented in `tests/integration/search/fuzzySearch.test.ts`.

- **Test**: `should find matches with NEAR expressions containing misspelled terms`
- **Description**: Verifies that the NEAR operator can find matches with fuzzy search when terms are misspelled.

## Best Practices for Testing NEAR Operator

When writing tests for the NEAR operator:

1. **Test with various distances**: Test with different distance values to ensure proximity matching works correctly.
2. **Test with different term types**: Test with simple terms, quoted strings, and regex patterns.
3. **Test with complex content**: Test with content that contains multiple occurrences of terms at different distances.
4. **Test edge cases**: Test with terms at exactly the specified distance, terms that span across lines, etc.
5. **Test error handling**: Test with invalid syntax and ensure the application handles errors gracefully.
