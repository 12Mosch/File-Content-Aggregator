/**
 * Services index file
 *
 * Exports all services for easy importing
 */

export {
  FuzzySearchService,
  type FuzzySearchOptions,
  type FuzzySearchResult,
} from "./FuzzySearchService.js";
export {
  WordBoundaryService,
  type WordBoundary,
} from "./WordBoundaryService.js";
export {
  NearOperatorService,
  type NearOperatorOptions,
} from "./NearOperatorService.js";
export {
  FileProcessingService,
  type FileProcessingOptions,
  type FileReadResult,
  type StreamProcessResult,
  type FileStats,
} from "./FileProcessingService.js";
export {
  ContentMatchingService,
  type ContentSearchMode,
  type ContentMatchingOptions,
  type MatchResult,
} from "./ContentMatchingService.js";
export {
  SearchResultProcessor,
  type SearchResultOptions,
  type ProcessedResult,
} from "./SearchResultProcessor.js";
export {
  FileDiscoveryService,
  type FileDiscoveryOptions,
  type FolderExclusionMode,
  type PathErrorDetail,
  type ProgressCallback,
  type CancellationChecker,
} from "./FileDiscoveryService.js";
