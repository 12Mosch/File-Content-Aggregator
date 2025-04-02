import React, { useState } from "react";
import { useTranslation } from "react-i18next"; // Import the hook
import "./SearchForm.css";

interface SearchFormData {
  searchPaths: string;
  extensions: string;
  excludeFiles: string;
  excludeFolders: string;
}

interface SearchFormProps {
  onSubmit: (params: {
    searchPaths: string[];
    extensions: string[];
    excludeFiles: string[];
    excludeFolders: string[];
  }) => void;
  isLoading: boolean;
}

const SearchForm: React.FC<SearchFormProps> = ({ onSubmit, isLoading }) => {
  // Use the hook, specifying the 'form' namespace
  const { t } = useTranslation(['form']);

  const [formData, setFormData] = useState<SearchFormData>({
    searchPaths: "",
    extensions: "",
    excludeFiles: "",
    excludeFolders: ".git, node_modules, bin, obj, dist",
  });

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const splitAndClean = (str: string) =>
      str
        .split(/[\n,]+/)
        .map((s) => s.trim())
        .filter(Boolean);

    onSubmit({
      searchPaths: splitAndClean(formData.searchPaths),
      extensions: splitAndClean(formData.extensions),
      excludeFiles: splitAndClean(formData.excludeFiles),
      excludeFolders: splitAndClean(formData.excludeFolders),
    });
  };

  return (
    <form onSubmit={handleSubmit} className="search-form">
      <div className="form-group">
        {/* Use t() for translation */}
        <label htmlFor="searchPaths">{t('searchPathLabel')}</label>
        <textarea
          id="searchPaths"
          name="searchPaths"
          value={formData.searchPaths}
          onChange={handleChange}
          rows={3}
          required
          placeholder={t('searchPathPlaceholder')} // Translate placeholder
          disabled={isLoading}
        />
      </div>

      <div className="form-group">
        <label htmlFor="extensions">{t('extensionsLabel')}</label>
        <input
          type="text"
          id="extensions"
          name="extensions"
          value={formData.extensions}
          onChange={handleChange}
          required
          placeholder={t('extensionsPlaceholder')} // Translate placeholder
          disabled={isLoading}
        />
      </div>

      <div className="form-group">
        <label htmlFor="excludeFiles">{t('excludeFilesLabel')}</label>
        <input
          type="text"
          id="excludeFiles"
          name="excludeFiles"
          value={formData.excludeFiles}
          onChange={handleChange}
          placeholder={t('excludeFilesPlaceholder')} // Translate placeholder
          disabled={isLoading}
        />
      </div>

      <div className="form-group">
        <label htmlFor="excludeFolders">{t('excludeFoldersLabel')}</label>
        <input
          type="text"
          id="excludeFolders"
          name="excludeFolders"
          value={formData.excludeFolders}
          onChange={handleChange}
          placeholder={t('excludeFoldersPlaceholder')} // Translate placeholder
          disabled={isLoading}
        />
      </div>

      <button type="submit" disabled={isLoading}>
        {/* Translate button text based on loading state */}
        {isLoading ? t('searchButtonLoading') : t('searchButton')}
      </button>
    </form>
  );
};

export default SearchForm;
