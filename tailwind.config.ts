import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        bangla: ["Noto Sans Bengali", "sans-serif"],
        sans: ["Hanken Grotesk", "system-ui", "sans-serif"]
      },
      colors: {
        pulmo: {
          // canonical brand tokens (see design.md §1)
          blue: "#2F80ED",
          green: "#27A660",
          gold: "#F2C94C",
          medium: "#1672DF",
          deep: "#1F3937",
          surface: "#F5F7FA",
          // legacy aliases for backward-compatible classes
          50: "#F5F7FA",
          500: "#2F80ED",
          900: "#1F3937"
        }
      }
    }
  },
  plugins: []
};

export default config;
