/**
 * Search Progress Component
 *
 * Displays the progress of an ongoing search operation.
 * Shows a progress bar, statistics, and allows cancellation.
 */

import React, { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { SearchProgress as SearchProgressType } from "../services/SearchService";
import { X } from "lucide-react";

interface SearchProgressProps {
  searchId: string; // Renamed to _searchId in component but keeping original name in interface
  onCancel: () => void;
  progress: SearchProgressType;
}

export function SearchProgress({
  onCancel,
  progress,
}: SearchProgressProps) {
  const { t } = useTranslation();
  const [elapsedTime, setElapsedTime] = useState<string>("0:00");

  // Format the elapsed time
  useEffect(() => {
    const formatTime = (ms: number) => {
      const seconds = Math.floor(ms / 1000);
      const minutes = Math.floor(seconds / 60);
      const remainingSeconds = seconds % 60;
      return `${minutes}:${remainingSeconds.toString().padStart(2, "0")}`;
    };

    setElapsedTime(formatTime(progress.elapsedTimeMs));

    // Update elapsed time every second
    const interval = setInterval(() => {
      setElapsedTime(formatTime(performance.now() - performance.now()));
    }, 1000);

    return () => clearInterval(interval);
  }, [progress.elapsedTimeMs]);

  // Calculate progress percentage
  const progressPercent =
    progress.totalFiles > 0
      ? Math.round((progress.filesProcessed / progress.totalFiles) * 100)
      : 0;

  return (
    <div className="bg-background border rounded-md p-4 mb-4 shadow-sm">
      <div className="flex justify-between items-center mb-2">
        <h3 className="text-lg font-medium">{t("search:searchInProgress")}</h3>
        <Button
          variant="ghost"
          size="icon"
          onClick={onCancel}
          aria-label={t("common:cancel")}
        >
          <X className="h-4 w-4" />
        </Button>
      </div>

      <Progress value={progressPercent} className="h-2 mb-2" />

      <div className="grid grid-cols-2 gap-4 text-sm">
        <div>
          <span className="text-muted-foreground">
            {t("search:filesProcessed")}:
          </span>{" "}
          <span className="font-medium">
            {progress.filesProcessed} / {progress.totalFiles}
          </span>
        </div>

        <div>
          <span className="text-muted-foreground">
            {t("search:matchesFound")}:
          </span>{" "}
          <span className="font-medium">{progress.matchesFound}</span>
        </div>

        <div>
          <span className="text-muted-foreground">
            {t("search:elapsedTime")}:
          </span>{" "}
          <span className="font-medium">{elapsedTime}</span>
        </div>

        {progress.currentFile && (
          <div className="col-span-2 truncate">
            <span className="text-muted-foreground">
              {t("search:currentFile")}:
            </span>{" "}
            <span className="font-medium">{progress.currentFile}</span>
          </div>
        )}
      </div>
    </div>
  );
}
