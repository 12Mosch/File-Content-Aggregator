// D:/Code/Electron/src/ui/SearchForm.tsx
/*
 * D:/Code/Electron/src/ui/SearchForm.tsx
 * Bug Fix: Ensure latest state is used when submitting query parameters.
 * Description: Using state variables directly in handleSubmit,
 *              ensuring callbacks correctly update the parent state.
 */
import React, { useState, useCallback, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { format, parseISO, isValid, parse, type Locale } from "date-fns";
import { enUS, de, es, fr, it, ja, pt, ru } from "date-fns/locale";
import QueryBuilder from "./QueryBuilder";
import type { QueryGroup as QueryStructure } from "./queryBuilderTypes";
import {
  isQueryStructure,
  convertStructuredQueryToString,
  generateId,
} from "./queryBuilderUtils";
import type { SearchHistoryEntry, SearchParams } from "./vite-env.d";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar as CalendarIcon, X, Loader2 } from "lucide-react";
import type { Matcher } from "react-day-picker";

// Define unit constants for calculations
const SIZE_UNITS = {
  Bytes: 1,
  KB: 1024,
  MB: 1024 * 1024,
  GB: 1024 * 1024 * 1024,
};
type SizeUnit = keyof typeof SIZE_UNITS;
type FolderExclusionMode = "contains" | "exact" | "startsWith" | "endsWith";
// Type for keys used in handleSelectChange
type SelectFieldName = "folderExclusionMode" | "minSizeUnit" | "maxSizeUnit";
// Type for translation keys for size units
type SizeUnitTranslationKey = `sizeUnit${SizeUnit}`;

// Define the shape of the data managed by the form's internal state
interface SearchFormData {
  searchPaths: string;
  extensions: string;
  excludeFiles: string;
  excludeFolders: string;
  folderExclusionMode: FolderExclusionMode;
  modifiedAfter: Date | undefined;
  modifiedBefore: Date | undefined;
  minSizeValue: string;
  minSizeUnit: SizeUnit;
  maxSizeValue: string;
  maxSizeUnit: SizeUnit;
  maxDepthValue: string;
}

interface SearchFormProps {
  onSubmit: (params: SearchParams) => void;
  isLoading: boolean;
  historyEntryToLoad: SearchHistoryEntry | null;
  onLoadComplete: (params: SearchParams) => void;
}

// Helper to convert size in bytes back to value and unit for the form
const bytesToSizeForm = (
  bytes: number | undefined
): { value: string; unit: SizeUnit } => {
  if (bytes === undefined || bytes < 0) return { value: "", unit: "Bytes" };
  if (bytes === 0) return { value: "0", unit: "Bytes" };
  const gb = SIZE_UNITS.GB;
  const mb = SIZE_UNITS.MB;
  const kb = SIZE_UNITS.KB;
  if (bytes >= gb && bytes % gb === 0) {
    return { value: (bytes / gb).toString(), unit: "GB" };
  }
  if (bytes >= mb && bytes % mb === 0) {
    return { value: (bytes / mb).toString(), unit: "MB" };
  }
  if (bytes >= kb && bytes % kb === 0) {
    return { value: (bytes / kb).toString(), unit: "KB" };
  }
  // Show decimals for non-exact conversions above KB
  if (bytes >= mb) {
    return { value: (bytes / mb).toFixed(2).replace(/\.?0+$/, ""), unit: "MB" };
  }
  if (bytes >= kb) {
    return { value: (bytes / kb).toFixed(2).replace(/\.?0+$/, ""), unit: "KB" };
  }
  return { value: bytes.toString(), unit: "Bytes" };
};

// Define date formats for display and parsing
const DISPLAY_DATE_FORMAT = "dd.MM.yyyy";
// Add more formats if needed, prioritize common ones
const PARSE_DATE_FORMATS = [
  DISPLAY_DATE_FORMAT, // Most likely format
  "dd/MM/yyyy",
  "dd-MM-yyyy",
  "yyyy-MM-dd", // ISO-like
  "yyyyMMdd",
  "MM/dd/yyyy", // Common US format
  "M/d/yyyy",
  "P", // date-fns short date format
  "PP", // date-fns medium date format
];

// Map i18n language codes to date-fns locales
const getLocaleObject = (langCode: string): Locale => {
  switch (langCode) {
    case "de":
      return de;
    case "es":
      return es;
    case "fr":
      return fr;
    case "it":
      return it;
    case "ja":
      return ja;
    case "pt":
      return pt;
    case "ru":
      return ru;
    case "en":
    default:
      return enUS;
  }
};

const SearchForm: React.FC<SearchFormProps> = ({
  onSubmit,
  isLoading,
  historyEntryToLoad,
  onLoadComplete,
}) => {
  const { t, i18n } = useTranslation(["form", "common"]);

  // Get locale object based on current i18n language
  const currentLocale = React.useMemo(
    () => getLocaleObject(i18n.language),
    [i18n.language]
  );

  const [formData, setFormData] = useState<SearchFormData>({
    searchPaths: "",
    extensions: "",
    excludeFiles: "",
    excludeFolders: ".git, node_modules, bin, obj, dist", // Sensible defaults
    folderExclusionMode: "contains",
    modifiedAfter: undefined,
    modifiedBefore: undefined,
    minSizeValue: "",
    minSizeUnit: "MB", // Default unit
    maxSizeValue: "",
    maxSizeUnit: "MB", // Default unit
    maxDepthValue: "",
  });
  // State managed by SearchForm, updated via callbacks from QueryBuilder
  const [queryStructure, setQueryStructure] = useState<QueryStructure | null>(
    null
  );
  const [queryCaseSensitive, setQueryCaseSensitive] = useState<boolean>(false);

  const [isAfterPopoverOpen, setIsAfterPopoverOpen] = useState(false);
  const [isBeforePopoverOpen, setIsBeforePopoverOpen] = useState(false);
  // State to hold the raw string input for dates
  const [rawAfterDate, setRawAfterDate] = useState<string>("");
  const [rawBeforeDate, setRawBeforeDate] = useState<string>("");

  // Effect to load data from history entry
  useEffect(() => {
    if (historyEntryToLoad) {
      console.log("Loading history entry:", historyEntryToLoad);
      const params = historyEntryToLoad.searchParams;
      console.log("History entry search params:", params);
      const minSize = bytesToSizeForm(params.minSizeBytes);
      const maxSize = bytesToSizeForm(params.maxSizeBytes);

      // Robust date parsing from history (ISO or yyyy-MM-dd)
      let initialModifiedAfter: Date | undefined = undefined;
      if (params.modifiedAfter) {
        try {
          // Try ISO first, then yyyy-MM-dd
          const parsedISO = parseISO(params.modifiedAfter);
          if (isValid(parsedISO)) {
            initialModifiedAfter = parsedISO;
          } else {
            const parsedYMD = parse(
              params.modifiedAfter,
              "yyyy-MM-dd",
              new Date()
            );
            if (isValid(parsedYMD)) initialModifiedAfter = parsedYMD;
          }
        } catch (_e) {
          console.error("Error parsing modifiedAfter from history:", _e);
        }
      }
      let initialModifiedBefore: Date | undefined = undefined;
      if (params.modifiedBefore) {
        try {
          const parsedISO = parseISO(params.modifiedBefore);
          if (isValid(parsedISO)) {
            initialModifiedBefore = parsedISO;
          } else {
            const parsedYMD = parse(
              params.modifiedBefore,
              "yyyy-MM-dd",
              new Date()
            );
            if (isValid(parsedYMD)) initialModifiedBefore = parsedYMD;
          }
        } catch (_e) {
          console.error("Error parsing modifiedBefore from history:", _e);
        }
      }

      // Update form data state
      setFormData({
        searchPaths: params.searchPaths?.join("\n") ?? "",
        extensions: params.extensions?.join(", ") ?? "",
        excludeFiles: params.excludeFiles?.join("\n") ?? "",
        excludeFolders: params.excludeFolders?.join("\n") ?? "",
        folderExclusionMode: params.folderExclusionMode ?? "contains",
        modifiedAfter: initialModifiedAfter,
        modifiedBefore: initialModifiedBefore,
        minSizeValue: minSize.value,
        minSizeUnit: minSize.unit,
        maxSizeValue: maxSize.value,
        maxSizeUnit: maxSize.unit,
        maxDepthValue: params.maxDepth?.toString() ?? "",
      });

      // Update raw date strings for display
      setRawAfterDate(
        initialModifiedAfter
          ? format(initialModifiedAfter, DISPLAY_DATE_FORMAT, {
              locale: currentLocale,
            })
          : ""
      );
      setRawBeforeDate(
        initialModifiedBefore
          ? format(initialModifiedBefore, DISPLAY_DATE_FORMAT, {
              locale: currentLocale,
            })
          : ""
      );

      // --- query builder state using type guard ---
      const loadedQuery = params.structuredQuery;
      let initialQueryStructure: QueryStructure | null = null;

      // First check if we have a valid structured query
      if (isQueryStructure(loadedQuery)) {
        console.log(
          "Found valid structured query in history entry:",
          loadedQuery
        );
        initialQueryStructure = loadedQuery;
      }
      // If no valid structured query but we have a contentSearchTerm, create a simple term condition
      else if (params.contentSearchTerm) {
        console.log(
          "Creating structured query from contentSearchTerm:",
          params.contentSearchTerm
        );
        // Extract the term from the contentSearchTerm (remove quotes if present)
        let termValue = params.contentSearchTerm;
        const quotedMatch = termValue.match(/^"(.+)"$/);
        if (quotedMatch && quotedMatch[1]) {
          termValue = quotedMatch[1];
        }

        // Create a new structured query with a single term condition
        initialQueryStructure = {
          id: generateId(),
          operator: "AND",
          conditions: [
            {
              id: generateId(),
              type: "term",
              value: termValue,
              caseSensitive: params.caseSensitive ?? false,
            },
          ],
          isRoot: true,
        };
      } else {
        // Handle invalid/missing structure (e.g., log warning, set to null)
        if (loadedQuery !== null && loadedQuery !== undefined) {
          console.warn(
            "Loaded history entry contained invalid structuredQuery:",
            loadedQuery
          );
        }
        initialQueryStructure = null;
      }

      // Set state to pass down as initial prop
      console.log(
        "Setting query structure from history:",
        initialQueryStructure
      );
      setQueryStructure(initialQueryStructure);
      // ----------------------------------------------------
      const initialCaseSensitive = params.caseSensitive ?? false;
      // Set state to pass down as initial prop
      setQueryCaseSensitive(initialCaseSensitive);

      // Prepare search parameters to pass to onLoadComplete
      // This is similar to handleSubmit but uses the loaded parameters
      const splitAndClean = (str: string) =>
        str
          .split(/[\n,]+/) // Split by newline or comma
          .map((s) => s.trim())
          .filter(Boolean); // Remove empty strings

      // Convert the query structure to string
      let contentQueryString = "";

      // If we have a structured query, convert it to a string
      if (initialQueryStructure) {
        contentQueryString = convertStructuredQueryToString(
          initialQueryStructure
        );
        console.log(
          "Converted structured query to string:",
          contentQueryString
        );
      }
      // If we don't have a structured query but have a contentSearchTerm, use that directly
      else if (params.contentSearchTerm) {
        contentQueryString = params.contentSearchTerm;
        console.log("Using contentSearchTerm directly:", contentQueryString);
      }

      const hasContentQuery =
        contentQueryString && contentQueryString.trim().length > 0;

      // Base parameters without content query specifics
      const baseParams: Omit<
        SearchParams,
        | "contentSearchTerm"
        | "contentSearchMode"
        | "caseSensitive"
        | "structuredQuery"
      > = {
        searchPaths: splitAndClean(formData.searchPaths),
        extensions: splitAndClean(formData.extensions),
        excludeFiles: splitAndClean(formData.excludeFiles),
        excludeFolders: splitAndClean(formData.excludeFolders),
        folderExclusionMode: formData.folderExclusionMode,
        modifiedAfter: formData.modifiedAfter
          ? format(formData.modifiedAfter, "yyyy-MM-dd")
          : undefined,
        modifiedBefore: formData.modifiedBefore
          ? format(formData.modifiedBefore, "yyyy-MM-dd")
          : undefined,
        maxDepth: parseInt(formData.maxDepthValue, 10) || undefined,
      };

      // Calculate size in bytes
      const minSizeNum = parseFloat(formData.minSizeValue);
      if (!isNaN(minSizeNum) && minSizeNum >= 0) {
        baseParams.minSizeBytes = minSizeNum * SIZE_UNITS[formData.minSizeUnit];
      }
      const maxSizeNum = parseFloat(formData.maxSizeValue);
      if (!isNaN(maxSizeNum) && maxSizeNum >= 0) {
        baseParams.maxSizeBytes = maxSizeNum * SIZE_UNITS[formData.maxSizeUnit];
      }

      // Conditionally add content query parameters
      let submitParams: SearchParams;
      if (hasContentQuery) {
        submitParams = {
          ...baseParams,
          contentSearchTerm: contentQueryString,
          contentSearchMode: "boolean",
          caseSensitive: initialCaseSensitive,
          structuredQuery: initialQueryStructure, // Include the structured query
        };
      } else {
        submitParams = {
          ...baseParams,
          contentSearchTerm: undefined,
          contentSearchMode: undefined,
          caseSensitive: undefined,
          structuredQuery: null,
        };
      }

      console.log("Loaded search parameters from history:", submitParams);

      // Notify parent component that loading is complete and pass the parameters
      onLoadComplete(submitParams);
    }
  }, [historyEntryToLoad, onLoadComplete, currentLocale]); // Depend on currentLocale

  // Handle standard input/textarea changes
  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  // Handle changes for Select components (units, mode)
  const handleSelectChange = (name: SelectFieldName) => (value: string) => {
    setFormData((prev) => ({
      ...prev,
      [name]: value as SizeUnit | FolderExclusionMode, // Type assertion
    }));
  };

  // Parse date string using multiple formats
  const parseDateString = (dateString: string): Date | undefined => {
    if (!dateString) return undefined;
    for (const fmt of PARSE_DATE_FORMATS) {
      try {
        // Pass locale to parse function
        const parsedDate = parse(dateString, fmt, new Date(), {
          locale: currentLocale,
        });
        if (isValid(parsedDate)) return parsedDate;
      } catch (_e) {
        /* ignore parse errors, try next format */
      }
    }
    // Try ISO format as a fallback
    try {
      const parsedISO = parseISO(dateString);
      if (isValid(parsedISO)) return parsedISO;
    } catch (_e) {
      /* ignore */
    }
    return undefined; // Return undefined if no format matches
  };

  // Handle changes in the raw date input fields
  const handleRawDateChange = (
    e: React.ChangeEvent<HTMLInputElement>,
    field: "modifiedAfter" | "modifiedBefore"
  ) => {
    const value = e.target.value;
    // Update the raw string state immediately
    if (field === "modifiedAfter") setRawAfterDate(value);
    else setRawBeforeDate(value);

    // Attempt to parse the date
    const parsedDate = parseDateString(value);
    // Update the actual Date state only if parsing is successful
    if (parsedDate) {
      setFormData((prev) => ({ ...prev, [field]: parsedDate }));
    } else if (!value) {
      // If the input is cleared, clear the Date state too
      setFormData((prev) => ({ ...prev, [field]: undefined }));
    }
    // If parsing fails but input is not empty, the Date state remains unchanged,
    // but the raw input shows the user's typing. Validation happens on Enter/Blur/Select.
  };

  // Handle Enter/Escape keys in date inputs for validation/reversion
  const handleDateInputKeyDown = (
    e: React.KeyboardEvent<HTMLInputElement>,
    field: "modifiedAfter" | "modifiedBefore"
  ) => {
    if (e.key === "Enter") {
      e.preventDefault();
      const rawValue = field === "modifiedAfter" ? rawAfterDate : rawBeforeDate;
      const parsedDate = parseDateString(rawValue);
      if (parsedDate) {
        // Valid date entered, update Date state and format raw input
        setFormData((prev) => ({ ...prev, [field]: parsedDate }));
        const formatted = format(parsedDate, DISPLAY_DATE_FORMAT, {
          locale: currentLocale,
        });
        if (field === "modifiedAfter") setRawAfterDate(formatted);
        else setRawBeforeDate(formatted);
      } else if (!rawValue) {
        // Input cleared, ensure Date state is undefined
        setFormData((prev) => ({ ...prev, [field]: undefined }));
      } else {
        // Invalid input, revert raw input to last valid formatted date
        const lastValidDate = formData[field];
        const formatted = lastValidDate
          ? format(lastValidDate, DISPLAY_DATE_FORMAT, {
              locale: currentLocale,
            })
          : "";
        if (field === "modifiedAfter") setRawAfterDate(formatted);
        else setRawBeforeDate(formatted);
      }
      // Close popover on Enter
      if (field === "modifiedAfter") setIsAfterPopoverOpen(false);
      else setIsBeforePopoverOpen(false);
    } else if (e.key === "Escape") {
      // Revert raw input to last valid formatted date on Escape
      const lastValidDate = formData[field];
      const formatted = lastValidDate
        ? format(lastValidDate, DISPLAY_DATE_FORMAT, { locale: currentLocale })
        : "";
      if (field === "modifiedAfter") setRawAfterDate(formatted);
      else setRawBeforeDate(formatted);
      // Close popover on Escape
      if (field === "modifiedAfter") setIsAfterPopoverOpen(false);
      else setIsBeforePopoverOpen(false);
    }
  };

  // Handle date selection from the Calendar component
  const handleDateSelect =
    (field: "modifiedAfter" | "modifiedBefore") => (date: Date | undefined) => {
      // Update the Date state
      setFormData((prev) => ({ ...prev, [field]: date }));
      // Update the raw input string to match the selected date
      const formattedDate = date
        ? format(date, DISPLAY_DATE_FORMAT, { locale: currentLocale })
        : "";
      if (field === "modifiedAfter") {
        setRawAfterDate(formattedDate);
        setIsAfterPopoverOpen(false); // Close popover
      } else {
        setRawBeforeDate(formattedDate);
        setIsBeforePopoverOpen(false); // Close popover
      }
    };

  // Clear a date field
  const clearDate = (field: "modifiedAfter" | "modifiedBefore") => {
    setFormData((prev) => ({ ...prev, [field]: undefined }));
    if (field === "modifiedAfter") {
      setRawAfterDate("");
      setIsAfterPopoverOpen(false); // Close popover
    } else {
      setRawBeforeDate("");
      setIsBeforePopoverOpen(false); // Close popover
    }
  };

  // --- Callbacks passed to QueryBuilder to update parent state ---
  const handleQueryChange = useCallback((newQuery: QueryStructure | null) => {
    // console.log("SearchForm: handleQueryChange updating state:", newQuery); // Log state update
    setQueryStructure(newQuery);
  }, []);

  const handleQueryCaseSensitivityChange = useCallback((checked: boolean) => {
    // console.log("SearchForm: handleQueryCaseSensitivityChange updating state:", checked); // Log state update
    setQueryCaseSensitive(checked);
  }, []);
  // --- End Callbacks ---

  // Handle search cancellation request
  const handleCancelSearch = () => {
    if (window.electronAPI?.cancelSearch) {
      console.log("UI: Requesting search cancellation...");
      window.electronAPI.cancelSearch();
    } else {
      console.warn("UI: cancelSearch API not available.");
    }
  };

  // Handle form submission
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    // --- Use state variables directly ---
    const currentQueryStructure = queryStructure;
    const currentQueryCaseSensitive = queryCaseSensitive;
    // --- End Use state variables ---

    // Prepare parameters for the backend
    const splitAndClean = (str: string) =>
      str
        .split(/[\n,]+/) // Split by newline or comma
        .map((s) => s.trim())
        .filter(Boolean); // Remove empty strings

    // Convert the query structure to string using the state value
    let contentQueryString = "";
    if (currentQueryStructure) {
      console.log(
        "Submit: Query structure before conversion:",
        JSON.stringify(currentQueryStructure, null, 2)
      );
      contentQueryString = convertStructuredQueryToString(
        currentQueryStructure
      );
      console.log(
        "Submit: Converted structured query to string:",
        contentQueryString
      );

      // Check if the query string is empty but we have conditions
      if (
        !contentQueryString &&
        currentQueryStructure.conditions &&
        currentQueryStructure.conditions.length > 0
      ) {
        console.warn(
          "Query string is empty but we have conditions, checking for direct term values"
        );

        // Try to extract terms directly from conditions
        const terms = currentQueryStructure.conditions
          .filter(
            (cond) =>
              cond &&
              "type" in cond &&
              cond.type === "term" &&
              typeof cond.value === "string"
          )
          .map((cond) => {
            const value = (cond as any).value.trim();
            // Quote the term if it's not already quoted
            return value.startsWith('"') && value.endsWith('"')
              ? value
              : `"${value}"`;
          })
          .filter((term) => term.length > 0);

        if (terms.length > 0) {
          contentQueryString = terms.join(
            ` ${currentQueryStructure.operator} `
          );
          console.log("Created fallback query string:", contentQueryString);
        }
      }
    }

    const hasContentQuery =
      contentQueryString && contentQueryString.trim().length > 0;
    console.log(
      "Submit: Has content query:",
      hasContentQuery,
      "Query:",
      contentQueryString
    );

    // Base parameters without content query specifics
    const baseParams: Omit<
      SearchParams,
      | "contentSearchTerm"
      | "contentSearchMode"
      | "caseSensitive"
      | "structuredQuery" // Exclude structuredQuery from base
    > = {
      searchPaths: splitAndClean(formData.searchPaths),
      extensions: splitAndClean(formData.extensions),
      excludeFiles: splitAndClean(formData.excludeFiles),
      excludeFolders: splitAndClean(formData.excludeFolders),
      folderExclusionMode: formData.folderExclusionMode,
      modifiedAfter: formData.modifiedAfter
        ? format(formData.modifiedAfter, "yyyy-MM-dd")
        : undefined,
      modifiedBefore: formData.modifiedBefore
        ? format(formData.modifiedBefore, "yyyy-MM-dd")
        : undefined,
      maxDepth: parseInt(formData.maxDepthValue, 10) || undefined,
    };

    // Calculate size in bytes
    const minSizeNum = parseFloat(formData.minSizeValue);
    if (!isNaN(minSizeNum) && minSizeNum >= 0) {
      baseParams.minSizeBytes = minSizeNum * SIZE_UNITS[formData.minSizeUnit];
    }
    const maxSizeNum = parseFloat(formData.maxSizeValue);
    if (!isNaN(maxSizeNum) && maxSizeNum >= 0) {
      baseParams.maxSizeBytes = maxSizeNum * SIZE_UNITS[formData.maxSizeUnit];
    }

    // Validate min/max size
    if (
      baseParams.minSizeBytes !== undefined &&
      baseParams.maxSizeBytes !== undefined &&
      baseParams.minSizeBytes > baseParams.maxSizeBytes
    ) {
      alert(t("errorMinMax"));
      return;
    }

    // Conditionally add content query parameters
    let submitParams: SearchParams;
    if (hasContentQuery) {
      submitParams = {
        ...baseParams,
        contentSearchTerm: contentQueryString, // Use the converted string
        contentSearchMode: "boolean", // Set mode to boolean when using builder
        caseSensitive: currentQueryCaseSensitive, // Use state value
        structuredQuery: currentQueryStructure, // Include the structured query for history
      };
    } else {
      submitParams = {
        ...baseParams,
        // Ensure these are undefined if no query
        contentSearchTerm: undefined,
        contentSearchMode: undefined,
        caseSensitive: undefined,
        structuredQuery: null,
      };
    }

    console.log("Submitting Params:", submitParams); // Log the final params being sent
    onSubmit(submitParams); // Call the onSubmit prop passed from App
  };

  // Create disabledDateMatcher based on isLoading
  const disabledDateMatcher: Matcher | Matcher[] | undefined = isLoading
    ? { before: new Date(0) } // Disable all dates if loading
    : undefined;

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5">
      {/* Search Paths */}
      <div className="space-y-1.5">
        <Label htmlFor="searchPaths">{t("searchPathLabel")}</Label>
        <Textarea
          id="searchPaths"
          name="searchPaths"
          value={formData.searchPaths}
          onChange={handleInputChange}
          rows={3}
          required
          placeholder={t("searchPathPlaceholder")}
          disabled={isLoading}
          className="resize-y min-h-[60px]"
        />
      </div>
      {/* Extensions */}
      <div className="space-y-1.5">
        <Label htmlFor="extensions">{t("extensionsLabel")}</Label>
        <Input
          type="text"
          id="extensions"
          name="extensions"
          value={formData.extensions}
          onChange={handleInputChange}
          required
          placeholder={t("extensionsPlaceholder")}
          disabled={isLoading}
        />
      </div>
      {/* Exclude Files */}
      <div className="space-y-1.5">
        <Label htmlFor="excludeFiles">{t("excludeFilesLabelRegex")}</Label>
        <Textarea
          id="excludeFiles"
          name="excludeFiles"
          value={formData.excludeFiles}
          onChange={handleInputChange}
          rows={2}
          placeholder={t("excludeFilesPlaceholderRegex")}
          disabled={isLoading}
          className="resize-y min-h-[40px]"
        />
      </div>
      {/* Exclude Folders */}
      <div className="space-y-1.5">
        <Label htmlFor="excludeFolders">{t("excludeFoldersLabelRegex")}</Label>
        <div className="flex flex-col sm:flex-row gap-4 items-start">
          <Textarea
            id="excludeFolders"
            name="excludeFolders"
            value={formData.excludeFolders}
            onChange={handleInputChange}
            rows={2}
            placeholder={t("excludeFoldersPlaceholderRegex")}
            disabled={isLoading}
            className="resize-y min-h-[40px] flex-grow"
          />
          <div className="space-y-1.5 shrink-0 w-full sm:w-auto">
            <Label
              htmlFor="folderExclusionMode"
              className="text-xs text-muted-foreground"
            >
              {t("folderExclusionModeLabel")}
            </Label>
            <Select
              name="folderExclusionMode"
              value={formData.folderExclusionMode}
              onValueChange={handleSelectChange("folderExclusionMode")}
              disabled={isLoading}
            >
              <SelectTrigger
                id="folderExclusionMode"
                className="w-full sm:w-[200px]"
              >
                <SelectValue placeholder={t("folderExclusionModeLabel")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="contains">
                  {t("folderExclusionModeContains")}
                </SelectItem>
                <SelectItem value="exact">
                  {t("folderExclusionModeExact")}
                </SelectItem>
                <SelectItem value="startsWith">
                  {t("folderExclusionModeStartsWith")}
                </SelectItem>
                <SelectItem value="endsWith">
                  {t("folderExclusionModeEndsWith")}
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>
      {/* Max Depth */}
      <div className="space-y-1.5 max-w-[250px]">
        <Label htmlFor="maxDepthValue">{t("maxDepthLabel")}</Label>
        <Input
          type="number"
          id="maxDepthValue"
          name="maxDepthValue"
          value={formData.maxDepthValue}
          onChange={handleInputChange}
          disabled={isLoading}
          placeholder={t("maxDepthPlaceholder")}
          min="1"
          step="1"
          className="[appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
        />
      </div>
      {/* Query Builder */}
      <div className="space-y-1.5">
        <Label>{t("contentQueryBuilderLabel")}</Label>
        <QueryBuilder
          // Pass state down as initial props
          initialQuery={queryStructure}
          initialCaseSensitive={queryCaseSensitive}
          // Pass callbacks to update parent state
          onChange={handleQueryChange}
          onCaseSensitivityChange={handleQueryCaseSensitivityChange}
          disabled={isLoading}
        />
      </div>

      {/* Date Fields Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Modified After */}
        <div className="space-y-1.5">
          <Label htmlFor="modifiedAfterInput">{t("modifiedAfterLabel")}</Label>
          <div className="flex items-center gap-1">
            <Popover
              open={isAfterPopoverOpen}
              onOpenChange={setIsAfterPopoverOpen}
            >
              <PopoverTrigger asChild>
                <div className="relative flex-grow">
                  <Input
                    id="modifiedAfterInput"
                    type="text"
                    value={rawAfterDate}
                    onChange={(e) => handleRawDateChange(e, "modifiedAfter")}
                    onKeyDown={(e) =>
                      handleDateInputKeyDown(e, "modifiedAfter")
                    }
                    placeholder={DISPLAY_DATE_FORMAT}
                    disabled={isLoading}
                    className="pl-8 h-9 pr-8" // Padding for icons
                  />
                  <CalendarIcon className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                  {/* Clear button */}
                  {formData.modifiedAfter && !isLoading && (
                    <Button
                      variant="ghost"
                      size="icon"
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        clearDate("modifiedAfter");
                      }}
                      className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 shrink-0 text-muted-foreground hover:text-destructive"
                      aria-label="Clear modified after date"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  selected={formData.modifiedAfter}
                  onSelect={handleDateSelect("modifiedAfter")}
                  locale={currentLocale} // Pass locale
                  disabled={disabledDateMatcher} // Pass the matcher
                  // Pass initialMonth to suggest starting view
                  initialMonth={formData.modifiedAfter}
                />
              </PopoverContent>
            </Popover>
          </div>
        </div>
        {/* Modified Before */}
        <div className="space-y-1.5">
          <Label htmlFor="modifiedBeforeInput">
            {t("modifiedBeforeLabel")}
          </Label>
          <div className="flex items-center gap-1">
            <Popover
              open={isBeforePopoverOpen}
              onOpenChange={setIsBeforePopoverOpen}
            >
              <PopoverTrigger asChild>
                <div className="relative flex-grow">
                  <Input
                    id="modifiedBeforeInput"
                    type="text"
                    value={rawBeforeDate}
                    onChange={(e) => handleRawDateChange(e, "modifiedBefore")}
                    onKeyDown={(e) =>
                      handleDateInputKeyDown(e, "modifiedBefore")
                    }
                    placeholder={DISPLAY_DATE_FORMAT}
                    disabled={isLoading}
                    className="pl-8 h-9 pr-8" // Padding for icons
                  />
                  <CalendarIcon className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                  {/* Clear button */}
                  {formData.modifiedBefore && !isLoading && (
                    <Button
                      variant="ghost"
                      size="icon"
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        clearDate("modifiedBefore");
                      }}
                      className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 shrink-0 text-muted-foreground hover:text-destructive"
                      aria-label="Clear modified before date"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  selected={formData.modifiedBefore}
                  onSelect={handleDateSelect("modifiedBefore")}
                  locale={currentLocale} // Pass locale
                  disabled={disabledDateMatcher} // Pass the matcher
                  // Pass initialMonth to suggest starting view
                  initialMonth={formData.modifiedBefore}
                />
              </PopoverContent>
            </Popover>
          </div>
        </div>
      </div>

      {/* Size Fields Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Min Size */}
        <div className="space-y-1.5">
          <Label htmlFor="minSizeValue">{t("minSizeLabel")}</Label>
          <div className="flex gap-2">
            <Input
              type="number"
              id="minSizeValue"
              name="minSizeValue"
              value={formData.minSizeValue}
              onChange={handleInputChange}
              disabled={isLoading}
              placeholder="e.g., 100"
              min="0"
              step="any"
              className="flex-grow [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
            />
            <Select
              name="minSizeUnit"
              value={formData.minSizeUnit}
              onValueChange={handleSelectChange("minSizeUnit")}
              disabled={isLoading}
            >
              <SelectTrigger className="w-[80px] shrink-0">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.keys(SIZE_UNITS).map((unit) => (
                  <SelectItem key={unit} value={unit}>
                    {t(
                      `sizeUnit${unit}` as SizeUnitTranslationKey,
                      unit as SizeUnit
                    )}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        {/* Max Size */}
        <div className="space-y-1.5">
          <Label htmlFor="maxSizeValue">{t("maxSizeLabel")}</Label>
          <div className="flex gap-2">
            <Input
              type="number"
              id="maxSizeValue"
              name="maxSizeValue"
              value={formData.maxSizeValue}
              onChange={handleInputChange}
              disabled={isLoading}
              placeholder="e.g., 50"
              min="0"
              step="any"
              className="flex-grow [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
            />
            <Select
              name="maxSizeUnit"
              value={formData.maxSizeUnit}
              onValueChange={handleSelectChange("maxSizeUnit")}
              disabled={isLoading}
            >
              <SelectTrigger className="w-[80px] shrink-0">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.keys(SIZE_UNITS).map((unit) => (
                  <SelectItem key={unit} value={unit}>
                    {t(
                      `sizeUnit${unit}` as SizeUnitTranslationKey,
                      unit as SizeUnit
                    )}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* Submit/Cancel Button Area */}
      <div className="pt-2 flex gap-4 items-center">
        <Button type="submit" disabled={isLoading} className="w-full sm:w-auto">
          {isLoading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              {t("searchButtonLoading")}
            </>
          ) : (
            t("searchButton")
          )}
        </Button>
        {/* Cancel Button */}
        {isLoading && (
          <Button
            type="button"
            variant="destructive"
            onClick={handleCancelSearch}
            className="w-full sm:w-auto"
          >
            {t("cancelButton")}
          </Button>
        )}
      </div>
    </form>
  );
};

export default SearchForm;
