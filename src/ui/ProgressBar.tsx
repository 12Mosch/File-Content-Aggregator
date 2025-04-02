import React from "react";
import { useTranslation } from "react-i18next"; // Import the hook
import "./ProgressBar.css";

interface ProgressBarProps {
  processed: number;
  total: number;
  message?: string;
  error?: string;
}

const ProgressBar: React.FC<ProgressBarProps> = ({
  processed,
  total,
  message,
  error,
}) => {
  // Use the hook, specifying the 'common' namespace
  const { t } = useTranslation(['common']);

  const percentage = total > 0 ? Math.round((processed / total) * 100) : 0;

  // Use provided message or generate default translated message with interpolation
  const displayMessage = message || t('progressDefault', { processed, total });

  return (
    <div className="progress-container">
      <div className="progress-info">
        <span>
          {displayMessage} ({percentage}%)
        </span>
        {/* Translate error prefix */}
        {error && <span className="progress-error">{t('progressErrorPrefix')} {error}</span>}
      </div>
      <div className="progress-bar-background">
        <div
          className="progress-bar-foreground"
          style={{ width: `${percentage}%` }}
          role="progressbar"
          aria-valuenow={percentage}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={displayMessage} // Use translated message for accessibility
        ></div>
      </div>
    </div>
  );
};

export default ProgressBar;
