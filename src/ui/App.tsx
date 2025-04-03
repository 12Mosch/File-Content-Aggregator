import React, { useState, useEffect, useCallback, useMemo } from "react";
import { useTranslation } from "react-i18next";
import SearchForm from "./SearchForm";
import ResultsDisplay from "./ResultsDisplay";
import ProgressBar from "./ProgressBar";
import SettingsModal from "./SettingsModal";
// Import types defined in vite-env.d.ts for API and data structures
import type {
  ProgressData,
  SearchResult,
  FileReadError,
  IElectronAPI,
} from "./vite-env.d";

// Import CSS files
import "./App.css"; // App specific styles (including settings button, view switcher)
import "./index.css"; // Global styles
import "./SettingsModal.css"; // Modal styles (ensure this is created)

// Define the shape of the search parameters used in the UI state
interface SearchParamsUI {
  searchPaths: string[];
  extensions: string[];
  excludeFiles: string[];
  excludeFolders: string[];
  folderExclusionMode?: 'contains' | 'exact' | 'startsWith' | 'endsWith';
  contentSearchTerm?: string;
  caseSensitive?: boolean;
  modifiedAfter?: string;
  modifiedBefore?: string;
  maxDepth?: number;
}

// Threshold for considering results "large" for clipboard warning
const LARGE_RESULT_LINE_THRESHOLD_APP = 100000;

// Helper type for grouping errors
type GroupedErrors = { [reasonKey: string]: string[] }; // e.g., { "readPermissionDenied": ["path1", "path2"] }

// Define type for structured items used in UI state
type StructuredResultItem = { filePath: string; content: string | null; readError?: string };

// --- New State Structure for Tree Items ---
interface ItemDisplayState {
    expanded: boolean;
    showFull: boolean; // Track if full content is shown for this item
}
// Use a Map for efficient lookups: filePath -> ItemDisplayState
type ItemDisplayStates = Map<string, ItemDisplayState>;
// -----------------------------------------


function App() {
  // --- i18n Hook ---
  const { t, i18n } = useTranslation(['common', 'errors', 'results']);

  // --- State Management ---
  const [results, setResults] = useState<string | null>(null); // Stores the aggregated file content (for text view, copy, save)
  const [structuredResults, setStructuredResults] = useState<StructuredResultItem[] | null>(null); // Stores structured data for tree view
  const [searchSummary, setSearchSummary] = useState<{
    filesFound: number;
    filesProcessed: number;
    errorsEncountered: number; // Count of file read errors
  } | null>(null); // Stores summary statistics of the search
  const [pathErrors, setPathErrors] = useState<string[]>([]); // Stores user-facing path access errors
  const [fileReadErrors, setFileReadErrors] = useState<FileReadError[]>([]); // Stores structured file read errors
  const [isLoading, setIsLoading] = useState<boolean>(false); // Tracks if a search is in progress
  const [progress, setProgress] = useState<ProgressData | null>(null); // Stores progress updates from backend
  const [generalError, setGeneralError] = useState<string | null>(null); // Stores general app/process errors
  const [isSettingsOpen, setIsSettingsOpen] = useState<boolean>(false); // Controls visibility of the settings modal
  const [viewMode, setViewMode] = useState<'text' | 'tree'>('text'); // State for results view mode ('text' or 'tree')
  // --- Updated State for Tree View ---
  const [itemDisplayStates, setItemDisplayStates] = useState<ItemDisplayStates>(new Map()); // State for expanded/showFull tree items

  // --- Memoized Grouping for File Read Errors ---
  const groupedFileReadErrors: GroupedErrors = useMemo(() => {
    return fileReadErrors.reduce((acc, error) => {
      const reasonKey = error.reason || "unknownError"; // Use key, provide fallback key
      if (!acc[reasonKey]) {
        acc[reasonKey] = []; // Initialize array for this reason if it's the first time
      }
      acc[reasonKey].push(error.filePath); // Add the file path to the group
      return acc;
    }, {} as GroupedErrors); // Start with an empty object
  }, [fileReadErrors]); // Recalculate only when fileReadErrors changes

  // --- Effect for Progress Updates ---
  useEffect(() => {
    if (window.electronAPI?.onSearchProgress) {
      console.log("UI: Subscribing to search progress");
      const unsubscribe = window.electronAPI.onSearchProgress(
        (progressData) => {
          setProgress(progressData);
        },
      );
      return () => { // Cleanup function
        console.log("UI: Unsubscribing from search progress");
        unsubscribe();
      };
    } else {
      console.warn("UI: electronAPI.onSearchProgress not found on window.");
      setGeneralError(t('errors:connectError'));
    }
  }, [t]); // Add 't' as dependency

  // --- Event Handlers ---

  // Handler for submitting the search form
  const handleSearchSubmit = useCallback(async (params: SearchParamsUI) => {
    console.log("UI: Starting search with params:", params);
    // Reset state before search
    setIsLoading(true);
    setResults(null);
    setStructuredResults(null);
    setSearchSummary(null);
    setPathErrors([]);
    setFileReadErrors([]);
    setItemDisplayStates(new Map()); // Reset item display states
    setProgress({ processed: 0, total: 0, message: "Starting search..." });
    setGeneralError(null);

    try {
      if (!window.electronAPI?.invokeSearch) throw new Error(t('errors:searchFunctionNA'));
      const searchResult: SearchResult = await window.electronAPI.invokeSearch(params);
      console.log("UI: Search completed.");

      // Update state with results
      setResults(searchResult.output);
      setStructuredResults(searchResult.structuredItems);
      setSearchSummary({
        filesFound: searchResult.filesFound,
        filesProcessed: searchResult.filesProcessed,
        errorsEncountered: searchResult.errorsEncountered,
      });

      // Translate path errors
      const translatedPathErrors = searchResult.pathErrors.map(err => {
          if (err.startsWith('Search path not found:')) {
              return t('errors:pathNotFound', { path: err.substring('Search path not found:'.length).trim() });
          }
          if (err.startsWith('Search path is not a directory:')) {
              return t('errors:pathNotDir', { path: err.substring('Search path is not a directory:'.length).trim() });
          }
          if (err.startsWith('Permission denied for search path:')) {
              return t('errors:pathPermissionDenied', { path: err.substring('Permission denied for search path:'.length).trim() });
          }
          return err;
      });
      setPathErrors(translatedPathErrors);
      setFileReadErrors(searchResult.fileReadErrors); // Store structured errors

      // Update final progress
      setProgress((prev) => ({
          ...(prev ?? { processed: 0, total: 0 }),
          processed: searchResult.filesProcessed,
          total: searchResult.filesProcessed > 0 ? searchResult.filesProcessed : (prev?.total ?? 0),
          message: `Search complete. Processed ${searchResult.filesProcessed} files.`,
      }));

    } catch (err: any) {
      console.error("UI: Search failed:", err);
      setGeneralError(t('errors:generalSearchFailed', { detail: err.message || "Unknown error" }));
      setProgress(null);
    } finally {
      setIsLoading(false);
    }
  }, [t]); // Add t dependency

  // Handler for copying results (always copies full text block)
  const handleCopyResults = useCallback(async (): Promise<{ success: boolean; potentiallyTruncated: boolean }> => {
    let potentiallyTruncated = false;
    if (results) {
        const lineCount = results.split('\n').length;
        if (lineCount > LARGE_RESULT_LINE_THRESHOLD_APP) {
            potentiallyTruncated = true;
        }
        if (window.electronAPI?.copyToClipboard) {
            try {
                const success = await window.electronAPI.copyToClipboard(results);
                return { success, potentiallyTruncated };
            } catch (err: any) {
                setGeneralError(t('errors:copyFailed', { detail: err.message }));
                return { success: false, potentiallyTruncated };
            }
        }
    }
    return { success: false, potentiallyTruncated: false };
  }, [results, t]); // Add results, t dependencies

  // Handler for saving results (always saves full text block)
  const handleSaveResults = useCallback(async (): Promise<void> => {
     if (results && window.electronAPI?.showSaveDialog && window.electronAPI?.writeFile) {
        setGeneralError(null);
        try {
            const filePath = await window.electronAPI.showSaveDialog();
            if (filePath) {
                const success = await window.electronAPI.writeFile(filePath, results);
                if (!success) {
                    setGeneralError(t('errors:saveFailedBackend'));
                }
            }
        } catch (err: any) {
            setGeneralError(t('errors:saveFailed', { detail: err.message }));
        }
     }
  }, [results, t]); // Add results, t dependencies

  // --- Settings Modal Toggle Handlers ---
  const openSettings = () => setIsSettingsOpen(true);
  const closeSettings = () => setIsSettingsOpen(false);

  // --- Tree View Toggle Handlers ---
  // Toggles the 'expanded' state for a given file path
  const handleToggleExpand = useCallback((filePath: string) => {
    setItemDisplayStates(prevMap => {
      const newMap = new Map(prevMap);
      const currentState = newMap.get(filePath);
      if (currentState?.expanded) {
         // Collapse: Remove entry or set expanded: false
         newMap.delete(filePath);
      } else {
        // Expand: Add entry, default showFull to false
        newMap.set(filePath, { expanded: true, showFull: false });
      }
      return newMap;
    });
  }, []); // No dependencies needed

  // Sets the 'showFull' state to true for a given file path
  const handleShowFullContent = useCallback((filePath: string) => {
      setItemDisplayStates(prevMap => {
          const newMap = new Map(prevMap);
          const currentState = newMap.get(filePath);
          // Only update if item exists, is expanded, and full content isn't already shown
          if (currentState?.expanded && !currentState.showFull) {
              newMap.set(filePath, { ...currentState, showFull: true });
              return newMap; // Return the updated map
          }
          return prevMap; // Return previous map if no change needed
      });
  }, []); // No dependencies needed

  // --- Render Logic ---
  return (
    <div className="app-container">
      {/* Header Section */}
      <div className="app-header">
        <h1>{t('common:appName')}</h1>
        <button onClick={openSettings} className="settings-button" aria-label={t('common:settings')}>
          ⚙️
        </button>
      </div>

      {/* Search Form Component */}
      <SearchForm onSubmit={handleSearchSubmit} isLoading={isLoading} />

      {/* Display General Errors */}
      {generalError && <p className="error-message">{t('errors:generalErrorPrefix')} {generalError}</p>}

      {/* Display Path Access Errors (styled as warnings) */}
      {pathErrors.length > 0 && (
        <div className="path-errors-container warning-message">
          <h4>{t('errors:pathErrorsHeading')}</h4>
          <ul>
            {pathErrors.map((err, index) => (
              <li key={`path-err-${index}`}>{err}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Display Grouped File Read Errors (styled as errors) */}
      {fileReadErrors.length > 0 && (
        <div className="file-read-errors-container error-message">
          <h4>{t('errors:fileReadErrorsHeading', { count: fileReadErrors.length })}</h4>
          {Object.entries(groupedFileReadErrors).map(([reasonKey, paths]) => (
            <div key={reasonKey} className="error-group">
              <h5>{t(`errors:${reasonKey}`, { defaultValue: reasonKey, count: paths.length })}:</h5>
              <ul>
                {paths.map((filePath, index) => (
                  <li key={`${reasonKey}-${index}`}>{filePath}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}

      {/* Display Progress Bar */}
      {isLoading && progress && (
        <ProgressBar
          processed={progress.processed}
          total={progress.total}
          message={progress.message}
          error={progress.error}
        />
      )}

      {/* Results Area: Only render if not loading and results are available */}
      {!isLoading && results !== null && searchSummary && (
        <div className="results-area">
            {/* View Mode Switcher */}
            <div className="view-mode-switcher">
                <label>
                    <input
                        type="radio"
                        name="viewMode"
                        value="text"
                        checked={viewMode === 'text'}
                        onChange={() => setViewMode('text')}
                    />
                    {t('results:viewModeText')}
                </label>
                <label>
                    <input
                        type="radio"
                        name="viewMode"
                        value="tree"
                        checked={viewMode === 'tree'}
                        onChange={() => setViewMode('tree')}
                        disabled={!structuredResults} // Disable tree view if no structured data
                    />
                    {t('results:viewModeTree')}
                </label>
            </div>

            {/* Results Display Component (passes down necessary props) */}
            <ResultsDisplay
                results={results} // Full text for text view, copy, save
                structuredResults={structuredResults} // Data for tree view
                summary={searchSummary}
                viewMode={viewMode} // Current view mode
                itemDisplayStates={itemDisplayStates} // Pass map of item states
                onCopy={handleCopyResults} // Callback for copy button
                onSave={handleSaveResults} // Callback for save button
                onToggleExpand={handleToggleExpand} // Callback to toggle tree items
                onShowFullContent={handleShowFullContent} // Callback to show full content
            />
        </div>
      )}

      {/* Settings Modal (Conditionally Rendered) */}
      <SettingsModal isOpen={isSettingsOpen} onClose={closeSettings} />
    </div>
  );
}

export default App;
