# Settings UI Integration Tests

This document describes the integration tests for the Settings UI components in the File Content Aggregator application.

## Overview

The Settings UI integration tests verify that the Settings UI components work correctly with the settings management system. These tests focus on the `SettingsModal` component and its interaction with the Electron IPC API for managing settings, particularly the fuzzy search settings.

The tests are located in `tests/integration/ui/settingsUI.test.ts`.

## Test Categories

The Settings UI integration tests are organized into three main categories:

### 1. Fuzzy Search Settings UI

These tests verify that the fuzzy search settings UI components work correctly. They test:

- Display of fuzzy search settings with correct initial values
- Updating fuzzy search Boolean setting when checkbox is toggled
- Updating fuzzy search NEAR setting when checkbox is toggled
- Graceful handling of API errors when fetching settings
- Graceful handling of API errors when updating settings

### 2. Settings Persistence

These tests verify that settings are correctly persisted between sessions. They test:

- Loading saved settings when the modal is opened
- Not fetching settings when the modal is closed

### 3. Settings Effect on Search Behavior

These tests verify that changes to settings affect search behavior. They test:

- Updating search behavior when fuzzy search settings are changed

## Running the Tests

To run the Settings UI integration tests:

```bash
# Run all integration tests
npm run test:integration

# Run only the Settings UI integration tests
npm test -- tests/integration/ui/settingsUI.test.ts
```

## Test Implementation Details

The Settings UI integration tests use Jest's mocking capabilities to mock the Electron IPC API and React components. This allows testing the Settings UI components without a real Electron environment.

### Mocking Strategy

The tests mock the following dependencies:

- **Electron API**: Mocked to simulate IPC communication with the main process
- **React Components**: Mocked to simulate the UI components
- **i18n**: Mocked to provide translations for UI text

### Test Coverage

The Settings UI integration tests cover the following aspects of the Settings UI functionality:

- Rendering of settings UI components
- Interaction with settings UI components
- Communication with the Electron IPC API
- Handling of API errors
- Settings persistence between sessions
- Effect of settings changes on search behavior

These tests complement the unit tests for settings management, providing end-to-end verification that the settings UI components work correctly with the settings management system.
