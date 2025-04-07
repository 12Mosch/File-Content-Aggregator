/** @type {import('tailwindcss').Config} */
module.exports = {
    darkMode: ["class"], // Or "media"
    content: [
      './pages/**/*.{ts,tsx}',
      './components/**/*.{ts,tsx}',
      './app/**/*.{ts,tsx}',
      './src/**/*.{ts,tsx}', // Make sure your src directory is included
    ],
    prefix: "", // Optional prefix
    theme: {
      container: {
        center: true,
        padding: "2rem",
        screens: {
          "2xl": "1400px",
        },
      },
      extend: {
        // shadcn adds color variables and potentially keyframes/animations here
        colors: {
          border: "hsl(var(--border))",
          input: "hsl(var(--input))",
          ring: "hsl(var(--ring))",
          background: "hsl(var(--background))",
          foreground: "hsl(var(--foreground))",
          primary: { /* ... */ },
          secondary: { /* ... */ },
          destructive: { /* ... */ },
          muted: { /* ... */ },
          accent: { /* ... */ },
          popover: { /* ... */ },
          card: { /* ... */ },
        },
        borderRadius: { /* ... */ },
        keyframes: { /* ... */ },
        animation: { /* ... */ },
      },
    },
    plugins: [require("tailwindcss-animate")], // Ensure this plugin is present
  }
  