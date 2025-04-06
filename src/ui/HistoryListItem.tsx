import React, { useState, useCallback, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import type { SearchHistoryEntry } from './vite-env.d';
import useDebounce from './hooks/useDebounce'; // Import debounce hook
import './HistoryModal.css';

interface HistoryListItemProps {
  entry: SearchHistoryEntry;
  onLoad: (entry: SearchHistoryEntry) => void;
  onDelete: (entryId: string) => void;
  onUpdate: (entryId: string, updates: Partial<Pick<SearchHistoryEntry, 'name' | 'isFavorite'>>) => void; // Update handler
}

// Debounce delay for saving name changes
const NAME_SAVE_DEBOUNCE = 750; // ms

// Helper to format timestamp (unchanged)
const formatTimestamp = (isoString: string): string => { try { return new Date(isoString).toLocaleString(); } catch (e) { return isoString; } };

// Helper to create a concise summary string (unchanged)
const createSummary = (params: SearchHistoryEntry['searchParams']): string => { let summary = params.searchPaths?.slice(0, 1).join(', ') ?? 'No paths'; if (params.searchPaths && params.searchPaths.length > 1) summary += ` (+${params.searchPaths.length - 1})`; if (params.contentSearchTerm) { const term = params.contentSearchTerm.length > 50 ? params.contentSearchTerm.substring(0, 47) + '...' : params.contentSearchTerm; summary += ` | Query: "${term}"`; } else if (params.structuredQuery) summary += ` | Query: [Builder]`; return summary; };

const HistoryListItem: React.FC<HistoryListItemProps> = ({ entry, onLoad, onDelete, onUpdate }) => {
  const { t } = useTranslation(['common']);
  const [isEditingName, setIsEditingName] = useState(false);
  const [currentName, setCurrentName] = useState(entry.name ?? '');
  const nameInputRef = useRef<HTMLInputElement>(null);

  // Debounce the name before calling the update function
  const debouncedName = useDebounce(currentName, NAME_SAVE_DEBOUNCE);

  // Effect to save the debounced name
  useEffect(() => {
    // Only save if editing and the debounced name is different from the original entry name
    // This prevents saving on initial load or if the name hasn't actually changed
    if (isEditingName && debouncedName !== (entry.name ?? '')) {
      onUpdate(entry.id, { name: debouncedName });
    }
  }, [debouncedName, entry.id, entry.name, onUpdate, isEditingName]);

  // Effect to focus input when editing starts
  useEffect(() => {
    if (isEditingName && nameInputRef.current) {
      nameInputRef.current.focus();
      nameInputRef.current.select(); // Select text for easy replacement
    }
  }, [isEditingName]);

  const handleLoadClick = () => onLoad(entry);
  const handleDeleteClick = () => onDelete(entry.id);

  const handleToggleFavorite = () => {
    onUpdate(entry.id, { isFavorite: !entry.isFavorite });
  };

  const handleNameClick = () => {
    if (!isEditingName) {
      setIsEditingName(true);
    }
  };

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setCurrentName(e.target.value);
  };

  const handleNameBlur = () => {
    setIsEditingName(false);
    // Save immediately on blur if the name changed from the original entry name
    // This catches cases where the user blurs before the debounce timer fires
    if (currentName !== (entry.name ?? '')) {
        onUpdate(entry.id, { name: currentName });
    }
  };

  const handleNameKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      setIsEditingName(false);
      // Save immediately on Enter if the name changed
      if (currentName !== (entry.name ?? '')) {
          onUpdate(entry.id, { name: currentName });
      }
    } else if (e.key === 'Escape') {
      setCurrentName(entry.name ?? ''); // Revert changes
      setIsEditingName(false);
    }
  };

  const summaryText = createSummary(entry.searchParams);
  const displayName = entry.name || t('historyUntitled'); // Use 'Untitled' if no name

  return (
    <li className={`history-list-item ${entry.isFavorite ? 'favorite' : ''}`}>
      <button
        onClick={handleToggleFavorite}
        className="history-item-favorite-toggle"
        title={entry.isFavorite ? t('historyUnfavorite') : t('historyFavorite')}
        aria-label={entry.isFavorite ? t('historyUnfavorite') : t('historyFavorite')}
      >
        {entry.isFavorite ? '★' : '☆'} {/* Filled/Empty star */}
      </button>
      <div className="history-item-summary" title={summaryText}>
        {isEditingName ? (
          <input
            ref={nameInputRef}
            type="text"
            value={currentName}
            onChange={handleNameChange}
            onBlur={handleNameBlur}
            onKeyDown={handleNameKeyDown}
            className="history-item-name-input"
            placeholder={t('historyNamePlaceholder')}
          />
        ) : (
          <span
            className={`history-item-name ${!entry.name ? 'untitled' : ''}`}
            onClick={handleNameClick}
            title={t('historyEditNameTooltip')} // Add tooltip to indicate clickable
          >
            {displayName}
          </span>
        )}
        <span className="history-item-timestamp">{formatTimestamp(entry.timestamp)}</span>
      </div>
      <div className="history-item-actions">
        <button onClick={handleLoadClick} className="history-item-button load">
          {t('historyLoadButton')}
        </button>
        <button onClick={handleDeleteClick} className="history-item-button delete">
          {t('historyDeleteButton')}
        </button>
      </div>
    </li>
  );
};

export default HistoryListItem;
