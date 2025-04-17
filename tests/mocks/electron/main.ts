/**
 * Mock implementation of main.ts for testing
 */

// Mock electron imports
const mockIpcMain = {
  handle: jest.fn(),
  on: jest.fn(),
};

const mockNativeTheme = {
  themeSource: "system",
};

const mockApp = {
  getPath: jest.fn(() => "/mock/path"),
  getLocale: jest.fn(() => "en"),
  getSystemLocale: jest.fn(() => "en-US"),
  whenReady: jest.fn(() => Promise.resolve()),
};

// Mock electron module
jest.mock(
  "electron",
  () => ({
    app: mockApp,
    ipcMain: mockIpcMain,
    nativeTheme: mockNativeTheme,
  }),
  { virtual: true }
);

// Mock store
export const mockStore = {
  get: jest.fn(),
  set: jest.fn(),
};

// Mock fileSearchService
export const mockUpdateFuzzySearchSettings = jest.fn();

// Mock IPC handlers
export const mockIpcHandlers: Record<string, jest.Mock> = {};

// Initialize settings
const THEME_PREFERENCE_KEY = "themePreference";
const FUZZY_SEARCH_BOOLEAN_ENABLED_KEY = "fuzzySearchBooleanEnabled";
const FUZZY_SEARCH_NEAR_ENABLED_KEY = "fuzzySearchNearEnabled";
const DEFAULT_EXPORT_FORMAT_KEY = "defaultExportFormat";

// Initialize theme
export function initializeSettings() {
  const storedTheme = mockStore.get(THEME_PREFERENCE_KEY, "system");
  mockNativeTheme.themeSource = storedTheme;

  // Initialize fuzzy search settings
  const fuzzySearchBooleanEnabled = mockStore.get(
    FUZZY_SEARCH_BOOLEAN_ENABLED_KEY,
    true
  );
  const fuzzySearchNearEnabled = mockStore.get(
    FUZZY_SEARCH_NEAR_ENABLED_KEY,
    true
  );
  // Initialize default export format
  mockStore.get(DEFAULT_EXPORT_FORMAT_KEY, "txt");

  mockUpdateFuzzySearchSettings(
    fuzzySearchBooleanEnabled,
    fuzzySearchNearEnabled
  );
}

// Define types for IPC handlers
type IpcEvent = { senderFrame?: { url: string } };
type ThemePreference = "light" | "dark" | "system";

// Create handler functions
const getThemePreference = async (_event: IpcEvent) => {
  try {
    // Validate sender frame
    if (_event.senderFrame && !_event.senderFrame.url.startsWith("file://")) {
      return "system";
    }
    return mockStore.get(THEME_PREFERENCE_KEY, "system");
  } catch (error) {
    console.error("Error getting theme preference:", error);
    return "system";
  }
};

const setThemePreference = async (_event: IpcEvent, theme: ThemePreference) => {
  if (["light", "dark", "system"].includes(theme)) {
    mockStore.set(THEME_PREFERENCE_KEY, theme);
    mockNativeTheme.themeSource = theme;
  }
};

const getFuzzySearchBooleanEnabled = async (_event: IpcEvent) => {
  return mockStore.get(FUZZY_SEARCH_BOOLEAN_ENABLED_KEY, true);
};

const setFuzzySearchBooleanEnabled = async (
  _event: IpcEvent,
  enabled: boolean
) => {
  mockStore.set(FUZZY_SEARCH_BOOLEAN_ENABLED_KEY, enabled);
  const nearEnabled = mockStore.get(FUZZY_SEARCH_NEAR_ENABLED_KEY, true);
  mockUpdateFuzzySearchSettings(enabled, nearEnabled);
};

const getFuzzySearchNearEnabled = async (_event: IpcEvent) => {
  return mockStore.get(FUZZY_SEARCH_NEAR_ENABLED_KEY, true);
};

const setFuzzySearchNearEnabled = async (
  _event: IpcEvent,
  enabled: boolean
) => {
  mockStore.set(FUZZY_SEARCH_NEAR_ENABLED_KEY, enabled);
  const booleanEnabled = mockStore.get(FUZZY_SEARCH_BOOLEAN_ENABLED_KEY, true);
  mockUpdateFuzzySearchSettings(booleanEnabled, enabled);
};

// Setup IPC handlers
mockIpcMain.handle = jest.fn();

// Register IPC handlers
mockIpcMain.handle.mockImplementation((channel: string, handler: any) => {
  mockIpcHandlers[channel] = handler;
});

// Register all handlers
mockIpcMain.handle("get-theme-preference", getThemePreference);
mockIpcMain.handle("set-theme-preference", setThemePreference);
mockIpcMain.handle(
  "get-fuzzy-search-boolean-enabled",
  getFuzzySearchBooleanEnabled
);
mockIpcMain.handle(
  "set-fuzzy-search-boolean-enabled",
  setFuzzySearchBooleanEnabled
);
mockIpcMain.handle("get-fuzzy-search-near-enabled", getFuzzySearchNearEnabled);
mockIpcMain.handle("set-fuzzy-search-near-enabled", setFuzzySearchNearEnabled);

// Initialize settings on import
initializeSettings();

// Export for tests
export { mockIpcMain, mockNativeTheme };

// Export default to satisfy module requirements
export default {
  mockStore,
  mockUpdateFuzzySearchSettings,
  mockIpcHandlers,
  mockNativeTheme,
  initializeSettings,
};
