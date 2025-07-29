/**
 * Mock implementation of the Electron API for testing
 */

export const mockElectronAPI = {
  // Theme preferences
  getThemePreference: jest.fn().mockResolvedValue("system"),
  setThemePreference: jest.fn().mockResolvedValue(undefined),

  // Language preferences
  getInitialLanguage: jest.fn().mockResolvedValue("en"),
  setLanguagePreference: jest.fn().mockResolvedValue(undefined),
  notifyLanguageChanged: jest.fn(),

  // Export format
  getDefaultExportFormat: jest.fn().mockResolvedValue("txt"),
  setDefaultExportFormat: jest.fn().mockResolvedValue(undefined),

  // Fuzzy search settings
  getFuzzySearchBooleanEnabled: jest.fn().mockResolvedValue(true),
  setFuzzySearchBooleanEnabled: jest.fn().mockResolvedValue(undefined),
  getFuzzySearchNearEnabled: jest.fn().mockResolvedValue(true),
  setFuzzySearchNearEnabled: jest.fn().mockResolvedValue(undefined),

  // Search history
  getSearchHistory: jest.fn().mockResolvedValue([]),
  saveSearchHistory: jest.fn().mockResolvedValue(undefined),
  clearSearchHistory: jest.fn().mockResolvedValue(undefined),

  // File operations
  openFile: jest.fn().mockResolvedValue({ success: true }),
  openFileLocation: jest.fn().mockResolvedValue({ success: true }),
  saveFile: jest.fn().mockResolvedValue(undefined),
  copyFilePaths: jest.fn().mockResolvedValue({ success: true }),
  copyFilesToFolder: jest.fn().mockResolvedValue({
    success: true,
    destinationFolder: "/mock/destination",
  }),
  moveFilesToFolder: jest.fn().mockResolvedValue({
    success: true,
    destinationFolder: "/mock/destination",
  }),

  // Search operations
  searchFiles: jest.fn().mockResolvedValue({
    filesProcessed: 0,
    filesFound: 0,
    structuredItems: [],
    errorsEncountered: 0,
  }),
  cancelSearch: jest.fn().mockResolvedValue(undefined),

  // Event listeners
  onSearchProgress: jest.fn(),
  onSearchComplete: jest.fn(),
  onSearchError: jest.fn(),
  onThemeChange: jest.fn(),
};
