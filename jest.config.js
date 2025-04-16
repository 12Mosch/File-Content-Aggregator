/** @type {import('jest').Config} */
const config = {
  preset: "ts-jest",
  testEnvironment: "jsdom",
  transform: {
    "^.+\\.tsx?$": [
      "ts-jest",
      {
        tsconfig: "tsconfig.json",
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
  setupFilesAfterEnv: [],
};

export default config;
