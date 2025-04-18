/**
 * Mock implementation of Logger for testing
 */

export class Logger {
  private static instance: Logger;

  /**
   * Gets the singleton instance of Logger
   */
  public static getInstance(): Logger {
    if (!Logger.instance) {
      Logger.instance = new Logger();
    }
    return Logger.instance;
  }

  /**
   * Private constructor (use getInstance)
   */
  private constructor() {}

  /**
   * Log a debug message
   */
  public debug(_message: string, _metadata?: unknown): void {
    // No-op in tests
  }

  /**
   * Log an info message
   */
  public info(_message: string, _metadata?: unknown): void {
    // No-op in tests
  }

  /**
   * Log a warning message
   */
  public warn(_message: string, _metadata?: unknown): void {
    // No-op in tests
  }

  /**
   * Log an error message
   */
  public error(_message: string, _metadata?: unknown): void {
    // No-op in tests
  }
}
