/** @type {import('jest').Config} */
const config = {
  preset: "ts-jest",
  testEnvironment: "jsdom",
  transform: {
    "^.+\\.tsx?$": [
      "ts-jest",
      {
        tsconfig: "tsconfig.json",
        useESM: false, // Disable ESM for now to avoid conflicts
      },
    ],
  },
  moduleFileExtensions: ["ts", "tsx", "js", "jsx", "json", "node"],
  // Define test locations
  testMatch: ["**/tests/**/*.test.[jt]s?(x)", "**/?(*.)+(spec|test).[jt]s?(x)"],
  // Group tests by type
  testPathIgnorePatterns: ["/node_modules/", "/dist/"],
  // Configure coverage reporting
  collectCoverageFrom: ["src/**/*.{js,jsx,ts,tsx}", "!src/**/*.d.ts"],
  // Configure test result reporters
  reporters: ["default"],
  // Configure test timeouts
  testTimeout: 10000,
  // Configure setup files
  setupFilesAfterEnv: ["./tests/setup.js"],
  // Handle module resolution
  moduleNameMapper: {
    "^(\\.{1,2}/.*)\\.js$": "$1",
    // Mock import.meta.url for tests
    "\\.\\.(css|less|scss|sass)$": "identity-obj-proxy",
  },
  transformIgnorePatterns: [
    "/node_modules/(?!(.+\\\\.mjs$)|p-limit|electron-store|fast-glob)",
  ],
  // Mock environment variables and globals
  globals: {
    // Mock import.meta for Jest compatibility
    "import.meta": {
      url: "file:///mock/url",
    },
  },
  // Set up environment variables for ESM compatibility
  setupFiles: ["<rootDir>/tests/jest.setup.js"],
};

export default config;
