/**
 * Error Handling Service
 *
 * Provides centralized error handling functionality for the application.
 * This service standardizes how errors are caught, logged, and presented to users.
 */

import { AppError } from "../errors.js";
import { Logger } from "./Logger.js";
import { isDev } from "../utils/common.js";

/**
 * Error severity levels
 */
export enum ErrorSeverity {
  LOW = "low", // Minor issues that don't affect functionality
  MEDIUM = "medium", // Issues that affect some functionality but app can continue
  HIGH = "high", // Serious issues that significantly impact functionality
  CRITICAL = "critical", // Fatal errors that prevent the app from functioning
}

/**
 * Error context information
 */
export interface ErrorContext {
  component?: string; // Component where the error occurred
  operation?: string; // Operation being performed when the error occurred
  data?: unknown; // Data related to the error
  userId?: string; // User identifier (if applicable)
  sessionId?: string; // Session identifier (if applicable)
  timestamp?: number; // Error timestamp
}

/**
 * Error handling options
 */
export interface ErrorHandlingOptions {
  severity?: ErrorSeverity;
  context?: ErrorContext;
  showToUser?: boolean; // Whether to show the error to the user
  reportToSystem?: boolean; // Whether to report the error to the system
}

/**
 * Error handling service for centralized error management
 */
export class ErrorHandlingService {
  private static instance: ErrorHandlingService;
  private logger: Logger;
  private errorListeners: Array<
    (error: Error, options?: ErrorHandlingOptions) => void
  > = [];
  private errorCount: Record<string, number> = {}; // Track error occurrences by code

  /**
   * Get the singleton instance
   */
  public static getInstance(): ErrorHandlingService {
    if (!ErrorHandlingService.instance) {
      ErrorHandlingService.instance = new ErrorHandlingService();
    }
    return ErrorHandlingService.instance;
  }

  /**
   * Private constructor (use getInstance)
   */
  private constructor() {
    this.logger = Logger.getInstance();
  }

  /**
   * Handle an error
   * @param error Error to handle
   * @param options Error handling options
   * @returns The handled error (for chaining)
   */
  public handleError(error: unknown, options?: ErrorHandlingOptions): Error {
    // Convert to AppError if not already
    const appError = this.normalizeError(error);

    // Set default options
    const opts: ErrorHandlingOptions = {
      severity: ErrorSeverity.MEDIUM,
      showToUser: true,
      reportToSystem: true,
      ...options,
    };

    // Add timestamp to context if not present
    if (opts.context && !opts.context.timestamp) {
      opts.context.timestamp = Date.now();
    }

    // Track error count
    const errorCode =
      appError instanceof AppError ? appError.code : "UNKNOWN_ERROR";
    this.errorCount[errorCode] = (this.errorCount[errorCode] || 0) + 1;

    // Log the error
    this.logError(appError, opts);

    // Notify listeners
    this.notifyListeners(appError, opts);

    return appError;
  }

  /**
   * Add an error listener
   * @param listener Function to call when an error is handled
   */
  public addListener(
    listener: (error: Error, options?: ErrorHandlingOptions) => void
  ): void {
    this.errorListeners.push(listener);
  }

  /**
   * Remove an error listener
   * @param listener Listener to remove
   */
  public removeListener(
    listener: (error: Error, options?: ErrorHandlingOptions) => void
  ): void {
    this.errorListeners = this.errorListeners.filter((l) => l !== listener);
  }

  /**
   * Get error statistics
   * @returns Error count by error code
   */
  public getErrorStats(): Record<string, number> {
    return { ...this.errorCount };
  }

  /**
   * Reset error statistics
   */
  public resetErrorStats(): void {
    this.errorCount = {};
  }

  /**
   * Normalize an error to an AppError
   * @param error Error to normalize
   * @returns Normalized AppError
   */
  private normalizeError(error: unknown): Error {
    if (error instanceof Error) {
      return error instanceof AppError ? error : AppError.fromUnknown(error);
    }
    return AppError.fromUnknown(error);
  }

  /**
   * Log an error
   * @param error Error to log
   * @param options Error handling options
   */
  private logError(error: Error, options: ErrorHandlingOptions): void {
    const { severity, context } = options;

    // Create log message
    const component = context?.component ? `[${context.component}] ` : "";
    const operation = context?.operation ? `during ${context.operation} ` : "";
    const message = `${component}Error ${operation}${error.message}`;

    // Log based on severity
    switch (severity) {
      case ErrorSeverity.LOW:
        this.logger.debug(message, { error, context });
        break;
      case ErrorSeverity.MEDIUM:
        this.logger.info(message, { error, context });
        break;
      case ErrorSeverity.HIGH:
        this.logger.warn(message, { error, context });
        break;
      case ErrorSeverity.CRITICAL:
        this.logger.error(message, { error, context });
        break;
      default:
        this.logger.error(message, { error, context });
    }

    // In development, log additional details for debugging
    if (
      isDev() &&
      (severity === ErrorSeverity.HIGH || severity === ErrorSeverity.CRITICAL)
    ) {
      console.error("Detailed error information:", error);
      if (error.stack) {
        console.error("Stack trace:", error.stack);
      }
    }
  }

  /**
   * Notify error listeners
   * @param error Error that occurred
   * @param options Error handling options
   */
  private notifyListeners(error: Error, options: ErrorHandlingOptions): void {
    this.errorListeners.forEach((listener) => {
      try {
        listener(error, options);
      } catch (listenerError) {
        // Don't let listener errors propagate
        this.logger.error("Error in error listener", listenerError);
      }
    });
  }

  /**
   * Create a wrapped version of a function that catches and handles errors
   * @param fn Function to wrap
   * @param options Error handling options
   * @returns Wrapped function
   */
  public wrapWithErrorHandler<T extends (...args: unknown[]) => unknown>(
    fn: T,
    options?: ErrorHandlingOptions
  ): (...args: Parameters<T>) => ReturnType<T> {
    return (...args: Parameters<T>): ReturnType<T> => {
      try {
        // Type assertion needed because TypeScript can't infer that fn(...args) returns ReturnType<T>
        return fn(...args) as ReturnType<T>;
      } catch (error) {
        this.handleError(error, options);
        throw error; // Re-throw after handling
      }
    };
  }

  /**
   * Create a wrapped version of an async function that catches and handles errors
   * @param fn Async function to wrap
   * @param options Error handling options
   * @returns Wrapped async function
   */
  public wrapWithAsyncErrorHandler<
    T extends (...args: unknown[]) => Promise<unknown>,
  >(
    fn: T,
    options?: ErrorHandlingOptions
  ): (...args: Parameters<T>) => Promise<Awaited<ReturnType<T>>> {
    return async (...args: Parameters<T>): Promise<Awaited<ReturnType<T>>> => {
      try {
        // Type assertion needed because TypeScript can't infer that await fn(...args) returns Awaited<ReturnType<T>>
        return (await fn(...args)) as Awaited<ReturnType<T>>;
      } catch (error) {
        this.handleError(error, options);
        throw error; // Re-throw after handling
      }
    };
  }
}

/**
 * Get the error handling service instance
 * @returns ErrorHandlingService instance
 */
export function getErrorHandler(): ErrorHandlingService {
  return ErrorHandlingService.getInstance();
}
