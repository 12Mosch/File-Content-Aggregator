import React from "react";
import { useTranslation } from "react-i18next";
import { Progress } from "@/components/ui/progress";

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
  const { t } = useTranslation(["common"]);

  // Calculate percentage (ensure it's between 0 and 100)
  const percentage =
    total > 0
      ? Math.min(100, Math.max(0, Math.round((processed / total) * 100)))
      : 0;

  // Determine the display message
  const displayMessage = message || t("progressDefault", { processed, total });

  return (
    // Main container with vertical spacing
    <div className="w-full my-4 space-y-2">
      {/* Container for the text labels (message and error) */}
      <div className="flex justify-between items-center flex-wrap gap-x-4 text-sm text-muted-foreground">
        {/* Display message and percentage */}
        <span>
          {displayMessage} ({percentage}%)
        </span>
        {/* Display error message if present */}
        {error && (
          <span className="ml-4 font-semibold text-destructive">
            {t("progressErrorPrefix")} {error}
          </span>
        )}
      </div>
      {/* Use the shadcn Progress component */}
      <Progress
        value={percentage} // Pass the calculated percentage
        aria-label={displayMessage} // For accessibility
        className="h-2.5" // Optional: Adjust height if needed (default is h-2)
      />
    </div>
  );
};

export default ProgressBar;
