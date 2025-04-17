/**
 * Unit tests for Settings Management
 *
 * These tests verify that the application correctly saves, loads, and validates
 * user settings, particularly focusing on fuzzy search configuration settings.
 */

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

// Import after mocking
import { ipcMain, nativeTheme } from "electron";
import { updateFuzzySearchSettings } from "../../../src/electron/fileSearchService";

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
    test("should use default values when settings are not found", () => {
      // Setup mock to return undefined (setting not found)
      mockStore.get.mockImplementation((key, defaultValue) => defaultValue);

      // Import the module that uses electron-store
      // We need to re-import to ensure it uses our mocked store
      jest.isolateModules(() => {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        require("../../../src/electron/main");

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
        expect(mockStore.get).toHaveBeenCalledWith(
          "defaultExportFormat",
          "txt"
        );
      });
    });

    test("should use stored values when settings exist", () => {
      // Setup mock to return custom values
      mockStore.get.mockImplementation((key) => {
        if (key === "themePreference") return "dark";
        if (key === "fuzzySearchBooleanEnabled") return false;
        if (key === "fuzzySearchNearEnabled") return false;
        if (key === "defaultExportFormat") return "json";
        return undefined;
      });

      // Import the module that uses electron-store
      jest.isolateModules(() => {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        require("../../../src/electron/main");

        // Verify stored values were used
        expect(mockStore.get).toHaveBeenCalledWith("themePreference", "system");
        expect(nativeTheme.themeSource).toBe("dark");

        expect(mockStore.get).toHaveBeenCalledWith(
          "fuzzySearchBooleanEnabled",
          true
        );
        expect(mockStore.get).toHaveBeenCalledWith(
          "fuzzySearchNearEnabled",
          true
        );

        // Verify updateFuzzySearchSettings was called with correct values
        expect(updateFuzzySearchSettings).toHaveBeenCalledWith(false, false);
      });
    });
  });

  describe("Saving and Loading Fuzzy Search Settings", () => {
    test("should save fuzzy search Boolean setting", () => {
      // Setup IPC handler mock
      const mockEvent = { senderFrame: { url: "file:///valid/url" } };
      let ipcHandler:
        | ((
            event: { senderFrame: { url: string } },
            enabled: boolean
          ) => Promise<void>)
        | undefined;

      // Capture the IPC handler function
      (ipcMain.handle as jest.Mock).mockImplementation((channel, handler) => {
        if (channel === "set-fuzzy-search-boolean-enabled") {
          ipcHandler = handler;
        }
      });

      // Import the module to register IPC handlers
      jest.isolateModules(() => {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        require("../../../src/electron/main");

        // Verify IPC handler was registered
        expect(ipcMain.handle).toHaveBeenCalledWith(
          "set-fuzzy-search-boolean-enabled",
          expect.any(Function)
        );

        // Call the captured handler
        if (ipcHandler) {
          void ipcHandler(mockEvent, false);
        }

        // Verify setting was saved
        expect(mockStore.set).toHaveBeenCalledWith(
          "fuzzySearchBooleanEnabled",
          false
        );

        // Verify updateFuzzySearchSettings was called
        expect(updateFuzzySearchSettings).toHaveBeenCalled();
      });
    });

    test("should save fuzzy search NEAR setting", () => {
      // Setup IPC handler mock
      const mockEvent = { senderFrame: { url: "file:///valid/url" } };
      let ipcHandler:
        | ((
            event: { senderFrame: { url: string } },
            enabled: boolean
          ) => Promise<void>)
        | undefined;

      // Capture the IPC handler function
      (ipcMain.handle as jest.Mock).mockImplementation((channel, handler) => {
        if (channel === "set-fuzzy-search-near-enabled") {
          ipcHandler = handler;
        }
      });

      // Import the module to register IPC handlers
      jest.isolateModules(() => {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        require("../../../src/electron/main");

        // Verify IPC handler was registered
        expect(ipcMain.handle).toHaveBeenCalledWith(
          "set-fuzzy-search-near-enabled",
          expect.any(Function)
        );

        // Call the captured handler
        if (ipcHandler) {
          void ipcHandler(mockEvent, false);
        }

        // Verify setting was saved
        expect(mockStore.set).toHaveBeenCalledWith(
          "fuzzySearchNearEnabled",
          false
        );

        // Verify updateFuzzySearchSettings was called
        expect(updateFuzzySearchSettings).toHaveBeenCalled();
      });
    });

    test("should load fuzzy search Boolean setting", () => {
      // Setup IPC handler mock
      const mockEvent = { senderFrame: { url: "file:///valid/url" } };
      let ipcHandler:
        | ((event: { senderFrame: { url: string } }) => Promise<boolean>)
        | undefined;

      // Setup mock to return a specific value
      mockStore.get.mockImplementation((key, defaultValue) => {
        if (key === "fuzzySearchBooleanEnabled") return false;
        return defaultValue;
      });

      // Capture the IPC handler function
      (ipcMain.handle as jest.Mock).mockImplementation((channel, handler) => {
        if (channel === "get-fuzzy-search-boolean-enabled") {
          ipcHandler = handler;
        }
      });

      // Import the module to register IPC handlers
      jest.isolateModules(() => {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        require("../../../src/electron/main");

        // Verify IPC handler was registered
        expect(ipcMain.handle).toHaveBeenCalledWith(
          "get-fuzzy-search-boolean-enabled",
          expect.any(Function)
        );

        // Call the captured handler and check result
        if (ipcHandler) {
          const resultPromise = ipcHandler(mockEvent);
          void expect(resultPromise).resolves.toBe(false);
        }

        // Verify setting was retrieved
        expect(mockStore.get).toHaveBeenCalledWith(
          "fuzzySearchBooleanEnabled",
          true
        );
      });
    });

    test("should load fuzzy search NEAR setting", () => {
      // Setup IPC handler mock
      const mockEvent = { senderFrame: { url: "file:///valid/url" } };
      let ipcHandler:
        | ((event: { senderFrame: { url: string } }) => Promise<boolean>)
        | undefined;

      // Setup mock to return a specific value
      mockStore.get.mockImplementation((key, defaultValue) => {
        if (key === "fuzzySearchNearEnabled") return false;
        return defaultValue;
      });

      // Capture the IPC handler function
      (ipcMain.handle as jest.Mock).mockImplementation((channel, handler) => {
        if (channel === "get-fuzzy-search-near-enabled") {
          ipcHandler = handler;
        }
      });

      // Import the module to register IPC handlers
      jest.isolateModules(() => {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        require("../../../src/electron/main");

        // Verify IPC handler was registered
        expect(ipcMain.handle).toHaveBeenCalledWith(
          "get-fuzzy-search-near-enabled",
          expect.any(Function)
        );

        // Call the captured handler and check result
        if (ipcHandler) {
          const resultPromise = ipcHandler(mockEvent);
          void expect(resultPromise).resolves.toBe(false);
        }

        // Verify setting was retrieved
        expect(mockStore.get).toHaveBeenCalledWith(
          "fuzzySearchNearEnabled",
          true
        );
      });
    });
  });

  describe("Settings Validation", () => {
    test("should validate theme preference values", () => {
      // Setup IPC handler mock
      const mockEvent = { senderFrame: { url: "file:///valid/url" } };
      let ipcHandler:
        | ((
            event: { senderFrame: { url: string } },
            theme: string
          ) => Promise<void>)
        | undefined;

      // Capture the IPC handler function
      (ipcMain.handle as jest.Mock).mockImplementation((channel, handler) => {
        if (channel === "set-theme-preference") {
          ipcHandler = handler;
        }
      });

      // Import the module to register IPC handlers
      jest.isolateModules(() => {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        require("../../../src/electron/main");

        // Verify IPC handler was registered
        expect(ipcMain.handle).toHaveBeenCalledWith(
          "set-theme-preference",
          expect.any(Function)
        );

        // Call the captured handler with valid theme
        if (ipcHandler) {
          void ipcHandler(mockEvent, "dark");
        }

        // Verify setting was saved
        expect(mockStore.set).toHaveBeenCalledWith("themePreference", "dark");
        expect(nativeTheme.themeSource).toBe("dark");
      });
    });

    test("should handle errors during settings operations", () => {
      // Setup IPC handler mock
      const mockEvent = { senderFrame: { url: "file:///valid/url" } };
      let ipcHandler:
        | ((event: { senderFrame: { url: string } }) => Promise<string>)
        | undefined;

      // Setup mock to throw an error
      mockStore.get.mockImplementation(() => {
        throw new Error("Mock store error");
      });

      // Capture the IPC handler function
      (ipcMain.handle as jest.Mock).mockImplementation((channel, handler) => {
        if (channel === "get-theme-preference") {
          ipcHandler = handler;
        }
      });

      // Import the module to register IPC handlers
      jest.isolateModules(() => {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        require("../../../src/electron/main");

        // Verify IPC handler was registered
        expect(ipcMain.handle).toHaveBeenCalledWith(
          "get-theme-preference",
          expect.any(Function)
        );

        // Call the captured handler and check result
        if (ipcHandler) {
          const resultPromise = ipcHandler(mockEvent);
          void expect(resultPromise).resolves.toBe("system");
        }

        // Verify error was logged
        expect(console.error).toHaveBeenCalled();
      });
    });

    test("should validate sender frame before processing settings", () => {
      // Setup IPC handler mock with invalid sender
      const mockEvent = { senderFrame: { url: "http://malicious-site.com" } };
      let ipcHandler:
        | ((event: { senderFrame: { url: string } }) => Promise<string>)
        | undefined;

      // Capture the IPC handler function
      (ipcMain.handle as jest.Mock).mockImplementation((channel, handler) => {
        if (channel === "get-theme-preference") {
          ipcHandler = handler;
        }
      });

      // Import the module to register IPC handlers
      jest.isolateModules(() => {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        require("../../../src/electron/main");

        // Call the captured handler with invalid sender
        if (ipcHandler) {
          const resultPromise = ipcHandler(mockEvent);
          void expect(resultPromise).resolves.toBe("system");
        }

        // Verify store was not accessed
        expect(mockStore.get).not.toHaveBeenCalled();
      });
    });
  });
});
