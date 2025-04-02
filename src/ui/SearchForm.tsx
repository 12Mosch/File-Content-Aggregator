import React, { useState } from "react";
import "./SearchForm.css"; // We'll create this CSS file next

interface SearchFormData {
  searchPaths: string; // Comma or newline separated
  extensions: string; // Comma separated
  excludeFiles: string; // Comma separated
  excludeFolders: string; // Comma separated
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
  const [formData, setFormData] = useState<SearchFormData>({
    searchPaths: "",
    extensions: "",
    excludeFiles: "",
    excludeFolders: ".git, node_modules, bin, obj, dist", // Sensible defaults
  });

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Split comma/newline separated strings into arrays, trim whitespace, filter empty
    const splitAndClean = (str: string) =>
      str
        .split(/[\n,]+/) // Split by newline or comma
        .map((s) => s.trim())
        .filter(Boolean); // Remove empty strings

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
        <label htmlFor="searchPaths">Search Paths (one per line or comma-separated):</label>
        <textarea
          id="searchPaths"
          name="searchPaths"
          value={formData.searchPaths}
          onChange={handleChange}
          rows={3}
          required
          placeholder="e.g., C:\Users\Me\Documents, /home/user/projects"
          disabled={isLoading}
        />
      </div>

      <div className="form-group">
        <label htmlFor="extensions">File Extensions (comma-separated):</label>
        <input
          type="text"
          id="extensions"
          name="extensions"
          value={formData.extensions}
          onChange={handleChange}
          required
          placeholder="e.g., txt, log, cs, tsx"
          disabled={isLoading}
        />
      </div>

      <div className="form-group">
        <label htmlFor="excludeFiles">Exclude Files (comma-separated, supports wildcards like *):</label>
        <input
          type="text"
          id="excludeFiles"
          name="excludeFiles"
          value={formData.excludeFiles}
          onChange={handleChange}
          placeholder="e.g., temp*.log, *.tmp"
          disabled={isLoading}
        />
      </div>

      <div className="form-group">
        <label htmlFor="excludeFolders">Exclude Folders (comma-separated, substring match):</label>
        <input
          type="text"
          id="excludeFolders"
          name="excludeFolders"
          value={formData.excludeFolders}
          onChange={handleChange}
          placeholder="e.g., node_modules, .git, bin"
          disabled={isLoading}
        />
      </div>

      <button type="submit" disabled={isLoading}>
        {isLoading ? "Searching..." : "Search Files"}
      </button>
    </form>
  );
};

export default SearchForm;
