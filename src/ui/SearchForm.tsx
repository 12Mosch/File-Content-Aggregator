// D:/Code/Electron/src/ui/SearchForm.tsx
import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import "./SearchForm.css";

// Define unit constants for calculations
const SIZE_UNITS = {
  Bytes: 1,
  KB: 1024,
  MB: 1024 * 1024,
  GB: 1024 * 1024 * 1024,
};
type SizeUnit = keyof typeof SIZE_UNITS;

// Define the shape of the data managed by the form's state
interface SearchFormData {
  searchPaths: string;
  extensions: string;
  excludeFiles: string;
  excludeFolders: string;
  contentSearchTerm: string;
  caseSensitive: boolean;
  modifiedAfter: string;
  modifiedBefore: string;
  minSizeValue: string;
  minSizeUnit: SizeUnit;
  maxSizeValue: string;
  maxSizeUnit: SizeUnit;
}

// Define the shape of the parameters passed to the onSubmit callback
interface SubmitParams {
  searchPaths: string[];
  extensions: string[];
  excludeFiles: string[];
  excludeFolders: string[];
  contentSearchTerm?: string;
  caseSensitive?: boolean;
  modifiedAfter?: string;
  modifiedBefore?: string;
  minSizeBytes?: number;
  maxSizeBytes?: number;
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
    contentSearchTerm: "",
    caseSensitive: false,
    modifiedAfter: "",
    modifiedBefore: "",
    minSizeValue: "",
    minSizeUnit: "MB",
    maxSizeValue: "",
    maxSizeUnit: "MB",
  });

  const handleChange = (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
    >,
  ) => {
    const { name, value } = e.target;
    if (e.target.type === "number" && parseFloat(value) < 0) {
      return;
    }
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleCheckboxChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, checked } = e.target;
    setFormData((prev) => ({ ...prev, [name]: checked }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const splitAndClean = (str: string) =>
      str
        .split(/[\n,]+/)
        .map((s) => s.trim())
        .filter(Boolean);

    const submitParams: SubmitParams = {
      searchPaths: splitAndClean(formData.searchPaths),
      extensions: splitAndClean(formData.extensions),
      excludeFiles: splitAndClean(formData.excludeFiles),
      excludeFolders: splitAndClean(formData.excludeFolders),
    };

    if (formData.contentSearchTerm.trim()) {
      submitParams.contentSearchTerm = formData.contentSearchTerm.trim();
      // Only pass caseSensitive if contentSearchTerm is present
      submitParams.caseSensitive = formData.caseSensitive;
    } else {
      // Ensure caseSensitive is false if contentSearchTerm is empty
      // (Although it won't be rendered, this ensures clean state if needed)
      setFormData(prev => ({ ...prev, caseSensitive: false }));
    }


    if (formData.modifiedAfter) {
      submitParams.modifiedAfter = formData.modifiedAfter;
    }
    if (formData.modifiedBefore) {
      submitParams.modifiedBefore = formData.modifiedBefore;
    }

    const minSizeNum = parseFloat(formData.minSizeValue);
    if (!isNaN(minSizeNum) && minSizeNum >= 0) {
      submitParams.minSizeBytes =
        minSizeNum * SIZE_UNITS[formData.minSizeUnit];
    }

    const maxSizeNum = parseFloat(formData.maxSizeValue);
    if (!isNaN(maxSizeNum) && maxSizeNum >= 0) {
      submitParams.maxSizeBytes =
        maxSizeNum * SIZE_UNITS[formData.maxSizeUnit];
    }

    if (
      submitParams.minSizeBytes !== undefined &&
      submitParams.maxSizeBytes !== undefined &&
      submitParams.minSizeBytes > submitParams.maxSizeBytes
    ) {
      console.error("Min size cannot be greater than max size.");
      alert("Error: Minimum size cannot be greater than maximum size.");
      return;
    }

    onSubmit(submitParams);
  };

  // Determine if the content search term is present (trimmed)
  const hasContentSearchTerm = !!formData.contentSearchTerm.trim();

  return (
    <form onSubmit={handleSubmit} className="search-form">
      {/* Search Paths */}
      <div className="form-group">
        <label htmlFor="searchPaths">{t("searchPathLabel")}</label>
        <textarea id="searchPaths" name="searchPaths" value={formData.searchPaths} onChange={handleChange} rows={3} required placeholder={t("searchPathPlaceholder")} disabled={isLoading} />
      </div>

      {/* Extensions */}
      <div className="form-group">
        <label htmlFor="extensions">{t("extensionsLabel")}</label>
        <input type="text" id="extensions" name="extensions" value={formData.extensions} onChange={handleChange} required placeholder={t("extensionsPlaceholder")} disabled={isLoading} />
      </div>

      {/* Exclude Files */}
      <div className="form-group">
        <label htmlFor="excludeFiles">{t("excludeFilesLabel")}</label>
        <input type="text" id="excludeFiles" name="excludeFiles" value={formData.excludeFiles} onChange={handleChange} placeholder={t("excludeFilesPlaceholder")} disabled={isLoading} />
      </div>

      {/* Exclude Folders */}
      <div className="form-group">
        <label htmlFor="excludeFolders">{t("excludeFoldersLabel")}</label>
        <input type="text" id="excludeFolders" name="excludeFolders" value={formData.excludeFolders} onChange={handleChange} placeholder={t("excludeFoldersPlaceholder")} disabled={isLoading} />
      </div>

      {/* Content Search Term */}
      <div className="form-group">
        <label htmlFor="contentSearchTerm">{t("contentSearchLabel")}</label>
        <input type="text" id="contentSearchTerm" name="contentSearchTerm" value={formData.contentSearchTerm} onChange={handleChange} placeholder={t("contentSearchPlaceholder")} disabled={isLoading} />
      </div>

      {/* Case Sensitive Checkbox - Conditionally Rendered */}
      {/* Only show this group if there is a content search term */}
      {hasContentSearchTerm && (
        <div className="form-group form-group-checkbox">
          <input
            type="checkbox"
            id="caseSensitive"
            name="caseSensitive"
            checked={formData.caseSensitive}
            onChange={handleCheckboxChange}
            // The disabled attribute here is slightly redundant now,
            // but harmless. It ensures it's disabled if somehow rendered
            // without a term (though that shouldn't happen with the condition).
            disabled={isLoading || !hasContentSearchTerm}
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
