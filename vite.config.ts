import path from "path"; // Required for path resolution
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite"; // Import the Tailwind Vite plugin

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(), // Add the Tailwind plugin
  ],
  base: "./", // Correct base for Electron builds
  build: {
    outDir: "dist-react", // Your React build output directory
  },
  server: {
    port: 5123, // Your dev server port
    strictPort: true,
  },
  // Configure the path alias for Vite to match tsconfig
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"), // Maps @/* to the src directory
    },
  },
});
