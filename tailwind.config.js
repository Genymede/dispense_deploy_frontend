/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ["'IBM Plex Sans Thai'", "sans-serif"],
        mono: ["'IBM Plex Mono'", "monospace"],
      },
      colors: {
        primary: {
          50: "#f0f7ff",
          100: "#e0effe",
          200: "#bae0fd",
          300: "#7cc6fb",
          400: "#36a9f7",
          500: "#0c8ee8",
          600: "#006fc6",
          700: "#0058a1",
          800: "#054b85",
          900: "#0a3f6e",
          950: "#072849",
        },
        medical: {
          bg: "#f8fafc",
          surface: "#ffffff",
          border: "#e2e8f0",
          muted: "#94a3b8",
        },
      },
      boxShadow: {
        card: "0 1px 3px 0 rgba(0,0,0,0.06), 0 1px 2px -1px rgba(0,0,0,0.04)",
        "card-hover": "0 4px 12px 0 rgba(0,0,0,0.08), 0 2px 4px -1px rgba(0,0,0,0.04)",
        modal: "0 20px 60px -10px rgba(0,0,0,0.15)",
      },
    },
  },
  plugins: [],
};
