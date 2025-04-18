/**
 * Mock implementation of SearchService
 */

import { EventEmitter } from "events";

// Define the search event types
export enum SearchEventType {
  PROGRESS = "progress",
  RESULT = "result",
  ERROR = "error",
  CANCELLED = "cancelled",
}

// Mock implementation of SearchService
export class SearchService extends EventEmitter {
  private static instance: SearchService;
  private isSearching = false;
  private cancellationToken: { cancelled: boolean } = { cancelled: false };

  private constructor() {
    super();
  }

  public static getInstance(): SearchService {
    if (!SearchService.instance) {
      SearchService.instance = new SearchService();
    }
    return SearchService.instance;
  }

  public async search(params: any): Promise<any> {
    this.isSearching = true;
    this.cancellationToken = { cancelled: false };

    try {
      // Simulate a search
      this.emit(SearchEventType.PROGRESS, { filesProcessed: 1, totalFiles: 10 });
      
      // Return mock results
      const result = {
        matches: [],
        totalFiles: 10,
        matchedFiles: 5,
        processingTimeMs: 100,
      };
      
      this.emit(SearchEventType.RESULT, result);
      this.isSearching = false;
      return result;
    } catch (error) {
      this.emit(SearchEventType.ERROR, error);
      this.isSearching = false;
      throw error;
    }
  }

  public cancelSearch(): void {
    if (this.isSearching) {
      this.cancellationToken.cancelled = true;
      this.emit(SearchEventType.CANCELLED);
      this.isSearching = false;
    }
  }

  public isCurrentlySearching(): boolean {
    return this.isSearching;
  }
}

export default SearchService;
