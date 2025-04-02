import React, { useState, useEffect, useCallback, useMemo } from "react"; // Added useMemo
import SearchForm from "./SearchForm";
import ResultsDisplay from "./ResultsDisplay";
import ProgressBar from "./ProgressBar";
import type { ProgressData, SearchResult, FileReadError, IElectronAPI } from "./vite-env.d"; // Import FileReadError

import "./App.css";
import "./index.css";

interface SearchParamsUI {
  searchPaths: string[];
  extensions: string[];
  excludeFiles: string[];
  excludeFolders: string[];
}

const LARGE_RESULT_LINE_THRESHOLD_APP = 100000;

// Helper type for grouped errors
type GroupedErrors = { [reason: string]: string[] }; // { "Reason": ["path1", "path2"] }

function App() {
  const [results, setResults] = useState<string | null>(null);
  const [searchSummary, setSearchSummary] = useState<{
    filesFound: number;
    filesProcessed: number;
    errorsEncountered: number;
  } | null>(null);
  const [pathErrors, setPathErrors] = useState<string[]>([]);
  const [fileReadErrors, setFileReadErrors] = useState<FileReadError[]>([]); // <-- State for structured read errors
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [progress, setProgress] = useState<ProgressData | null>(null);
  const [generalError, setGeneralError] = useState<string | null>(null);

  // Group file read errors by reason using useMemo
  const groupedFileReadErrors: GroupedErrors = useMemo(() => {
    return fileReadErrors.reduce((acc, error) => {
      if (!acc[error.reason]) {
        acc[error.reason] = [];
      }
      acc[error.reason].push(error.filePath);
      return acc;
    }, {} as GroupedErrors);
  }, [fileReadErrors]); // Recalculate only when fileReadErrors changes

  useEffect(() => {
    if (window.electronAPI?.onSearchProgress) {
      const unsubscribe = window.electronAPI.onSearchProgress(
        (progressData) => {
          setProgress(progressData);
        },
      );
      return () => unsubscribe();
    } else {
      setGeneralError("Error: Could not connect to backend for progress updates.");
    }
  }, []);

  const handleSearchSubmit = useCallback(async (params: SearchParamsUI) => {
    setIsLoading(true);
    setResults(null);
    setSearchSummary(null);
    setPathErrors([]);
    setFileReadErrors([]); // <-- Clear previous file read errors
    setProgress({ processed: 0, total: 0, message: "Starting search..." });
    setGeneralError(null);

    try {
      if (!window.electronAPI?.invokeSearch) {
        throw new Error("Search function not available.");
      }
      const searchResult: SearchResult = await window.electronAPI.invokeSearch(params);

      setResults(searchResult.output);
      setSearchSummary({
        filesFound: searchResult.filesFound,
        filesProcessed: searchResult.filesProcessed,
        errorsEncountered: searchResult.errorsEncountered, // This count comes from backend now
      });
      setPathErrors(searchResult.pathErrors);
      setFileReadErrors(searchResult.fileReadErrors); // <-- Store structured errors

      setProgress((prev) => ({
          ...(prev ?? { processed: 0, total: 0 }),
          processed: searchResult.filesProcessed,
          total: searchResult.filesProcessed > 0 ? searchResult.filesProcessed : (prev?.total ?? 0),
          message: `Search complete. Processed ${searchResult.filesProcessed} files.`,
      }));

    } catch (err: any) {
      setGeneralError(`Search failed: ${err.message || "Unknown error"}`);
      setProgress(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const handleCopyResults = useCallback(async (): Promise<{ success: boolean; potentiallyTruncated: boolean }> => {
    let potentiallyTruncated = false;
    if (results) {
        const lineCount = results.split('\n').length;
        if (lineCount > LARGE_RESULT_LINE_THRESHOLD_APP) {
            potentiallyTruncated = true;
            console.warn("UI: Attempting to copy large results, may be truncated.");
        }
        if (window.electronAPI?.copyToClipboard) {
            try {
                const success = await window.electronAPI.copyToClipboard(results);
                return { success, potentiallyTruncated };
            } catch (err: any) {
                setGeneralError(`Copy failed: ${err.message}`);
                return { success: false, potentiallyTruncated };
            }
        }
    }
    return { success: false, potentiallyTruncated: false };
  }, [results]);

  const handleSaveResults = useCallback(async (): Promise<void> => {
     if (results && window.electronAPI?.showSaveDialog && window.electronAPI?.writeFile) {
        setGeneralError(null);
        try {
            const filePath = await window.electronAPI.showSaveDialog();
            if (filePath) {
                const success = await window.electronAPI.writeFile(filePath, results);
                if (!success) {
                    setGeneralError("Failed to save file.");
                }
            }
        } catch (err: any) {
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
        <div className="path-errors-container warning-message"> {/* Use warning style */}
          <h4>Path Access Issues Encountered:</h4>
          <ul>
            {pathErrors.map((err, index) => (
              <li key={`path-err-${index}`}>{err}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Display grouped file read errors */}
      {fileReadErrors.length > 0 && (
        <div className="file-read-errors-container error-message"> {/* Use error style */}
          <h4>File Read Errors Encountered ({fileReadErrors.length} total):</h4>
          {Object.entries(groupedFileReadErrors).map(([reason, paths]) => (
            <div key={reason} className="error-group">
              <h5>{reason} ({paths.length}):</h5>
              <ul>
                {paths.map((filePath, index) => (
                  <li key={`${reason}-${index}`}>{filePath}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}


      {/* Display progress bar */}
      {isLoading && progress && (
        <ProgressBar
          processed={progress.processed}
          total={progress.total}
          message={progress.message}
          error={progress.error} // Shows simplified error during progress
        />
      )}

      {/* Display results */}
      {results !== null && searchSummary && (
        <ResultsDisplay
          results={results}
          summary={searchSummary}
          onCopy={handleCopyResults}
          onSave={handleSaveResults}
        />
      )}
    </div>
  );
}

export default App;
