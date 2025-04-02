import React, { useState, useEffect, useCallback, useMemo } from "react";
import { useTranslation } from "react-i18next"; // For translations
import SearchForm from "./SearchForm"; // Input form component
import ResultsDisplay from "./ResultsDisplay"; // Results display component (virtualized)
import ProgressBar from "./ProgressBar"; // Progress bar component
import SettingsModal from "./SettingsModal"; // Settings modal component
// Import types defined in vite-env.d.ts for API and data structures
import type {
  ProgressData,
  SearchResult,
  FileReadError,
  IElectronAPI,
} from "./vite-env.d";

// Import CSS files
import "./App.css"; // App specific styles (including settings button)
import "./index.css"; // Global styles
import "./SettingsModal.css"; // Modal styles (ensure this is created)

// Define the shape of the search parameters used in the UI state
interface SearchParamsUI {
  searchPaths: string[];
  extensions: string[];
  excludeFiles: string[];
  excludeFolders: string[];
}

// Threshold for considering results "large" for clipboard warning
const LARGE_RESULT_LINE_THRESHOLD_APP = 100000;

// Helper type for grouping file read errors by their reason key
type GroupedErrors = { [reasonKey: string]: string[] }; // e.g., { "readPermissionDenied": ["path1", "path2"] }

function App() {
  // --- i18n Hook ---
  // Initialize translation hook, specifying namespaces used in this component
  const { t, i18n } = useTranslation(['common', 'errors', 'results']);

  // --- State Management ---
  const [results, setResults] = useState<string | null>(null); // Stores the aggregated file content
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

  // --- Memoized Grouping for File Read Errors ---
  // Groups file read errors by their 'reason' (which is a translation key)
  // This avoids recalculating on every render unless fileReadErrors changes.
  const groupedFileReadErrors: GroupedErrors = useMemo(() => {
    return fileReadErrors.reduce((acc, error) => {
      const reasonKey = error.reason || "unknownError"; // Use reason key, provide a fallback key
      if (!acc[reasonKey]) {
        acc[reasonKey] = []; // Initialize array for this reason if it's the first time
      }
      acc[reasonKey].push(error.filePath); // Add the file path to the group
      return acc;
    }, {} as GroupedErrors); // Start with an empty object
  }, [fileReadErrors]); // Dependency array: only recalculate when fileReadErrors changes

  // --- Effect for Progress Updates ---
  // Subscribes to progress events from the main process when the component mounts
  useEffect(() => {
    // Ensure the Electron API for progress updates is available
    if (window.electronAPI?.onSearchProgress) {
      console.log("UI: Subscribing to search progress");
      // Call the API function, providing a callback to update the progress state
      const unsubscribe = window.electronAPI.onSearchProgress(
        (progressData) => {
          setProgress(progressData); // Update state with received progress data
        },
      );
      // Return a cleanup function that unsubscribes the listener when the component unmounts
      return () => {
        console.log("UI: Unsubscribing from search progress");
        unsubscribe();
      };
    } else {
      // Log a warning and set an error state if the API is not found
      console.warn("UI: electronAPI.onSearchProgress not found on window.");
      setGeneralError(t('errors:connectError')); // Use translated error message
    }
    // Add 't' to dependency array because it's used within the effect for the error message
  }, [t]);

  // --- Event Handlers ---

  // Handler for submitting the search form
  const handleSearchSubmit = useCallback(async (params: SearchParamsUI) => {
    console.log("UI: Starting search with params:", params);
    // Reset state before starting a new search
    setIsLoading(true);
    setResults(null);
    setSearchSummary(null);
    setPathErrors([]);
    setFileReadErrors([]);
    setProgress({ processed: 0, total: 0, message: "Starting search..." }); // Initial progress state
    setGeneralError(null);

    try {
      // Check if the search API function is available
      if (!window.electronAPI?.invokeSearch) {
        throw new Error(t('errors:searchFunctionNA')); // Use translated error
      }
      // Call the backend search function via IPC invoke
      const searchResult: SearchResult = await window.electronAPI.invokeSearch(params);
      console.log("UI: Search completed.");

      // Update state with the results received from the backend
      setResults(searchResult.output);
      setSearchSummary({
        filesFound: searchResult.filesFound,
        filesProcessed: searchResult.filesProcessed,
        errorsEncountered: searchResult.errorsEncountered,
      });

      // Translate path errors before storing them for display
      const translatedPathErrors = searchResult.pathErrors.map(err => {
          // Attempt to match known error patterns and translate them
          if (err.startsWith('Search path not found:')) {
              return t('errors:pathNotFound', { path: err.substring('Search path not found:'.length).trim() });
          }
          if (err.startsWith('Search path is not a directory:')) {
              return t('errors:pathNotDir', { path: err.substring('Search path is not a directory:'.length).trim() });
          }
          if (err.startsWith('Permission denied for search path:')) {
              return t('errors:pathPermissionDenied', { path: err.substring('Permission denied for search path:'.length).trim() });
          }
          // Fallback: return the original error string if no pattern matches
          return err;
      });
      setPathErrors(translatedPathErrors);

      // Store the structured file read errors (translation happens during rendering)
      setFileReadErrors(searchResult.fileReadErrors);

      // Update final progress state message
      setProgress((prev) => ({
          ...(prev ?? { processed: 0, total: 0 }), // Keep previous progress data if available
          processed: searchResult.filesProcessed,
          // Ensure total isn't 0 if processed is > 0, use previous total as fallback
          total: searchResult.filesProcessed > 0 ? searchResult.filesProcessed : (prev?.total ?? 0),
          message: `Search complete. Processed ${searchResult.filesProcessed} files.`, // Keep this simple, ProgressBar handles its own default translation
      }));

    } catch (err: any) {
      // Handle errors during the search process itself
      console.error("UI: Search failed:", err);
      setGeneralError(t('errors:generalSearchFailed', { detail: err.message || "Unknown error" })); // Translate error
      setProgress(null); // Clear progress on error
    } finally {
      setIsLoading(false); // Ensure loading state is always reset
    }
  }, [t]); // Add t to dependency array as it's used within the callback

  // Handler for copying results to clipboard
  const handleCopyResults = useCallback(async (): Promise<{ success: boolean; potentiallyTruncated: boolean }> => {
    let potentiallyTruncated = false;
    if (results) {
        // Check if results are large based on line count
        const lineCount = results.split('\n').length;
        if (lineCount > LARGE_RESULT_LINE_THRESHOLD_APP) {
            potentiallyTruncated = true;
            console.warn("UI: Attempting to copy large results, may be truncated.");
        }

        // Check if copy API is available
        if (window.electronAPI?.copyToClipboard) {
            console.log("UI: Requesting copy to clipboard");
            try {
                // Call backend copy function
                const success = await window.electronAPI.copyToClipboard(results);
                console.log("UI: Copy request status:", success);
                return { success, potentiallyTruncated }; // Return status object
            } catch (err: any) {
                console.error("UI: Copy to clipboard failed:", err);
                setGeneralError(t('errors:copyFailed', { detail: err.message })); // Translate error
                return { success: false, potentiallyTruncated };
            }
        }
    }
    // Return default failure if no results or API unavailable
    return { success: false, potentiallyTruncated: false };
  }, [results, t]); // Add results and t to dependency array

  // Handler for saving results to a file
  const handleSaveResults = useCallback(async (): Promise<void> => {
     // Check if results exist and save APIs are available
     if (results && window.electronAPI?.showSaveDialog && window.electronAPI?.writeFile) {
        setGeneralError(null); // Clear previous errors
        try {
            // Show save dialog via IPC
            const filePath = await window.electronAPI.showSaveDialog();
            // If user selected a path (didn't cancel)
            if (filePath) {
                console.log(`UI: File path selected: ${filePath}. Requesting write.`);
                // Write file via IPC
                const success = await window.electronAPI.writeFile(filePath, results);
                if (!success) {
                    // Handle backend write failure
                    console.error("UI: File write failed (backend reported failure).");
                    setGeneralError(t('errors:saveFailedBackend')); // Translate error
                } else {
                    console.log("UI: File write successful.");
                    // Optionally show a temporary success message here
                }
            } else {
                console.log("UI: Save file dialog cancelled.");
            }
        } catch (err: any) {
            // Handle errors during the save process (e.g., dialog error)
            console.error("UI: Save process failed:", err);
            setGeneralError(t('errors:saveFailed', { detail: err.message })); // Translate error
        }
     }
  }, [results, t]); // Add results and t to dependency array

  // --- Settings Modal Toggle Handlers ---
  const openSettings = () => setIsSettingsOpen(true);
  const closeSettings = () => setIsSettingsOpen(false);

  // --- Render Logic ---
  return (
    <div className="app-container">
      {/* Header Section */}
      <div className="app-header">
        <h1>{t('common:appName')}</h1>
        {/* Settings Button */}
        <button onClick={openSettings} className="settings-button" aria-label={t('common:settings')}>
          {/* Placeholder Gear Icon - Consider replacing with an SVG or icon font */}
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
              // Path errors are already translated in handleSearchSubmit
              <li key={`path-err-${index}`}>{err}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Display Grouped File Read Errors (styled as errors) */}
      {fileReadErrors.length > 0 && (
        <div className="file-read-errors-container error-message">
          <h4>{t('errors:fileReadErrorsHeading', { count: fileReadErrors.length })}</h4>
          {/* Iterate through grouped errors using the reasonKey */}
          {Object.entries(groupedFileReadErrors).map(([reasonKey, paths]) => (
            <div key={reasonKey} className="error-group">
              {/* Translate the heading using the reasonKey directly */}
              {/* Provide the key itself as fallback if translation missing */}
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
          error={progress.error} // Shows simplified error key during progress
        />
      )}

      {/* Display Results Component */}
      {results !== null && searchSummary && (
        <ResultsDisplay
          results={results}
          summary={searchSummary}
          onCopy={handleCopyResults} // Pass down the modified handler
          onSave={handleSaveResults}
        />
      )}

      {/* Settings Modal (Conditionally Rendered) */}
      <SettingsModal isOpen={isSettingsOpen} onClose={closeSettings} />
    </div>
  );
}

export default App;
