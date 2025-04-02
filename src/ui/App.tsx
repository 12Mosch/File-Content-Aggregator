import React, { useState, useEffect, useCallback } from "react";
import SearchForm from "./SearchForm";
import ResultsDisplay from "./ResultsDisplay";
import ProgressBar from "./ProgressBar";
// Import the types defined in vite-env.d.ts
import type { ProgressData, SearchResult, IElectronAPI } from "./vite-env.d";

import "./App.css"; // Keep existing base styles
import "./index.css"; // Ensure global styles are imported

// Define the shape of the search parameters used in the UI state
interface SearchParamsUI {
  searchPaths: string[];
  extensions: string[];
  excludeFiles: string[];
  excludeFolders: string[];
}

function App() {
  // State for search results and status
  const [results, setResults] = useState<string | null>(null);
  const [searchSummary, setSearchSummary] = useState<{
    filesFound: number;
    filesProcessed: number;
    errorsEncountered: number;
  } | null>(null);
  const [pathErrors, setPathErrors] = useState<string[]>([]); // <-- State for path errors
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [progress, setProgress] = useState<ProgressData | null>(null);
  const [generalError, setGeneralError] = useState<string | null>(null); // Renamed for clarity

  // Effect to listen for progress updates from the main process
  useEffect(() => {
    if (window.electronAPI?.onSearchProgress) {
      console.log("UI: Subscribing to search progress");
      const unsubscribe = window.electronAPI.onSearchProgress(
        (progressData) => {
          setProgress(progressData);
        },
      );
      return () => {
        console.log("UI: Unsubscribing from search progress");
        unsubscribe();
      };
    } else {
      console.warn("UI: electronAPI.onSearchProgress not found on window.");
      setGeneralError("Error: Could not connect to backend for progress updates.");
    }
  }, []);

  // Handler for submitting the search form
  const handleSearchSubmit = useCallback(async (params: SearchParamsUI) => {
    console.log("UI: Starting search with params:", params);
    setIsLoading(true);
    setResults(null);
    setSearchSummary(null);
    setPathErrors([]); // <-- Clear previous path errors
    setProgress({ processed: 0, total: 0, message: "Starting search..." });
    setGeneralError(null);

    try {
      if (!window.electronAPI?.invokeSearch) {
        throw new Error("Search function not available.");
      }
      const searchResult: SearchResult = await window.electronAPI.invokeSearch(params);
      console.log("UI: Search completed. Result summary:", {
          found: searchResult.filesFound,
          processed: searchResult.filesProcessed,
          errors: searchResult.errorsEncountered,
          pathErrors: searchResult.pathErrors.length
      });

      setResults(searchResult.output);
      setSearchSummary({
        filesFound: searchResult.filesFound,
        filesProcessed: searchResult.filesProcessed,
        errorsEncountered: searchResult.errorsEncountered,
      });
      setPathErrors(searchResult.pathErrors); // <-- Store path errors

      // Final progress update
      setProgress((prev) => ({
          ...(prev ?? { processed: 0, total: 0 }),
          processed: searchResult.filesProcessed,
          total: searchResult.filesProcessed > 0 ? searchResult.filesProcessed : (prev?.total ?? 0), // Adjust total logic slightly
          message: `Search complete. Processed ${searchResult.filesProcessed} files.`,
      }));

    } catch (err: any) {
      console.error("UI: Search failed:", err);
      setGeneralError(`Search failed: ${err.message || "Unknown error"}`);
      setProgress(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Handler for copying results to clipboard
  const handleCopyResults = useCallback(async (): Promise<boolean> => {
    if (results && window.electronAPI?.copyToClipboard) {
      console.log("UI: Requesting copy to clipboard");
      try {
        const success = await window.electronAPI.copyToClipboard(results);
        console.log("UI: Copy request status:", success);
        return success;
      } catch (err: any) {
        console.error("UI: Copy to clipboard failed:", err);
        setGeneralError(`Copy failed: ${err.message}`);
        return false;
      }
    }
    return false;
  }, [results]);

  // Handler for saving results to a file
  const handleSaveResults = useCallback(async (): Promise<void> => {
     if (results && window.electronAPI?.showSaveDialog && window.electronAPI?.writeFile) {
        console.log("UI: Requesting save file dialog");
        setGeneralError(null);
        try {
            const filePath = await window.electronAPI.showSaveDialog();
            if (filePath) {
                console.log(`UI: File path selected: ${filePath}. Requesting write.`);
                const success = await window.electronAPI.writeFile(filePath, results);
                if (success) {
                    console.log("UI: File write successful.");
                } else {
                    console.error("UI: File write failed (backend reported failure).");
                    setGeneralError("Failed to save file.");
                }
            } else {
                console.log("UI: Save file dialog cancelled.");
            }
        } catch (err: any) {
            console.error("UI: Save process failed:", err);
            setGeneralError(`Save failed: ${err.message}`);
        }
     }
  }, [results]);

  return (
    <div className="app-container">
      <h1>File Content Aggregator</h1>

      <SearchForm onSubmit={handleSearchSubmit} isLoading={isLoading} />

      {/* Display general errors */}
      {generalError && <p className="error-message">Error: {generalError}</p>}

      {/* Display path-specific errors */}
      {pathErrors.length > 0 && (
        <div className="path-errors-container error-message"> {/* Reuse error style */}
          <h4>Path Errors Encountered:</h4>
          <ul>
            {pathErrors.map((err, index) => (
              <li key={index}>{err}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Display progress bar */}
      {isLoading && progress && (
        <ProgressBar
          processed={progress.processed}
          total={progress.total}
          message={progress.message}
          error={progress.error} // This is for file read errors during progress
        />
      )}

      {/* Display results */}
      {results !== null && searchSummary && (
        <ResultsDisplay
          results={results}
          summary={searchSummary}
          // pathErrors={pathErrors} // Pass path errors to ResultsDisplay
          onCopy={handleCopyResults}
          onSave={handleSaveResults}
        />
      )}
    </div>
  );
}

export default App;
