/**
 * File Search Service Facade
 *
 * This facade provides backward compatibility with the original FileSearchService API
 * while using the optimized implementation internally.
 */

import { OptimizedFileSearchService } from "./services/OptimizedFileSearchService.js";
import {
  SearchParams,
  SearchResult,
  ProgressCallback,
  CancellationChecker,
} from "./types.js";

// Get the optimized service instance
const optimizedService = OptimizedFileSearchService.getInstance();

// Global search settings for backward compatibility
let fuzzySearchBooleanEnabled = true;
let fuzzySearchNearEnabled = true;
let wholeWordMatchingEnabled = false;

/**
 * Updates the search settings
 * @param booleanEnabled Whether fuzzy search is enabled for boolean queries
 * @param nearEnabled Whether fuzzy search is enabled for NEAR operator
 * @param wholeWordEnabled Whether whole word matching is enabled
 */
export function updateSearchSettings(
  booleanEnabled: boolean,
  nearEnabled: boolean,
  wholeWordEnabled: boolean
): void {
  // Update local variables for backward compatibility
  fuzzySearchBooleanEnabled = booleanEnabled;
  fuzzySearchNearEnabled = nearEnabled;
  wholeWordMatchingEnabled = wholeWordEnabled;

  // Update the optimized service
  optimizedService.updateSearchSettings(booleanEnabled, nearEnabled, wholeWordEnabled);
}

/**
 * Legacy function for backward compatibility
 * @param booleanEnabled Whether fuzzy search is enabled for boolean queries
 * @param nearEnabled Whether fuzzy search is enabled for NEAR operator
 */
export function updateFuzzySearchSettings(
  booleanEnabled: boolean,
  nearEnabled: boolean
): void {
  // Call the new function with the current value of wholeWordMatchingEnabled
  updateSearchSettings(booleanEnabled, nearEnabled, wholeWordMatchingEnabled);
}

/**
 * Main search function
 * @param params Search parameters
 * @param progressCallback Callback for progress updates
 * @param checkCancellation Function to check if the search should be cancelled
 * @returns Search results
 */
export async function searchFiles(
  params: SearchParams,
  progressCallback: ProgressCallback,
  checkCancellation: CancellationChecker
): Promise<SearchResult> {
  // Delegate to the optimized service
  return optimizedService.searchFiles(params, progressCallback, checkCancellation);
}
