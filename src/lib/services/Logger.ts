/**
 * Logger Service
 *
 * Provides standardized logging functionality for the application.
 */

import { isDev } from "../utils/common.js";

/**
 * Log level enumeration
 */
export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
  NONE = 4,
}

/**
 * Logger configuration
 */
export interface LoggerConfig {
  level: LogLevel;
  includeTimestamp: boolean;
  logToConsole: boolean;
  logToFile: boolean;
  logFilePath?: string;
}

/**
 * Logger service for standardized logging
 */
export class Logger {
  private static instance: Logger;
  private config: LoggerConfig;

  /**
   * Get the singleton instance
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
  private constructor() {
    // Default configuration
    this.config = {
      level: isDev() ? LogLevel.DEBUG : LogLevel.INFO,
      includeTimestamp: true,
      logToConsole: true,
      logToFile: false,
    };
  }

  /**
   * Configure the logger
   * @param config Logger configuration
   */
  public configure(config: Partial<LoggerConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Set the log level
   * @param level Log level
   */
  public setLevel(level: LogLevel): void {
    this.config.level = level;
  }

  /**
   * Log a debug message
   * @param message Message to log
   * @param context Optional context object
   */
  public debug(message: string, context?: unknown): void {
    this.log(LogLevel.DEBUG, message, context);
  }

  /**
   * Log an info message
   * @param message Message to log
   * @param context Optional context object
   */
  public info(message: string, context?: unknown): void {
    this.log(LogLevel.INFO, message, context);
  }

  /**
   * Log a warning message
   * @param message Message to log
   * @param context Optional context object
   */
  public warn(message: string, context?: unknown): void {
    this.log(LogLevel.WARN, message, context);
  }

  /**
   * Log an error message
   * @param message Message to log
   * @param error Error object or context
   */
  public error(message: string, error?: unknown): void {
    this.log(LogLevel.ERROR, message, error);
  }

  /**
   * Log a message with the specified level
   * @param level Log level
   * @param message Message to log
   * @param context Optional context object
   */
  private log(level: LogLevel, message: string, context?: unknown): void {
    if (level < this.config.level) {
      return; // Skip logging if level is below configured level
    }

    const timestamp = this.config.includeTimestamp
      ? new Date().toISOString()
      : "";
    const levelString = LogLevel[level];

    let formattedMessage = `[${levelString}]`;
    if (timestamp) {
      formattedMessage = `${timestamp} ${formattedMessage}`;
    }
    formattedMessage = `${formattedMessage} ${message}`;

    if (this.config.logToConsole) {
      this.logToConsole(level, formattedMessage, context);
    }

    if (this.config.logToFile && this.config.logFilePath) {
      this.logToFile(formattedMessage, context);
    }
  }

  /**
   * Log to the console
   * @param level Log level
   * @param message Formatted message
   * @param context Optional context object
   */
  private logToConsole(
    level: LogLevel,
    message: string,
    context?: unknown
  ): void {
    switch (level) {
      case LogLevel.DEBUG:
        if (context) {
          console.debug(message, context);
        } else {
          console.debug(message);
        }
        break;
      case LogLevel.INFO:
        if (context) {
          console.info(message, context);
        } else {
          console.info(message);
        }
        break;
      case LogLevel.WARN:
        if (context) {
          console.warn(message, context);
        } else {
          console.warn(message);
        }
        break;
      case LogLevel.ERROR:
        if (context) {
          console.error(message, context);
        } else {
          console.error(message);
        }
        break;
    }
  }

  /**
   * Log to a file (not implemented yet)
   * @param message Formatted message
   * @param context Optional context object
   */
  private logToFile(message: string, context?: unknown): void {
    // TODO: Implement file logging
    // This would typically use fs.appendFile to write to the log file
  }
}
