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
  minSizeValue: string; // New: Value for min size input
  minSizeUnit: SizeUnit; // New: Unit for min size
  maxSizeValue: string; // New: Value for max size input
  maxSizeUnit: SizeUnit; // New: Unit for max size
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
  minSizeBytes?: number; // New: Optional min size in bytes
  maxSizeBytes?: number; // New: Optional max size in bytes
}

interface SearchFormProps {
  onSubmit: (params: SubmitParams) => void;
  isLoading: boolean;
}

const SearchForm: React.FC<SearchFormProps> = ({ onSubmit, isLoading }) => {
  const { t } = useTranslation(["form"]);

  // Initialize state with default values, including the new size fields
  const [formData, setFormData] = useState<SearchFormData>({
    searchPaths: "",
    extensions: "",
    excludeFiles: "",
    excludeFolders: ".git, node_modules, bin, obj, dist",
    contentSearchTerm: "",
    caseSensitive: false,
    modifiedAfter: "",
    modifiedBefore: "",
    minSizeValue: "", // Default to empty
    minSizeUnit: "MB", // Default unit
    maxSizeValue: "", // Default to empty
    maxSizeUnit: "MB", // Default unit
  });

  // Generic handler for text, textarea, date, and number input changes
  const handleChange = (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
    >,
  ) => {
    const { name, value } = e.target;
    // Special handling for number inputs to prevent negative values visually
    if (e.target.type === "number" && parseFloat(value) < 0) {
      return; // Or set value to '0'
    }
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  // Specific handler for the checkbox change
  const handleCheckboxChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, checked } = e.target;
    setFormData((prev) => ({ ...prev, [name]: checked }));
  };

  // Handler for form submission
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const splitAndClean = (str: string) =>
      str
        .split(/[\n,]+/)
        .map((s) => s.trim())
        .filter(Boolean);

    // Prepare the parameters object
    const submitParams: SubmitParams = {
      searchPaths: splitAndClean(formData.searchPaths),
      extensions: splitAndClean(formData.extensions),
      excludeFiles: splitAndClean(formData.excludeFiles),
      excludeFolders: splitAndClean(formData.excludeFolders),
    };

    // Add content search params if provided
    if (formData.contentSearchTerm.trim()) {
      submitParams.contentSearchTerm = formData.contentSearchTerm.trim();
      submitParams.caseSensitive = formData.caseSensitive;
    }

    // Add date params if provided
    if (formData.modifiedAfter) {
      submitParams.modifiedAfter = formData.modifiedAfter;
    }
    if (formData.modifiedBefore) {
      submitParams.modifiedBefore = formData.modifiedBefore;
    }

    // --- New: Calculate and add size params ---
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
    // Optional: Add validation if min > max
    if (
      submitParams.minSizeBytes !== undefined &&
      submitParams.maxSizeBytes !== undefined &&
      submitParams.minSizeBytes > submitParams.maxSizeBytes
    ) {
      // Handle error - maybe show a message to the user and don't submit
      console.error("Min size cannot be greater than max size.");
      alert("Error: Minimum size cannot be greater than maximum size."); // Simple alert for now
      return;
    }
    // -----------------------------------------

    onSubmit(submitParams);
  };

  return (
    <form onSubmit={handleSubmit} className="search-form">
      {/* --- Existing Fields --- */}
      <div className="form-group">
        <label htmlFor="searchPaths">{t("searchPathLabel")}</label>
        <textarea id="searchPaths" name="searchPaths" value={formData.searchPaths} onChange={handleChange} rows={3} required placeholder={t("searchPathPlaceholder")} disabled={isLoading} />
      </div>
      <div className="form-group">
        <label htmlFor="extensions">{t("extensionsLabel")}</label>
        <input type="text" id="extensions" name="extensions" value={formData.extensions} onChange={handleChange} required placeholder={t("extensionsPlaceholder")} disabled={isLoading} />
      </div>
      <div className="form-group">
        <label htmlFor="excludeFiles">{t("excludeFilesLabel")}</label>
        <input type="text" id="excludeFiles" name="excludeFiles" value={formData.excludeFiles} onChange={handleChange} placeholder={t("excludeFilesPlaceholder")} disabled={isLoading} />
      </div>
      <div className="form-group">
        <label htmlFor="excludeFolders">{t("excludeFoldersLabel")}</label>
        <input type="text" id="excludeFolders" name="excludeFolders" value={formData.excludeFolders} onChange={handleChange} placeholder={t("excludeFoldersPlaceholder")} disabled={isLoading} />
      </div>
      <div className="form-group">
        <label htmlFor="contentSearchTerm">{t("contentSearchLabel")}</label>
        <input type="text" id="contentSearchTerm" name="contentSearchTerm" value={formData.contentSearchTerm} onChange={handleChange} placeholder={t("contentSearchPlaceholder")} disabled={isLoading} />
      </div>
      <div className="form-group form-group-checkbox">
        <input type="checkbox" id="caseSensitive" name="caseSensitive" checked={formData.caseSensitive} onChange={handleCheckboxChange} disabled={isLoading || !formData.contentSearchTerm.trim()} className="form-checkbox" />
        <label htmlFor="caseSensitive" className="form-checkbox-label">{t("caseSensitiveLabel")}</label>
      </div>
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

      {/* --- New Size Fields --- */}
      <div className="form-row">
        {/* Min Size Group */}
        <div className="form-group form-group-size">
          <label htmlFor="minSizeValue">{t("minSizeLabel")}</label>
          <div className="size-input-group">
            <input
              type="number"
              id="minSizeValue"
              name="minSizeValue"
              value={formData.minSizeValue}
              onChange={handleChange}
              disabled={isLoading}
              className="form-input-size-value"
              placeholder="e.g., 100"
              min="0" // HTML5 validation for non-negative
              step="any" // Allow decimals
            />
            <select
              id="minSizeUnit"
              name="minSizeUnit"
              value={formData.minSizeUnit}
              onChange={handleChange}
              disabled={isLoading}
              className="form-input-size-unit"
            >
              {Object.keys(SIZE_UNITS).map((unit) => (
                <option key={unit} value={unit}>
                  {t(`sizeUnit${unit}` as any)} {/* Translate unit */}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Max Size Group */}
        <div className="form-group form-group-size">
          <label htmlFor="maxSizeValue">{t("maxSizeLabel")}</label>
          <div className="size-input-group">
            <input
              type="number"
              id="maxSizeValue"
              name="maxSizeValue"
              value={formData.maxSizeValue}
              onChange={handleChange}
              disabled={isLoading}
              className="form-input-size-value"
              placeholder="e.g., 50"
              min="0"
              step="any"
            />
            <select
              id="maxSizeUnit"
              name="maxSizeUnit"
              value={formData.maxSizeUnit}
              onChange={handleChange}
              disabled={isLoading}
              className="form-input-size-unit"
            >
              {Object.keys(SIZE_UNITS).map((unit) => (
                <option key={unit} value={unit}>
                  {t(`sizeUnit${unit}` as any)} {/* Translate unit */}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* --- Submit Button --- */}
      <button type="submit" disabled={isLoading}>
        {isLoading ? t("searchButtonLoading") : t("searchButton")}
      </button>
    </form>
  );
};

// Add styling for size input groups if needed in SearchForm.css
/*
.form-group-size label {
  margin-bottom: 0.3rem; // Adjust spacing if needed
}

.size-input-group {
  display: flex;
  gap: 0.5rem; // Space between number input and unit select
}

.form-input-size-value {
  flex-grow: 1; // Allow number input to take more space
  // Consider removing spinner arrows if desired
  // -moz-appearance: textfield;
}
// .form-input-size-value::-webkit-outer-spin-button,
// .form-input-size-value::-webkit-inner-spin-button {
//   -webkit-appearance: none;
//   margin: 0;
// }

.form-input-size-unit {
  flex-shrink: 0; // Prevent unit select from shrinking too much
  min-width: 70px; // Ensure unit text is visible
}
*/

export default SearchForm;
