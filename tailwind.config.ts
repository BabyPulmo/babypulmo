import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        bangla: ["Noto Sans Bengali", "sans-serif"]
      },
      colors: {
        pulmo: {
          50: "#fef7ed",
          500: "#f97316",
          900: "#7c2d12"
        }
      }
    }
  },
  plugins: []
};

export default config;
