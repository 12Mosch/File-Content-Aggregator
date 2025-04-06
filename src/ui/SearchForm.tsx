// D:/Code/Electron/src/ui/SearchForm.tsx
import React, { useState, useCallback } from "react";
import { useTranslation } from "react-i18next";
import QueryBuilder from "./QueryBuilder"; // Import the new QueryBuilder
import type { QueryGroup as QueryStructure } from "./queryBuilderTypes"; // Import the structure type
import "./SearchForm.css";
import type { ContentSearchMode } from "./vite-env.d"; // Keep this if needed elsewhere

// Define unit constants for calculations
const SIZE_UNITS = { Bytes: 1, KB: 1024, MB: 1024 * 1024, GB: 1024 * 1024 * 1024 };
type SizeUnit = keyof typeof SIZE_UNITS;
type FolderExclusionMode = "contains" | "exact" | "startsWith" | "endsWith";

// Define the shape of the data managed by the form's state (excluding content search)
interface SearchFormData {
  searchPaths: string;
  extensions: string;
  excludeFiles: string;
  excludeFolders: string;
  folderExclusionMode: FolderExclusionMode;
  // Removed: contentSearchTerm, contentSearchMode, caseSensitive (handled by QueryBuilder)
  modifiedAfter: string;
  modifiedBefore: string;
  minSizeValue: string;
  minSizeUnit: SizeUnit;
  maxSizeValue: string;
  maxSizeUnit: SizeUnit;
  maxDepthValue: string;
}

// Define the shape of the parameters passed to the onSubmit callback
// Content search term is now generated from the query builder structure
interface SubmitParams {
  searchPaths: string[];
  extensions: string[];
  excludeFiles: string[];
  excludeFolders: string[];
  folderExclusionMode?: FolderExclusionMode;
  contentSearchTerm?: string; // This will be the generated boolean string
  contentSearchMode?: ContentSearchMode; // Will likely always be 'boolean' if term exists
  caseSensitive?: boolean; // Still needed for backend simple term matching within boolean
  modifiedAfter?: string;
  modifiedBefore?: string;
  minSizeBytes?: number;
  maxSizeBytes?: number;
  maxDepth?: number;
}

interface SearchFormProps {
  onSubmit: (params: SubmitParams) => void;
  isLoading: boolean;
}

// --- Helper Function to Convert Structured Query to String ---
const convertStructuredQueryToString = (group: QueryStructure): string => {
  if (!group || group.conditions.length === 0) {
    return "";
  }

  const parts = group.conditions.map((item) => {
    if ("operator" in item) {
      // It's a nested QueryGroup
      return `(${convertStructuredQueryToString(item)})`;
    } else {
      // It's a Condition
      switch (item.type) {
        case "term":
          // Quote terms containing spaces or special chars for safety, handle case sensitivity later
          return /\s|[()]|AND|OR|NOT|NEAR/i.test(item.value)
            ? `"${item.value.replace(/"/g, '\\"')}"` // Escape internal quotes
            : item.value;
        case "regex":
          // Assume value is the pattern, flags are separate. Construct /pattern/flags literal.
          // Ensure flags are valid characters
          const validFlags = (item.flags || "").replace(/[^gimyus]/g, "");
          return `/${item.value}/${validFlags}`;
        case "near":
          // Wrap terms in quotes if they aren't already regex literals or simple identifiers
          const formatNearTerm = (term: string) => {
            if (term.startsWith('/') && term.endsWith('/')) return term; // Already regex
            return /\s|[()]|AND|OR|NOT|NEAR/i.test(term)
              ? `"${term.replace(/"/g, '\\"')}"`
              : term;
          };
          return `NEAR(${formatNearTerm(item.term1)}, ${formatNearTerm(item.term2)}, ${item.distance})`;
        default:
          console.warn("Unknown condition type in query structure:", item);
          return "";
      }
    }
  });

  // Filter out empty strings resulting from unknown types
  const validParts = parts.filter(Boolean);
  if (validParts.length === 0) return "";
  if (validParts.length === 1) return validParts[0]; // No need for operator if only one part

  return validParts.join(` ${group.operator} `);
};
// ---------------------------------------------------------

const SearchForm: React.FC<SearchFormProps> = ({ onSubmit, isLoading }) => {
  const { t } = useTranslation(["form"]);

  const [formData, setFormData] = useState<SearchFormData>({
    searchPaths: "",
    extensions: "",
    excludeFiles: "",
    excludeFolders: ".git, node_modules, bin, obj, dist",
    folderExclusionMode: "contains",
    modifiedAfter: "",
    modifiedBefore: "",
    minSizeValue: "",
    minSizeUnit: "MB",
    maxSizeValue: "",
    maxSizeUnit: "MB",
    maxDepthValue: "",
  });

  // State for the structured query from the QueryBuilder
  const [queryStructure, setQueryStructure] = useState<QueryStructure | null>(null);
  // State to track if the query builder should use case sensitivity for simple terms
  const [queryCaseSensitive, setQueryCaseSensitive] = useState<boolean>(false);

  const handleFormChange = (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
    >,
  ) => {
    const { name, value } = e.target;
    if (e.target.type === "number" && parseFloat(value) < 0) {
      if (value === "" || parseFloat(value) === 0) {
         setFormData((prev) => ({ ...prev, [name]: value }));
      }
      return;
    }
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  // Callback for the QueryBuilder to update the structured query state
  const handleQueryChange = useCallback((newQuery: QueryStructure | null) => {
    setQueryStructure(newQuery);
  }, []);

  // Callback for the QueryBuilder to update case sensitivity
  const handleQueryCaseSensitivityChange = useCallback((checked: boolean) => {
    setQueryCaseSensitive(checked);
  }, []);


  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const splitAndClean = (str: string) => str.split(/[\n,]+/).map((s) => s.trim()).filter(Boolean);

    // Convert the structured query to a string for the backend
    const contentQueryString = queryStructure ? convertStructuredQueryToString(queryStructure) : "";

    const submitParams: SubmitParams = {
      searchPaths: splitAndClean(formData.searchPaths),
      extensions: splitAndClean(formData.extensions),
      excludeFiles: splitAndClean(formData.excludeFiles),
      excludeFolders: splitAndClean(formData.excludeFolders),
      folderExclusionMode: formData.folderExclusionMode,
    };

    // Set content search parameters if a query string was generated
    if (contentQueryString) {
      submitParams.contentSearchTerm = contentQueryString;
      submitParams.contentSearchMode = "boolean"; // Always boolean mode when using builder
      submitParams.caseSensitive = queryCaseSensitive; // Pass the case sensitivity setting
    } else {
      submitParams.contentSearchTerm = undefined;
      submitParams.contentSearchMode = undefined;
      submitParams.caseSensitive = undefined;
    }

    // --- Date, Size, Depth handling (remains the same) ---
    if (formData.modifiedAfter) submitParams.modifiedAfter = formData.modifiedAfter;
    if (formData.modifiedBefore) submitParams.modifiedBefore = formData.modifiedBefore;
    const minSizeNum = parseFloat(formData.minSizeValue);
    if (!isNaN(minSizeNum) && minSizeNum >= 0) submitParams.minSizeBytes = minSizeNum * SIZE_UNITS[formData.minSizeUnit];
    const maxSizeNum = parseFloat(formData.maxSizeValue);
    if (!isNaN(maxSizeNum) && maxSizeNum >= 0) submitParams.maxSizeBytes = maxSizeNum * SIZE_UNITS[formData.maxSizeUnit];
    if (submitParams.minSizeBytes !== undefined && submitParams.maxSizeBytes !== undefined && submitParams.minSizeBytes > submitParams.maxSizeBytes) {
      alert(t('errorMinMax'));
      return;
    }
    const maxDepthNum = parseInt(formData.maxDepthValue, 10);
    if (!isNaN(maxDepthNum) && maxDepthNum > 0) submitParams.maxDepth = maxDepthNum;
    // ---------------------------------

    console.log("Submitting Params:", submitParams); // Log parameters being sent
    onSubmit(submitParams);
  };

  return (
    <form onSubmit={handleSubmit} className="search-form">
      {/* Search Paths, Extensions, Exclude Files */}
      <div className="form-group">
        <label htmlFor="searchPaths">{t("searchPathLabel")}</label>
        <textarea id="searchPaths" name="searchPaths" value={formData.searchPaths} onChange={handleFormChange} rows={3} required placeholder={t("searchPathPlaceholder")} disabled={isLoading} />
      </div>
      <div className="form-group">
        <label htmlFor="extensions">{t("extensionsLabel")}</label>
        <input type="text" id="extensions" name="extensions" value={formData.extensions} onChange={handleFormChange} required placeholder={t("extensionsPlaceholder")} disabled={isLoading} />
      </div>
      <div className="form-group">
        <label htmlFor="excludeFiles">{t("excludeFilesLabelRegex")}</label>
        <textarea id="excludeFiles" name="excludeFiles" value={formData.excludeFiles} onChange={handleFormChange} rows={2} placeholder={t("excludeFilesPlaceholderRegex")} disabled={isLoading} />
      </div>

      {/* Exclude Folders & Mode Selector */}
      <div className="form-group">
        <label htmlFor="excludeFolders">{t("excludeFoldersLabelRegex")}</label>
        <div className="folder-exclusion-group">
          <textarea id="excludeFolders" name="excludeFolders" value={formData.excludeFolders} onChange={handleFormChange} rows={2} placeholder={t("excludeFoldersPlaceholderRegex")} disabled={isLoading} className="folder-exclusion-input" />
          <div className="folder-exclusion-mode-group">
             <label htmlFor="folderExclusionMode" className="folder-exclusion-mode-label">{t("folderExclusionModeLabel")}</label>
             <select id="folderExclusionMode" name="folderExclusionMode" value={formData.folderExclusionMode} onChange={handleFormChange} disabled={isLoading} className="folder-exclusion-mode-select">
                <option value="contains">{t("folderExclusionModeContains")}</option>
                <option value="exact">{t("folderExclusionModeExact")}</option>
                <option value="startsWith">{t("folderExclusionModeStartsWith")}</option>
                <option value="endsWith">{t("folderExclusionModeEndsWith")}</option>
             </select>
          </div>
        </div>
      </div>

      {/* Max Depth */}
      <div className="form-group form-group-depth">
        <label htmlFor="maxDepthValue">{t("maxDepthLabel")}</label>
        <input type="number" id="maxDepthValue" name="maxDepthValue" value={formData.maxDepthValue} onChange={handleFormChange} disabled={isLoading} className="form-input-depth" placeholder={t("maxDepthPlaceholder")} min="1" step="1" />
      </div>

      {/* --- Query Builder Integration --- */}
      <div className="form-group">
        <label>{t("contentQueryBuilderLabel")}</label>
        <QueryBuilder
            onChange={handleQueryChange}
            onCaseSensitivityChange={handleQueryCaseSensitivityChange} // Pass handler
            initialCaseSensitive={queryCaseSensitive} // Pass initial state
            disabled={isLoading}
        />
      </div>
      {/* ------------------------------- */}

      {/* Date Fields */}
      <div className="form-row">
        <div className="form-group">
          <label htmlFor="modifiedAfter">{t("modifiedAfterLabel")}</label>
          <input type="date" id="modifiedAfter" name="modifiedAfter" value={formData.modifiedAfter} onChange={handleFormChange} disabled={isLoading} className="form-input-date" />
        </div>
        <div className="form-group">
          <label htmlFor="modifiedBefore">{t("modifiedBeforeLabel")}</label>
          <input type="date" id="modifiedBefore" name="modifiedBefore" value={formData.modifiedBefore} onChange={handleFormChange} disabled={isLoading} className="form-input-date" />
        </div>
      </div>

      {/* Size Fields */}
      <div className="form-row">
        <div className="form-group form-group-size">
          <label htmlFor="minSizeValue">{t("minSizeLabel")}</label>
          <div className="size-input-group">
            <input type="number" id="minSizeValue" name="minSizeValue" value={formData.minSizeValue} onChange={handleFormChange} disabled={isLoading} className="form-input-size-value" placeholder="e.g., 100" min="0" step="any" />
            <select id="minSizeUnit" name="minSizeUnit" value={formData.minSizeUnit} onChange={handleFormChange} disabled={isLoading} className="form-input-size-unit">
              {Object.keys(SIZE_UNITS).map((unit) => (<option key={unit} value={unit}>{t(`sizeUnit${unit}` as any)}</option>))}
            </select>
          </div>
        </div>
        <div className="form-group form-group-size">
          <label htmlFor="maxSizeValue">{t("maxSizeLabel")}</label>
          <div className="size-input-group">
            <input type="number" id="maxSizeValue" name="maxSizeValue" value={formData.maxSizeValue} onChange={handleFormChange} disabled={isLoading} className="form-input-size-value" placeholder="e.g., 50" min="0" step="any" />
            <select id="maxSizeUnit" name="maxSizeUnit" value={formData.maxSizeUnit} onChange={handleFormChange} disabled={isLoading} className="form-input-size-unit">
              {Object.keys(SIZE_UNITS).map((unit) => (<option key={unit} value={unit}>{t(`sizeUnit${unit}` as any)}</option>))}
            </select>
          </div>
        </div>
      </div>

      {/* Submit Button */}
      <button type="submit" disabled={isLoading}>
        {isLoading ? t("searchButtonLoading") : t("searchButton")}
      </button>
    </form>
  );
};

export default SearchForm;
