# File Content Aggregator - Developer Guide

This guide provides technical information for developers working on or contributing to the File Content Aggregator project.

## Table of Contents

- [Introduction](#introduction)
- [Getting Started](#getting-started)
  - [Prerequisites](#prerequisites)
  - [Installation](#installation)
  - [Running in Development](#running-in-development)
- [Project Structure](#project-structure)
- [Architecture](#architecture)
  - [Electron Main vs. Renderer](#electron-main-vs-renderer)
  - [Preload Script & Context Isolation](#preload-script--context-isolation)
  - [Inter-Process Communication (IPC)](#inter-process-communication-ipc)
  - [Vite Integration](#vite-integration)
- [Key Technologies](#key-technologies)
- [Core Logic Areas](#core-logic-areas)
  - [File Search (`fileSearchService.ts`)](#file-search-filesearchservicets)
  - [Internationalization (i18n)](#internationalization-i18n)
  - [UI State Management](#ui-state-management)
  - [Theming](#theming)
  - [Search History](#search-history)
  - [Exporting Results](#exporting-results)
  - [On-Demand Content Loading](#on-demand-content-loading)
  - [Copying Results](#copying-results)
- [Building for Distribution](#building-for-distribution)
- [Security Considerations](#security-considerations)
- [Code Style & Linting](#code-style--linting)
- [Contributing](#contributing)

## Introduction

File Content Aggregator is a desktop application built using Electron, React (with Vite), and TypeScript. It allows users to search for files across specified directories based on various criteria, including filename patterns, metadata (date, size), and complex content queries using boolean logic and proximity search.

## Getting Started

### Prerequisites

- Node.js (LTS version recommended)
- npm (usually included with Node.js)
- Git

### Installation

1.  Clone the repository:
    ```bash
    git clone <https://github.com/12Mosch/File-Content-Aggregator/>
    cd file-content-aggregator
    ```
2.  Install dependencies:
    ```bash
    npm install
    ```

### Running in Development

To run the application locally with hot-reloading for the UI:

```bash
npm run dev
```

This command concurrently:

1.  Starts the Vite development server (typically on `http://localhost:5123`) to serve the React UI.
2.  Transpiles the Electron main and preload scripts.
3.  Starts the Electron application, loading the UI from the Vite dev server. The main process terminal output will appear in your console, and the renderer process console (and React DevTools) can be accessed via Electron's developer tools (usually opened automatically in dev mode).

## Project Structure

```
file-content-aggregator/
├── docs/                     # Documentation files (like this one)
│   ├── assets/               # Images for documentation
│   ├── user-guide.md
│   └── developer-guide.md
├── public/                   # Static assets served by Vite / copied to build
│   ├── locales/              # i18n translation JSON files
│   └── vite.svg              # Example static asset
├── release/                  # Output directory for packaged application (from electron-builder)
├── src/
│   ├── components/           # React UI components (especially shadcn/ui)
│   │   └── ui/               # shadcn/ui components live here
│   ├── electron/             # Electron Main process & related code
│   │   ├── main.ts           # Main process entry point
│   │   ├── fileSearchService.ts # Core file searching logic
│   │   ├── preload.cts       # Preload script (CommonJS for Electron compatibility)
│   │   ├── pathResolver.ts   # Helper for resolving paths (e.g., preload)
│   │   ├── util.ts           # Utility functions for main process (e.g., isDev)
│   │   └── tsconfig.json     # TypeScript config specific to main process
│   ├── hooks/                # Custom React hooks (e.g., useDebounce)
│   ├── lib/                  # Shared utility functions (e.g., cn for Tailwind)
│   │   └── utils.ts
│   ├── ui/                   # Electron Renderer process code (React UI)
│   │   ├── App.tsx           # Root React component
│   │   ├── main.tsx          # Renderer process entry point (React root render)
│   │   ├── SearchForm.tsx    # Component for search inputs
│   │   ├── ResultsDisplay.tsx # Component for displaying results
│   │   ├── QueryBuilder.tsx  # Structured query builder UI
│   │   ├── QueryGroup.tsx    # Query builder sub-component
│   │   ├── QueryCondition.tsx # Query builder sub-component
│   │   ├── SettingsModal.tsx # Settings UI
│   │   ├── HistoryModal.tsx  # History UI
│   │   ├── ThemeManager.tsx  # Theme application logic and listener component
│   │   ├── highlight.worker.ts # Web worker for syntax highlighting
│   │   ├── i18n.ts           # i18next configuration for UI
│   │   ├── index.css         # Main CSS entry point (Tailwind directives)
│   │   ├── queryBuilderUtils.ts # Utilities for query builder (ID gen, type guard)
│   │   └── vite-env.d.ts     # TypeScript definitions for Vite env & Electron API
│   └── queryBuilderTypes.ts  # Shared types for the query builder structure
├── index.html                # HTML entry point for Vite/React UI
├── package.json              # Project dependencies and scripts
├── vite.config.ts            # Vite configuration
├── tsconfig.json             # Root TypeScript configuration
├── tsconfig.app.json         # TypeScript config for React app (checked by Vite)
├── tsconfig.node.json        # TypeScript config for Vite config file itself
├── tailwind.config.js        # Tailwind CSS configuration
├── components.json           # shadcn/ui configuration
├── electron-builder.json     # electron-builder configuration for packaging
├── README.md                 # Project overview
├── LICENSE                   # Project license
└── CONTRIBUTING.md           # Contribution guidelines
```

## Architecture

### Electron Main vs. Renderer

- **Main Process (`src/electron/main.ts`):** Runs in a Node.js environment. Has access to all Node.js APIs and Electron APIs for managing windows, menus, dialogs, system events, etc. It orchestrates the application lifecycle and performs backend tasks like file searching, exporting results, reading individual file contents on demand, and generating formatted content for copying.
- **Renderer Process (`src/ui/main.tsx` & components):** Runs the web page (`index.html`) inside a Chromium window. This is where the React UI lives. It _does not_ have direct access to Node.js or most Electron APIs for security reasons.

### Preload Script & Context Isolation

- **Preload Script (`src/electron/preload.cts`):** A special script that runs in the renderer's context _before_ the web page loads, but _with access_ to Node.js globals like `require` and Electron's `ipcRenderer`.
- **Context Isolation:** This is **enabled** (default and recommended). It ensures the preload script and the renderer's main world JavaScript do not share the same `window` object, preventing prototype pollution and enhancing security.
- **`contextBridge`:** Used in the preload script to securely expose specific functions from the Node.js/Electron world to the renderer process via `window.electronAPI`. This is the _only_ way the renderer should interact with the main process's capabilities.
- **Sandbox:** Enabled for the renderer process, further restricting its capabilities.

### Inter-Process Communication (IPC)

Communication between the Main and Renderer processes happens via IPC messages:

- **Renderer -> Main (Invoke/Response):** Used for actions where the renderer needs data or confirmation from the main process.
  - Renderer calls `window.electronAPI.invokeSomething(args)`.
  - Preload script uses `ipcRenderer.invoke('channel', args)`.
  - Main process listens with `ipcMain.handle('channel', async (event, args) => { ... return result; })`.
  - _Examples:_ `search-files`, `export-results`, `get-initial-language`, `get-theme-preference`, history handlers, `copy-to-clipboard`, `get-file-content`, `generate-export-content`, settings handlers.
- **Main -> Renderer (Send):** Used for updates or events initiated by the main process.
  - Main process uses `mainWindow.webContents.send('channel', data)`.
  - Preload script sets up a listener using `ipcRenderer.on('channel', listener)` and exposes a handler function via `contextBridge` (e.g., `onSearchProgress`, `onThemePreferenceChanged`).
  - Renderer calls `window.electronAPI.onSomething(callback)` to register its handler.
  - _Examples:_ `search-progress`, `theme-preference-changed`.
- **Renderer -> Main (Send):** Used for fire-and-forget notifications from the renderer.
  - Renderer calls `window.electronAPI.notifySomething(args)`.
  - Preload script uses `ipcRenderer.send('channel', args)`.
  - Main process listens with `ipcMain.on('channel', (event, args) => { ... })`.
  - _Examples:_ `language-changed`, `cancel-search`.
- **Security:** `main.ts` uses `validateSender` to ensure IPC messages originate from the expected main window frame.

### Vite Integration

- **Development:** Vite serves the React UI on a local development server. Electron loads the UI from this server (`mainWindow.loadURL("http://localhost:5123")`). Vite provides Hot Module Replacement (HMR) for fast UI updates.
- **Production:** `vite build` bundles the React UI into static files in `dist-react/`. Electron loads the UI directly from the filesystem using a custom protocol (`app://`) registered in `main.ts` (`mainWindow.loadURL("app://index.html")`). The custom protocol handler serves files from `dist-react/`.

## Key Technologies

- **Electron:** Framework for building cross-platform desktop apps with web technologies.
- **React 19:** UI library for building the user interface.
- **Vite:** Fast build tool and development server for the React UI.
- **TypeScript:** Provides static typing for improved code quality and maintainability.
- **Tailwind CSS:** Utility-first CSS framework for styling.
- **shadcn/ui:** Re-usable UI components built on Radix UI and Tailwind CSS.
- **i18next / react-i18next:** Framework for internationalization (handling multiple languages). Locales stored in `public/locales`.
- **react-window / react-virtualized-auto-sizer:** Libraries for efficiently rendering long lists (search results) by only rendering visible items (virtualization).
- **fast-glob:** Efficient library for finding files matching glob patterns. Used for initial file discovery.
- **picomatch:** Performant glob pattern matcher. Used for file/folder exclusion filtering.
- **jsep:** JavaScript Expression Parser. Used to parse the boolean content query string into an Abstract Syntax Tree (AST).
- **p-limit:** Limits asynchronous operation concurrency (used to limit simultaneous file reads/stats).
- **highlight.js:** Library for syntax highlighting. Executed in a Web Worker (`highlight.worker.ts`) to avoid blocking the main UI thread.
- **date-fns:** Modern utility library for date parsing, formatting, and manipulation.
- **electron-store:** Simple data persistence library for Electron apps. Used for storing settings and search history.

## Core Logic Areas

- **File Search (`fileSearchService.ts`):** Contains the main search orchestration logic.
  - Uses `fast-glob` with `suppressErrors: true` for initial discovery. This allows the scan to continue even if permission errors occur in subdirectories, ensuring all *accessible* files matching the pattern are found.
  - **Error Handling:** Initial `fs.stat` checks on the top-level search paths are performed *before* globbing to catch immediate access issues (e.g., path not found, not a directory). Traversal errors (like `EPERM`) encountered by `fast-glob` are suppressed by the library itself but logged internally by the application if needed. Errors during later `fs.stat` (for metadata filtering) or `fs.readFile` (for content matching) are caught and reported per-file.
  - **Error Relevance Filtering:** Before returning the final `SearchResult`, any captured path errors (primarily from the initial `fs.stat` checks) are filtered by `filterRelevantPathErrors`. This function checks if a directory that caused a permission error would have been excluded by the `excludeFolders` rules anyway. Only errors for non-excluded paths are included in the final `pathErrors` array shown to the user.
  - Applies filters (extension, excludes, date, size) sequentially.
  - Uses `p-limit` to manage concurrency for file stats and reads.
  - Parses boolean queries using `jsep` and evaluates the AST against file content using `evaluateBooleanAst`. Includes robust error handling during evaluation, ensuring the internal word boundary cache is cleared even on failure to prevent potential memory leaks.
  - Handles proximity search (`NEAR`) logic within the AST evaluation.
  - Accepts and checks a `checkCancellation` function periodically.
  - Sends progress updates via the `progressCallback`.
  - **Memory Optimization:** The function no longer reads or returns the full content of matched files in the main result set. It only returns metadata (`filePath`, `matched`, `readError`).
- **Internationalization (i18n):**
  - UI: Configured in `src/ui/i18n.ts`, uses `HttpApi` backend to load locales from `/public/locales`. `useTranslation` hook used in components. Language preference synced with `main.ts` via IPC.
  - Main: Separate `i18next` instance configured in `main.ts`, uses `i18next-fs-backend` to load locales for dialogs.
- **UI State Management:** Primarily uses standard React hooks (`useState`, `useCallback`, `useEffect`, `useMemo`). Global state like search results, progress, errors, history, and settings are managed in the root `App.tsx` component and passed down as props. Content for individual files in the tree view is fetched on demand and managed within `ResultsDisplay.tsx`.
- **Theming:**
  - Initialization: The initial theme preference is fetched via IPC (`getThemePreference`) in `src/ui/main.tsx` _before_ the initial React render. The `applyTheme` function (from `ThemeManager.tsx`) is called immediately to set the correct `light`/`dark` class on the `<html>` element, preventing a theme flash.
  - Updates: The `ThemeHandler` component (`src/ui/ThemeManager.tsx`) listens for subsequent theme preference changes (via IPC `theme-preference-changed`) and OS theme changes (if preference is "System"). It calls `applyTheme` to update the `<html>` class when these changes occur.
  - Storage: Preference is read/written via IPC to `electron-store` (handled in `main.ts`).
  - Styling: Uses Tailwind CSS dark mode variant (`dark:`) and CSS variables defined in `index.css`.
- **Search History:**
  - IPC handlers in `main.ts` manage CRUD operations using `electron-store`.
  - **De-duplication:** The `add-search-history-entry` handler now checks if an entry with identical `searchParams` (excluding `structuredQuery` and array order) already exists. If found, it updates the existing entry's timestamp and moves it to the top instead of adding a duplicate.
  - UI handled by `HistoryModal.tsx` and `HistoryListItem.tsx`.
  - Loading: When loading a history entry in `SearchForm.tsx`, the `structuredQuery` property (stored as `unknown`) is validated using the `isQueryStructure` type guard (`src/ui/queryBuilderUtils.ts`) before being set in the component's state, ensuring type safety.
- **Exporting Results:**
  - The `export-results` IPC handler in `main.ts` takes the structured results data (which *does not* include file content) and the desired format (TXT, CSV, JSON, Markdown).
  - It uses helper functions (`generateTxt`, `generateCsv`, `generateJson`, `generateMarkdown`) to format the data based on file path, match status, and read errors.
  - It prompts the user for a save location using `dialog.showSaveDialog`.
  - It writes the generated content to the selected file using `fs.writeFile`.
  - Error Handling: If an error occurs during content generation (e.g., JSON serialization failure), the specific error message is now included in the `dialog.showErrorBox` presented to the user, aiding debugging. File write errors are also handled.
- **On-Demand Content Loading:**
  - A new IPC channel `get-file-content` is handled in `main.ts`.
  - The renderer (`ResultsDisplay.tsx`) calls `window.electronAPI.invokeGetFileContent(filePath)` when a user expands an item in the tree view.
  - The main process reads only the requested file's content and returns it (or an error).
  - `ResultsDisplay.tsx` uses a `contentCache` Ref to store fetched content and manage loading/error states for individual tree items.
- **Copying Results:**
  - The "Copy Results" button in `ResultsDisplay.tsx` triggers the `handleCopyResults` function.
  - This function calls the `generate-export-content` IPC handler in `main.ts`, passing the current `filteredStructuredItems` and the selected `exportFormat`.
  - The main process generates the content string in the requested format (without saving to disk) and returns it to the renderer.
  - The renderer then uses the `copy-to-clipboard` IPC handler to place the generated string onto the system clipboard.
  - A warning is shown if the number of items being copied is large, as the resulting string might exceed clipboard limits.

## Building for Distribution

1.  **Build UI & Transpile Electron Code:**
    ```bash
    npm run build
    ```
    This runs `vite build` (output to `dist-react/`) and `tsc` for the main/preload processes (output to `dist-electron/`).
2.  **Package Application:** Use the `dist:*` scripts or the main `dist` script:
    ```bash
    npm run dist        # Build for current OS and default arch
    npm run dist:win    # Build for Windows x64
    npm run dist:mac    # Build for macOS arm64
    npm run dist:linux  # Build for Linux x64
    ```
    `electron-builder` reads configuration from `electron-builder.json` and creates installers/packages in the `release/` directory.

## Security Considerations

Security is paramount in Electron applications. Key measures taken:

- **Context Isolation:** **Enabled** (`contextIsolation: true`). Prevents direct access between the renderer's web content and Electron/Node.js APIs.
- **Sandbox:** **Enabled** (`sandbox: true`). Further restricts the renderer process's capabilities.
- **Preload Script (`contextBridge`):** Only specific, necessary functions are exposed from the preload script to the renderer via `window.electronAPI`.
- **Content Security Policy (CSP):** A strict CSP is applied via `session.defaultSession.webRequest.onHeadersReceived` in `main.ts` to limit resource loading and script execution sources.
- **IPC Sender Validation:** All `ipcMain.handle` and `ipcMain.on` listeners in `main.ts` use `validateSender` to ensure messages come from the expected renderer window frame.
- **No Node Integration in Renderer:** `nodeIntegration: false` is set for the renderer's webPreferences.
- **External Links:** Use `shell.openExternal` (if needed, currently not implemented) instead of opening links directly in the app window.
- **Input Validation:** While basic validation exists (e.g., date parsing), further sanitization could be added if handling more complex user inputs that might be used in shell commands or file paths (though currently, file operations are handled safely by Node APIs).

Refer to the official [Electron Security Documentation](https://www.electronjs.org/docs/latest/tutorial/security) for more details.

## Code Style & Linting

- **TypeScript:** Used throughout the project for type safety.
- **ESLint:** Configured (`eslint.config.js` or similar) for code quality and consistency. Run `npm run lint` to check and potentially fix issues.
- **Prettier:** Used for automatic code formatting (likely integrated with ESLint or run separately).
- **TSDoc:** Used for documenting functions, classes, and interfaces (`/** ... */`). Aim for clear explanations, especially for exported members and complex logic.

## Contributing

Contributions are welcome! Please see [CONTRIBUTING.md](./CONTRIBUTING.md) for detailed guidelines on reporting issues, suggesting features, and submitting pull requests.
