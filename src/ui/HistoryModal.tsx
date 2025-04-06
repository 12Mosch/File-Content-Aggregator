// D:/Code/Electron/src/ui/HistoryModal.tsx
import React, { useState, useMemo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import HistoryListItem from './HistoryListItem';
import type { SearchHistoryEntry, SearchParams } from './vite-env.d'; // Import SearchParams
import useDebounce from './hooks/useDebounce';
import './HistoryModal.css';

interface HistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  history: SearchHistoryEntry[];
  onLoad: (entry: SearchHistoryEntry) => void;
  onDelete: (entryId: string) => void;
  onClear: () => void;
  onUpdateEntry: (entryId: string, updates: Partial<Pick<SearchHistoryEntry, 'name' | 'isFavorite'>>) => void;
}

const HISTORY_FILTER_DEBOUNCE = 300; // ms

// Helper to create a comprehensive searchable string from the entry
const createSearchableString = (entry: SearchHistoryEntry): string => {
    const name = entry.name ?? '';
    const params = entry.searchParams;

    // Combine relevant parameters into a single string for searching
    const searchableParams = [
        name,
        params.searchPaths?.join(' ') ?? '',
        params.extensions?.join(' ') ?? '',
        params.excludeFiles?.join(' ') ?? '',
        params.excludeFolders?.join(' ') ?? '',
        params.contentSearchTerm ?? '', // Use the generated string query
        // Add other simple params if desired (e.g., dates, depth)
        params.modifiedAfter ?? '',
        params.modifiedBefore ?? '',
        params.maxDepth?.toString() ?? '',
        // Size might be less useful unless formatted back, skipping for now
    ];

    return searchableParams.join(' ').toLowerCase(); // Join all parts and convert to lowercase
};


const HistoryModal: React.FC<HistoryModalProps> = ({
  isOpen,
  onClose,
  history,
  onLoad,
  onDelete,
  onClear,
  onUpdateEntry,
}) => {
  const { t } = useTranslation(['common']);
  const [filterTerm, setFilterTerm] = useState('');
  const debouncedFilterTerm = useDebounce(filterTerm, HISTORY_FILTER_DEBOUNCE);

  // Filter and sort history entries
  const filteredAndSortedHistory = useMemo(() => {
    const lowerCaseFilter = debouncedFilterTerm.toLowerCase().trim();

    // Filter based on the comprehensive searchable string
    const filtered = lowerCaseFilter
      ? history.filter(entry => createSearchableString(entry).includes(lowerCaseFilter))
      : history;

    // Sort: Favorites first, then by timestamp descending
    return filtered.sort((a, b) => {
      if (a.isFavorite && !b.isFavorite) return -1;
      if (!a.isFavorite && b.isFavorite) return 1;
      return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
    });
  }, [history, debouncedFilterTerm]);

  const handleFilterChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFilterTerm(e.target.value);
  };

  if (!isOpen) {
    return null;
  }

  return (
    <div className="modal-overlay history-modal-overlay" onClick={onClose}>
      <div className="modal-content history-modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header history-modal-header">
          <h2>{t('historyTitle')}</h2>
           {/* Filter Input */}
           <input
                type="text"
                placeholder={t('historyFilterPlaceholder')} // Update placeholder text via i18n
                value={filterTerm}
                onChange={handleFilterChange}
                className="history-filter-input"
            />
          <button onClick={onClose} className="modal-close-btn history-modal-close-btn" aria-label={t('closeButton')}>
            &times;
          </button>
        </div>

        <div className="modal-body history-modal-body">
          {history.length === 0 ? (
            <p>{t('historyEmpty')}</p>
          ) : filteredAndSortedHistory.length === 0 ? (
             <p>{t('historyNoResults')}</p>
          ) : (
            <ul className="history-list">
              {filteredAndSortedHistory.map((entry) => (
                <HistoryListItem
                  key={entry.id}
                  entry={entry}
                  onLoad={onLoad}
                  onDelete={onDelete}
                  onUpdate={onUpdateEntry}
                />
              ))}
            </ul>
          )}
        </div>

        <div className="modal-footer history-modal-footer">
          <button
            onClick={onClear}
            disabled={history.length === 0}
            className="history-clear-button"
          >
            {t('historyClearAllButton')}
          </button>
          <button onClick={onClose} className="history-close-button">
            {t('closeButton')}
          </button>
        </div>
      </div>
    </div>
  );
};

export default HistoryModal;
