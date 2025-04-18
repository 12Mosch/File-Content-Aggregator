/**
 * Configuration Service
 *
 * Provides centralized configuration management for the application.
 */

import { AppError } from "../errors.js";
import { safeJsonParse, safeJsonStringify } from "../utils/common.js";

/**
 * Configuration service for centralized configuration management
 */
export class ConfigService {
  private static instance: ConfigService;
  private config: Record<string, unknown> = {};
  private defaults: Record<string, unknown> = {};

  /**
   * Get the singleton instance
   */
  public static getInstance(): ConfigService {
    if (!ConfigService.instance) {
      ConfigService.instance = new ConfigService();
    }
    return ConfigService.instance;
  }

  /**
   * Private constructor (use getInstance)
   */
  private constructor() {
    // Initialize with default configuration
    this.initDefaults();
  }

  /**
   * Initialize default configuration values
   */
  private initDefaults(): void {
    this.defaults = {
      // General settings
      "general.language": "en",
      "general.theme": "system",
      "general.exportFormat": "json",

      // Search settings
      "search.fuzzySearchEnabled": true,
      "search.fuzzySearchThreshold": 0.6,
      "search.fuzzySearchBooleanEnabled": true,
      "search.fuzzySearchNearEnabled": true,
      "search.wholeWordMatchingEnabled": false,
      "search.maxResults": 1000,
      "search.maxContextLength": 100,

      // Cache settings
      "cache.searchResultsMaxSize": 50,
      "cache.searchResultsTTL": 1800000, // 30 minutes
      "cache.fileContentMaxSize": 100,
      "cache.fileContentTTL": 300000, // 5 minutes
      "cache.highlightMaxSize": 200,
      "cache.uiStateMaxSize": 20,

      // UI settings
      "ui.resultsViewMode": "tree",
      "ui.showLineNumbers": true,
      "ui.expandAllByDefault": false,
      "ui.filterDebounceDelay": 300,

      // Performance settings
      "performance.workerPoolSize": 4,
      "performance.maxConcurrentSearches": 2,
      "performance.searchTimeout": 30000, // 30 seconds
    };

    // Initialize config with defaults
    this.config = { ...this.defaults };
  }

  /**
   * Get a configuration value
   * @param key Configuration key
   * @param defaultValue Default value if not found
   * @returns Configuration value
   */
  public get<T>(key: string, defaultValue?: T): T {
    const value = this.config[key];

    if (value === undefined) {
      if (defaultValue !== undefined) {
        return defaultValue;
      }

      const defaultFromDefaults = this.defaults[key] as T;
      if (defaultFromDefaults !== undefined) {
        return defaultFromDefaults;
      }

      throw AppError.configError(`Configuration key not found: ${key}`);
    }

    return value as T;
  }

  /**
   * Set a configuration value
   * @param key Configuration key
   * @param value Configuration value
   */
  public set<T>(key: string, value: T): void {
    this.config[key] = value;
  }

  /**
   * Check if a configuration key exists
   * @param key Configuration key
   * @returns True if the key exists
   */
  public has(key: string): boolean {
    return this.config[key] !== undefined;
  }

  /**
   * Reset a configuration value to its default
   * @param key Configuration key
   * @returns True if the key was reset
   */
  public reset(key: string): boolean {
    if (this.defaults[key] !== undefined) {
      this.config[key] = this.defaults[key];
      return true;
    }
    return false;
  }

  /**
   * Reset all configuration values to defaults
   */
  public resetAll(): void {
    this.config = { ...this.defaults };
  }

  /**
   * Get all configuration values
   * @returns All configuration values
   */
  public getAll(): Record<string, unknown> {
    return { ...this.config };
  }

  /**
   * Load configuration from JSON
   * @param json JSON string
   * @returns True if the configuration was loaded
   */
  public loadFromJson(json: string): boolean {
    try {
      const parsed = safeJsonParse<Record<string, unknown>>(json, {});
      this.config = { ...this.defaults, ...parsed };
      return true;
    } catch (error) {
      throw AppError.configError(
        "Failed to load configuration from JSON",
        error
      );
    }
  }

  /**
   * Save configuration to JSON
   * @returns JSON string
   */
  public saveToJson(): string {
    return safeJsonStringify(this.config);
  }

  /**
   * Get a section of the configuration
   * @param section Section prefix
   * @returns Section configuration
   */
  public getSection(section: string): Record<string, unknown> {
    const result: Record<string, unknown> = {};
    const prefix = section.endsWith(".") ? section : `${section}.`;

    for (const [key, value] of Object.entries(this.config)) {
      if (key.startsWith(prefix)) {
        const shortKey = key.substring(prefix.length);
        result[shortKey] = value;
      }
    }

    return result;
  }

  /**
   * Set a section of the configuration
   * @param section Section prefix
   * @param values Section configuration
   */
  public setSection(section: string, values: Record<string, unknown>): void {
    const prefix = section.endsWith(".") ? section : `${section}.`;

    for (const [key, value] of Object.entries(values)) {
      this.config[`${prefix}${key}`] = value;
    }
  }
}
