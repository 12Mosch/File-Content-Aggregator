/**
 * Common Utility Functions
 *
 * Shared utility functions used throughout the application.
 */

import { AppError } from "../errors.js";

/**
 * Check if the application is running in development mode
 * @returns True if in development mode
 */
export function isDev(): boolean {
  return process.env.NODE_ENV === "development";
}

/**
 * Safely parse JSON with error handling
 * @param json JSON string to parse
 * @param defaultValue Default value to return if parsing fails
 * @returns Parsed object or default value
 */
export function safeJsonParse<T>(json: string, defaultValue: T): T {
  try {
    return JSON.parse(json) as T;
  } catch (error) {
    console.error("Failed to parse JSON:", error);
    return defaultValue;
  }
}

/**
 * Safely stringify an object to JSON with error handling
 * @param obj Object to stringify
 * @param defaultValue Default value to return if stringification fails
 * @returns JSON string or default value
 */
export function safeJsonStringify(obj: unknown, defaultValue = "{}"): string {
  try {
    return JSON.stringify(obj);
  } catch (error) {
    console.error("Failed to stringify object:", error);
    return defaultValue;
  }
}

/**
 * Debounce a function
 * @param func Function to debounce
 * @param wait Wait time in milliseconds
 * @param immediate Whether to call the function immediately
 * @returns Debounced function
 */
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number,
  immediate = false
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout | null = null;

  return function (this: any, ...args: Parameters<T>): void {
    const context = this;

    const later = function () {
      timeout = null;
      if (!immediate) func.apply(context, args);
    };

    const callNow = immediate && !timeout;

    if (timeout) clearTimeout(timeout);
    timeout = setTimeout(later, wait);

    if (callNow) func.apply(context, args);
  };
}

/**
 * Throttle a function
 * @param func Function to throttle
 * @param limit Limit in milliseconds
 * @returns Throttled function
 */
export function throttle<T extends (...args: any[]) => any>(
  func: T,
  limit: number
): (...args: Parameters<T>) => void {
  let inThrottle = false;
  let lastFunc: NodeJS.Timeout;
  let lastRan: number;

  return function (this: any, ...args: Parameters<T>): void {
    const context = this;

    if (!inThrottle) {
      func.apply(context, args);
      lastRan = Date.now();
      inThrottle = true;

      setTimeout(() => {
        inThrottle = false;
      }, limit);
    } else {
      clearTimeout(lastFunc);
      lastFunc = setTimeout(
        () => {
          if (Date.now() - lastRan >= limit) {
            func.apply(context, args);
            lastRan = Date.now();
          }
        },
        limit - (Date.now() - lastRan)
      );
    }
  };
}

/**
 * Create a unique ID
 * @param prefix Optional prefix for the ID
 * @returns Unique ID string
 */
export function uniqueId(prefix = ""): string {
  return `${prefix}${Date.now().toString(36)}${Math.random().toString(36).substring(2)}`;
}

/**
 * Format a file size in bytes to a human-readable string
 * @param bytes File size in bytes
 * @param decimals Number of decimal places
 * @returns Formatted file size string
 */
export function formatFileSize(bytes: number, decimals = 2): string {
  if (bytes === 0) return "0 Bytes";

  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ["Bytes", "KB", "MB", "GB", "TB", "PB", "EB", "ZB", "YB"];

  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + " " + sizes[i];
}

/**
 * Format a duration in milliseconds to a human-readable string
 * @param ms Duration in milliseconds
 * @returns Formatted duration string
 */
export function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;

  const seconds = Math.floor(ms / 1000);
  if (seconds < 60) return `${seconds}s`;

  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  if (minutes < 60) return `${minutes}m ${remainingSeconds}s`;

  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  return `${hours}h ${remainingMinutes}m ${remainingSeconds}s`;
}

/**
 * Safely execute a function with error handling
 * @param fn Function to execute
 * @param errorHandler Error handler function
 * @returns Function result or undefined if an error occurred
 */
export async function safeExecute<T>(
  fn: () => Promise<T> | T,
  errorHandler?: (error: unknown) => void
): Promise<T | undefined> {
  try {
    return await fn();
  } catch (error) {
    if (errorHandler) {
      errorHandler(error);
    } else {
      console.error("Error in safeExecute:", error);
    }
    return undefined;
  }
}

/**
 * Retry a function with exponential backoff
 * @param fn Function to retry
 * @param maxRetries Maximum number of retries
 * @param initialDelay Initial delay in milliseconds
 * @param maxDelay Maximum delay in milliseconds
 * @returns Function result
 */
export async function retry<T>(
  fn: () => Promise<T>,
  maxRetries = 3,
  initialDelay = 1000,
  maxDelay = 10000
): Promise<T> {
  let lastError: unknown;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;

      if (attempt === maxRetries) {
        break;
      }

      const delay = Math.min(initialDelay * Math.pow(2, attempt), maxDelay);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  throw AppError.fromUnknown(lastError, `Failed after ${maxRetries} retries`);
}

/**
 * Create a timeout promise that rejects after a specified time
 * @param ms Timeout in milliseconds
 * @param operation Operation name for the error message
 * @returns Promise that rejects after the timeout
 */
export function timeout(ms: number, operation = "operation"): Promise<never> {
  return new Promise((_, reject) => {
    setTimeout(() => {
      reject(AppError.timeoutError(operation, ms));
    }, ms);
  });
}

/**
 * Execute a function with a timeout
 * @param fn Function to execute
 * @param ms Timeout in milliseconds
 * @param operation Operation name for the error message
 * @returns Function result
 */
export async function withTimeout<T>(
  fn: () => Promise<T>,
  ms: number,
  operation = "operation"
): Promise<T> {
  return Promise.race([fn(), timeout(ms, operation)]);
}
