import React from 'react';
import { useTranslation } from 'react-i18next';
import HistoryListItem from './HistoryListItem';
import type { SearchHistoryEntry } from './vite-env.d';
import './HistoryModal.css'; // Create or reuse modal CSS

interface HistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  history: SearchHistoryEntry[];
  onLoad: (entry: SearchHistoryEntry) => void;
  onDelete: (entryId: string) => void;
  onClear: () => void;
}

const HistoryModal: React.FC<HistoryModalProps> = ({
  isOpen,
  onClose,
  history,
  onLoad,
  onDelete,
  onClear,
}) => {
  const { t } = useTranslation(['common']);

  if (!isOpen) {
    return null;
  }

  return (
    <div className="modal-overlay history-modal-overlay" onClick={onClose}>
      <div className="modal-content history-modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header history-modal-header">
          <h2>{t('historyTitle')}</h2>
          <button onClick={onClose} className="modal-close-btn history-modal-close-btn" aria-label={t('closeButton')}>
            &times;
          </button>
        </div>

        <div className="modal-body history-modal-body">
          {history.length === 0 ? (
            <p>{t('historyEmpty')}</p>
          ) : (
            <ul className="history-list">
              {history.map((entry) => (
                <HistoryListItem
                  key={entry.id}
                  entry={entry}
                  onLoad={onLoad}
                  onDelete={onDelete}
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
