/**
 * Mock implementation of OptimizedFileSearchService
 */

import {
  SearchParams,
  SearchResult,
} from "../../../../src/electron/types/search";

// Mock implementation of the OptimizedFileSearchService
export class OptimizedFileSearchService {
  // Mock search method
  static async search(_params: SearchParams): Promise<SearchResult> {
    return {
      matches: [],
      totalFiles: 0,
      matchedFiles: 0,
      processingTimeMs: 0,
    };
  }

  // Mock update settings method
  static updateSettings(_settings: unknown): void {
    // Do nothing in the mock
  }
}

// Export default instance
export default OptimizedFileSearchService;
