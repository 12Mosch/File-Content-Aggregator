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
  const [itemDisplayStates, setItemDisplayStates] = useState<ItemDisplayStates>(new Map());
  const [itemDisplayVersion, setItemDisplayVersion] = useState(0);

  const [resultsFilterTerm, setResultsFilterTerm] = useState<string>("");
  const [resultsFilterCaseSensitive, setResultsFilterCaseSensitive] = useState<boolean>(false);
  const debouncedFilterTerm = useDebounce(resultsFilterTerm, FILTER_DEBOUNCE_DELAY);

  // --- History State ---
  const [isHistoryOpen, setIsHistoryOpen] = useState<boolean>(false);
  const [searchHistory, setSearchHistory] = useState<SearchHistoryEntry[]>([]);
  // State to trigger loading a history entry into the form
  const [historyEntryToLoad, setHistoryEntryToLoad] = useState<SearchHistoryEntry | null>(null);
  // ---------------------

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

  useEffect(() => {
    if (window.electronAPI?.onSearchProgress) {
      const unsubscribe = window.electronAPI.onSearchProgress(setProgress);
      return unsubscribe;
    } else {
      console.warn("UI: electronAPI.onSearchProgress not found on window.");
      setGeneralError(t('errors:connectError'));
    }
  }, [t]);

  // --- History Functions ---
  const openHistoryModal = useCallback(async () => {
    if (window.electronAPI?.getSearchHistory) {
      try {
        const history = await window.electronAPI.getSearchHistory();
        setSearchHistory(history);
        setIsHistoryOpen(true);
      } catch (err) {
        console.error("UI: Failed to fetch search history:", err);
        setGeneralError(t('errors:historyFetchFailed'));
      }
    } else {
      console.warn("UI: getSearchHistory API not available.");
      setGeneralError(t('errors:historyApiNA'));
    }
  }, [t]);

  const closeHistoryModal = () => setIsHistoryOpen(false);

  const handleLoadSearchFromHistory = useCallback((entry: SearchHistoryEntry) => {
    console.log("UI: Loading history entry:", entry.id);
    setHistoryEntryToLoad(entry); // Set the entry to be loaded by SearchForm
    closeHistoryModal(); // Close modal after selection
  }, []);

  // Callback for SearchForm to signal loading is complete
  const handleHistoryLoadComplete = useCallback(() => {
    setHistoryEntryToLoad(null); // Reset the trigger
  }, []);

  const handleDeleteHistoryEntry = useCallback(async (entryId: string) => {
    if (window.electronAPI?.deleteSearchHistoryEntry) {
      try {
        await window.electronAPI.deleteSearchHistoryEntry(entryId);
        // Refresh history in the modal
        setSearchHistory(prev => prev.filter(entry => entry.id !== entryId));
      } catch (err) {
        console.error("UI: Failed to delete history entry:", err);
        setGeneralError(t('errors:historyDeleteFailed'));
      }
    } else {
      console.warn("UI: deleteSearchHistoryEntry API not available.");
      setGeneralError(t('errors:historyApiNA'));
    }
  }, [t]);

  const handleClearHistory = useCallback(async () => {
    // Optional: Add a confirmation dialog here
    if (!confirm(t('common:historyClearConfirm'))) {
        return;
    }
    if (window.electronAPI?.clearSearchHistory) {
      try {
        await window.electronAPI.clearSearchHistory();
        setSearchHistory([]); // Clear local state
        // Optionally close the modal after clearing
        // closeHistoryModal();
      } catch (err) {
        console.error("UI: Failed to clear history:", err);
        setGeneralError(t('errors:historyClearFailed'));
      }
    } else {
      console.warn("UI: clearSearchHistory API not available.");
      setGeneralError(t('errors:historyApiNA'));
    }
  }, [t]);
  // -----------------------

  const handleSearchSubmit = useCallback(async (params: SubmitParams) => {
    setIsLoading(true);
    setResults(null);
    setStructuredResults(null);
    setSearchSummary(null);
    setPathErrors([]);
    setFileReadErrors([]);
    setItemDisplayStates(new Map());
    setItemDisplayVersion(0);
    setProgress({ processed: 0, total: 0, message: "Starting search..." });
    setGeneralError(null);
    setResultsFilterTerm("");

    // --- Save to History ---
    if (window.electronAPI?.addSearchHistoryEntry && params.searchPaths.length > 0) {
        const historyEntry: SearchHistoryEntry = {
            id: generateId(), // Use utility function
            timestamp: new Date().toISOString(),
            // Store the exact parameters sent to the backend
            // including the potentially null structuredQuery
            searchParams: { ...params },
        };
        try {
            await window.electronAPI.addSearchHistoryEntry(historyEntry);
        } catch (err) {
            console.error("UI: Failed to save search to history:", err);
            // Non-critical error, don't block the search itself
        }
    }
    // ---------------------

    try {
      if (!window.electronAPI?.invokeSearch) throw new Error(t('errors:searchFunctionNA'));
      const searchResult: SearchResult = await window.electronAPI.invokeSearch(params);

      setResults(searchResult.output);
      setStructuredResults(searchResult.structuredItems);
      setSearchSummary({
        filesFound: searchResult.filesFound,
        filesProcessed: searchResult.filesProcessed,
        errorsEncountered: searchResult.errorsEncountered,
      });

      const translatedPathErrors = searchResult.pathErrors.map(err => {
          if (err.startsWith('Search path not found:')) return t('errors:pathNotFound', { path: err.substring('Search path not found:'.length).trim() });
          if (err.startsWith('Search path is not a directory:')) return t('errors:pathNotDir', { path: err.substring('Search path is not a directory:'.length).trim() });
          if (err.startsWith('Permission denied for search path:')) return t('errors:pathPermissionDenied', { path: err.substring('Permission denied for search path:'.length).trim() });
          // Add translation for boolean/regex parse errors if needed
          if (err.startsWith('Invalid boolean query syntax:')) return t('errors:invalidBooleanQuery', { detail: err.substring('Invalid boolean query syntax:'.length).trim() });
          if (err.startsWith('Invalid regular expression pattern:')) return t('errors:invalidRegexPattern', { pattern: err.substring('Invalid regular expression pattern:'.length).trim() });
          return err; // Fallback for untranslated errors
      });
      setPathErrors(translatedPathErrors);
      setFileReadErrors(searchResult.fileReadErrors);

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
  }, [t]); // Add t to dependency array

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
  }, [results, t]);

  const openSettings = () => setIsSettingsOpen(true);
  const closeSettings = () => setIsSettingsOpen(false);

  // --- Modified state update functions ---
  const updateItemDisplayState = useCallback((updater: (prevMap: ItemDisplayStates) => ItemDisplayStates) => {
      setItemDisplayStates(prevMap => {
          const newMap = updater(prevMap);
          if (newMap !== prevMap) {
              setItemDisplayVersion(v => v + 1);
              return newMap;
          }
          return prevMap;
      });
  }, []);

  const handleToggleExpand = useCallback((filePath: string) => {
    updateItemDisplayState(prevMap => {
      const newMap = new Map(prevMap);
      const currentState = newMap.get(filePath);
      if (currentState?.expanded) {
          newMap.delete(filePath);
      } else {
          newMap.set(filePath, { expanded: true, showFull: false });
      }
      return newMap;
    });
  }, [updateItemDisplayState]);

  const handleShowFullContent = useCallback((filePath: string) => {
    updateItemDisplayState(prevMap => {
        const currentState = prevMap.get(filePath);
        if (currentState?.expanded && !currentState.showFull) {
            const newMap = new Map(prevMap);
            newMap.set(filePath, { ...currentState, showFull: true });
            return newMap;
        }
        return prevMap;
    });
  }, [updateItemDisplayState]);
  // ---------------------------------------

  const isFilterActive = debouncedFilterTerm.trim().length > 0;

  const filteredTextLines = useMemo(() => {
    if (!results) return [];
    const lines = results.split('\n');
    if (!isFilterActive) return lines;

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

  const filteredStructuredResults = useMemo(() => {
    if (!structuredResults) return null;
    if (!isFilterActive) return structuredResults;

    const term = debouncedFilterTerm;
    const caseSensitive = resultsFilterCaseSensitive;

    return structuredResults.filter(item => {
      const filePathMatch = caseSensitive
        ? item.filePath.includes(term)
        : item.filePath.toLowerCase().includes(term.toLowerCase());

      const contentMatch = item.content !== null && (
        caseSensitive
          ? item.content.includes(term)
          : item.content.toLowerCase().includes(term.toLowerCase())
      );

      return filePathMatch || contentMatch;
    });
  }, [structuredResults, debouncedFilterTerm, resultsFilterCaseSensitive, isFilterActive]);

  return (
    <div className="app-container">
      <div className="app-header">
        <h1>{t('common:appName')}</h1>
        <div className="app-header-actions">
            <HistoryButton onClick={openHistoryModal} disabled={isLoading} />
            <button onClick={openSettings} className="settings-button" aria-label={t('common:settings')}>
              ⚙️
            </button>
        </div>
      </div>

      <SearchForm
        onSubmit={handleSearchSubmit}
        isLoading={isLoading}
        // Pass the history entry to load and the completion callback
        historyEntryToLoad={historyEntryToLoad}
        onLoadComplete={handleHistoryLoadComplete}
      />

      {generalError && <p className="error-message">{t('errors:generalErrorPrefix')} {generalError}</p>}

      {pathErrors.length > 0 && (
        <div className="path-errors-container warning-message">
          <h4>{t('errors:pathErrorsHeading')}</h4>
          <ul>{pathErrors.map((err, i) => <li key={`path-err-${i}`}>{err}</li>)}</ul>
        </div>
      )}

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

      {isLoading && progress && <ProgressBar {...progress} />}

      {!isLoading && results !== null && searchSummary && (
        <div className="results-area">
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

            <ResultsDisplay
                results={results}
                filteredTextLines={filteredTextLines}
                filteredStructuredItems={filteredStructuredResults}
                summary={searchSummary}
                viewMode={viewMode}
                itemDisplayStates={itemDisplayStates}
                itemDisplayVersion={itemDisplayVersion}
                onCopy={handleCopyResults}
                onSave={handleSaveResults}
                onToggleExpand={handleToggleExpand}
                onShowFullContent={handleShowFullContent}
                isFilterActive={isFilterActive}
                filterTerm={debouncedFilterTerm}
                filterCaseSensitive={resultsFilterCaseSensitive}
            />
        </div>
      )}

      <SettingsModal isOpen={isSettingsOpen} onClose={closeSettings} />
      <HistoryModal
        isOpen={isHistoryOpen}
        onClose={closeHistoryModal}
        history={searchHistory}
        onLoad={handleLoadSearchFromHistory}
        onDelete={handleDeleteHistoryEntry}
        onClear={handleClearHistory}
      />
    </div>
  );
}

export default App;
