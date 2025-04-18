/**
 * Mock implementation of FileSearchService
 */

import { SearchParams, SearchResult } from "../../../src/electron/types/search";

// Mock search files function
export async function searchFiles(
  params: SearchParams,
  progressCallback?: (progress: any) => void,
  checkCancellation?: () => boolean
): Promise<any> {
  // Check if the search should be cancelled
  if (checkCancellation && checkCancellation()) {
    if (progressCallback) {
      progressCallback({ status: "cancelled" });
    }
    // Return an object with all the expected properties
    return {
      wasCancelled: true,
      structuredItems: [],
      filesFound: 0,
      filesProcessed: 0,
      errorsEncountered: 0,
      pathErrors: [],
    };
  }

  // Handle invalid regex pattern
  if (
    params.contentSearchTerm === "invalid regex" &&
    params.contentSearchMode === "regex"
  ) {
    return {
      filesFound: 2,
      filesProcessed: 0,
      errorsEncountered: 1,
      pathErrors: ["Invalid regex pattern"],
      structuredItems: [],
    };
  }

  // Default successful search
  return {
    filesFound: 2,
    filesProcessed: 2,
    errorsEncountered: 0,
    pathErrors: [],
    structuredItems: [
      { matched: true, filePath: "/test/file1.txt" },
      { matched: false, filePath: "/test/file2.txt" },
    ],
  };
}

// Mock update search settings function
export function updateSearchSettings(
  booleanEnabled: boolean,
  nearEnabled: boolean,
  wholeWordEnabled: boolean
): void {
  console.log(
    `Search settings updated: Boolean=${booleanEnabled}, NEAR=${nearEnabled}, WholeWord=${wholeWordEnabled}`
  );
}

// Mock update fuzzy search settings function
export function updateFuzzySearchSettings(settings: any): void {
  // Do nothing in the mock
}

// Export default object
export default {
  searchFiles,
  updateSearchSettings,
  updateFuzzySearchSettings,
};
