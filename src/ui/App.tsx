// D:/Code/Electron/src/ui/App.tsx
import React, { useState, useEffect, useCallback, useMemo } from "react";
import { useTranslation } from "react-i18next";
import SearchForm from "./SearchForm";
import ResultsDisplay from "./ResultsDisplay";
import ProgressBar from "./ProgressBar";
import SettingsModal from "./SettingsModal";
import useDebounce from "./hooks/useDebounce";
import type {
  ProgressData,
  SearchResult,
  FileReadError,
  IElectronAPI,
  StructuredItem,
} from "./vite-env.d";

import "./App.css";
import "./index.css";
import "./SettingsModal.css";
import "./ResultsFilter.css";

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
  // --- Add a state counter to force updates ---
  const [itemDisplayVersion, setItemDisplayVersion] = useState(0);
  // -------------------------------------------

  const [resultsFilterTerm, setResultsFilterTerm] = useState<string>("");
  const [resultsFilterCaseSensitive, setResultsFilterCaseSensitive] = useState<boolean>(false);
  const debouncedFilterTerm = useDebounce(resultsFilterTerm, FILTER_DEBOUNCE_DELAY);

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

  const handleSearchSubmit = useCallback(async (params: SearchParamsUI) => {
    setIsLoading(true);
    setResults(null);
    setStructuredResults(null);
    setSearchSummary(null);
    setPathErrors([]);
    setFileReadErrors([]);
    setItemDisplayStates(new Map()); // Reset map
    setItemDisplayVersion(0); // Reset version counter
    setProgress({ processed: 0, total: 0, message: "Starting search..." });
    setGeneralError(null);
    setResultsFilterTerm("");

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
          return err;
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
  }, [t]);

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
          // Always create a new map from the updater function's result
          const newMap = updater(prevMap);
          // Only increment version if the map actually changed reference or content
          // (updater should return prevMap if no change occurred)
          if (newMap !== prevMap) {
              setItemDisplayVersion(v => v + 1); // Increment version on change
              return newMap;
          }
          return prevMap; // Return old map if no change
      });
  }, []); // No dependencies needed for the updater function itself

  const handleToggleExpand = useCallback((filePath: string) => {
    console.log(`[App] Toggling expand for: ${filePath}`);
    updateItemDisplayState(prevMap => {
      const newMap = new Map(prevMap); // Create a new map instance
      const currentState = newMap.get(filePath);
      if (currentState?.expanded) {
          console.log(`[App] Collapsing: ${filePath}`);
          newMap.delete(filePath);
      } else {
          console.log(`[App] Expanding: ${filePath}`);
          newMap.set(filePath, { expanded: true, showFull: false });
      }
      console.log('[App] New itemDisplayStates size:', newMap.size);
      return newMap; // Return the new map
    });
  }, [updateItemDisplayState]); // Depend on the memoized updater

  const handleShowFullContent = useCallback((filePath: string) => {
    console.log(`[App] handleShowFullContent called for: ${filePath}`);
    updateItemDisplayState(prevMap => {
        const currentState = prevMap.get(filePath); // Check current state from previous map
        console.log(`[App] Current state for ${filePath}:`, currentState);

        if (currentState?.expanded && !currentState.showFull) {
            const newMap = new Map(prevMap); // Create new map only if changing
            console.log(`[App] Setting showFull = true for: ${filePath}`);
            newMap.set(filePath, { ...currentState, showFull: true });
            return newMap; // Return the new map
        }
        console.log(`[App] No state change needed for showFull on: ${filePath}`);
        return prevMap; // Return the *previous* map reference if no change
    });
  }, [updateItemDisplayState]); // Depend on the memoized updater
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
        <button onClick={openSettings} className="settings-button" aria-label={t('common:settings')}>
          ⚙️
        </button>
      </div>

      <SearchForm onSubmit={handleSearchSubmit} isLoading={isLoading} />

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

            {/* Pass itemDisplayStates AND itemDisplayVersion down */}
            <ResultsDisplay
                results={results}
                filteredTextLines={filteredTextLines}
                filteredStructuredItems={filteredStructuredResults}
                summary={searchSummary}
                viewMode={viewMode}
                itemDisplayStates={itemDisplayStates} // Pass the state map
                itemDisplayVersion={itemDisplayVersion} // Pass the version counter
                onCopy={handleCopyResults}
                onSave={handleSaveResults}
                onToggleExpand={handleToggleExpand}
                onShowFullContent={handleShowFullContent} // Pass the handler
                isFilterActive={isFilterActive}
                filterTerm={debouncedFilterTerm}
                filterCaseSensitive={resultsFilterCaseSensitive}
            />
        </div>
      )}

      <SettingsModal isOpen={isSettingsOpen} onClose={closeSettings} />
    </div>
  );
}

export default App;
