import React, { useState, useEffect, useCallback, useMemo } from "react";
import { useTranslation } from "react-i18next";
import SearchForm from "./SearchForm";
import ResultsDisplay from "./ResultsDisplay";
import ProgressBar from "./ProgressBar";
import SettingsModal from "./SettingsModal";
import HistoryButton from "./HistoryButton";
import HistoryModal from "./HistoryModal";
import useDebounce from "./hooks/useDebounce";
import type {
  ProgressData,
  SearchResult,
  FileReadError,
  IElectronAPI,
  StructuredItem,
  SearchHistoryEntry, // Import History Entry type
  SearchParams as SubmitParams, // Rename for clarity in this file
} from "./vite-env.d";
import { generateId } from "./queryBuilderUtils"; // Import ID generator

import "./App.css";
import "./index.css";
import "./SettingsModal.css";
import "./ResultsFilter.css";
import "./HistoryModal.css"; // Add History Modal CSS

// Removed SearchParamsUI as SearchForm now handles its internal state differently

const LARGE_RESULT_LINE_THRESHOLD_APP = 100000;
type GroupedErrors = { [reasonKey: string]: string[] };

interface ItemDisplayState {
    expanded: boolean;
    showFull: boolean;
}
type ItemDisplayStates = Map<string, ItemDisplayState>;

const FILTER_DEBOUNCE_DELAY = 300;

function App() {
  const { t, i18n } = useTranslation(['common', 'errors', 'results', 'form']);

  // --- Core State ---
  const [results, setResults] = useState<string | null>(null);
  const [structuredResults, setStructuredResults] = useState<StructuredItem[] | null>(null);
  const [searchSummary, setSearchSummary] = useState<{
    filesFound: number;
    filesProcessed: number;
    errorsEncountered: number;
  } | null>(null);
  const [pathErrors, setPathErrors] = useState<string[]>([]);
  const [fileReadErrors, setFileReadErrors] = useState<FileReadError[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [progress, setProgress] = useState<ProgressData | null>(null);
  const [generalError, setGeneralError] = useState<string | null>(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState<boolean>(false);
  const [viewMode, setViewMode] = useState<'text' | 'tree'>('text');

  // --- Results Display State ---
  const [itemDisplayStates, setItemDisplayStates] = useState<ItemDisplayStates>(new Map());
  const [itemDisplayVersion, setItemDisplayVersion] = useState(0); // For forcing list updates

  // --- Results Filter State ---
  const [resultsFilterTerm, setResultsFilterTerm] = useState<string>("");
  const [resultsFilterCaseSensitive, setResultsFilterCaseSensitive] = useState<boolean>(false);
  const debouncedFilterTerm = useDebounce(resultsFilterTerm, FILTER_DEBOUNCE_DELAY);

  // --- History State ---
  const [isHistoryOpen, setIsHistoryOpen] = useState<boolean>(false);
  const [searchHistory, setSearchHistory] = useState<SearchHistoryEntry[]>([]);
  // State to trigger loading a history entry into the form
  const [historyEntryToLoad, setHistoryEntryToLoad] = useState<SearchHistoryEntry | null>(null);
  // ---------------------

  // Memoized error grouping
  const groupedFileReadErrors: GroupedErrors = useMemo(() => {
    return fileReadErrors.reduce((acc, error) => {
      const reasonKey = error.reason || "unknownError";
      if (!acc[reasonKey]) {
        acc[reasonKey] = [];
      }
      acc[reasonKey].push(error.filePath);
      return acc;
    }, {} as GroupedErrors);
  }, [fileReadErrors]);

  // Effect for handling search progress updates from main process
  useEffect(() => {
    if (window.electronAPI?.onSearchProgress) {
      const unsubscribe = window.electronAPI.onSearchProgress(setProgress);
      return unsubscribe; // Cleanup function to remove listener
    } else {
      console.warn("UI: electronAPI.onSearchProgress not found on window.");
      setGeneralError(t('errors:connectError'));
    }
  }, [t]); // Dependency on t ensures error message is translated

  // --- History Functions ---
  /** Fetches the latest search history from the main process */
  const fetchHistory = useCallback(async () => {
    if (window.electronAPI?.getSearchHistory) {
      try {
        const history = await window.electronAPI.getSearchHistory();
        setSearchHistory(history); // Update local state
        return history; // Return fetched history
      } catch (err) {
        console.error("UI: Failed to fetch search history:", err);
        setGeneralError(t('errors:historyFetchFailed'));
        return []; // Return empty on error
      }
    } else {
      console.warn("UI: getSearchHistory API not available.");
      setGeneralError(t('errors:historyApiNA'));
      return []; // Return empty if API unavailable
    }
  }, [t]); // Dependency on t for error messages

  /** Opens the history modal and fetches the latest history */
  const openHistoryModal = useCallback(async () => {
    await fetchHistory(); // Fetch latest history when opening
    setIsHistoryOpen(true);
  }, [fetchHistory]);

  /** Closes the history modal */
  const closeHistoryModal = () => setIsHistoryOpen(false);

  /** Sets the history entry to be loaded into the form */
  const handleLoadSearchFromHistory = useCallback((entry: SearchHistoryEntry) => {
    console.log("UI: Loading history entry:", entry.id);
    setHistoryEntryToLoad(entry); // Set the entry to be loaded by SearchForm
    closeHistoryModal(); // Close modal after selection
  }, []);

  /** Callback for SearchForm to signal that history loading is complete */
  const handleHistoryLoadComplete = useCallback(() => {
    setHistoryEntryToLoad(null); // Reset the trigger
  }, []);

  /** Deletes a specific history entry via IPC and updates local state */
  const handleDeleteHistoryEntry = useCallback(async (entryId: string) => {
    if (window.electronAPI?.deleteSearchHistoryEntry) {
      try {
        await window.electronAPI.deleteSearchHistoryEntry(entryId);
        // Update local state immediately for responsiveness
        setSearchHistory(prev => prev.filter(entry => entry.id !== entryId));
      } catch (err) {
        console.error("UI: Failed to delete history entry:", err);
        setGeneralError(t('errors:historyDeleteFailed'));
      }
    } else {
      console.warn("UI: deleteSearchHistoryEntry API not available.");
      setGeneralError(t('errors:historyApiNA'));
    }
  }, [t]); // Dependency on t for error messages

  /** Clears the entire search history via IPC after confirmation */
  const handleClearHistory = useCallback(async () => {
    if (window.electronAPI?.clearSearchHistory) {
      try {
        // Confirmation happens in the main process now
        const success = await window.electronAPI.clearSearchHistory();
        if (success) {
            setSearchHistory([]); // Clear local state only on success
            console.log("UI: History cleared successfully.");
        } else {
            console.log("UI: History clear cancelled by user or failed in backend.");
            // Optionally show a less intrusive message if cancelled
        }
      } catch (err) {
        console.error("UI: Failed to clear history:", err);
        setGeneralError(t('errors:historyClearFailed'));
      }
    } else {
      console.warn("UI: clearSearchHistory API not available.");
      setGeneralError(t('errors:historyApiNA'));
    }
  }, [t]); // Dependency on t for error messages

  /** Updates a history entry (name/favorite) via IPC and updates local state */
  const handleUpdateHistoryEntry = useCallback(async (entryId: string, updates: Partial<Pick<SearchHistoryEntry, 'name' | 'isFavorite'>>) => {
    if (window.electronAPI?.updateSearchHistoryEntry) {
        try {
            const success = await window.electronAPI.updateSearchHistoryEntry(entryId, updates);
            if (success) {
                // Update local state to reflect the change immediately
                setSearchHistory(prev => prev.map(entry =>
                    entry.id === entryId ? { ...entry, ...updates } : entry
                ));
            } else {
                 console.warn(`UI: Failed to update history entry ${entryId} in backend.`);
                 // Optionally revert local state or show an error message
                 setGeneralError(t('errors:historyUpdateFailed')); // Inform user
            }
        } catch (err) {
            console.error(`UI: Error updating history entry ${entryId}:`, err);
            setGeneralError(t('errors:historyUpdateFailed'));
        }
    } else {
        console.warn("UI: updateSearchHistoryEntry API not available.");
        setGeneralError(t('errors:historyApiNA'));
    }
  }, [t]); // Dependency on t for error messages
  // -----------------------

  /** Handles the submission of the search form */
  const handleSearchSubmit = useCallback(async (params: SubmitParams) => {
    setIsLoading(true);
    // Reset results and errors state
    setResults(null);
    setStructuredResults(null);
    setSearchSummary(null);
    setPathErrors([]);
    setFileReadErrors([]);
    setItemDisplayStates(new Map());
    setItemDisplayVersion(0);
    setProgress({ processed: 0, total: 0, message: "Starting search..." });
    setGeneralError(null);
    setResultsFilterTerm(""); // Clear results filter on new search

    // --- Save to History ---
    // Save the search parameters (including the structured query) to history
    if (window.electronAPI?.addSearchHistoryEntry && params.searchPaths.length > 0) {
        const historyEntry: SearchHistoryEntry = {
            id: generateId(), // Use utility function for unique ID
            timestamp: new Date().toISOString(),
            // Store the exact parameters object received from the form,
            // which includes the structuredQuery if the builder was used.
            searchParams: { ...params },
            // name and isFavorite will be added/updated later via the modal
        };
        try {
            // Asynchronously add to history, don't wait for it to complete
            window.electronAPI.addSearchHistoryEntry(historyEntry);
        } catch (err) {
            console.error("UI: Failed to save search to history:", err);
            // Non-critical error, don't block the search itself
        }
    }
    // ---------------------

    // --- Execute Search ---
    try {
      if (!window.electronAPI?.invokeSearch) throw new Error(t('errors:searchFunctionNA'));

      // Exclude the raw structuredQuery from the parameters sent to the backend search function,
      // as the backend only needs the generated contentSearchTerm string.
      const { structuredQuery, ...backendParams } = params;
      const searchResult: SearchResult = await window.electronAPI.invokeSearch(backendParams);

      // --- Process Search Results ---
      setResults(searchResult.output);
      setStructuredResults(searchResult.structuredItems);
      setSearchSummary({
        filesFound: searchResult.filesFound,
        filesProcessed: searchResult.filesProcessed,
        errorsEncountered: searchResult.errorsEncountered,
      });

      // Translate known path/parse errors for user display
      const translatedPathErrors = searchResult.pathErrors.map(err => {
          if (err.startsWith('Search path not found:')) return t('errors:pathNotFound', { path: err.substring('Search path not found:'.length).trim() });
          if (err.startsWith('Search path is not a directory:')) return t('errors:pathNotDir', { path: err.substring('Search path is not a directory:'.length).trim() });
          if (err.startsWith('Permission denied for search path:')) return t('errors:pathPermissionDenied', { path: err.substring('Permission denied for search path:'.length).trim() });
          if (err.startsWith('Invalid boolean query syntax:')) return t('errors:invalidBooleanQuery', { detail: err.substring('Invalid boolean query syntax:'.length).trim() });
          if (err.startsWith('Invalid regular expression pattern:')) return t('errors:invalidRegexPattern', { pattern: err.substring('Invalid regular expression pattern:'.length).trim() });
          return err; // Fallback for untranslated errors
      });
      setPathErrors(translatedPathErrors);
      setFileReadErrors(searchResult.fileReadErrors);

      // Update progress bar to final state
      setProgress((prev) => ({
          ...(prev ?? { processed: 0, total: 0 }),
          processed: searchResult.filesProcessed,
          total: searchResult.filesProcessed > 0 ? searchResult.filesProcessed : (prev?.total ?? 0),
          message: `Search complete. Processed ${searchResult.filesProcessed} files.`,
      }));

    } catch (err: any) {
      console.error("UI: Search failed:", err);
      setGeneralError(t('errors:generalSearchFailed', { detail: err.message || "Unknown error" }));
      setProgress(null); // Clear progress on error
    } finally {
      setIsLoading(false); // Ensure loading state is reset
    }
  }, [t]); // Add t to dependency array for error messages

  // --- Other UI Handlers (Copy, Save, Settings, Results Display) ---

  /** Copies the raw text results to the clipboard */
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
  }, [results, t]);

  /** Opens a save dialog and writes the raw text results to a file */
  const handleSaveResults = useCallback(async (): Promise<void> => {
     if (results && window.electronAPI?.showSaveDialog && window.electronAPI?.writeFile) {
        setGeneralError(null);
        try {
            const filePath = await window.electronAPI.showSaveDialog();
            if (filePath) {
                const success = await window.electronAPI.writeFile(filePath, results);
                if (!success) {
                    // Error is usually shown by main process dialog
                    setGeneralError(t('errors:saveFailedBackend'));
                }
            }
        } catch (err: any) {
            setGeneralError(t('errors:saveFailed', { detail: err.message }));
        }
     }
  }, [results, t]);

  /** Opens the settings modal */
  const openSettings = () => setIsSettingsOpen(true);
  /** Closes the settings modal */
  const closeSettings = () => setIsSettingsOpen(false);

  /** Updates the display state (expanded/showFull) for tree view items */
  const updateItemDisplayState = useCallback((updater: (prevMap: ItemDisplayStates) => ItemDisplayStates) => {
      setItemDisplayStates(prevMap => {
          const newMap = updater(prevMap);
          // Only increment version counter if the map reference actually changes
          if (newMap !== prevMap) {
              setItemDisplayVersion(v => v + 1); // Trigger re-render of virtualized list
              return newMap;
          }
          return prevMap; // Return old map if no change
      });
  }, []); // No dependencies needed

  /** Toggles the expanded state of a tree view item */
  const handleToggleExpand = useCallback((filePath: string) => {
    updateItemDisplayState(prevMap => {
      const newMap = new Map(prevMap); // Create a new map instance
      const currentState = newMap.get(filePath);
      if (currentState?.expanded) {
          newMap.delete(filePath); // Collapse: remove entry
      } else {
          newMap.set(filePath, { expanded: true, showFull: false }); // Expand: add entry
      }
      return newMap; // Return the new map
    });
  }, [updateItemDisplayState]); // Depend on the memoized updater

  /** Sets a tree view item to show its full content */
  const handleShowFullContent = useCallback((filePath: string) => {
    updateItemDisplayState(prevMap => {
        const currentState = prevMap.get(filePath); // Check current state from previous map
        // Only update if it's expanded but not showing full content yet
        if (currentState?.expanded && !currentState.showFull) {
            const newMap = new Map(prevMap); // Create new map only if changing
            newMap.set(filePath, { ...currentState, showFull: true });
            return newMap; // Return the new map
        }
        return prevMap; // Return the *previous* map reference if no change
    });
  }, [updateItemDisplayState]); // Depend on the memoized updater
  // ---------------------------------------

  // --- Filtering Logic for Results Display ---
  const isFilterActive = debouncedFilterTerm.trim().length > 0;

  /** Memoized filtered lines for the text view */
  const filteredTextLines = useMemo(() => {
    if (!results) return [];
    const lines = results.split('\n');
    if (!isFilterActive) return lines; // Return all lines if filter is inactive

    const term = debouncedFilterTerm;
    const caseSensitive = resultsFilterCaseSensitive;

    return lines.filter(line => {
      if (caseSensitive) {
        return line.includes(term);
      } else {
        return line.toLowerCase().includes(term.toLowerCase());
      }
    });
  }, [results, debouncedFilterTerm, resultsFilterCaseSensitive, isFilterActive]);

  /** Memoized filtered items for the tree view */
  const filteredStructuredResults = useMemo(() => {
    if (!structuredResults) return null;
    if (!isFilterActive) return structuredResults; // Return all items if filter is inactive

    const term = debouncedFilterTerm;
    const caseSensitive = resultsFilterCaseSensitive;

    return structuredResults.filter(item => {
      // Check if filter term matches file path
      const filePathMatch = caseSensitive
        ? item.filePath.includes(term)
        : item.filePath.toLowerCase().includes(term.toLowerCase());

      // Check if filter term matches file content (if content exists)
      const contentMatch = item.content !== null && (
        caseSensitive
          ? item.content.includes(term)
          : item.content.toLowerCase().includes(term.toLowerCase())
      );

      return filePathMatch || contentMatch; // Include item if either path or content matches
    });
  }, [structuredResults, debouncedFilterTerm, resultsFilterCaseSensitive, isFilterActive]);
  // -----------------------------------------

  // --- Render ---
  return (
    <div className="app-container">
      {/* Header with Title and Action Buttons */}
      <div className="app-header">
        <h1>{t('common:appName')}</h1>
        <div className="app-header-actions">
            {/* History Button */}
            <HistoryButton onClick={openHistoryModal} disabled={isLoading} />
            {/* Settings Button */}
            <button onClick={openSettings} className="settings-button" aria-label={t('common:settings')}>
              ⚙️
            </button>
        </div>
      </div>

      {/* Search Form Component */}
      <SearchForm
        onSubmit={handleSearchSubmit}
        isLoading={isLoading}
        // Pass the history entry to load and the completion callback
        historyEntryToLoad={historyEntryToLoad}
        onLoadComplete={handleHistoryLoadComplete}
      />

      {/* General Error Display */}
      {generalError && <p className="error-message">{t('errors:generalErrorPrefix')} {generalError}</p>}

      {/* Path Access Error Display */}
      {pathErrors.length > 0 && (
        <div className="path-errors-container warning-message">
          <h4>{t('errors:pathErrorsHeading')}</h4>
          <ul>{pathErrors.map((err, i) => <li key={`path-err-${i}`}>{err}</li>)}</ul>
        </div>
      )}

      {/* File Read Error Display */}
      {fileReadErrors.length > 0 && (
        <div className="file-read-errors-container error-message">
          <h4>{t('errors:fileReadErrorsHeading', { count: fileReadErrors.length })}</h4>
          {Object.entries(groupedFileReadErrors).map(([key, paths]) => (
            <div key={key} className="error-group">
              <h5>{t(`errors:${key}`, { defaultValue: key, count: paths.length })}:</h5>
              <ul>{paths.map((p, i) => <li key={`${key}-${i}`}>{p}</li>)}</ul>
            </div>
          ))}
        </div>
      )}

      {/* Progress Bar */}
      {isLoading && progress && <ProgressBar {...progress} />}

      {/* Results Area (only shown when not loading and results exist) */}
      {!isLoading && results !== null && searchSummary && (
        <div className="results-area">
            {/* Results Filter Section */}
            <div className="results-filter-section">
                <label htmlFor="resultsFilterInput" className="results-filter-label">
                    {t('results:filterResultsLabel')}
                </label>
                <input
                    type="text"
                    id="resultsFilterInput"
                    className="results-filter-input"
                    value={resultsFilterTerm}
                    onChange={(e) => setResultsFilterTerm(e.target.value)}
                    placeholder={t('results:filterResultsPlaceholder')}
                />
                <div className="results-filter-checkbox-group">
                    <input
                        type="checkbox"
                        id="resultsFilterCaseSensitive"
                        className="results-filter-checkbox"
                        checked={resultsFilterCaseSensitive}
                        onChange={(e) => setResultsFilterCaseSensitive(e.target.checked)}
                    />
                    <label htmlFor="resultsFilterCaseSensitive" className="results-filter-checkbox-label">
                        {t('results:filterCaseSensitiveLabel')}
                    </label>
                </div>
            </div>

            {/* View Mode Switcher */}
            <div className="view-mode-switcher">
                <label>
                    <input type="radio" name="viewMode" value="text" checked={viewMode === 'text'} onChange={() => setViewMode('text')} />
                    {t('results:viewModeText')}
                </label>
                <label>
                    <input type="radio" name="viewMode" value="tree" checked={viewMode === 'tree'} onChange={() => setViewMode('tree')} disabled={!structuredResults} />
                    {t('results:viewModeTree')}
                </label>
            </div>

            {/* Results Display Component */}
            <ResultsDisplay
                results={results} // Raw text results
                filteredTextLines={filteredTextLines} // Filtered lines for text view
                filteredStructuredItems={filteredStructuredResults} // Filtered items for tree view
                summary={searchSummary} // Search summary stats
                viewMode={viewMode} // Current view mode ('text' or 'tree')
                itemDisplayStates={itemDisplayStates} // Map of expanded/showFull states for tree items
                itemDisplayVersion={itemDisplayVersion} // Version counter to force list updates
                onCopy={handleCopyResults} // Callback for copy button
                onSave={handleSaveResults} // Callback for save button
                onToggleExpand={handleToggleExpand} // Callback to toggle tree item expansion
                onShowFullContent={handleShowFullContent} // Callback to show full content in tree item
                isFilterActive={isFilterActive} // Whether the results filter is active
                filterTerm={debouncedFilterTerm} // The debounced filter term
                filterCaseSensitive={resultsFilterCaseSensitive} // Filter case sensitivity
            />
        </div>
      )}

      {/* Modals */}
      <SettingsModal isOpen={isSettingsOpen} onClose={closeSettings} />
      <HistoryModal
        isOpen={isHistoryOpen}
        onClose={closeHistoryModal}
        history={searchHistory} // Pass full history state
        onLoad={handleLoadSearchFromHistory} // Handler to load an entry
        onDelete={handleDeleteHistoryEntry} // Handler to delete an entry
        onClear={handleClearHistory} // Handler to clear all history
        onUpdateEntry={handleUpdateHistoryEntry} // Pass the new update handler
      />
    </div>
  );
}

export default App;
