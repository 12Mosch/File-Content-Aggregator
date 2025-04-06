import React, { useState, useMemo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import HistoryListItem from './HistoryListItem';
import type { SearchHistoryEntry } from './vite-env.d';
import useDebounce from './hooks/useDebounce'; // Import debounce hook
import './HistoryModal.css';

interface HistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  history: SearchHistoryEntry[];
  onLoad: (entry: SearchHistoryEntry) => void;
  onDelete: (entryId: string) => void;
  onClear: () => void;
  onUpdateEntry: (entryId: string, updates: Partial<Pick<SearchHistoryEntry, 'name' | 'isFavorite'>>) => void; // Add update handler prop
}

const HISTORY_FILTER_DEBOUNCE = 300; // ms

// Helper to create a searchable string from params (simplified)
const createSearchableString = (entry: SearchHistoryEntry): string => {
    const name = entry.name ?? '';
    const paths = entry.searchParams.searchPaths?.join(' ') ?? '';
    const query = entry.searchParams.contentSearchTerm ?? ''; // Use the generated string query
    return `${name} ${paths} ${query}`.toLowerCase();
};


const HistoryModal: React.FC<HistoryModalProps> = ({
  isOpen,
  onClose,
  history,
  onLoad,
  onDelete,
  onClear,
  onUpdateEntry, // Receive update handler
}) => {
  const { t } = useTranslation(['common']);
  const [filterTerm, setFilterTerm] = useState('');
  const debouncedFilterTerm = useDebounce(filterTerm, HISTORY_FILTER_DEBOUNCE);

  // Filter and sort history entries
  const filteredAndSortedHistory = useMemo(() => {
    const lowerCaseFilter = debouncedFilterTerm.toLowerCase().trim();

    const filtered = lowerCaseFilter
      ? history.filter(entry => createSearchableString(entry).includes(lowerCaseFilter))
      : history;

    // Sort: Favorites first, then by timestamp descending
    return filtered.sort((a, b) => {
      if (a.isFavorite && !b.isFavorite) return -1;
      if (!a.isFavorite && b.isFavorite) return 1;
      // If favorite status is the same, sort by timestamp
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
           {/* --- Filter Input --- */}
           <input
                type="text"
                placeholder={t('historyFilterPlaceholder')}
                value={filterTerm}
                onChange={handleFilterChange}
                className="history-filter-input"
            />
          <button onClick={onClose} className="modal-close-btn history-modal-close-btn" aria-label={t('closeButton')}>
            &times;
          </button>
        </div>

        <div className="modal-body history-modal-body">
          {history.length === 0 ? ( // Check original history length for the empty message
            <p>{t('historyEmpty')}</p>
          ) : filteredAndSortedHistory.length === 0 ? ( // Check filtered length for no results message
             <p>{t('historyNoResults')}</p>
          ) : (
            <ul className="history-list">
              {filteredAndSortedHistory.map((entry) => (
                <HistoryListItem
                  key={entry.id}
                  entry={entry}
                  onLoad={onLoad}
                  onDelete={onDelete}
                  onUpdate={onUpdateEntry} // Pass the update handler down
                />
              ))}
            </ul>
          )}
        </div>

        <div className="modal-footer history-modal-footer">
          <button
            onClick={onClear}
            disabled={history.length === 0} // Disable based on original history length
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
