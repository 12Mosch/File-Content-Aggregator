// D:/Code/Electron/src/ui/SearchForm.tsx
import React, { useState, useCallback, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { format, parseISO, isValid, parse } from "date-fns";
import { de } from "date-fns/locale";
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
import { Calendar as CalendarIcon, X, Loader2 } from "lucide-react"; // Import Loader2 for loading state
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
  onLoadComplete: () => void;
}

// Helper to convert size in bytes back to value and unit for the form
const bytesToSizeForm = (bytes: number | undefined): { value: string; unit: SizeUnit } => { /* ... */ if (bytes === undefined || bytes < 0) return { value: '', unit: 'Bytes' }; if (bytes === 0) return { value: '0', unit: 'Bytes' }; const gb = SIZE_UNITS.GB; const mb = SIZE_UNITS.MB; const kb = SIZE_UNITS.KB; if (bytes >= gb && bytes % gb === 0) return { value: (bytes / gb).toString(), unit: 'GB' }; if (bytes >= mb && bytes % mb === 0) return { value: (bytes / mb).toString(), unit: 'MB' }; if (bytes >= kb && bytes % kb === 0) return { value: (bytes / kb).toString(), unit: 'KB' }; if (bytes >= mb) return { value: (bytes / mb).toFixed(2).replace(/\.?0+$/, ''), unit: 'MB' }; if (bytes >= kb) return { value: (bytes / kb).toFixed(2).replace(/\.?0+$/, ''), unit: 'KB' }; return { value: bytes.toString(), unit: 'Bytes' }; };

// Helper function to convert structured query to string
const convertStructuredQueryToString = (group: QueryStructure): string => { /* ... */ if (!group || group.conditions.length === 0) return ""; const parts = group.conditions.map((item) => { if ("operator" in item) return `(${convertStructuredQueryToString(item)})`; else { switch (item.type) { case "term": return /\s|[()]|AND|OR|NOT|NEAR/i.test(item.value) ? `"${item.value.replace(/"/g, '\\"')}"` : item.value; case "regex": const validFlags = (item.flags || "").replace(/[^gimyus]/g, ""); return `/${item.value}/${validFlags}`; case "near": const formatNearTerm = (term: string) => { if (term.startsWith('/') && term.endsWith('/')) return term; return /\s|[()]|AND|OR|NOT|NEAR/i.test(term) ? `"${term.replace(/"/g, '\\"')}"` : term; }; return `NEAR(${formatNearTerm(item.term1)}, ${formatNearTerm(item.term2)}, ${item.distance})`; default: console.warn("Unknown condition type:", item); return ""; } } }); const validParts = parts.filter(Boolean); if (validParts.length === 0) return ""; if (validParts.length === 1) return validParts[0]; return validParts.join(` ${group.operator} `); };

// Define date formats for display and parsing
const DISPLAY_DATE_FORMAT = "dd.MM.yyyy";
const PARSE_DATE_FORMATS = [
    "dd.MM.yyyy", "dd/MM/yyyy", "dd-MM-yyyy", "yyyy-MM-dd",
    "yyyyMMdd", "P", "PP", "PPP", "PPPP"
];

const SearchForm: React.FC<SearchFormProps> = ({
  onSubmit,
  isLoading,
  historyEntryToLoad,
  onLoadComplete,
}) => {
  const { t, i18n } = useTranslation(["form", "common"]);

  const currentLocale = React.useMemo(() => { /* ... */ switch (i18n.language) { case 'de': return de; default: return undefined; } }, [i18n.language]);
  const [formData, setFormData] = useState<SearchFormData>({ /* ... */ searchPaths: "", extensions: "", excludeFiles: "", excludeFolders: ".git, node_modules, bin, obj, dist", folderExclusionMode: "contains", modifiedAfter: undefined, modifiedBefore: undefined, minSizeValue: "", minSizeUnit: "MB", maxSizeValue: "", maxSizeUnit: "MB", maxDepthValue: "", });
  const [queryStructure, setQueryStructure] = useState<QueryStructure | null>(null);
  const [queryCaseSensitive, setQueryCaseSensitive] = useState<boolean>(false);
  const [isAfterPopoverOpen, setIsAfterPopoverOpen] = useState(false);
  const [isBeforePopoverOpen, setIsBeforePopoverOpen] = useState(false);
  const [rawAfterDate, setRawAfterDate] = useState<string>("");
  const [rawBeforeDate, setRawBeforeDate] = useState<string>("");

  useEffect(() => { /* ... history loading ... */ if (historyEntryToLoad) { const params = historyEntryToLoad.searchParams; const minSize = bytesToSizeForm(params.minSizeBytes); const maxSize = bytesToSizeForm(params.maxSizeBytes); let initialModifiedAfter: Date | undefined = undefined; if (params.modifiedAfter) { try { const parsed = parse(params.modifiedAfter, "yyyy-MM-dd", new Date()); if (isValid(parsed)) initialModifiedAfter = parsed; else { const parsedISO = parseISO(params.modifiedAfter); if (isValid(parsedISO)) initialModifiedAfter = parsedISO; } } catch (e) { console.error("Error parsing modifiedAfter from history:", e); } } let initialModifiedBefore: Date | undefined = undefined; if (params.modifiedBefore) { try { const parsed = parse(params.modifiedBefore, "yyyy-MM-dd", new Date()); if (isValid(parsed)) initialModifiedBefore = parsed; else { const parsedISO = parseISO(params.modifiedBefore); if (isValid(parsedISO)) initialModifiedBefore = parsedISO; } } catch (e) { console.error("Error parsing modifiedBefore from history:", e); } } setFormData({ searchPaths: params.searchPaths?.join("\n") ?? "", extensions: params.extensions?.join(", ") ?? "", excludeFiles: params.excludeFiles?.join("\n") ?? "", excludeFolders: params.excludeFolders?.join("\n") ?? "", folderExclusionMode: params.folderExclusionMode ?? "contains", modifiedAfter: initialModifiedAfter, modifiedBefore: initialModifiedBefore, minSizeValue: minSize.value, minSizeUnit: minSize.unit, maxSizeValue: maxSize.value, maxSizeUnit: maxSize.unit, maxDepthValue: params.maxDepth?.toString() ?? "", }); setRawAfterDate(initialModifiedAfter ? format(initialModifiedAfter, DISPLAY_DATE_FORMAT, { locale: currentLocale }) : ""); setRawBeforeDate(initialModifiedBefore ? format(initialModifiedBefore, DISPLAY_DATE_FORMAT, { locale: currentLocale }) : ""); setQueryStructure(params.structuredQuery ?? null); setQueryCaseSensitive(params.caseSensitive ?? false); onLoadComplete(); } }, [historyEntryToLoad, onLoadComplete, currentLocale]);
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => { /* ... */ const { name, value } = e.target; if (e.target.type === "number" && parseFloat(value) < 0) { if (value === "" || parseFloat(value) === 0) setFormData((prev) => ({ ...prev, [name]: value })); return; } setFormData((prev) => ({ ...prev, [name]: value })); };
  const handleSelectChange = (name: keyof SearchFormData) => (value: string) => { /* ... */ setFormData((prev) => ({ ...prev, [name]: value as any })); };
  const parseDateString = (dateString: string): Date | undefined => { /* ... */ if (!dateString) return undefined; for (const fmt of PARSE_DATE_FORMATS) { try { const parsedDate = parse(dateString, fmt, new Date()); if (isValid(parsedDate)) return parsedDate; } catch (e) { /* ignore */ } } return undefined; };
  const handleRawDateChange = (e: React.ChangeEvent<HTMLInputElement>, field: "modifiedAfter" | "modifiedBefore") => { /* ... */ const value = e.target.value; if (field === "modifiedAfter") setRawAfterDate(value); else setRawBeforeDate(value); const parsedDate = parseDateString(value); if (parsedDate) { setFormData((prev) => ({ ...prev, [field]: parsedDate })); } else if (!value) { setFormData((prev) => ({ ...prev, [field]: undefined })); } };
  const handleDateInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>, field: "modifiedAfter" | "modifiedBefore") => { /* ... */ if (e.key === 'Enter') { e.preventDefault(); const rawValue = field === "modifiedAfter" ? rawAfterDate : rawBeforeDate; const parsedDate = parseDateString(rawValue); if (parsedDate) { setFormData((prev) => ({ ...prev, [field]: parsedDate })); if (field === "modifiedAfter") setRawAfterDate(format(parsedDate, DISPLAY_DATE_FORMAT, { locale: currentLocale })); else setRawBeforeDate(format(parsedDate, DISPLAY_DATE_FORMAT, { locale: currentLocale })); } else if (!rawValue) { setFormData((prev) => ({ ...prev, [field]: undefined })); } else { const lastValidDate = formData[field]; if (field === "modifiedAfter") setRawAfterDate(lastValidDate ? format(lastValidDate, DISPLAY_DATE_FORMAT, { locale: currentLocale }) : ""); else setRawBeforeDate(lastValidDate ? format(lastValidDate, DISPLAY_DATE_FORMAT, { locale: currentLocale }) : ""); } if (field === 'modifiedAfter') setIsAfterPopoverOpen(false); else setIsBeforePopoverOpen(false); } else if (e.key === 'Escape') { const lastValidDate = formData[field]; if (field === "modifiedAfter") setRawAfterDate(lastValidDate ? format(lastValidDate, DISPLAY_DATE_FORMAT, { locale: currentLocale }) : ""); else setRawBeforeDate(lastValidDate ? format(lastValidDate, DISPLAY_DATE_FORMAT, { locale: currentLocale }) : ""); if (field === 'modifiedAfter') setIsAfterPopoverOpen(false); else setIsBeforePopoverOpen(false); } };
  const handleDateSelect = (field: "modifiedAfter" | "modifiedBefore") => (date: Date | undefined) => { /* ... */ setFormData((prev) => ({ ...prev, [field]: date })); const formattedDate = date ? format(date, DISPLAY_DATE_FORMAT, { locale: currentLocale }) : ""; if (field === "modifiedAfter") { setRawAfterDate(formattedDate); setIsAfterPopoverOpen(false); } else { setRawBeforeDate(formattedDate); setIsBeforePopoverOpen(false); } };
  const clearDate = (field: "modifiedAfter" | "modifiedBefore") => { /* ... */ setFormData((prev) => ({ ...prev, [field]: undefined })); if (field === "modifiedAfter") { setRawAfterDate(""); setIsAfterPopoverOpen(false); } else { setRawBeforeDate(""); setIsBeforePopoverOpen(false); } };
  const handleQueryChange = useCallback((newQuery: QueryStructure | null) => { setQueryStructure(newQuery); }, []);
  const handleQueryCaseSensitivityChange = useCallback((checked: boolean) => { setQueryCaseSensitive(checked); }, []);

  // --- NEW: Cancel Handler ---
  const handleCancelSearch = () => {
      if (window.electronAPI?.cancelSearch) {
          console.log("UI: Requesting search cancellation...");
          window.electronAPI.cancelSearch();
          // Optionally provide immediate feedback, though progress updates should reflect it
      } else {
          console.warn("UI: cancelSearch API not available.");
      }
  };
  // -------------------------

  const handleSubmit = (e: React.FormEvent) => { /* ... */ e.preventDefault(); handleDateInputKeyDown({ key: 'Enter', preventDefault: () => {} } as React.KeyboardEvent<HTMLInputElement>, 'modifiedAfter'); handleDateInputKeyDown({ key: 'Enter', preventDefault: () => {} } as React.KeyboardEvent<HTMLInputElement>, 'modifiedBefore'); setTimeout(() => { const splitAndClean = (str: string) => str.split(/[\n,]+/).map((s) => s.trim()).filter(Boolean); const contentQueryString = queryStructure ? convertStructuredQueryToString(queryStructure) : ""; const submitParams: SearchParams = { searchPaths: splitAndClean(formData.searchPaths), extensions: splitAndClean(formData.extensions), excludeFiles: splitAndClean(formData.excludeFiles), excludeFolders: splitAndClean(formData.excludeFolders), folderExclusionMode: formData.folderExclusionMode, structuredQuery: queryStructure, contentSearchTerm: contentQueryString || undefined, contentSearchMode: contentQueryString ? "boolean" : undefined, caseSensitive: contentQueryString ? queryCaseSensitive : undefined, modifiedAfter: formData.modifiedAfter ? format(formData.modifiedAfter, "yyyy-MM-dd") : undefined, modifiedBefore: formData.modifiedBefore ? format(formData.modifiedBefore, "yyyy-MM-dd") : undefined, maxDepth: parseInt(formData.maxDepthValue, 10) || undefined, }; const minSizeNum = parseFloat(formData.minSizeValue); if (!isNaN(minSizeNum) && minSizeNum >= 0) submitParams.minSizeBytes = minSizeNum * SIZE_UNITS[formData.minSizeUnit]; const maxSizeNum = parseFloat(formData.maxSizeValue); if (!isNaN(maxSizeNum) && maxSizeNum >= 0) submitParams.maxSizeBytes = maxSizeNum * SIZE_UNITS[formData.maxSizeUnit]; if (submitParams.minSizeBytes !== undefined && submitParams.maxSizeBytes !== undefined && submitParams.minSizeBytes > submitParams.maxSizeBytes) { alert(t("errorMinMax")); return; } console.log("Submitting Params:", submitParams); onSubmit(submitParams); }, 50); };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5">
      {/* Search Paths, Extensions, Excludes, Depth, QueryBuilder (Unchanged) */}
       <div className="space-y-1.5">
        <Label htmlFor="searchPaths">{t("searchPathLabel")}</Label>
        <Textarea id="searchPaths" name="searchPaths" value={formData.searchPaths} onChange={handleInputChange} rows={3} required placeholder={t("searchPathPlaceholder")} disabled={isLoading} className="resize-y min-h-[60px]" />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="extensions">{t("extensionsLabel")}</Label>
        <Input type="text" id="extensions" name="extensions" value={formData.extensions} onChange={handleInputChange} required placeholder={t("extensionsPlaceholder")} disabled={isLoading} />
      </div>
       <div className="space-y-1.5">
        <Label htmlFor="excludeFiles">{t("excludeFilesLabelRegex")}</Label>
        <Textarea id="excludeFiles" name="excludeFiles" value={formData.excludeFiles} onChange={handleInputChange} rows={2} placeholder={t("excludeFilesPlaceholderRegex")} disabled={isLoading} className="resize-y min-h-[40px]" />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="excludeFolders">{t("excludeFoldersLabelRegex")}</Label>
        <div className="flex flex-col sm:flex-row gap-4 items-start">
          <Textarea id="excludeFolders" name="excludeFolders" value={formData.excludeFolders} onChange={handleInputChange} rows={2} placeholder={t("excludeFoldersPlaceholderRegex")} disabled={isLoading} className="resize-y min-h-[40px] flex-grow" />
          <div className="space-y-1.5 shrink-0 w-full sm:w-auto">
             <Label htmlFor="folderExclusionMode" className="text-xs text-muted-foreground">{t("folderExclusionModeLabel")}</Label>
             <Select name="folderExclusionMode" value={formData.folderExclusionMode} onValueChange={handleSelectChange('folderExclusionMode')} disabled={isLoading}>
                <SelectTrigger id="folderExclusionMode" className="w-full sm:w-[200px]"><SelectValue placeholder={t("folderExclusionModeLabel")} /></SelectTrigger>
                <SelectContent>
                    <SelectItem value="contains">{t("folderExclusionModeContains")}</SelectItem>
                    <SelectItem value="exact">{t("folderExclusionModeExact")}</SelectItem>
                    <SelectItem value="startsWith">{t("folderExclusionModeStartsWith")}</SelectItem>
                    <SelectItem value="endsWith">{t("folderExclusionModeEndsWith")}</SelectItem>
                </SelectContent>
             </Select>
          </div>
        </div>
      </div>
      <div className="space-y-1.5 max-w-[250px]">
        <Label htmlFor="maxDepthValue">{t("maxDepthLabel")}</Label>
        <Input type="number" id="maxDepthValue" name="maxDepthValue" value={formData.maxDepthValue} onChange={handleInputChange} disabled={isLoading} placeholder={t("maxDepthPlaceholder")} min="1" step="1" className="[appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" />
      </div>
      <div className="space-y-1.5">
        <Label>{t("contentQueryBuilderLabel")}</Label>
        <QueryBuilder initialQuery={queryStructure} initialCaseSensitive={queryCaseSensitive} onChange={handleQueryChange} onCaseSensitivityChange={handleQueryCaseSensitivityChange} disabled={isLoading} />
      </div>

      {/* Date Fields Row (Unchanged structure) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Modified After */}
        <div className="space-y-1.5">
          <Label htmlFor="modifiedAfterInput">{t("modifiedAfterLabel")}</Label>
          <div className="flex items-center gap-1">
            <Popover open={isAfterPopoverOpen} onOpenChange={setIsAfterPopoverOpen}>
              <PopoverTrigger asChild>
                <div className="relative flex-grow">
                  <Input id="modifiedAfterInput" type="text" value={rawAfterDate} onChange={(e) => handleRawDateChange(e, "modifiedAfter")} onKeyDown={(e) => handleDateInputKeyDown(e, "modifiedAfter")} placeholder={DISPLAY_DATE_FORMAT} disabled={isLoading} className="pl-8 h-9 pr-8" />
                  <CalendarIcon className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                   {formData.modifiedAfter && !isLoading && ( <Button variant="ghost" size="icon" type="button" onClick={(e) => { e.stopPropagation(); clearDate("modifiedAfter"); }} className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 shrink-0 text-muted-foreground hover:text-destructive" aria-label="Clear modified after date"><X className="h-4 w-4" /></Button> )}
                </div>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar selected={formData.modifiedAfter} onSelect={handleDateSelect("modifiedAfter")} month={formData.modifiedAfter} locale={currentLocale} disabled={isLoading} />
              </PopoverContent>
            </Popover>
          </div>
        </div>
        {/* Modified Before */}
        <div className="space-y-1.5">
          <Label htmlFor="modifiedBeforeInput">{t("modifiedBeforeLabel")}</Label>
           <div className="flex items-center gap-1">
            <Popover open={isBeforePopoverOpen} onOpenChange={setIsBeforePopoverOpen}>
              <PopoverTrigger asChild>
                 <div className="relative flex-grow">
                   <Input id="modifiedBeforeInput" type="text" value={rawBeforeDate} onChange={(e) => handleRawDateChange(e, "modifiedBefore")} onKeyDown={(e) => handleDateInputKeyDown(e, "modifiedBefore")} placeholder={DISPLAY_DATE_FORMAT} disabled={isLoading} className="pl-8 h-9 pr-8" />
                   <CalendarIcon className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                   {formData.modifiedBefore && !isLoading && ( <Button variant="ghost" size="icon" type="button" onClick={(e) => { e.stopPropagation(); clearDate("modifiedBefore"); }} className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 shrink-0 text-muted-foreground hover:text-destructive" aria-label="Clear modified before date"><X className="h-4 w-4" /></Button> )}
                 </div>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar selected={formData.modifiedBefore} onSelect={handleDateSelect("modifiedBefore")} month={formData.modifiedBefore} locale={currentLocale} disabled={isLoading} />
              </PopoverContent>
            </Popover>
          </div>
        </div>
      </div>

      {/* Size Fields Row (Unchanged) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label htmlFor="minSizeValue">{t("minSizeLabel")}</Label>
          <div className="flex gap-2">
            <Input type="number" id="minSizeValue" name="minSizeValue" value={formData.minSizeValue} onChange={handleInputChange} disabled={isLoading} placeholder="e.g., 100" min="0" step="any" className="flex-grow [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" />
            <Select name="minSizeUnit" value={formData.minSizeUnit} onValueChange={handleSelectChange('minSizeUnit')} disabled={isLoading}>
                <SelectTrigger className="w-[80px] shrink-0"><SelectValue /></SelectTrigger>
                <SelectContent>{Object.keys(SIZE_UNITS).map((unit) => (<SelectItem key={unit} value={unit}>{t(`sizeUnit${unit}` as any)}</SelectItem>))}</SelectContent>
            </Select>
          </div>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="maxSizeValue">{t("maxSizeLabel")}</Label>
          <div className="flex gap-2">
            <Input type="number" id="maxSizeValue" name="maxSizeValue" value={formData.maxSizeValue} onChange={handleInputChange} disabled={isLoading} placeholder="e.g., 50" min="0" step="any" className="flex-grow [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" />
            <Select name="maxSizeUnit" value={formData.maxSizeUnit} onValueChange={handleSelectChange('maxSizeUnit')} disabled={isLoading}>
                <SelectTrigger className="w-[80px] shrink-0"><SelectValue /></SelectTrigger>
                <SelectContent>{Object.keys(SIZE_UNITS).map((unit) => (<SelectItem key={unit} value={unit}>{t(`sizeUnit${unit}` as any)}</SelectItem>))}</SelectContent>
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
        {/* --- NEW: Cancel Button --- */}
        {isLoading && (
            <Button
                type="button"
                variant="destructive" // Or "outline"
                onClick={handleCancelSearch}
                className="w-full sm:w-auto"
            >
                {t("cancelButton")}
            </Button>
        )}
        {/* ------------------------- */}
      </div>
    </form>
  );
};

export default SearchForm;
