import type { Config } from "tailwindcss";
import defaultTheme from "tailwindcss/defaultTheme";
import colors from "tailwindcss/colors";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ["var(--font-sarabun)", ...defaultTheme.fontFamily.sans],
        prompt: ["var(--font-prompt)", ...defaultTheme.fontFamily.sans],
      },
      colors: {
        background: "var(--background)",
        foreground: "var(--foreground)",
        brand: {
          50: colors.emerald[50],
          100: colors.emerald[100],
          500: colors.emerald[500],
          600: colors.emerald[600],
          700: colors.emerald[700],
        },
        accent: {
          500: colors.indigo[500],
          600: colors.indigo[600],
        },
        // SEMANTIC TOKENS
        success: colors.emerald,
        error: colors.rose,
        warning: colors.amber,
        info: colors.sky,
        neutral: colors.slate,
      },
    },
  },
  plugins: [],
};
export default config;
