/**
 * Highlight Theme Selector Component
 *
 * A component that allows users to select the highlighting theme
 * and provides a preview of the selected theme.
 */

import React, { useState, useEffect } from "react";
import { getCurrentTheme } from "../utils/themeDetection";
import { getHighlightWorkerPool } from "../services/HighlightWorkerPool";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export interface HighlightThemeSelectorProps {
  /** Current theme preference */
  currentTheme?: "light" | "dark" | "high-contrast" | "auto";
  /** Callback when theme changes */
  onThemeChange?: (theme: "light" | "dark" | "high-contrast" | "auto") => void;
  /** Whether to show preview */
  showPreview?: boolean;
  /** Custom CSS class */
  className?: string;
}

const SAMPLE_CODE = `function fibonacci(n) {
  if (n <= 1) return n;
  return fibonacci(n - 1) + fibonacci(n - 2);
}

// Calculate the 10th Fibonacci number
const result = fibonacci(10);
console.log(\`Result: \${result}\`);`;

/**
 * Theme selector with live preview
 */
export const HighlightThemeSelector: React.FC<HighlightThemeSelectorProps> = ({
  currentTheme = "auto",
  onThemeChange,
  showPreview = true,
  className = "",
}) => {
  const [selectedTheme, setSelectedTheme] = useState(currentTheme);
  const [previewHtml, setPreviewHtml] = useState<string>("");
  const [isLoading, setIsLoading] = useState(false);

  // Update preview when theme changes
  useEffect(() => {
    if (!showPreview) return;

    const updatePreview = async () => {
      setIsLoading(true);
      try {
        const workerPool = getHighlightWorkerPool();
        const effectiveTheme =
          selectedTheme === "auto" ? getCurrentTheme() : selectedTheme;

        const result = await workerPool.highlight({
          filePath: "preview.js",
          code: SAMPLE_CODE,
          language: "javascript",
          theme: effectiveTheme,
          priority: "low",
        });

        if (result.status === "done" && result.highlightedHtml) {
          setPreviewHtml(result.highlightedHtml);
        }
      } catch (error) {
        console.error("Failed to generate theme preview:", error);
        setPreviewHtml(`<pre><code>${SAMPLE_CODE}</code></pre>`);
      } finally {
        setIsLoading(false);
      }
    };

    void updatePreview();
  }, [selectedTheme, showPreview]);

  const handleThemeChange = (newTheme: string) => {
    const theme = newTheme as "light" | "dark" | "high-contrast" | "auto";
    setSelectedTheme(theme);
    onThemeChange?.(theme);
  };

  const getThemeDescription = (theme: string) => {
    switch (theme) {
      case "light":
        return "Clean, professional appearance for light backgrounds";
      case "dark":
        return "Easy on the eyes for dark environments";
      case "high-contrast":
        return "Maximum contrast for accessibility";
      case "auto":
        return "Automatically matches your system theme";
      default:
        return "";
    }
  };

  return (
    <div className={`space-y-4 ${className}`}>
      <div className="space-y-2">
        <Label htmlFor="highlight-theme-select">
          Syntax Highlighting Theme
        </Label>
        <Select value={selectedTheme} onValueChange={handleThemeChange}>
          <SelectTrigger id="highlight-theme-select">
            <SelectValue placeholder="Select a theme" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="auto">
              <div className="flex flex-col">
                <span>Auto</span>
                <span className="text-xs text-muted-foreground">
                  {getThemeDescription("auto")}
                </span>
              </div>
            </SelectItem>
            <SelectItem value="light">
              <div className="flex flex-col">
                <span>Light</span>
                <span className="text-xs text-muted-foreground">
                  {getThemeDescription("light")}
                </span>
              </div>
            </SelectItem>
            <SelectItem value="dark">
              <div className="flex flex-col">
                <span>Dark</span>
                <span className="text-xs text-muted-foreground">
                  {getThemeDescription("dark")}
                </span>
              </div>
            </SelectItem>
            <SelectItem value="high-contrast">
              <div className="flex flex-col">
                <span>High Contrast</span>
                <span className="text-xs text-muted-foreground">
                  {getThemeDescription("high-contrast")}
                </span>
              </div>
            </SelectItem>
          </SelectContent>
        </Select>
      </div>

      {showPreview && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Preview</CardTitle>
            <CardDescription>
              How syntax highlighting will appear with the selected theme
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center p-4">
                <div className="h-6 w-6 animate-spin rounded-full border-b-2 border-primary"></div>
                <span className="ml-2 text-sm text-muted-foreground">
                  Loading preview...
                </span>
              </div>
            ) : (
              <div
                className="overflow-x-auto rounded border p-3 text-sm"
                dangerouslySetInnerHTML={{ __html: previewHtml }}
              />
            )}
          </CardContent>
        </Card>
      )}

      <div className="text-xs text-muted-foreground">
        <p>
          <strong>Performance:</strong> The enhanced highlighting system uses
          worker pools for better performance and supports 30+ programming
          languages with lazy loading.
        </p>
        <p className="mt-1">
          <strong>Accessibility:</strong> All themes include proper ARIA labels
          and semantic markup for screen readers.
        </p>
      </div>
    </div>
  );
};

/**
 * Simple theme toggle button
 */
export const HighlightThemeToggle: React.FC<{
  currentTheme: "light" | "dark" | "high-contrast";
  onToggle: (theme: "light" | "dark" | "high-contrast") => void;
}> = ({ currentTheme, onToggle }) => {
  const getNextTheme = (current: string) => {
    switch (current) {
      case "light":
        return "dark";
      case "dark":
        return "high-contrast";
      case "high-contrast":
        return "light";
      default:
        return "light";
    }
  };

  const handleToggle = () => {
    const nextTheme = getNextTheme(currentTheme);
    onToggle(nextTheme);
  };

  return (
    <button
      onClick={handleToggle}
      className="rounded border px-3 py-1 text-xs hover:bg-accent"
      title={`Current: ${currentTheme}. Click to cycle themes.`}
    >
      Theme: {currentTheme}
    </button>
  );
};

export default HighlightThemeSelector;
