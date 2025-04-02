import React, { useState, useEffect, useCallback } from "react";
import SearchForm from "./SearchForm";
import ResultsDisplay from "./ResultsDisplay";
import ProgressBar from "./ProgressBar";
// Import the types defined in vite-env.d.ts
import type { ProgressData, SearchResult, IElectronAPI } from "./vite-env.d";

import "./App.css"; // Keep existing base styles

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
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [progress, setProgress] = useState<ProgressData | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Effect to listen for progress updates from the main process
  useEffect(() => {
    // Ensure the API is available before subscribing
    if (window.electronAPI?.onSearchProgress) {
      console.log("UI: Subscribing to search progress");
      const unsubscribe = window.electronAPI.onSearchProgress(
        (progressData) => {
          // console.log("UI: Received progress update", progressData); // Log received data
          setProgress(progressData);
        },
      );

      // Cleanup function to remove the listener when the component unmounts
      return () => {
        console.log("UI: Unsubscribing from search progress");
        unsubscribe();
      };
    } else {
      console.warn("UI: electronAPI.onSearchProgress not found on window.");
      setError("Error: Could not connect to backend for progress updates.");
    }
  }, []); // Empty dependency array ensures this runs only once on mount

  // Handler for submitting the search form
  const handleSearchSubmit = useCallback(async (params: SearchParamsUI) => {
    console.log("UI: Starting search with params:", params);
    setIsLoading(true);
    setResults(null); // Clear previous results
    setSearchSummary(null);
    setProgress({ processed: 0, total: 0, message: "Starting search..." }); // Initial progress
    setError(null); // Clear previous errors

    try {
      // Ensure the API function exists
      if (!window.electronAPI?.invokeSearch) {
        throw new Error("Search function not available.");
      }
      // Call the backend search function via IPC
      const searchResult: SearchResult = await window.electronAPI.invokeSearch(params);
      console.log("UI: Search completed. Result summary:", {
          found: searchResult.filesFound,
          processed: searchResult.filesProcessed,
          errors: searchResult.errorsEncountered
      });

      setResults(searchResult.output);
      setSearchSummary({
        filesFound: searchResult.filesFound,
        filesProcessed: searchResult.filesProcessed,
        errorsEncountered: searchResult.errorsEncountered,
      });
      // Final progress update might come via listener, or set explicitly here
      setProgress((prev) => ({
          ...(prev ?? { processed: 0, total: 0 }), // Keep existing data if available
          processed: searchResult.filesProcessed,
          total: searchResult.filesProcessed, // Or use a total from the result if available
          message: `Search complete. Processed ${searchResult.filesProcessed} files.`,
      }));

    } catch (err: any) {
      console.error("UI: Search failed:", err);
      setError(`Search failed: ${err.message || "Unknown error"}`);
      setProgress(null); // Clear progress on error
    } finally {
      setIsLoading(false); // Ensure loading is set to false
    }
  }, []); // useCallback with empty dependency array, as it doesn't depend on component state directly

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
        setError(`Copy failed: ${err.message}`);
        return false;
      }
    }
    return false;
  }, [results]); // Depends on the 'results' state

  // Handler for saving results to a file
  const handleSaveResults = useCallback(async (): Promise<void> => {
     if (results && window.electronAPI?.showSaveDialog && window.electronAPI?.writeFile) {
        console.log("UI: Requesting save file dialog");
        setError(null); // Clear previous save errors
        try {
            const filePath = await window.electronAPI.showSaveDialog();
            if (filePath) {
                console.log(`UI: File path selected: ${filePath}. Requesting write.`);
                const success = await window.electronAPI.writeFile(filePath, results);
                if (success) {
                    console.log("UI: File write successful.");
                    // Optionally show a success message to the user here
                } else {
                    console.error("UI: File write failed (backend reported failure).");
                    setError("Failed to save file.");
                }
            } else {
                console.log("UI: Save file dialog cancelled.");
            }
        } catch (err: any) {
            console.error("UI: Save process failed:", err);
            setError(`Save failed: ${err.message}`);
        }
     }
  }, [results]); // Depends on the 'results' state

  return (
    <div className="app-container"> {/* Optional: Add a container class */}
      <h1>File Content Aggregator</h1>

      <SearchForm onSubmit={handleSearchSubmit} isLoading={isLoading} />

      {isLoading && progress && (
        <ProgressBar
          processed={progress.processed}
          total={progress.total}
          message={progress.message}
          error={progress.error}
        />
      )}

      {error && <p className="error-message">Error: {error}</p>}

      {results !== null && searchSummary && (
        <ResultsDisplay
          results={results}
          summary={searchSummary}
          onCopy={handleCopyResults}
          onSave={handleSaveResults}
        />
      )}

      {/* Remove or keep the placeholder content below as needed */}
      {/*
            <div className="placeholder-content">
                <p className="read-the-docs">
                    Based on Vite + React + Electron
                </p>
            </div>
            */}
    </div>
  );
}

export default App;
