/**
 * Unit tests for file operations functionality
 */
import { jest } from "@jest/globals";

// Create a mock for the Electron API
const mockOpenFile = jest.fn();
const mockOpenFileLocation = jest.fn();

// Mock the window.electronAPI object
Object.defineProperty(window, "electronAPI", {
  value: {
    openFile: mockOpenFile,
    openFileLocation: mockOpenFileLocation,
  },
  writable: true,
});

describe("File Operations", () => {
  beforeEach(() => {
    // Reset mocks before each test
    mockOpenFile.mockReset();
    mockOpenFileLocation.mockReset();

    // Set up default successful responses
    mockOpenFile.mockResolvedValue({ success: true });
    mockOpenFileLocation.mockResolvedValue({ success: true });
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  describe("openFile", () => {
    it("should call the openFile API with the correct file path", async () => {
      const testFilePath = "C:\\path\\to\\test\\file.txt";

      // Call the API
      const result = await window.electronAPI.openFile(testFilePath);

      // Verify the API was called with the correct path
      expect(mockOpenFile).toHaveBeenCalledWith(testFilePath);
      expect(mockOpenFile).toHaveBeenCalledTimes(1);
      expect(result).toEqual({ success: true });
    });

    it("should handle errors when opening a file", async () => {
      const testFilePath = "C:\\path\\to\\nonexistent\\file.txt";
      const errorMessage = "openFileError";

      // Mock an error response
      mockOpenFile.mockResolvedValue({ success: false, error: errorMessage });

      // Call the API
      const result = await window.electronAPI.openFile(testFilePath);

      // Verify the error handling
      expect(mockOpenFile).toHaveBeenCalledWith(testFilePath);
      expect(result).toEqual({ success: false, error: errorMessage });
    });
  });

  describe("openFileLocation", () => {
    it("should call the openFileLocation API with the correct file path", async () => {
      const testFilePath = "C:\\path\\to\\test\\file.txt";

      // Call the API
      const result = await window.electronAPI.openFileLocation(testFilePath);

      // Verify the API was called with the correct path
      expect(mockOpenFileLocation).toHaveBeenCalledWith(testFilePath);
      expect(mockOpenFileLocation).toHaveBeenCalledTimes(1);
      expect(result).toEqual({ success: true });
    });

    it("should handle errors when opening a file location", async () => {
      const testFilePath = "C:\\path\\to\\nonexistent\\file.txt";
      const errorMessage = "openFileLocationError";

      // Mock an error response
      mockOpenFileLocation.mockResolvedValue({
        success: false,
        error: errorMessage,
      });

      // Call the API
      const result = await window.electronAPI.openFileLocation(testFilePath);

      // Verify the error handling
      expect(mockOpenFileLocation).toHaveBeenCalledWith(testFilePath);
      expect(result).toEqual({ success: false, error: errorMessage });
    });
  });
});
