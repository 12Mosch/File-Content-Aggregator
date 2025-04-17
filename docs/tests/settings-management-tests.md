# Settings Management Tests

This document describes the testing approach and test cases for the Settings Management functionality in the File Content Aggregator application.

## Overview

The Settings Management tests verify that the application correctly saves, loads, and validates user settings, with a particular focus on fuzzy search configuration settings. These tests ensure that:

1. Default settings are applied correctly when no user settings exist
2. User settings are saved and loaded correctly
3. Settings validation works as expected
4. Error handling during settings operations is robust

## Test Structure

The Settings Management tests are located in `tests/unit/settings/settingsManagement.test.ts` and are organized into the following test suites:

1. **Default Settings Values**: Tests that verify default values are applied correctly
2. **Saving and Loading Fuzzy Search Settings**: Tests that verify settings are saved and loaded correctly
3. **Settings Validation**: Tests that verify settings validation and error handling

## Mocking Strategy

The tests use Jest's mocking capabilities to mock the following dependencies:

1. **electron-store**: Mocked to control the behavior of `get` and `set` methods
2. **electron**: Mocked to provide the necessary Electron APIs
3. **fileSearchService**: Mocked to verify that settings are passed correctly to the search service

Example of the mocking setup:

```typescript
// Mock electron-store
const mockStore = {
  get: jest.fn(),
  set: jest.fn(),
};

// Mock electron
jest.mock("electron", () => {
  return {
    app: {
      getPath: jest.fn(() => "/mock/path"),
      getLocale: jest.fn(() => "en"),
      getSystemLocale: jest.fn(() => "en-US"),
      whenReady: jest.fn(() => Promise.resolve()),
    },
    ipcMain: {
      handle: jest.fn(),
    },
    nativeTheme: {
      themeSource: "system",
    },
  };
});

// Mock electron-store
jest.mock("electron-store", () => {
  return function () {
    return mockStore;
  };
});

// Mock fileSearchService
jest.mock("../../../src/electron/fileSearchService", () => {
  return {
    updateFuzzySearchSettings: jest.fn(),
  };
});
```

## Test Cases

### Default Settings Values

1. **Default Values When Settings Not Found**
   - Verifies that default values are used when settings are not found in the store
   - Tests default values for theme preference, fuzzy search settings, and export format

2. **Stored Values When Settings Exist**
   - Verifies that stored values are used when settings exist in the store
   - Tests that the values are correctly passed to the appropriate components

### Saving and Loading Fuzzy Search Settings

1. **Save Fuzzy Search Boolean Setting**
   - Verifies that the fuzzy search Boolean setting is saved correctly
   - Tests that the setting is passed to the search service

2. **Save Fuzzy Search NEAR Setting**
   - Verifies that the fuzzy search NEAR setting is saved correctly
   - Tests that the setting is passed to the search service

3. **Load Fuzzy Search Boolean Setting**
   - Verifies that the fuzzy search Boolean setting is loaded correctly
   - Tests that the correct value is returned by the IPC handler

4. **Load Fuzzy Search NEAR Setting**
   - Verifies that the fuzzy search NEAR setting is loaded correctly
   - Tests that the correct value is returned by the IPC handler

### Settings Validation

1. **Validate Theme Preference Values**
   - Verifies that theme preference values are validated correctly
   - Tests that valid values are accepted and applied

2. **Handle Errors During Settings Operations**
   - Verifies that errors during settings operations are handled correctly
   - Tests that default values are returned when errors occur

3. **Validate Sender Frame**
   - Verifies that the sender frame is validated before processing settings
   - Tests that requests from invalid sources are rejected

## Running the Tests

You can run the Settings Management tests using the following command:

```bash
npm test -- tests/unit/settings/settingsManagement.test.ts
```

Or run all unit tests with:

```bash
npm run test:unit
```

## Related Components

The Settings Management tests interact with the following components:

1. **main.ts**: Contains the IPC handlers for settings management
2. **fileSearchService.ts**: Receives and applies fuzzy search settings
3. **SettingsModal.tsx**: UI component for changing settings

## Future Improvements

Potential improvements to the Settings Management tests:

1. Add tests for additional settings (language, export format, etc.)
2. Add tests for settings persistence between application restarts
3. Add integration tests for the settings UI components
