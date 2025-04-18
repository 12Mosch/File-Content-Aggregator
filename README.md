# File Content Aggregator

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
[![Latest Release](https://img.shields.io/github/v/release/12Mosch/File-Content-Aggregator)](https://github.com/12Mosch/File-Content-Aggregator/releases)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](./CONTRIBUTING.md)

![App Screenshot](./docs/assets/AppScreenshot.png)

> A powerful cross-platform desktop application that helps you find exactly what you're looking for across your files and directories.

File Content Aggregator is built with Electron and React to efficiently search for files based on name, path, metadata, and content across multiple directories. It features a powerful boolean and proximity query engine, making it perfect for developers, data analysts, and anyone who needs to search through large collections of files quickly and precisely.

## Table of Contents

- [Key Features](#key-features)
- [Installation](#installation)
- [Usage](#usage)
- [Development](#development)
- [Building](#building)
- [Technology Stack](#technology-stack)
- [Documentation](#documentation)
- [Troubleshooting](#troubleshooting)
- [Contributing](#contributing)
- [Acknowledgments](#acknowledgments)
- [License](#license)

## Key Features

- **Multi-Directory Search:** Specify multiple starting paths for your search, either by typing paths or using the visual directory selection dialog via the "Browse..." button.
- **Flexible Filtering:**
  - Filter by **file extensions** (e.g., `.txt`, `.log`, `.ts`).
  - Limit **search depth** within directories.
  - **Collapsible Advanced Options:** Optional criteria are organized into accordion sections for a cleaner interface:
    - **Exclude Options:** Exclude specific **files** using glob patterns or regular expressions (e.g., `*.tmp`, `/temp\d+\.log/i`) and exclude specific **folders** using wildcard patterns with different matching modes (Contains, Exact, Starts With, Ends With - e.g., `node_modules`, `.git*`, `*cache*`).
    - **Date Options:** Filter by **modification date** range (Modified After / Before).
    - **Size Options:** Filter by **file size** range (Min / Max Size).
- **Advanced Content Querying:**
  - **Structured Query Builder:** Easily build complex content searches visually.
  - **Simple Term:** Find exact text matches (case-sensitive option available).
  - **Regular Expressions:** Use `/pattern/flags` for powerful pattern matching within file content.
  - **Boolean Logic:** Combine terms and expressions using `AND`, `OR`, `NOT`, and parentheses `()`.
  - **Proximity Search:** Find terms near each other using `NEAR(term1, term2, distance)` (e.g., `NEAR(error, database, 5)` finds "error" within 5 words of "database").
  - **Fuzzy Search:** Automatically find approximate matches for terms, helping with typos and variations.
- **Efficient Results Display:**
  - **Tree View:** Lists all processed files, showing content previews (fetched on demand) for matches or error messages for non-matches/read errors.
  - **Virtualization:** Uses `react-window` and `react-virtualized-auto-sizer` to handle potentially huge numbers of files and large result sets smoothly.
  - **Syntax Highlighting:** Highlights code snippets in the tree view using `highlight.js` in a web worker for performance.
  - **Search Term Highlighting:** Highlights matched search terms within content previews for easy identification.
  - **Results Filtering:** Filter the displayed results (tree view) on the fly based on file path or error messages.
  - **Results Sorting:** Sort the displayed results by File Path, File Size, Date Modified, or Match Status (Ascending/Descending).
  - **Copy & Export:**
    - **Copy Individual File Content:** Use the copy icon (📄) in an expanded item's header to copy only that specific file's full content.
    - **Copy All Results:** Use the "Copy Results" button to copy the metadata and content (for matched files) of _all processed files_ (formatted as TXT, CSV, JSON, or Markdown) to the clipboard. (⚠️ May be truncated for very large result sets).
    - **Export All Results:** Use the "Save Results As..." button to save the metadata and content (for matched files) of _all processed files_ to a file in the selected format (TXT, CSV, JSON, or Markdown).
- **Application Features:**
  - **Search History:** Automatically saves searches (de-duplicates identical searches); view, load, filter, name, favorite, and delete past searches.
  - **Internationalization (i18n):** Supports multiple languages (Currently: English, German, Spanish, French, Italian, Japanese, Portuguese, Russian). Uses `i18next`.
  - **Theming:** Supports Light, Dark, and System Default themes using Tailwind CSS and `shadcn/ui`.
  - **Settings:** Configure language, theme, and default export format. Options to disable fuzzy search in Content Query, Boolean Query mode, and NEAR function.
  - **Progress & Cancellation:** Real-time progress bar during search with the ability to cancel ongoing searches.
- **Security Focused:**
  - Built with Electron's security best practices in mind (Context Isolation, Sandbox enabled).
  - Strict Content Security Policy (CSP).
  - IPC message validation.

## Installation

Pre-built binaries for Windows, macOS, and Linux can be found on the [**GitHub Releases**](https://github.com/12Mosch/File-Content-Aggregator/releases) page.

- **Windows:** Download the `.exe` (portable) or `.msi` (installer).
- **macOS:** Download the `.dmg` file. Open it and drag the application to your Applications folder.
- **Linux:** Download the `.AppImage` file. Make it executable (`chmod +x file-content-aggregator*.AppImage`) and run it.

After installation, launch the application. You should see the main interface with search options. If you encounter any issues, see the [Troubleshooting](#troubleshooting) section.

## Usage

1.  Launch the application.
2.  **Configure Search:**
    - Enter the **Search Paths** (one per line or comma-separated) or use the **Browse...** button to select directories visually.
    - Specify required **File Extensions**.
    - Add any **Exclude Files/Folders** patterns.
    - Use the **Content Query** builder or leave blank to search based only on metadata/filters.
    - Set optional filters like **Max Depth**, **Date Modified**, and **File Size**.
    - _(Note: Date input supports `DD.MM.YYYY` format via keyboard)_.
3.  Click **Search Files**.
4.  View progress and results in the **Tree View**. Use the **Cancel Search** button if needed.
5.  Expand items in the Tree View (`▶`/`▼`) to see content previews (if matched and readable). Content is loaded on demand.
6.  Use the **Filter Results** input to narrow down the displayed files based on path or error.
7.  Use the **Sort By** and **Direction** dropdowns to sort the results list.
8.  Use the **Export Format** dropdown (TXT, CSV, JSON, MD) and the **Copy Results** button to copy the formatted list of all processed files (including content for matched files) to the clipboard (⚠️ may be truncated for very large result sets). Use the **Save Results As...** button to save the formatted list (including content for matched files) to a file. Use the copy icon (📄) in an expanded item's header to copy only that specific file's content (once loaded).
9.  Access **Settings** (⚙️) or **Search History** (🕒) using the buttons in the header.

## Development

### Prerequisites

- [Node.js](https://nodejs.org/) (v16 or later)
- [npm](https://www.npmjs.com/) (v7 or later)
- Git

### Project Structure

```
├── electron/          # Electron main process code
├── public/            # Static assets and localization files
├── src/               # React application source code
│   ├── components/    # UI components
│   ├── contexts/      # React contexts
│   ├── hooks/         # Custom React hooks
│   ├── lib/           # Utility functions and libraries
│   ├── services/      # Service modules
│   └── workers/       # Web workers
├── tests/             # Test files
└── docs/              # Documentation
```

### Development Workflow

To run the application locally for development:

1.  **Clone the repository:**

    ```bash
    git clone https://github.com/12Mosch/File-Content-Aggregator.git
    cd File-Content-Aggregator
    ```

2.  **Install dependencies:**

    ```bash
    npm install
    ```

3.  **Run the development server:**

    ```bash
    npm run dev
    ```

    This will start the Vite development server for the React UI and launch the Electron application connected to it, usually with developer tools open.

4.  **Linting and Testing:**

    ```bash
    # Run ESLint
    npm run lint

    # Run tests
    npm run test
    ```

## Building

To build the application for distribution:

- Build for all platforms: `npm run dist`
- Build for Windows (x64): `npm run dist:win`
- Build for macOS (arm64): `npm run dist:mac`
- Build for Linux (x64): `npm run dist:linux`

The distributable files will be located in the `release/` directory.

## Technology Stack

- **Framework:** Electron
- **UI Library:** React 19
- **Bundler/Dev Server:** Vite
- **Language:** TypeScript
- **Styling:** Tailwind CSS
- **UI Components:** shadcn/ui
- **Internationalization:** i18next, react-i18next
- **Virtualization:** react-window, react-virtualized-auto-sizer
- **File Searching:** fast-glob, picomatch
- **Content Query Parsing:** jsep
- **Fuzzy Search:** fuse.js
- **Syntax Highlighting:** highlight.js
- **Date Handling:** date-fns
- **Concurrency Limiting:** p-limit
- **Persistent Storage:** electron-store

## Documentation

- **User Guide:** Detailed instructions and feature explanations can be found in [`/docs/user-guide.md`](./docs/user-guide.md).
- **Developer Guide:** Information on project structure, architecture, code organization, and development processes is in [`/docs/developer-guide.md`](./docs/developer-guide.md).
- **Testing Guide:** Information on testing approach and test cases is in [`/docs/tests/testing.md`](./docs/tests/testing.md).
- **UI Performance:** Information on UI performance optimizations is in [`/docs/development/ui-performance.md`](./docs/development/ui-performance.md).
- **Success Metrics:** Tracking of success metrics is in [`/docs/development/success-metrics.md`](./docs/development/success-metrics.md).
- **Code Documentation:** Key functions and modules include TSDoc comments.

## Contributing

Contributions are welcome! Please read the [**CONTRIBUTING.md**](./CONTRIBUTING.md) file for guidelines on how to contribute to this project.
