import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

// Data Center code imports no PA file, and only snapshot.ts reads files
// (CODING_STANDARDS §4). A later object replaces the rule's options, so
// snapshot.ts restates the PA pattern alone.
const paFiles = {
  regex: "^@/(lib|components)/(?!dc(/|$))",
  message: "Data Center code does not import PA files (CODING_STANDARDS §4): copy what it needs into src/lib/dc/.",
};
const fileReads = {
  regex: "^(node:)?fs(/|$)",
  message: "Data Center code reads files through src/lib/dc/snapshot.ts only (CODING_STANDARDS §4).",
};

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    files: ["src/app/(dc)/**", "src/components/dc/**", "src/lib/dc/**"],
    rules: { "no-restricted-imports": ["error", { patterns: [paFiles, fileReads] }] },
  },
  {
    files: ["src/lib/dc/snapshot.ts"],
    rules: { "no-restricted-imports": ["error", { patterns: [paFiles] }] },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
