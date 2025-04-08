// eslint.config.js
import eslintJs from "@eslint/js";
import tseslint from "typescript-eslint";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import globals from "globals";
import eslintConfigPrettier from "eslint-config-prettier";

export default tseslint.config(
  // 1. Global Ignores
  {
    ignores: [
      "node_modules/",
      "dist-*/", // Ignores dist-electron/, dist-react/ etc.
      "release/",
      "build/",
      ".tmp/",
      "coverage/",
      "eslint.config.js", // Ignore this config file itself
    ],
  },

  // 2. Base ESLint Recommended Rules (Apply to all linted files)
  eslintJs.configs.recommended,

  // 3. Base TypeScript Config (Non-Type-Checked) - Applies to TS, TSX, CTS
  {
    files: ["**/*.{ts,tsx,cts}"],
    extends: [...tseslint.configs.recommended], // Apply base TS rules
    rules: {
      // Base TS rule overrides can go here if needed for all TS files
      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/no-unused-vars": [
        "warn",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
        },
      ],
    },
  },

  // 4. Type-Checked Config - Applies ONLY to TS, TSX (Requires Project)
  {
    files: ["src/**/*.{ts,tsx}"], // Only TS/TSX files in src
    extends: [...tseslint.configs.recommendedTypeChecked], // Add type-checked rules
    languageOptions: {
      parserOptions: {
        project: true, // Auto-detect tsconfig.json based on file location
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      // Type-checked rule overrides
      "@typescript-eslint/no-misused-promises": [
        "error",
        { checksVoidReturn: { attributes: false } }, // Allow async functions in attributes like onClick
      ],
      // Downgrade some unsafe rules to warn initially if they are too noisy
      "@typescript-eslint/no-unsafe-assignment": "warn",
      "@typescript-eslint/no-unsafe-call": "warn",
      "@typescript-eslint/no-unsafe-member-access": "warn",
      "@typescript-eslint/no-unsafe-argument": "warn",
      "@typescript-eslint/no-floating-promises": "warn", // Warn initially, fix later
      "@typescript-eslint/require-await": "warn", // Warn initially, fix later
      "@typescript-eslint/restrict-template-expressions": "warn", // Warn initially
      "@typescript-eslint/no-base-to-string": "warn", // Warn initially
      "@typescript-eslint/no-redundant-type-constituents": "warn", // Warn initially
    },
  },

  // 5. React Specific Config (UI + Components) - Inherits from #3 and #4
  {
    files: ["src/ui/**/*.{ts,tsx}", "src/components/**/*.{ts,tsx}"],
    languageOptions: {
      parserOptions: {
        ecmaFeatures: { jsx: true },
      },
      globals: {
        ...globals.browser,
      },
    },
    plugins: {
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      "react-refresh/only-export-components": [
        "warn",
        { allowConstantExport: true },
      ],
      // Override specific TS rules for React if needed
      "@typescript-eslint/explicit-function-return-type": "off", // Often verbose for components
    },
  },

  // 6. Electron Main Process Config - Inherits from #3 and #4
  {
    files: ["src/electron/**/*.ts"],
    languageOptions: {
      globals: {
        ...globals.node,
      },
    },
    rules: {
      // Main process specific overrides
    },
  },

  // 7. Electron Preload Script Config - Inherits ONLY from #3 (Non-Type-Checked)
  {
    files: ["src/electron/preload.cts"],
    languageOptions: {
      globals: {
        ...globals.node, // Or maybe browser/node mix depending on contextBridge usage
      },
    },
    rules: {
      // Disable rules conflicting with CommonJS 'require'
      "@typescript-eslint/no-require-imports": "off",
      "@typescript-eslint/no-var-requires": "off",
    },
  },

  // 8. JS Config Files Config - Inherits ONLY from #2 (Base JS)
  {
    files: ["*.config.js", "*.config.cjs"],
    languageOptions: {
      globals: {
        ...globals.node,
      },
    },
    rules: {
      // Disable TS rules for JS files
      "@typescript-eslint/explicit-function-return-type": "off",
      "@typescript-eslint/no-require-imports": "off",
      "@typescript-eslint/no-var-requires": "off",
      "@typescript-eslint/no-unsafe-call": "off",
      "@typescript-eslint/no-unsafe-assignment": "off",
      "@typescript-eslint/no-unsafe-member-access": "off",
      "@typescript-eslint/no-unsafe-argument": "off",
      "no-undef": "off", // Allow module/require
    },
  },
  eslintConfigPrettier,
);
