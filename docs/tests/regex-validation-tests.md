# Regex Pattern Validation Tests

This document describes the tests for regex pattern validation in the File Content Aggregator application.

## Overview

The regex pattern validation tests verify that the application correctly validates regex patterns, handles invalid patterns, and properly processes regex flags. These tests are crucial for ensuring that the regex search functionality works reliably and safely.

## Test Categories

The regex pattern validation tests are organized into the following categories:

### Valid Regex Pattern Validation

These tests verify that the application correctly parses and validates valid regex patterns:

- Basic regex patterns (e.g., `/abc/`)
- Regex patterns with flags (e.g., `/abc/i`, `/abc/gim`)
- Complex regex patterns (e.g., `/^[a-z0-9]+$/i`)
- Regex patterns with escaped forward slashes (e.g., `/path\/to\/file/`)

### Invalid Regex Pattern Validation

These tests verify that the application correctly identifies and handles invalid regex patterns:

- Non-regex literal strings (e.g., `abc`)
- Regex without closing delimiter (e.g., `/abc`)
- Regex with unclosed character class (e.g., `/[abc/`)
- Regex with unbalanced parentheses (e.g., `/(abc/`)
- Regex with invalid quantifier (e.g., `/a{-1}/`)

### Regex Syntax Error Handling

These tests verify that the application correctly handles regex syntax errors:

- Invalid character classes (e.g., `[]`)
- Invalid lookahead assertions (e.g., `(?=*)`)
- Invalid backreferences (e.g., `(a)\2`)
- Empty patterns (e.g., `""`)

### Regex Flags Validation

These tests verify that the application correctly processes regex flags:

- Case insensitive flag (`i`)
- Global flag (`g`)
- Multiline flag (`m`)
- Unicode flag (`u`)
- Multiple flags (e.g., `gim`)
- Invalid flags (e.g., `gimxyz`)

## Implementation Details

The regex pattern validation tests are implemented in `tests/unit/search/regexPatternValidation.test.ts`. The tests use Jest's testing framework and focus on two main functions:

1. `parseRegexLiteral`: Parses a regex literal string (e.g., `/pattern/flags`) into a RegExp object.
2. `createSafeRegex`: Creates a RegExp object with the given pattern and flags, with error handling.

## Running the Tests

You can run the regex pattern validation tests using the following command:

```bash
npm run test:unit -- --testPathPattern=regexPatternValidation
```

## Related Tests

The regex pattern validation tests are part of a broader suite of tests for regex functionality:

- **Regex Pattern Matching**: Tests for basic pattern matching, character classes, quantifiers, etc.
- **Regex in Search Pipeline**: Integration tests for regex in the search pipeline.

## Best Practices

When working with regex patterns in the application, follow these best practices:

1. **Always validate regex patterns**: Use the `parseRegexLiteral` or `createSafeRegex` functions to validate regex patterns before using them.
2. **Handle regex errors gracefully**: Catch and handle regex errors to prevent application crashes.
3. **Provide user feedback**: Inform users when they enter invalid regex patterns.
4. **Be mindful of performance**: Complex regex patterns can be computationally expensive, especially on large files.
