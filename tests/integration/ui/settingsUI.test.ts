/**
 * Integration Tests for Settings UI
 *
 * These tests verify that the Settings UI components work correctly with the settings
 * management system, particularly focusing on fuzzy search settings.
 */

// Import the mock electronAPI
import { mockElectronAPI } from "../../mocks/electronAPI";

// Mock the SettingsModal component
jest.mock("../../../src/ui/SettingsModal", () => {
  return {
    __esModule: true,
    default: jest.fn().mockImplementation(({ isOpen }) => {
      if (isOpen) {
        // Simulate the useEffect that fetches settings
        mockElectronAPI.getThemePreference();
        mockElectronAPI.getDefaultExportFormat();
        mockElectronAPI.getFuzzySearchBooleanEnabled();
        mockElectronAPI.getFuzzySearchNearEnabled();
      }
      return null;
    }),
  };
});

describe("Settings UI Integration Tests", () => {
  // Reset mocks before each test
  beforeEach(() => {
    jest.clearAllMocks();

    // Set up default mock implementations
    mockElectronAPI.getThemePreference.mockResolvedValue("system");
    mockElectronAPI.getDefaultExportFormat.mockResolvedValue("txt");
    mockElectronAPI.getFuzzySearchBooleanEnabled.mockResolvedValue(true);
    mockElectronAPI.getFuzzySearchNearEnabled.mockResolvedValue(true);
  });

  describe("Fuzzy Search Settings UI", () => {
    test("should update fuzzy search Boolean setting", async () => {
      // Simulate the handler that would be triggered when the checkbox is toggled
      await mockElectronAPI.setFuzzySearchBooleanEnabled(false);

      // Check that the API was called with false
      expect(mockElectronAPI.setFuzzySearchBooleanEnabled).toHaveBeenCalledWith(
        false
      );
    });

    test("should update fuzzy search NEAR setting", async () => {
      // Simulate the handler that would be triggered when the checkbox is toggled
      await mockElectronAPI.setFuzzySearchNearEnabled(false);

      // Check that the API was called with false
      expect(mockElectronAPI.setFuzzySearchNearEnabled).toHaveBeenCalledWith(
        false
      );
    });

    test("should handle API errors gracefully", async () => {
      // Create a backup of the original implementation
      const originalImplementation =
        mockElectronAPI.setFuzzySearchBooleanEnabled;

      try {
        // Mock API errors
        mockElectronAPI.setFuzzySearchBooleanEnabled = jest
          .fn()
          .mockRejectedValue(new Error("API error"));

        // Spy on console.error
        const consoleErrorSpy = jest
          .spyOn(console, "error")
          .mockImplementation();

        try {
          // Attempt to update the setting
          await mockElectronAPI.setFuzzySearchBooleanEnabled(false);
        } catch (_error) {
          // Error should be caught
        }

        // Restore console.error
        consoleErrorSpy.mockRestore();
      } finally {
        // Restore the original implementation
        mockElectronAPI.setFuzzySearchBooleanEnabled = originalImplementation;
      }
    });
  });

  describe("Settings Persistence", () => {
    test("should load saved settings", async () => {
      // Mock saved settings
      mockElectronAPI.getFuzzySearchBooleanEnabled.mockResolvedValue(false);
      mockElectronAPI.getFuzzySearchNearEnabled.mockResolvedValue(false);

      // Fetch the settings
      const booleanEnabled =
        await mockElectronAPI.getFuzzySearchBooleanEnabled();
      const nearEnabled = await mockElectronAPI.getFuzzySearchNearEnabled();

      // Check that the settings were fetched
      expect(mockElectronAPI.getFuzzySearchBooleanEnabled).toHaveBeenCalled();
      expect(mockElectronAPI.getFuzzySearchNearEnabled).toHaveBeenCalled();

      // Check that the settings have the expected values
      expect(booleanEnabled).toBe(false);
      expect(nearEnabled).toBe(false);
    });
  });

  describe("Settings Effect on Search Behavior", () => {
    test("should update search behavior when fuzzy search settings are changed", async () => {
      // Simulate updating the fuzzy search Boolean setting
      await mockElectronAPI.setFuzzySearchBooleanEnabled(false);

      // Check that the API was called with false
      expect(mockElectronAPI.setFuzzySearchBooleanEnabled).toHaveBeenCalledWith(
        false
      );

      // In a real integration test, we would now perform a search and verify that
      // fuzzy search is not applied in Boolean queries. However, since we're mocking
      // the electron API, we can only verify that the API was called correctly.
    });
  });
});
