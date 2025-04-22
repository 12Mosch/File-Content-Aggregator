# File Content Aggregator Features

File Content Aggregator is a powerful desktop application built with Electron and React that allows users to efficiently search for files based on name, path, metadata, and content across multiple directories. This document provides a comprehensive overview of all features available in the application.

## Core Search Features

### Search Configuration
- **Multiple Search Paths**: Search across multiple directories simultaneously (one per line or comma-separated)
- **Browse Button**: Visual directory selection using a file browser dialog
- **File Extensions**: Filter files by extension (e.g., .txt, .js, .html)
- **Exclude Files/Folders**: Exclude specific files or directories from search using patterns
- **Folder Exclusion Modes**: Choose between "contains", "exact", "startsWith", or "endsWith" matching for folder exclusions
- **Max Depth**: Limit search depth in directory hierarchies

### Content Search Modes
- **Boolean Query**: Create complex logical expressions with AND/OR operators using the Query Builder
- **Simple Term**: Search for exact text matches without Boolean logic
- **Regular Expression**: Use regex patterns for advanced pattern matching
- **Whole Word Matching**: Match only whole words, not substrings within words (e.g., "log" won't match "catalog")

### Advanced Search Features
- **NEAR Operator**: Find terms that appear within a specified word distance of each other
- **Fuzzy Search**: Find approximate matches for terms that don't match exactly
  - Configurable for Boolean Query mode
  - Configurable for NEAR operator
- **Case Sensitivity**: Toggle case-sensitive searching
- **Date Modified Filters**: Search for files modified before or after specific dates
- **File Size Filters**: Search for files within specific size ranges

## Results Management

### Results Display
- **Tree View**: Hierarchical display of search results organized by file path
- **Content Preview**: View content snippets of matched files with search terms highlighted
- **Syntax Highlighting**: Code files are displayed with language-appropriate syntax highlighting
- **Search Term Highlighting**: Search terms are highlighted in content previews for easy identification
- **Expand/Collapse**: Toggle visibility of file content in the results tree
- **Show More**: Expand content previews to show more lines for large files
- **Results Summary**: View statistics about the search (files found, processed, errors)

### Results Filtering and Sorting
- **Filter Results**: Fuzzy search within results to quickly find specific files
- **Sort Results**: Sort by file path, match count, or file size in ascending or descending order

### File Operations
- **Open File**: Open files with the default system application
- **Show in Folder**: Open the file's containing folder in the system's file explorer
- **Copy File Content**: Copy the content of individual files to the clipboard
- **File Selection**: Select specific files using checkboxes for export operations

### Export Features
- **Export All Results**: Save all search results to a file
- **Export Selected Files**: Save only selected files to a file
- **Multiple Export Formats**: Export as TXT, CSV, JSON, or Markdown
- **Copy to Clipboard**: Copy results directly to clipboard in the selected format

## Application Features

### Search History
- **Automatic Saving**: Search parameters are automatically saved
- **De-duplication**: Identical searches are de-duplicated
- **History Management**: View, load, filter, name, favorite, and delete past searches
- **Search Persistence**: Reload previous searches with all original parameters

### User Interface
- **Responsive Design**: Adapts to different window sizes and screen resolutions
- **Keyboard Shortcuts**: Navigate and perform actions using keyboard shortcuts
- **Accessibility Features**: Screen reader compatibility and keyboard navigation
- **Progress Tracking**: Real-time progress indicators during search operations
- **Cancel Search**: Ability to cancel ongoing searches
- **Error Handling**: Clear error messages for search paths, file access issues, etc.

### Customization
- **Theming**: Support for Light, Dark, and System Default themes
- **Internationalization (i18n)**: Multiple language support
  - Currently supported languages: English, German, Spanish, French, Italian, Japanese, Portuguese, Russian
- **Settings Management**: Persistent user preferences
- **Default Export Format**: Configure preferred export format

### Performance Features
- **Worker Threads**: Multi-threaded search for improved performance
- **Virtualized Lists**: Efficient rendering of large result sets
- **On-Demand Content Loading**: File content is loaded only when needed
- **Optimized Search Algorithms**: Fast file discovery and content matching
- **Concurrency Limiting**: Controlled parallel operations to prevent system overload
- **Caching**: Content and highlighting caches for improved responsiveness

## Technical Features

- **Electron Framework**: Cross-platform desktop application
- **React UI**: Modern, component-based user interface
- **TypeScript**: Type-safe code
- **Tailwind CSS**: Utility-first CSS framework for styling
- **shadcn/ui**: High-quality UI components
- **Highlight.js**: Syntax highlighting for code files
- **Fuse.js**: Fuzzy search implementation
- **Fast-glob & Picomatch**: Efficient file pattern matching
- **JSEP**: JavaScript Expression Parser for query parsing
- **Electron Store**: Persistent storage for settings and history
- **React Virtualization**: Efficient rendering of large lists
