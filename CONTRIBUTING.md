# Contributing to File Content Aggregator

First off, thank you for considering contributing to File Content Aggregator! We welcome contributions from everyone. Whether it's reporting a bug, proposing a feature, improving documentation, or writing code, your help is appreciated.

Please take a moment to review this document to make the contribution process easy and effective for everyone involved.

## How Can I Contribute?

There are many ways to contribute:

*   **Reporting Bugs:** If you find a bug, please report it!
*   **Suggesting Enhancements:** Have an idea for a new feature or an improvement to an existing one? Let us know!
*   **Improving Documentation:** Help us make the documentation clearer and more comprehensive.
*   **Writing Code:** Fix bugs or implement new features.

### Reporting Bugs

Before submitting a bug report, please check the existing [GitHub Issues](https://github.com/12Mosch/File-Content-Aggregator/issues) to see if the bug has already been reported.

If you can't find an existing issue, please open a new one and include the following information:

1.  **Clear and descriptive title:** Summarize the bug concisely.
2.  **Steps to reproduce:** Provide detailed steps so we can reproduce the issue reliably.
3.  **Expected behavior:** What did you expect to happen?
4.  **Actual behavior:** What actually happened? Include error messages or stack traces if applicable.
5.  **Screenshots/GIFs:** Visual aids are often very helpful.
6.  **Environment:**
    *   Operating System (e.g., Windows 11, macOS Sonoma, Ubuntu 22.04)
    *   File Content Aggregator Version (Check the `package.json` or an "About" section if you add one later)

### Suggesting Enhancements

Before submitting an enhancement suggestion, please check the [GitHub Issues](https://github.com/12Mosch/File-Content-Aggregator/issues) to see if a similar idea has already been discussed.

If you can't find an existing issue, please open a new one and include:

1.  **Clear and descriptive title:** Summarize the enhancement.
2.  **Detailed description:** Explain the feature or improvement you'd like to see.
3.  **Motivation/Use Case:** Why is this enhancement needed? What problem does it solve?
4.  **Possible Implementation (Optional):** If you have ideas on how it could be implemented, feel free to share them.

### Pull Requests (Code Contributions)

We welcome code contributions! Here's the general workflow:

1.  **Fork the repository:** Create your own copy of the repository on GitHub.
2.  **Clone your fork:**
    ```bash
    git clone <your-fork-url>
    cd file-content-aggregator
    ```
3.  **Install dependencies:**
    ```bash
    npm install
    ```
4.  **Create a new branch:** Choose a descriptive branch name (e.g., `fix/results-filter-bug`, `feat/add-export-option`).
    ```bash
    git checkout -b <your-branch-name>
    ```
5.  **Make your changes:** Write your code, add tests if applicable, and update documentation as needed.
    *   Ensure your code adheres to the project's coding style (see below).
    *   Run the linter: `npm run lint`.
6.  **Commit your changes:** Use clear and descriptive commit messages. Consider following the [Conventional Commits](https://www.conventionalcommits.org/) specification.
    ```bash
    git add .
    git commit -m "feat: Add CSV export option for results"
    ```
7.  **Push your branch:**
    ```bash
    git push origin <your-branch-name>
    ```
8.  **Open a Pull Request (PR):** Go to the original repository on GitHub and open a PR from your forked branch to the `main` branch (or the relevant development branch).
    *   Provide a clear title and description for your PR.
    *   Reference any related GitHub issues (e.g., "Closes #123").
9.  **Review:** Your PR will be reviewed by maintainers. Address any feedback or requested changes.
10. **Merge:** Once approved, your PR will be merged. Thank you!

## Development Setup

Please refer to the [Developer Guide](./docs/developer-guide.md) for detailed instructions on setting up the development environment and running the application locally (`npm install`, `npm run dev`).

## Coding Style & Conventions

*   **Language:** TypeScript
*   **Formatting:** Prettier (configuration likely in `package.json` or `.prettierrc`). Please ensure your code is formatted before committing.
*   **Linting:** ESLint (configuration likely in `eslint.config.js` or similar). Please run `npm run lint` and fix any reported issues before submitting a PR.
*   **Comments:** Use TSDoc (`/** ... */`) for documenting exported functions, classes, interfaces, and complex logic blocks.

## Testing

*(Optional Section - Add details if/when you implement tests)*

We aim to add automated tests to ensure code quality and prevent regressions. If you are contributing code, please consider adding relevant unit or integration tests.

*   Run tests using: `npm test` (You'll need to define this script in `package.json` when tests are added).

## License

By contributing to File Content Aggregator, you agree that your contributions will be licensed under the [MIT License](./LICENSE) that covers the project.
