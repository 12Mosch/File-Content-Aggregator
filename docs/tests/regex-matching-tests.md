# Regex Pattern Matching Tests

This document describes the tests for regex pattern matching in the File Content Aggregator application.

## Overview

The regex pattern matching tests verify that the application correctly matches regex patterns against content, handles different regex features, and properly processes matches. These tests are crucial for ensuring that the regex search functionality works correctly and efficiently.

## Test Categories

The regex pattern matching tests are organized into the following categories:

### Basic Pattern Matching

These tests verify that the application correctly matches simple regex patterns:

- Simple pattern matching (e.g., `/test/`)
- Multiple occurrences (e.g., `/test/g`)
- Case sensitivity (e.g., `/test/i`)
- Word boundaries (e.g., `/\btest\b/`)

### Character Classes

These tests verify that the application correctly handles character classes:

- Digit character class (e.g., `/\d+/`)
- Word character class (e.g., `/\w+/`)
- Custom character classes (e.g., `/[a-z]+/`)
- Negated character classes (e.g., `/[^0-9]+/`)

### Quantifiers

These tests verify that the application correctly handles quantifiers:

- Star quantifier (e.g., `/a*/`)
- Plus quantifier (e.g., `/a+/`)
- Question mark quantifier (e.g., `/colou?r/`)
- Curly braces quantifier (e.g., `/a{2,3}/`)
- Greedy quantifiers (e.g., `/.*?/`)
- Lazy quantifiers (e.g., `/.*?/`)

### Capturing Groups

These tests verify that the application correctly handles capturing groups:

- Basic capturing groups (e.g., `/([a-z]+)@([a-z]+)\.(com|org)/`)
- Backreferences (e.g., `/\b(\w+)\s+\1\b/`)
- Non-capturing groups (e.g., `/(?:[a-z]+)(\d+)/`)

### Lookahead/Lookbehind Assertions

These tests verify that the application correctly handles lookahead and lookbehind assertions:

- Positive lookahead (e.g., `/\b\w+(?=\d)/`)
- Negative lookahead (e.g., `/\b\w+(?!\d)/`)
- Positive lookbehind (e.g., `/(?<=\$)\d+/`)
- Negative lookbehind (e.g., `/(?<!\$)\d+/`)

### Boundary Assertions

These tests verify that the application correctly handles boundary assertions:

- Beginning of string (e.g., `/^test/`)
- End of string (e.g., `/test$/`)
- Word boundaries (e.g., `/\btest\b/`)
- Non-word boundaries (e.g., `/\Btest\B/`)

### Integration with parseRegexLiteral

These tests verify that the application correctly integrates regex pattern matching with regex literal parsing:

- Parsing and matching regex literals (e.g., `/\d+/`)
- Parsing and matching regex literals with flags (e.g., `/test/gi`)
- Handling invalid regex literals (e.g., `/[unclosed/`)

## Implementation Details

The regex pattern matching tests are implemented in `tests/unit/search/regexPatternMatching.test.ts`. The tests use Jest's testing framework and focus on two main functions:

1. `findTermIndices`: Finds all indices of a term in content, supporting both string and RegExp terms.
2. `parseRegexLiteral`: Parses a regex literal string (e.g., `/pattern/flags`) into a RegExp object.

## Running the Tests

You can run the regex pattern matching tests using the following command:

```bash
npm run test:unit -- --testPathPattern=regexPatternMatching
```

## Related Tests

The regex pattern matching tests are part of a broader suite of tests for regex functionality:

- **Regex Pattern Validation**: Tests for validating regex patterns, handling invalid patterns, and processing flags.
- **Regex in Search Pipeline**: Integration tests for regex in the search pipeline.

## Best Practices

When working with regex pattern matching in the application, follow these best practices:

1. **Use appropriate regex features**: Choose the right regex features for the task at hand.
2. **Be mindful of performance**: Complex regex patterns can be computationally expensive, especially on large files.
3. **Handle edge cases**: Consider edge cases like empty matches, overlapping matches, and matches at boundaries.
4. **Use the global flag**: When finding all matches, ensure the regex has the global flag.
5. **Prevent infinite loops**: Handle zero-width matches carefully to prevent infinite loops.
