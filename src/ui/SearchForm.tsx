// D:/Code/Electron/src/ui/SearchForm.tsx
import React, { useState } from "react";
import { useTranslation } from "react-i18next"; // Import the hook
import "./SearchForm.css";

// Define the shape of the data managed by the form's state
interface SearchFormData {
  searchPaths: string;
  extensions: string;
  excludeFiles: string;
  excludeFolders: string;
  contentSearchTerm: string; // New: Content search term
  caseSensitive: boolean; // New: Case sensitivity flag
}

// Define the shape of the parameters passed to the onSubmit callback
interface SubmitParams {
  searchPaths: string[];
  extensions: string[];
  excludeFiles: string[];
  excludeFolders: string[];
  contentSearchTerm?: string; // New: Optional content search term
  caseSensitive?: boolean; // New: Optional case sensitivity flag
}

interface SearchFormProps {
  onSubmit: (params: SubmitParams) => void;
  isLoading: boolean;
}

const SearchForm: React.FC<SearchFormProps> = ({ onSubmit, isLoading }) => {
  // Use the hook, specifying the 'form' namespace
  const { t } = useTranslation(["form"]);

  // Initialize state with default values, including the new fields
  const [formData, setFormData] = useState<SearchFormData>({
    searchPaths: "",
    extensions: "",
    excludeFiles: "",
    excludeFolders: ".git, node_modules, bin, obj, dist",
    contentSearchTerm: "", // Default to empty
    caseSensitive: false, // Default to case-insensitive
  });

  // Generic handler for text input and textarea changes
  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  // Specific handler for the checkbox change
  const handleCheckboxChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, checked } = e.target;
    setFormData((prev) => ({ ...prev, [name]: checked }));
  };

  // Handler for form submission
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Helper function to split comma/newline separated strings into trimmed, non-empty arrays
    const splitAndClean = (str: string) =>
      str
        .split(/[\n,]+/)
        .map((s) => s.trim())
        .filter(Boolean);

    // Prepare the parameters object for the onSubmit callback
    const submitParams: SubmitParams = {
      searchPaths: splitAndClean(formData.searchPaths),
      extensions: splitAndClean(formData.extensions),
      excludeFiles: splitAndClean(formData.excludeFiles),
      excludeFolders: splitAndClean(formData.excludeFolders),
    };

    // Only include contentSearchTerm if it's not empty
    if (formData.contentSearchTerm.trim()) {
      submitParams.contentSearchTerm = formData.contentSearchTerm.trim();
      // Only include caseSensitive if contentSearchTerm is provided
      submitParams.caseSensitive = formData.caseSensitive;
    }

    onSubmit(submitParams);
  };

  return (
    <form onSubmit={handleSubmit} className="search-form">
      {/* Search Paths */}
      <div className="form-group">
        <label htmlFor="searchPaths">{t("searchPathLabel")}</label>
        <textarea
          id="searchPaths"
          name="searchPaths"
          value={formData.searchPaths}
          onChange={handleChange}
          rows={3}
          required
          placeholder={t("searchPathPlaceholder")}
          disabled={isLoading}
        />
      </div>

      {/* Extensions */}
      <div className="form-group">
        <label htmlFor="extensions">{t("extensionsLabel")}</label>
        <input
          type="text"
          id="extensions"
          name="extensions"
          value={formData.extensions}
          onChange={handleChange}
          required
          placeholder={t("extensionsPlaceholder")}
          disabled={isLoading}
        />
      </div>

      {/* Exclude Files */}
      <div className="form-group">
        <label htmlFor="excludeFiles">{t("excludeFilesLabel")}</label>
        <input
          type="text"
          id="excludeFiles"
          name="excludeFiles"
          value={formData.excludeFiles}
          onChange={handleChange}
          placeholder={t("excludeFilesPlaceholder")}
          disabled={isLoading}
        />
      </div>

      {/* Exclude Folders */}
      <div className="form-group">
        <label htmlFor="excludeFolders">{t("excludeFoldersLabel")}</label>
        <input
          type="text"
          id="excludeFolders"
          name="excludeFolders"
          value={formData.excludeFolders}
          onChange={handleChange}
          placeholder={t("excludeFoldersPlaceholder")}
          disabled={isLoading}
        />
      </div>

      {/* Content Search Term (New) */}
      <div className="form-group">
        <label htmlFor="contentSearchTerm">{t("contentSearchLabel")}</label>
        <input
          type="text"
          id="contentSearchTerm"
          name="contentSearchTerm"
          value={formData.contentSearchTerm}
          onChange={handleChange}
          placeholder={t("contentSearchPlaceholder")}
          disabled={isLoading}
        />
      </div>

      {/* Case Sensitive Checkbox (New) */}
      <div className="form-group form-group-checkbox">
        <input
          type="checkbox"
          id="caseSensitive"
          name="caseSensitive"
          checked={formData.caseSensitive}
          onChange={handleCheckboxChange}
          disabled={isLoading || !formData.contentSearchTerm.trim()} // Disable if no search term
          className="form-checkbox"
        />
        <label htmlFor="caseSensitive" className="form-checkbox-label">
          {t("caseSensitiveLabel")}
        </label>
      </div>

      {/* Submit Button */}
      <button type="submit" disabled={isLoading}>
        {isLoading ? t("searchButtonLoading") : t("searchButton")}
      </button>
    </form>
  );
};

// Add some basic styling for the checkbox group if needed in SearchForm.css
/*
.form-group-checkbox {
  flex-direction: row;
  align-items: center;
  gap: 0.5rem;
}

.form-checkbox {
  width: auto; // Override default input width if necessary
}

.form-checkbox-label {
  margin-bottom: 0; // Remove default label margin
  color: var(--color-text-primary); // Ensure consistent text color
  font-weight: normal; // Make it less prominent than group labels
}
*/

export default SearchForm;
