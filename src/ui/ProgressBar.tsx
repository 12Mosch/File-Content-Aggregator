import React from "react";
import "./ProgressBar.css"; // We'll create this CSS file next

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
  // Avoid division by zero and handle initial state
  const percentage = total > 0 ? Math.round((processed / total) * 100) : 0;

  return (
    <div className="progress-container">
      <div className="progress-info">
        <span>
          {message || `Processing ${processed} of ${total} files...`} (
          {percentage}%)
        </span>
        {error && <span className="progress-error">Error: {error}</span>}
      </div>
      <div className="progress-bar-background">
        <div
          className="progress-bar-foreground"
          style={{ width: `${percentage}%` }}
          role="progressbar"
          aria-valuenow={percentage}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={message || "Search progress"}
        ></div>
      </div>
    </div>
  );
};

export default ProgressBar;
