# Accessibility Tests

This document describes the tests for accessibility features in the File Content Aggregator application.

## Overview

Accessibility testing ensures that the application is usable by people with disabilities, including those who use assistive technologies like screen readers or who rely on keyboard navigation. These tests verify that the application follows accessibility best practices and provides a good user experience for all users.

The accessibility tests are located in `tests/integration/ui/accessibility.test.ts`.

## Test Categories

The accessibility tests are organized into two main categories:

### 1. Keyboard Navigation

These tests verify that users can navigate and interact with the application using only a keyboard. They test:

- Tab navigation through search results
- Arrow key navigation within result items
- Keyboard shortcuts for common actions:
  - Ctrl+Enter / Cmd+Enter to execute a search
  - Escape to cancel a search
  - Ctrl+C / Cmd+C to copy results
  - Ctrl+E / Cmd+E to export results
  - Ctrl+, / Cmd+, to open settings
  - Ctrl+H / Cmd+H to open history

### 2. Screen Reader Compatibility

These tests verify that the application works well with screen readers. They test:

- Proper ARIA attributes on UI elements
- Appropriate announcements for search results
- Announcements for highlighted search terms in content previews

## Running the Tests

To run the accessibility tests:

```bash
# Run all integration tests
npm run test:integration

# Run only the accessibility tests
npm test -- tests/integration/ui/accessibility.test.ts
```

## Test Implementation Details

The accessibility tests use Jest's mocking capabilities to mock the DOM and React components. This allows testing the accessibility features without a real browser environment.

### Mocking Strategy

- **DOM Mocking**: The tests mock the necessary DOM APIs using Jest's mocking capabilities.
- **Event Handling**: The tests simulate user interactions by firing keyboard events.
- **ARIA Attributes**: The tests verify that UI elements have appropriate ARIA attributes.

### Keyboard Navigation Tests

The keyboard navigation tests focus on ensuring that users can navigate through the application using only a keyboard. These tests verify that:

1. Users can navigate through search results using Tab and arrow keys
2. Keyboard shortcuts work for common actions
3. Focus is managed appropriately when navigating through the UI

### Screen Reader Compatibility Tests

The screen reader compatibility tests focus on ensuring that screen readers can properly announce UI elements and content. These tests verify that:

1. UI elements have appropriate ARIA roles and labels
2. Search results are properly announced
3. Highlighted search terms in content previews are properly announced

## Accessibility Best Practices

The application follows these accessibility best practices:

1. **Keyboard Navigation**: All interactive elements are keyboard accessible.
2. **ARIA Attributes**: ARIA roles, states, and properties are used to enhance accessibility.
3. **Focus Management**: Focus is managed appropriately to ensure users can navigate efficiently.
4. **Screen Reader Announcements**: Important information is announced to screen readers.
5. **Color Contrast**: UI elements have sufficient color contrast for readability.
6. **Text Alternatives**: Non-text content has text alternatives.

## Test Coverage

The accessibility tests cover:

- Keyboard navigation of search results
- Keyboard shortcuts for common actions
- ARIA attributes on UI elements
- Screen reader announcements for search results
- Screen reader announcements for highlighted terms

## Resources

- [Web Content Accessibility Guidelines (WCAG)](https://www.w3.org/WAI/standards-guidelines/wcag/)
- [WAI-ARIA Authoring Practices](https://www.w3.org/WAI/ARIA/apg/)
- [Testing Library Accessibility](https://testing-library.com/docs/dom-testing-library/api-accessibility/)
- [Jest DOM Accessibility Matchers](https://github.com/testing-library/jest-dom#accessibility-matchers)
