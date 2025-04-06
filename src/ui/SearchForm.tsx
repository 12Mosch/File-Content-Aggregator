// D:/Code/Electron/src/ui/SearchForm.tsx
import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import "./SearchForm.css";
import type { ContentSearchMode } from "./vite-env.d";

// Define unit constants for calculations
const SIZE_UNITS = { Bytes: 1, KB: 1024, MB: 1024 * 1024, GB: 1024 * 1024 * 1024 };
type SizeUnit = keyof typeof SIZE_UNITS;
type FolderExclusionMode = "contains" | "exact" | "startsWith" | "endsWith";

// Define the shape of the data managed by the form's state
interface SearchFormData {
  searchPaths: string;
  extensions: string;
  excludeFiles: string;
  excludeFolders: string;
  folderExclusionMode: FolderExclusionMode;
  contentSearchTerm: string;
  contentSearchMode: ContentSearchMode;
  caseSensitive: boolean;
  modifiedAfter: string;
  modifiedBefore: string;
  minSizeValue: string;
  minSizeUnit: SizeUnit;
  maxSizeValue: string;
  maxSizeUnit: SizeUnit;
  maxDepthValue: string;
}

// Define the shape of the parameters passed to the onSubmit callback
interface SubmitParams {
  searchPaths: string[];
  extensions: string[];
  excludeFiles: string[];
  excludeFolders: string[];
  folderExclusionMode?: FolderExclusionMode;
  contentSearchTerm?: string;
  contentSearchMode?: ContentSearchMode;
  caseSensitive?: boolean; // Applies to 'term' mode and non-regex terms in 'boolean' mode
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

const SearchForm: React.FC<SearchFormProps> = ({ onSubmit, isLoading }) => {
  const { t } = useTranslation(["form"]);

  const [formData, setFormData] = useState<SearchFormData>({
    searchPaths: "",
    extensions: "",
    excludeFiles: "",
    excludeFolders: ".git, node_modules, bin, obj, dist",
    folderExclusionMode: "contains",
    contentSearchTerm: "",
    contentSearchMode: "term",
    caseSensitive: false,
    modifiedAfter: "",
    modifiedBefore: "",
    minSizeValue: "",
    minSizeUnit: "MB",
    maxSizeValue: "",
    maxSizeUnit: "MB",
    maxDepthValue: "",
  });

  const handleChange = (
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

  const handleCheckboxChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, checked } = e.target;
    setFormData((prev) => ({ ...prev, [name]: checked }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const splitAndClean = (str: string) => str.split(/[\n,]+/).map((s) => s.trim()).filter(Boolean);

    const submitParams: SubmitParams = {
      searchPaths: splitAndClean(formData.searchPaths),
      extensions: splitAndClean(formData.extensions),
      excludeFiles: splitAndClean(formData.excludeFiles),
      excludeFolders: splitAndClean(formData.excludeFolders),
      folderExclusionMode: formData.folderExclusionMode,
    };

    if (formData.contentSearchTerm.trim()) {
      submitParams.contentSearchTerm = formData.contentSearchTerm.trim();
      submitParams.contentSearchMode = formData.contentSearchMode;
      // Only pass caseSensitive if mode is 'term' or 'boolean'
      // Regex mode relies on flags in the pattern itself
      if (formData.contentSearchMode === 'term' || formData.contentSearchMode === 'boolean') {
        submitParams.caseSensitive = formData.caseSensitive;
      } else {
        submitParams.caseSensitive = undefined; // Don't pass for regex mode
      }
    } else {
      submitParams.contentSearchTerm = undefined;
      submitParams.contentSearchMode = undefined;
      submitParams.caseSensitive = undefined;
    }

    // --- Date, Size, Depth handling ---
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

    onSubmit(submitParams);
  };

  const hasContentSearchTerm = !!formData.contentSearchTerm.trim();
  // Case sensitive checkbox is relevant for 'term' and 'boolean' modes
  const isCaseSensitiveRelevant = formData.contentSearchMode === 'term' || formData.contentSearchMode === 'boolean';
  const isCaseSensitiveDisabled = isLoading || !hasContentSearchTerm || !isCaseSensitiveRelevant;

  // --- Determine placeholder based on mode ---
  const getPlaceholder = () => {
      switch (formData.contentSearchMode) {
          case 'regex': return t("contentSearchPlaceholderRegex");
          case 'boolean': return t("contentSearchPlaceholderBooleanRegex"); // Use updated key
          case 'term':
          default: return t("contentSearchPlaceholder");
      }
  };
  // -----------------------------------------

  return (
    <form onSubmit={handleSubmit} className="search-form">
      {/* Search Paths, Extensions, Exclude Files */}
      <div className="form-group">
        <label htmlFor="searchPaths">{t("searchPathLabel")}</label>
        <textarea id="searchPaths" name="searchPaths" value={formData.searchPaths} onChange={handleChange} rows={3} required placeholder={t("searchPathPlaceholder")} disabled={isLoading} />
      </div>
      <div className="form-group">
        <label htmlFor="extensions">{t("extensionsLabel")}</label>
        <input type="text" id="extensions" name="extensions" value={formData.extensions} onChange={handleChange} required placeholder={t("extensionsPlaceholder")} disabled={isLoading} />
      </div>
      <div className="form-group">
        <label htmlFor="excludeFiles">{t("excludeFilesLabelRegex")}</label>
        <textarea id="excludeFiles" name="excludeFiles" value={formData.excludeFiles} onChange={handleChange} rows={2} placeholder={t("excludeFilesPlaceholderRegex")} disabled={isLoading} />
      </div>

      {/* Exclude Folders & Mode Selector */}
      <div className="form-group">
        <label htmlFor="excludeFolders">{t("excludeFoldersLabelRegex")}</label>
        <div className="folder-exclusion-group">
          <textarea id="excludeFolders" name="excludeFolders" value={formData.excludeFolders} onChange={handleChange} rows={2} placeholder={t("excludeFoldersPlaceholderRegex")} disabled={isLoading} className="folder-exclusion-input" />
          <div className="folder-exclusion-mode-group">
             <label htmlFor="folderExclusionMode" className="folder-exclusion-mode-label">{t("folderExclusionModeLabel")}</label>
             <select id="folderExclusionMode" name="folderExclusionMode" value={formData.folderExclusionMode} onChange={handleChange} disabled={isLoading} className="folder-exclusion-mode-select">
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
        <input type="number" id="maxDepthValue" name="maxDepthValue" value={formData.maxDepthValue} onChange={handleChange} disabled={isLoading} className="form-input-depth" placeholder={t("maxDepthPlaceholder")} min="1" step="1" />
      </div>

      {/* Content Search Group (Dropdown + Input) */}
      <div className="form-group">
        <label htmlFor="contentSearchMode">{t("contentSearchModeLabel")}</label>
        <div className="content-search-group">
          <select
            id="contentSearchMode"
            name="contentSearchMode"
            value={formData.contentSearchMode}
            onChange={handleChange}
            disabled={isLoading}
            className="content-search-mode-select"
          >
            <option value="term">{t("contentSearchModeTerm")}</option>
            <option value="regex">{t("contentSearchModeRegex")}</option>
            <option value="boolean">{t("contentSearchModeBoolean")}</option>
          </select>
          <input
            type="text"
            id="contentSearchTerm"
            name="contentSearchTerm"
            value={formData.contentSearchTerm}
            onChange={handleChange}
            placeholder={getPlaceholder()} // Use dynamic placeholder
            disabled={isLoading}
            className="content-search-input"
          />
        </div>
      </div>

      {/* Case Sensitive Checkbox (only shown if relevant) */}
      {hasContentSearchTerm && isCaseSensitiveRelevant && (
        <div className="form-group form-group-checkbox">
          <input
            type="checkbox"
            id="caseSensitive"
            name="caseSensitive"
            checked={formData.caseSensitive}
            onChange={handleCheckboxChange}
            disabled={isCaseSensitiveDisabled}
            className="form-checkbox"
          />
          <label htmlFor="caseSensitive" className="form-checkbox-label">
            {t("caseSensitiveLabel")}
          </label>
        </div>
      )}

      {/* Date Fields */}
      <div className="form-row">
        <div className="form-group">
          <label htmlFor="modifiedAfter">{t("modifiedAfterLabel")}</label>
          <input type="date" id="modifiedAfter" name="modifiedAfter" value={formData.modifiedAfter} onChange={handleChange} disabled={isLoading} className="form-input-date" />
        </div>
        <div className="form-group">
          <label htmlFor="modifiedBefore">{t("modifiedBeforeLabel")}</label>
          <input type="date" id="modifiedBefore" name="modifiedBefore" value={formData.modifiedBefore} onChange={handleChange} disabled={isLoading} className="form-input-date" />
        </div>
      </div>

      {/* Size Fields */}
      <div className="form-row">
        <div className="form-group form-group-size">
          <label htmlFor="minSizeValue">{t("minSizeLabel")}</label>
          <div className="size-input-group">
            <input type="number" id="minSizeValue" name="minSizeValue" value={formData.minSizeValue} onChange={handleChange} disabled={isLoading} className="form-input-size-value" placeholder="e.g., 100" min="0" step="any" />
            <select id="minSizeUnit" name="minSizeUnit" value={formData.minSizeUnit} onChange={handleChange} disabled={isLoading} className="form-input-size-unit">
              {Object.keys(SIZE_UNITS).map((unit) => (<option key={unit} value={unit}>{t(`sizeUnit${unit}` as any)}</option>))}
            </select>
          </div>
        </div>
        <div className="form-group form-group-size">
          <label htmlFor="maxSizeValue">{t("maxSizeLabel")}</label>
          <div className="size-input-group">
            <input type="number" id="maxSizeValue" name="maxSizeValue" value={formData.maxSizeValue} onChange={handleChange} disabled={isLoading} className="form-input-size-value" placeholder="e.g., 50" min="0" step="any" />
            <select id="maxSizeUnit" name="maxSizeUnit" value={formData.maxSizeUnit} onChange={handleChange} disabled={isLoading} className="form-input-size-unit">
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
