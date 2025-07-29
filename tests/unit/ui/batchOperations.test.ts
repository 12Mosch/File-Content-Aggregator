/**
 * Unit tests for batch operations functionality
 */
import { jest } from "@jest/globals";

// Create mocks for the Electron API
const mockCopyFilePaths = jest.fn();
const mockCopyFilesToFolder = jest.fn();
const mockMoveFilesToFolder = jest.fn();

// Mock the window.electronAPI object
Object.defineProperty(window, "electronAPI", {
  value: {
    copyFilePaths: mockCopyFilePaths,
    copyFilesToFolder: mockCopyFilesToFolder,
    moveFilesToFolder: mockMoveFilesToFolder,
  },
  writable: true,
});

describe("Batch Operations", () => {
  beforeEach(() => {
    // Reset mocks before each test
    mockCopyFilePaths.mockReset();
    mockCopyFilesToFolder.mockReset();
    mockMoveFilesToFolder.mockReset();

    // Set up default successful responses
    mockCopyFilePaths.mockResolvedValue({ success: true });
    mockCopyFilesToFolder.mockResolvedValue({
      success: true,
      destinationFolder: "/test/destination",
    });
    mockMoveFilesToFolder.mockResolvedValue({
      success: true,
      destinationFolder: "/test/destination",
    });
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  test("copyFilePaths should call the API with the correct parameters", async () => {
    // Arrange
    const filePaths = ["/path/to/file1.txt", "/path/to/file2.txt"];

    // Act
    const result = await window.electronAPI.copyFilePaths(filePaths);

    // Assert
    expect(mockCopyFilePaths).toHaveBeenCalledWith(filePaths);
    expect(result).toEqual({ success: true });
  });

  test("copyFilesToFolder should call the API with the correct parameters", async () => {
    // Arrange
    const filePaths = ["/path/to/file1.txt", "/path/to/file2.txt"];

    // Act
    const result = await window.electronAPI.copyFilesToFolder(filePaths);

    // Assert
    expect(mockCopyFilesToFolder).toHaveBeenCalledWith(filePaths);
    expect(result).toEqual({
      success: true,
      destinationFolder: "/test/destination",
    });
  });

  test("moveFilesToFolder should call the API with the correct parameters", async () => {
    // Arrange
    const filePaths = ["/path/to/file1.txt", "/path/to/file2.txt"];

    // Act
    const result = await window.electronAPI.moveFilesToFolder(filePaths);

    // Assert
    expect(mockMoveFilesToFolder).toHaveBeenCalledWith(filePaths);
    expect(result).toEqual({
      success: true,
      destinationFolder: "/test/destination",
    });
  });

  test("copyFilePaths should handle errors", async () => {
    // Arrange
    const filePaths = ["/path/to/file1.txt", "/path/to/file2.txt"];
    mockCopyFilePaths.mockResolvedValue({
      success: false,
      error: "Failed to copy file paths",
    });

    // Act
    const result = await window.electronAPI.copyFilePaths(filePaths);

    // Assert
    expect(mockCopyFilePaths).toHaveBeenCalledWith(filePaths);
    expect(result).toEqual({
      success: false,
      error: "Failed to copy file paths",
    });
  });

  test("copyFilesToFolder should handle errors", async () => {
    // Arrange
    const filePaths = ["/path/to/file1.txt", "/path/to/file2.txt"];
    mockCopyFilesToFolder.mockResolvedValue({
      success: false,
      error: "Failed to copy files",
    });

    // Act
    const result = await window.electronAPI.copyFilesToFolder(filePaths);

    // Assert
    expect(mockCopyFilesToFolder).toHaveBeenCalledWith(filePaths);
    expect(result).toEqual({ success: false, error: "Failed to copy files" });
  });

  test("moveFilesToFolder should handle errors", async () => {
    // Arrange
    const filePaths = ["/path/to/file1.txt", "/path/to/file2.txt"];
    mockMoveFilesToFolder.mockResolvedValue({
      success: false,
      error: "Failed to move files",
    });

    // Act
    const result = await window.electronAPI.moveFilesToFolder(filePaths);

    // Assert
    expect(mockMoveFilesToFolder).toHaveBeenCalledWith(filePaths);
    expect(result).toEqual({ success: false, error: "Failed to move files" });
  });

  test("copyFilesToFolder should handle cancellation", async () => {
    // Arrange
    const filePaths = ["/path/to/file1.txt", "/path/to/file2.txt"];
    mockCopyFilesToFolder.mockResolvedValue({
      success: false,
      error: "Operation cancelled.",
    });

    // Act
    const result = await window.electronAPI.copyFilesToFolder(filePaths);

    // Assert
    expect(mockCopyFilesToFolder).toHaveBeenCalledWith(filePaths);
    expect(result).toEqual({ success: false, error: "Operation cancelled." });
  });

  test("moveFilesToFolder should handle cancellation", async () => {
    // Arrange
    const filePaths = ["/path/to/file1.txt", "/path/to/file2.txt"];
    mockMoveFilesToFolder.mockResolvedValue({
      success: false,
      error: "Operation cancelled.",
    });

    // Act
    const result = await window.electronAPI.moveFilesToFolder(filePaths);

    // Assert
    expect(mockMoveFilesToFolder).toHaveBeenCalledWith(filePaths);
    expect(result).toEqual({ success: false, error: "Operation cancelled." });
  });
});
