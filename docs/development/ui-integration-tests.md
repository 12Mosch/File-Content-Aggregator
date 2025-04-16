# UI Integration Tests

This document describes the integration tests for the UI components in the File Content Aggregator application.

## Overview

The UI integration tests verify that the UI components work together correctly to display search results, handle user interactions, and highlight search terms in content previews. These tests focus on the `ResultsDisplay` component and its interaction with other UI components.

The tests are located in `tests/integration/ui/uiIntegration.test.ts`.

## Test Categories

The UI integration tests are organized into four main categories:

### 1. Search Results Display

These tests verify that search results are displayed correctly in the UI. They test:

- Rendering of search results in the tree view
- Proper display of search summary information
- Handling of empty search results

### 2. Tree View Expansion/Collapse

These tests verify that the tree view expansion and collapse functionality works correctly. They test:

- Expanding and collapsing file nodes in the tree view
- Proper state management for expanded/collapsed nodes
- Visual indicators for expanded/collapsed state

### 3. File Content Preview Loading

These tests verify that file content previews are loaded and displayed correctly. They test:

- Loading file content when a node is expanded
- Handling of "Show More" functionality for large files
- Error handling for file content loading failures

### 4. Search Term Highlighting in Previews

These tests verify that search terms are highlighted correctly in content previews. They test:

- Highlighting of exact search terms in HTML content
- Highlighting of fuzzy search matches
- Highlighting of terms found via NEAR operator
- Highlighting of search terms with Unicode characters

## Running the Tests

To run the UI integration tests:

```bash
# Run all integration tests
npm run test:integration

# Run only the UI integration tests
npm test -- tests/integration/ui/uiIntegration.test.ts
```

## Test Implementation Details

The UI integration tests use Jest's mocking capabilities to mock the DOM and React components. This allows testing the UI components without a real browser environment.

### Mocking Strategy

- **DOM Mocking**: The tests mock the necessary DOM APIs using Jest's mocking capabilities.
- **React Component Mocking**: The tests mock React components to isolate the components being tested.
- **Event Handling**: The tests simulate user interactions by directly calling the event handler functions.

### Highlighting Tests

The highlighting tests focus on the `highlightTermsInHtml` function, which is responsible for highlighting search terms in HTML content. These tests verify that:

1. The function correctly highlights exact search terms
2. The function handles fuzzy search matches
3. The function handles terms found via NEAR operator
4. The function handles Unicode characters

## Test Coverage

The UI integration tests cover the following aspects of the UI functionality:

- Rendering of search results
- Tree view expansion/collapse
- File content preview loading
- Search term highlighting in previews

These tests complement the unit tests for individual UI components, providing end-to-end verification that the components work together correctly.
