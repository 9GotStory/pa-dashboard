import { Prompt, Sarabun } from "next/font/google";

// The Data Center's Prompt and Sarabun: the weights of PA's src/lib/fonts.ts,
// not preloaded. Preloading its 20 files held back the text that is each Data
// Center page's LCP (SPEC §9.6); without a preload the browser fetches only the
// faces the page draws. subsets only picks the files to preload, so it is left out.
export const prompt = Prompt({
  weight: ["300", "400", "500", "600", "700"],
  variable: "--font-prompt",
  display: "swap",
  preload: false,
});

export const sarabun = Sarabun({
  weight: ["300", "400", "500", "600", "700"],
  variable: "--font-sarabun",
  display: "swap",
  preload: false,
});
