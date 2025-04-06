import React from 'react';
import { useTranslation } from 'react-i18next';
import './HistoryButton.css'; // Create this CSS file

interface HistoryButtonProps {
  onClick: () => void;
  disabled?: boolean;
}

const HistoryButton: React.FC<HistoryButtonProps> = ({ onClick, disabled }) => {
  const { t } = useTranslation(['common']);

  return (
    <button
      onClick={onClick}
      className="history-button"
      aria-label={t('historyButtonLabel')}
      title={t('historyButtonLabel')} // Tooltip
      disabled={disabled}
    >
      {/* Simple history icon (Unicode or SVG) */}
      🕒
      {/* Or use an SVG icon */}
      {/* <svg ... /> */}
    </button>
  );
};

export default HistoryButton;
