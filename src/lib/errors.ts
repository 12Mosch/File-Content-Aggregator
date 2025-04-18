/**
 * Application Error Classes
 *
 * Standardized error classes for the application.
 * These provide consistent error handling and reporting.
 */

/**
 * Base application error class
 */
export class AppError extends Error {
  /**
   * Create a new application error
   * @param message Error message
   * @param code Error code for categorization
   * @param details Additional error details
   */
  constructor(
    message: string,
    public readonly code: string,
    public readonly details?: unknown
  ) {
    super(message);
    this.name = "AppError";

    // Ensure proper prototype chain for instanceof checks
    Object.setPrototypeOf(this, AppError.prototype);
  }

  /**
   * Create a file not found error
   * @param path File path
   * @returns AppError instance
   */
  static fileNotFound(path: string): AppError {
    return new AppError(`File not found: ${path}`, "FILE_NOT_FOUND", { path });
  }

  /**
   * Create a file access error
   * @param path File path
   * @param details Error details
   * @returns AppError instance
   */
  static fileAccessError(path: string, details?: unknown): AppError {
    return new AppError(`Cannot access file: ${path}`, "FILE_ACCESS_ERROR", {
      path,
      details,
    });
  }

  /**
   * Create a search error
   * @param message Error message
   * @param details Error details
   * @returns AppError instance
   */
  static searchError(message: string, details?: unknown): AppError {
    return new AppError(message, "SEARCH_ERROR", details);
  }

  /**
   * Create a regex error
   * @param pattern Regex pattern
   * @param details Error details
   * @returns AppError instance
   */
  static regexError(pattern: string, details?: unknown): AppError {
    return new AppError(`Invalid regex pattern: ${pattern}`, "REGEX_ERROR", {
      pattern,
      details,
    });
  }

  /**
   * Create a parsing error
   * @param expression Expression that failed to parse
   * @param details Error details
   * @returns AppError instance
   */
  static parsingError(expression: string, details?: unknown): AppError {
    return new AppError(
      `Failed to parse expression: ${expression}`,
      "PARSING_ERROR",
      { expression, details }
    );
  }

  /**
   * Create a configuration error
   * @param message Error message
   * @param details Error details
   * @returns AppError instance
   */
  static configError(message: string, details?: unknown): AppError {
    return new AppError(
      `Configuration error: ${message}`,
      "CONFIG_ERROR",
      details
    );
  }

  /**
   * Create a timeout error
   * @param operation Operation that timed out
   * @param timeoutMs Timeout in milliseconds
   * @returns AppError instance
   */
  static timeoutError(operation: string, timeoutMs: number): AppError {
    return new AppError(
      `Operation timed out: ${operation} (${timeoutMs}ms)`,
      "TIMEOUT_ERROR",
      { operation, timeoutMs }
    );
  }

  /**
   * Create a cancellation error
   * @param operation Operation that was cancelled
   * @returns AppError instance
   */
  static cancellationError(operation: string): AppError {
    return new AppError(
      `Operation cancelled: ${operation}`,
      "CANCELLATION_ERROR",
      { operation }
    );
  }

  /**
   * Create a validation error
   * @param message Error message
   * @param field Field that failed validation
   * @param value Invalid value
   * @returns AppError instance
   */
  static validationError(
    message: string,
    field?: string,
    value?: unknown
  ): AppError {
    return new AppError(`Validation error: ${message}`, "VALIDATION_ERROR", {
      field,
      value,
    });
  }

  /**
   * Convert an unknown error to an AppError
   * @param error Unknown error
   * @param defaultMessage Default message if error is not an Error instance
   * @returns AppError instance
   */
  static fromUnknown(
    error: unknown,
    defaultMessage = "An unknown error occurred"
  ): AppError {
    if (error instanceof AppError) {
      return error;
    }

    if (error instanceof Error) {
      return new AppError(error.message, "UNKNOWN_ERROR", {
        originalError: error,
      });
    }

    return new AppError(defaultMessage, "UNKNOWN_ERROR", {
      originalError: error,
    });
  }
}
