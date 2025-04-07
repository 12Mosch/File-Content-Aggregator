import React, { useState, useCallback, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { format, parseISO, isValid } from "date-fns";
import QueryBuilder from "./QueryBuilder";
import type { QueryGroup as QueryStructure } from "./queryBuilderTypes";
import type {
  SearchHistoryEntry,
  SearchParams,
  ContentSearchMode,
} from "./vite-env.d";
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
import { Calendar as CalendarIcon, X } from "lucide-react";
import { cn } from "@/lib/utils";

// Define unit constants for calculations
const SIZE_UNITS = { Bytes: 1, KB: 1024, MB: 1024 * 1024, GB: 1024 * 1024 * 1024 };
type SizeUnit = keyof typeof SIZE_UNITS;
type FolderExclusionMode = "contains" | "exact" | "startsWith" | "endsWith";

// Define the shape of the data managed by the form's internal state
interface SearchFormData {
  searchPaths: string;
  extensions: string;
  excludeFiles: string;
  excludeFolders: string;
  folderExclusionMode: FolderExclusionMode;
  // Dates are now Date objects or undefined
  modifiedAfter: Date | undefined;
  modifiedBefore: Date | undefined;
  minSizeValue: string;
  minSizeUnit: SizeUnit;
  maxSizeValue: string;
  maxSizeUnit: SizeUnit;
  maxDepthValue: string;
}

interface SearchFormProps {
  onSubmit: (params: SearchParams) => void; // Use the unified SearchParams type
  isLoading: boolean;
  historyEntryToLoad: SearchHistoryEntry | null;
  onLoadComplete: () => void;
}

// Helper to convert size in bytes back to value and unit for the form (remains the same)
const bytesToSizeForm = (bytes: number | undefined): { value: string; unit: SizeUnit } => { if (bytes === undefined || bytes < 0) return { value: '', unit: 'Bytes' }; if (bytes === 0) return { value: '0', unit: 'Bytes' }; const gb = SIZE_UNITS.GB; const mb = SIZE_UNITS.MB; const kb = SIZE_UNITS.KB; if (bytes >= gb && bytes % gb === 0) return { value: (bytes / gb).toString(), unit: 'GB' }; if (bytes >= mb && bytes % mb === 0) return { value: (bytes / mb).toString(), unit: 'MB' }; if (bytes >= kb && bytes % kb === 0) return { value: (bytes / kb).toString(), unit: 'KB' }; if (bytes >= mb) return { value: (bytes / mb).toFixed(2).replace(/\.?0+$/, ''), unit: 'MB' }; if (bytes >= kb) return { value: (bytes / kb).toFixed(2).replace(/\.?0+$/, ''), unit: 'KB' }; return { value: bytes.toString(), unit: 'Bytes' }; };

// Helper function to convert structured query to string (remains the same)
const convertStructuredQueryToString = (group: QueryStructure): string => { if (!group || group.conditions.length === 0) return ""; const parts = group.conditions.map((item) => { if ("operator" in item) return `(${convertStructuredQueryToString(item)})`; else { switch (item.type) { case "term": return /\s|[()]|AND|OR|NOT|NEAR/i.test(item.value) ? `"${item.value.replace(/"/g, '\\"')}"` : item.value; case "regex": const validFlags = (item.flags || "").replace(/[^gimyus]/g, ""); return `/${item.value}/${validFlags}`; case "near": const formatNearTerm = (term: string) => { if (term.startsWith('/') && term.endsWith('/')) return term; return /\s|[()]|AND|OR|NOT|NEAR/i.test(term) ? `"${term.replace(/"/g, '\\"')}"` : term; }; return `NEAR(${formatNearTerm(item.term1)}, ${formatNearTerm(item.term2)}, ${item.distance})`; default: console.warn("Unknown condition type:", item); return ""; } } }); const validParts = parts.filter(Boolean); if (validParts.length === 0) return ""; if (validParts.length === 1) return validParts[0]; return validParts.join(` ${group.operator} `); };

const SearchForm: React.FC<SearchFormProps> = ({
  onSubmit,
  isLoading,
  historyEntryToLoad,
  onLoadComplete,
}) => {
  const { t } = useTranslation(["form"]);

  // Internal form state for non-query builder fields
  const [formData, setFormData] = useState<SearchFormData>({
    searchPaths: "",
    extensions: "",
    excludeFiles: "",
    excludeFolders: ".git, node_modules, bin, obj, dist",
    folderExclusionMode: "contains",
    // Initialize dates as undefined
    modifiedAfter: undefined,
    modifiedBefore: undefined,
    minSizeValue: "",
    minSizeUnit: "MB",
    maxSizeValue: "",
    maxSizeUnit: "MB",
    maxDepthValue: "",
  });

  // State for the QueryBuilder
  const [queryStructure, setQueryStructure] = useState<QueryStructure | null>(
    null,
  );
  const [queryCaseSensitive, setQueryCaseSensitive] = useState<boolean>(false);

  // Effect to load history entry into form state
  useEffect(() => {
    if (historyEntryToLoad) {
      console.log(
        "SearchForm: Loading history entry into state",
        historyEntryToLoad.id,
      );
      const params = historyEntryToLoad.searchParams;
      const minSize = bytesToSizeForm(params.minSizeBytes);
      const maxSize = bytesToSizeForm(params.maxSizeBytes);

      // Parse date strings from history into Date objects
      let initialModifiedAfter: Date | undefined = undefined;
      if (params.modifiedAfter) {
        try {
          const parsed = parseISO(params.modifiedAfter);
          if (isValid(parsed)) {
            initialModifiedAfter = parsed;
          }
        } catch (e) {
          console.error("Error parsing modifiedAfter from history:", e);
        }
      }
      let initialModifiedBefore: Date | undefined = undefined;
      if (params.modifiedBefore) {
        try {
          const parsed = parseISO(params.modifiedBefore);
          if (isValid(parsed)) {
            initialModifiedBefore = parsed;
          }
        } catch (e) {
          console.error("Error parsing modifiedBefore from history:", e);
        }
      }

      setFormData({
        searchPaths: params.searchPaths?.join("\n") ?? "",
        extensions: params.extensions?.join(", ") ?? "",
        excludeFiles: params.excludeFiles?.join("\n") ?? "",
        excludeFolders: params.excludeFolders?.join("\n") ?? "",
        folderExclusionMode: params.folderExclusionMode ?? "contains",
        modifiedAfter: initialModifiedAfter, // Use parsed Date object
        modifiedBefore: initialModifiedBefore, // Use parsed Date object
        minSizeValue: minSize.value,
        minSizeUnit: minSize.unit,
        maxSizeValue: maxSize.value,
        maxSizeUnit: maxSize.unit,
        maxDepthValue: params.maxDepth?.toString() ?? "",
      });
      setQueryStructure(params.structuredQuery ?? null);
      setQueryCaseSensitive(params.caseSensitive ?? false);
      onLoadComplete();
    }
  }, [historyEntryToLoad, onLoadComplete]);

  // --- Handlers ---
  // Generic handler for Input and Textarea changes (excluding dates now)
  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
  ) => {
    const { name, value } = e.target;
    // Prevent negative numbers for number inputs
    if (e.target.type === "number" && parseFloat(value) < 0) {
      if (value === "" || parseFloat(value) === 0) {
        setFormData((prev) => ({ ...prev, [name]: value }));
      }
      return;
    }
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  // Specific handler for Select components (shadcn passes value directly)
  const handleSelectChange = (name: keyof SearchFormData) => (value: string) => {
    setFormData((prev) => ({ ...prev, [name]: value as any })); // Use 'as any' for simplicity here
  };

  // Handlers for Date selection using Calendar
  const handleDateSelect =
    (field: "modifiedAfter" | "modifiedBefore") =>
    (date: Date | undefined) => {
      setFormData((prev) => ({ ...prev, [field]: date }));
      // Optionally close popover here if needed, depends on Popover setup
    };

  // Handlers to clear dates
  const clearDate = (field: "modifiedAfter" | "modifiedBefore") => {
    setFormData((prev) => ({ ...prev, [field]: undefined }));
  };

  // QueryBuilder change handlers
  const handleQueryChange = useCallback((newQuery: QueryStructure | null) => {
    setQueryStructure(newQuery);
  }, []);
  const handleQueryCaseSensitivityChange = useCallback((checked: boolean) => {
    setQueryCaseSensitive(checked);
  }, []);

  // Form submission handler
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const splitAndClean = (str: string) =>
      str.split(/[\n,]+/).map((s) => s.trim()).filter(Boolean);
    const contentQueryString = queryStructure
      ? convertStructuredQueryToString(queryStructure)
      : "";

    // Construct the final parameters object matching the SearchParams type
    const submitParams: SearchParams = {
      searchPaths: splitAndClean(formData.searchPaths),
      extensions: splitAndClean(formData.extensions),
      excludeFiles: splitAndClean(formData.excludeFiles),
      excludeFolders: splitAndClean(formData.excludeFolders),
      folderExclusionMode: formData.folderExclusionMode,
      structuredQuery: queryStructure, // Include structure for history
      // Content search related params
      contentSearchTerm: contentQueryString || undefined,
      contentSearchMode: contentQueryString ? "boolean" : undefined,
      caseSensitive: contentQueryString ? queryCaseSensitive : undefined,
      // Format Date objects back to YYYY-MM-DD strings for backend
      modifiedAfter: formData.modifiedAfter
        ? format(formData.modifiedAfter, "yyyy-MM-dd")
        : undefined,
      modifiedBefore: formData.modifiedBefore
        ? format(formData.modifiedBefore, "yyyy-MM-dd")
        : undefined,
      maxDepth: parseInt(formData.maxDepthValue, 10) || undefined,
    };

    // Size calculation
    const minSizeNum = parseFloat(formData.minSizeValue);
    if (!isNaN(minSizeNum) && minSizeNum >= 0)
      submitParams.minSizeBytes = minSizeNum * SIZE_UNITS[formData.minSizeUnit];
    const maxSizeNum = parseFloat(formData.maxSizeValue);
    if (!isNaN(maxSizeNum) && maxSizeNum >= 0)
      submitParams.maxSizeBytes = maxSizeNum * SIZE_UNITS[formData.maxSizeUnit];
    if (
      submitParams.minSizeBytes !== undefined &&
      submitParams.maxSizeBytes !== undefined &&
      submitParams.minSizeBytes > submitParams.maxSizeBytes
    ) {
      alert(t("errorMinMax")); // Consider using a shadcn Alert Dialog here
      return;
    }

    console.log("Submitting Params:", submitParams);
    onSubmit(submitParams);
  };

  return (
    // Use Tailwind classes for form layout (flex column with gaps)
    <form onSubmit={handleSubmit} className="flex flex-col gap-5">
      {/* Search Paths */}
      <div className="space-y-1.5">
        {" "}
        {/* Use space-y for vertical spacing */}
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
          className="resize-y min-h-[60px]" // Allow vertical resize
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

      {/* Exclude Folders & Mode */}
      <div className="space-y-1.5">
        <Label htmlFor="excludeFolders">{t("excludeFoldersLabelRegex")}</Label>
        {/* Use flex or grid for horizontal layout */}
        <div className="flex flex-col sm:flex-row gap-4 items-start">
          <Textarea
            id="excludeFolders"
            name="excludeFolders"
            value={formData.excludeFolders}
            onChange={handleInputChange}
            rows={2}
            placeholder={t("excludeFoldersPlaceholderRegex")}
            disabled={isLoading}
            className="resize-y min-h-[40px] flex-grow" // Allow textarea to grow
          />
          {/* Mode Selector Group */}
          <div className="space-y-1.5 shrink-0 w-full sm:w-auto">
            <Label
              htmlFor="folderExclusionMode"
              className="text-xs text-muted-foreground"
            >
              {" "}
              {/* Smaller label */}
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
                {" "}
                {/* Responsive width */}
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
        {" "}
        {/* Limit width */}
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
          className="[appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" // Hide number spinners
        />
      </div>

      {/* Query Builder */}
      <div className="space-y-1.5">
        <Label>{t("contentQueryBuilderLabel")}</Label>
        <QueryBuilder
          initialQuery={queryStructure}
          initialCaseSensitive={queryCaseSensitive}
          onChange={handleQueryChange}
          onCaseSensitivityChange={handleQueryCaseSensitivityChange}
          disabled={isLoading}
        />
      </div>

      {/* Date Fields Row - Replaced with Popover/Calendar */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Modified After */}
        <div className="space-y-1.5">
          <Label htmlFor="modifiedAfterBtn">{t("modifiedAfterLabel")}</Label>
          <div className="flex items-center gap-2">
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  id="modifiedAfterBtn"
                  variant={"outline"}
                  className={cn(
                    "w-full justify-start text-left font-normal h-9", // Match input height
                    !formData.modifiedAfter && "text-muted-foreground",
                  )}
                  disabled={isLoading}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {formData.modifiedAfter ? (
                    format(formData.modifiedAfter, "PPP") // PPP format e.g., Jul 2, 2024
                  ) : (
                    <span>Pick a date</span>
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0">
                <Calendar
                  mode="single"
                  selected={formData.modifiedAfter}
                  onSelect={handleDateSelect("modifiedAfter")}
                  initialFocus
                  disabled={isLoading}
                />
              </PopoverContent>
            </Popover>
            {/* Clear Button */}
            {formData.modifiedAfter && (
              <Button
                variant="ghost"
                size="icon"
                onClick={() => clearDate("modifiedAfter")}
                disabled={isLoading}
                className="h-9 w-9" // Match input height
                aria-label="Clear modified after date"
              >
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>

        {/* Modified Before */}
        <div className="space-y-1.5">
          <Label htmlFor="modifiedBeforeBtn">{t("modifiedBeforeLabel")}</Label>
          <div className="flex items-center gap-2">
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  id="modifiedBeforeBtn"
                  variant={"outline"}
                  className={cn(
                    "w-full justify-start text-left font-normal h-9", // Match input height
                    !formData.modifiedBefore && "text-muted-foreground",
                  )}
                  disabled={isLoading}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {formData.modifiedBefore ? (
                    format(formData.modifiedBefore, "PPP")
                  ) : (
                    <span>Pick a date</span>
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0">
                <Calendar
                  mode="single"
                  selected={formData.modifiedBefore}
                  onSelect={handleDateSelect("modifiedBefore")}
                  initialFocus
                  disabled={isLoading}
                />
              </PopoverContent>
            </Popover>
            {/* Clear Button */}
            {formData.modifiedBefore && (
              <Button
                variant="ghost"
                size="icon"
                onClick={() => clearDate("modifiedBefore")}
                disabled={isLoading}
                className="h-9 w-9" // Match input height
                aria-label="Clear modified before date"
              >
                <X className="h-4 w-4" />
              </Button>
            )}
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
                {" "}
                {/* Fixed width for unit */}
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.keys(SIZE_UNITS).map((unit) => (
                  <SelectItem key={unit} value={unit}>
                    {t(`sizeUnit${unit}` as any)}
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
                    {t(`sizeUnit${unit}` as any)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* Submit Button */}
      <div className="pt-2">
        {" "}
        {/* Add some top padding before the button */}
        <Button
          type="submit"
          disabled={isLoading}
          className="w-full sm:w-auto"
        >
          {" "}
          {/* Full width on small screens */}
          {isLoading ? t("searchButtonLoading") : t("searchButton")}
        </Button>
      </div>
    </form>
  );
};

export default SearchForm;
