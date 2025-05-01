/**
 * Unit tests for the ErrorHandlingService
 */

import {
  ErrorHandlingService,
  ErrorSeverity,
  getErrorHandler,
} from "../../../src/lib/services/ErrorHandlingService";
import { AppError } from "../../../src/lib/errors";

// Mock the Logger
const mockDebug = jest.fn();
const mockInfo = jest.fn();
const mockWarn = jest.fn();
const mockError = jest.fn();

jest.mock("../../../src/lib/services/Logger", () => ({
  Logger: {
    getInstance: jest.fn(() => ({
      debug: mockDebug,
      info: mockInfo,
      warn: mockWarn,
      error: mockError,
    })),
  },
}));

// Mock the isDev utility
jest.mock("../../../src/lib/utils/common", () => ({
  isDev: jest.fn(() => false),
}));

describe("ErrorHandlingService", () => {
  let errorHandler: ErrorHandlingService;

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();
    mockDebug.mockClear();
    mockInfo.mockClear();
    mockWarn.mockClear();
    mockError.mockClear();

    // Get a fresh instance for each test
    errorHandler = ErrorHandlingService.getInstance();
  });

  describe("getInstance", () => {
    it("returns a singleton instance", () => {
      const instance1 = ErrorHandlingService.getInstance();
      const instance2 = ErrorHandlingService.getInstance();

      expect(instance1).toBe(instance2);
    });
  });

  describe("handleError", () => {
    it("handles Error objects", () => {
      const error = new Error("Test error");
      errorHandler.handleError(error);

      // Should log at medium severity by default
      expect(mockInfo).toHaveBeenCalled();
    });

    it("handles AppError objects", () => {
      const error = new AppError("Test error", "TEST_ERROR");
      errorHandler.handleError(error);

      expect(mockInfo).toHaveBeenCalled();
    });

    it("handles non-Error objects", () => {
      const error = "String error";
      errorHandler.handleError(error);

      expect(mockInfo).toHaveBeenCalled();
    });

    it("respects severity levels", () => {
      const error = new Error("Test error");

      errorHandler.handleError(error, { severity: ErrorSeverity.LOW });
      expect(mockDebug).toHaveBeenCalled();

      errorHandler.handleError(error, { severity: ErrorSeverity.MEDIUM });
      expect(mockInfo).toHaveBeenCalled();

      errorHandler.handleError(error, { severity: ErrorSeverity.HIGH });
      expect(mockWarn).toHaveBeenCalled();

      errorHandler.handleError(error, { severity: ErrorSeverity.CRITICAL });
      expect(mockError).toHaveBeenCalled();
    });

    it("includes context in log messages", () => {
      const error = new Error("Test error");
      const context = {
        component: "TestComponent",
        operation: "testOperation",
        data: { test: "data" },
      };

      errorHandler.handleError(error, { context });

      // Check that the context was included in the log message
      expect(mockInfo).toHaveBeenCalledWith(
        expect.stringContaining("[TestComponent]"),
        expect.objectContaining({ context })
      );
    });

    it("tracks error counts", () => {
      const error1 = new AppError("Error 1", "ERROR_1");
      const error2 = new AppError("Error 2", "ERROR_2");

      errorHandler.handleError(error1);
      errorHandler.handleError(error1);
      errorHandler.handleError(error2);

      const stats = errorHandler.getErrorStats();
      expect(stats.ERROR_1).toBe(2);
      expect(stats.ERROR_2).toBe(1);
    });

    it("notifies listeners", () => {
      const listener = jest.fn();
      const error = new Error("Test error");

      errorHandler.addListener(listener);
      errorHandler.handleError(error);

      expect(listener).toHaveBeenCalledWith(error, expect.any(Object));

      // Remove the listener and verify it's not called
      errorHandler.removeListener(listener);
      errorHandler.handleError(error);

      expect(listener).toHaveBeenCalledTimes(1);
    });
  });

  describe("wrapWithErrorHandler", () => {
    it("wraps a function with error handling", () => {
      const mockFn = jest.fn(() => "result");
      const wrappedFn = errorHandler.wrapWithErrorHandler(mockFn);

      const result = wrappedFn("arg1", "arg2");

      expect(mockFn).toHaveBeenCalledWith("arg1", "arg2");
      expect(result).toBe("result");
    });

    it("handles errors in wrapped functions", () => {
      const error = new Error("Function error");
      const mockFn = jest.fn(() => {
        throw error;
      });

      const wrappedFn = errorHandler.wrapWithErrorHandler(mockFn);

      expect(() => wrappedFn()).toThrow(error);
      expect(mockInfo).toHaveBeenCalled();
    });
  });

  describe("wrapWithAsyncErrorHandler", () => {
    it("wraps an async function with error handling", async () => {
      const mockFn = jest.fn().mockResolvedValue("async result");
      const wrappedFn = errorHandler.wrapWithAsyncErrorHandler(mockFn);

      const result = await wrappedFn("arg1", "arg2");

      expect(mockFn).toHaveBeenCalledWith("arg1", "arg2");
      expect(result).toBe("async result");
    });

    it("handles errors in wrapped async functions", async () => {
      const error = new Error("Async function error");
      const mockFn = jest.fn().mockRejectedValue(error);

      const wrappedFn = errorHandler.wrapWithAsyncErrorHandler(mockFn);

      await expect(wrappedFn()).rejects.toThrow(error);
      expect(mockInfo).toHaveBeenCalled();
    });
  });

  describe("getErrorHandler", () => {
    it("returns the singleton instance", () => {
      const handler = getErrorHandler();
      expect(handler).toBe(ErrorHandlingService.getInstance());
    });
  });
});
