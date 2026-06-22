/** @type {import('tailwindcss').Config} */
export default {
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#f0f9ff",
          300: "#7dd3fc",
          400: "#38bdf8",
          500: "#0ea5e9",
          600: "#0284c7",
          700: "#0369a1",
          900: "#0c4a6e",
        },
        app: {
          bg: "rgb(var(--app-bg) / <alpha-value>)",
          surface: "rgb(var(--app-surface) / <alpha-value>)",
          "surface-muted": "rgb(var(--app-surface-muted) / <alpha-value>)",
          input: "rgb(var(--app-input) / <alpha-value>)",
          muted: "rgb(var(--app-muted) / <alpha-value>)",
          "muted-hover": "rgb(var(--app-muted-hover) / <alpha-value>)",
          border: "rgb(var(--app-border) / <alpha-value>)",
          nav: "rgb(var(--app-nav) / <alpha-value>)",
          fg: "rgb(var(--app-fg) / <alpha-value>)",
          "fg-muted": "rgb(var(--app-fg-muted) / <alpha-value>)",
          "fg-subtle": "rgb(var(--app-fg-subtle) / <alpha-value>)",
        },
      },
    },
  },
  plugins: [],
};
