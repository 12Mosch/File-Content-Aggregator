/**
 * Unit tests for Settings Management
 *
 * These tests verify that the application correctly saves, loads, and validates
 * user settings, particularly focusing on fuzzy search configuration settings.
 */

// Mock fileSearchService
jest.mock("../../../src/electron/fileSearchService", () => {
  return {
    updateFuzzySearchSettings: jest.fn(),
  };
});

// Import after mocking
// We don't need to import updateFuzzySearchSettings as it's mocked
import {
  mockStore,
  // mockIpcMain is not used directly
  mockNativeTheme,
  initializeSettings,
  mockIpcHandlers,
  mockUpdateFuzzySearchSettings as mockUpdateSettings,
} from "../../mocks/electron/main";

// Mock console.log to avoid cluttering test output
jest.spyOn(console, "log").mockImplementation(() => {});
jest.spyOn(console, "error").mockImplementation(() => {});

describe("Settings Management", () => {
  // Reset mocks before each test
  beforeEach(() => {
    jest.clearAllMocks();
    mockStore.get.mockReset();
    mockStore.set.mockReset();
  });

  describe("Default Settings Values", () => {
    test("should use default values when settings are not found", async () => {
      // Setup mock to return undefined (setting not found)
      mockStore.get.mockImplementation((_key, defaultValue) => defaultValue);

      // Initialize settings with our mock
      initializeSettings();

      // Verify default values were used
      expect(mockStore.get).toHaveBeenCalledWith("themePreference", "system");
      expect(mockStore.get).toHaveBeenCalledWith(
        "fuzzySearchBooleanEnabled",
        true
      );
      expect(mockStore.get).toHaveBeenCalledWith(
        "fuzzySearchNearEnabled",
        true
      );
      expect(mockStore.get).toHaveBeenCalledWith("defaultExportFormat", "txt");
    });

    test("should use stored values when settings exist", async () => {
      // Setup mock to return custom values
      mockStore.get.mockImplementation((key) => {
        if (key === "themePreference") return "dark";
        if (key === "fuzzySearchBooleanEnabled") return false;
        if (key === "fuzzySearchNearEnabled") return false;
        if (key === "defaultExportFormat") return "json";
        return undefined;
      });

      // Initialize settings with our mock
      initializeSettings();

      // Verify stored values were used
      expect(mockStore.get).toHaveBeenCalledWith("themePreference", "system");
      expect(mockNativeTheme.themeSource).toBe("dark");

      expect(mockStore.get).toHaveBeenCalledWith(
        "fuzzySearchBooleanEnabled",
        true
      );
      expect(mockStore.get).toHaveBeenCalledWith(
        "fuzzySearchNearEnabled",
        true
      );

      // Verify updateFuzzySearchSettings was called with correct values
      expect(mockUpdateSettings).toHaveBeenCalledWith(false, false);
    });
  });

  describe("Saving and Loading Fuzzy Search Settings", () => {
    test("should save fuzzy search Boolean setting", async () => {
      // Setup IPC handler mock
      const mockEvent = { senderFrame: { url: "file:///valid/url" } };

      // Get the handler from our mock
      const handler = mockIpcHandlers["set-fuzzy-search-boolean-enabled"];

      // Call the handler
      if (handler) {
        await handler(mockEvent, false);
      }

      // Verify setting was saved
      expect(mockStore.set).toHaveBeenCalledWith(
        "fuzzySearchBooleanEnabled",
        false
      );

      // Verify updateFuzzySearchSettings was called
      expect(mockUpdateSettings).toHaveBeenCalled();
    });

    test("should save fuzzy search NEAR setting", async () => {
      // Setup IPC handler mock
      const mockEvent = { senderFrame: { url: "file:///valid/url" } };

      // Get the handler from our mock
      const handler = mockIpcHandlers["set-fuzzy-search-near-enabled"];

      // Call the handler
      if (handler) {
        await handler(mockEvent, false);
      }

      // Verify setting was saved
      expect(mockStore.set).toHaveBeenCalledWith(
        "fuzzySearchNearEnabled",
        false
      );

      // Verify updateFuzzySearchSettings was called
      expect(mockUpdateSettings).toHaveBeenCalled();
    });

    test("should load fuzzy search Boolean setting", async () => {
      // Setup IPC handler mock
      const mockEvent = { senderFrame: { url: "file:///valid/url" } };

      // Setup mock to return a specific value
      mockStore.get.mockImplementation((key, defaultValue) => {
        if (key === "fuzzySearchBooleanEnabled") return false;
        return defaultValue;
      });

      // Get the handler from our mock
      const handler = mockIpcHandlers["get-fuzzy-search-boolean-enabled"];

      // Call the handler
      let result: boolean | undefined;
      if (handler) {
        result = await handler(mockEvent);
      }

      // Verify result
      expect(result).toBe(false);

      // Verify setting was retrieved
      expect(mockStore.get).toHaveBeenCalledWith(
        "fuzzySearchBooleanEnabled",
        true
      );
    });

    test("should load fuzzy search NEAR setting", async () => {
      // Setup IPC handler mock
      const mockEvent = { senderFrame: { url: "file:///valid/url" } };

      // Setup mock to return a specific value
      mockStore.get.mockImplementation((key, defaultValue) => {
        if (key === "fuzzySearchNearEnabled") return false;
        return defaultValue;
      });

      // Get the handler from our mock
      const handler = mockIpcHandlers["get-fuzzy-search-near-enabled"];

      // Call the handler
      let result: boolean | undefined;
      if (handler) {
        result = await handler(mockEvent);
      }

      // Verify result
      expect(result).toBe(false);

      // Verify setting was retrieved
      expect(mockStore.get).toHaveBeenCalledWith(
        "fuzzySearchNearEnabled",
        true
      );
    });
  });

  describe("Settings Validation", () => {
    test("should validate theme preference values", async () => {
      // Setup IPC handler mock
      const mockEvent = { senderFrame: { url: "file:///valid/url" } };

      // Get the handler from our mock
      const handler = mockIpcHandlers["set-theme-preference"];

      // Call the handler
      if (handler) {
        await handler(mockEvent, "dark");
      }

      // Verify setting was saved
      expect(mockStore.set).toHaveBeenCalledWith("themePreference", "dark");
      expect(mockNativeTheme.themeSource).toBe("dark");
    });

    test("should handle errors during settings operations", async () => {
      // Setup IPC handler mock
      const mockEvent = { senderFrame: { url: "file:///valid/url" } };

      // Setup mock to throw an error
      mockStore.get.mockImplementation(() => {
        throw new Error("Mock store error");
      });

      // Get the handler from our mock
      const handler = mockIpcHandlers["get-theme-preference"];

      // Call the handler
      let result: string | undefined;
      if (handler) {
        result = await handler(mockEvent);
      }

      // Verify result
      expect(result).toBe("system");

      // Verify error was logged
      expect(console.error).toHaveBeenCalled();
    });

    test("should validate sender frame before processing settings", async () => {
      // Setup IPC handler mock with invalid sender
      const mockEvent = { senderFrame: { url: "http://malicious-site.com" } };

      // Get the handler from our mock
      const handler = mockIpcHandlers["get-theme-preference"];

      // Reset the mock to ensure we can check if it's called
      mockStore.get.mockReset();

      // Call the handler with invalid sender
      let result: string | undefined;
      if (handler) {
        result = await handler(mockEvent);
      }

      // Verify result
      expect(result).toBe("system");

      // Verify store was not accessed
      expect(mockStore.get).not.toHaveBeenCalled();
    });
  });
});
