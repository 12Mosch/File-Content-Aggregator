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
  public debug(message: string, metadata?: any): void {
    // No-op in tests
  }

  /**
   * Log an info message
   */
  public info(message: string, metadata?: any): void {
    // No-op in tests
  }

  /**
   * Log a warning message
   */
  public warn(message: string, metadata?: any): void {
    // No-op in tests
  }

  /**
   * Log an error message
   */
  public error(message: string, metadata?: any): void {
    // No-op in tests
  }
}
