# Localization Tests

This document describes the integration tests for localization functionality in the File Content Aggregator application.

## Overview

The localization integration tests verify that the application correctly handles different languages and character sets, including non-Latin characters. These tests focus on three main areas:

1. UI with different language settings
2. Search with non-Latin characters
3. Highlighting with non-Latin characters

The tests are located in `tests/integration/ui/localization.test.ts`.

## Test Categories

### 1. UI with Different Language Settings

These tests verify that the UI correctly handles different language settings. They test:

- Changing language settings
- Handling unsupported languages gracefully

### 2. Search with Non-Latin Characters

These tests verify that the search functionality correctly handles non-Latin characters. They test:

- Finding exact matches with Japanese characters
- Finding exact matches with Arabic characters
- Finding exact matches with Cyrillic characters
- Finding fuzzy matches with Japanese characters
- Finding fuzzy matches with Arabic characters
- Finding fuzzy matches with Cyrillic characters

### 3. Highlighting with Non-Latin Characters

These tests verify that the highlighting functionality correctly handles non-Latin characters. They test:

- Highlighting Japanese characters in HTML content
- Highlighting Arabic characters in HTML content
- Highlighting Cyrillic characters in HTML content
- Highlighting mixed Latin and non-Latin characters
- Highlighting emoji characters in HTML content

## Running the Tests

To run the localization integration tests:

```bash
# Run all integration tests
npm run test:integration

# Run only the localization integration tests
npm test -- tests/integration/ui/localization.test.ts
```

## Test Implementation Details

The localization integration tests use Jest's mocking capabilities to mock the i18n functionality and the Electron API. This allows testing the localization functionality without a real browser environment.

### Mocking Strategy

- **i18n Mocking**: The tests mock the i18n functionality to simulate different language settings.
- **Electron API Mocking**: The tests mock the Electron API to simulate language preference changes.

### Search Tests

The search tests focus on the application's ability to find matches with non-Latin characters. These tests verify that:

1. The application can find exact matches with non-Latin characters
2. The application can find fuzzy matches with non-Latin characters

### Highlighting Tests

The highlighting tests focus on the application's ability to highlight matches with non-Latin characters. These tests verify that:

1. The application can highlight non-Latin characters in HTML content
2. The application can highlight mixed Latin and non-Latin characters
3. The application can highlight emoji characters

## Test Coverage

The localization integration tests cover the following aspects of the localization functionality:

- Language settings changes
- Search with non-Latin characters
- Highlighting with non-Latin characters

These tests complement the unit tests for individual components, providing end-to-end verification that the application correctly handles different languages and character sets.
