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
// population.ts holds the /sync file reader too, which stays out of the
// pages' JavaScript (SPEC §9.6): page.tsx computes on the server and the
// components take the result as props.
const populationReader = {
  regex: "^@/lib/dc/population$",
  message:
    "A Data Center component does not import population.ts, which holds the /sync file reader (SPEC §9.6): take the computed values as props.",
};

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    files: ["src/app/(dc)/**", "src/components/dc/**", "src/lib/dc/**"],
    rules: {
      "no-restricted-imports": ["error", { patterns: [paFiles, fileReads] }],
      // Strings too: a BOM typed into one is invisible, so the repo writes it as an escape.
      "no-irregular-whitespace": ["error", { skipStrings: false }],
    },
  },
  // The old R6 colour names were removed from globals.css in F63, the contract
  // step of SPEC §9.1; a class on one of them would have no colour.
  // dc-canvas is a name of both, and dc-border-subtle a new one. dc-gold has
  // its own value, no V7.6 name for the เกณฑ์ line, and stays (FEATURES F63).
  {
    files: ["src/app/(dc)/**", "src/components/dc/**"],
    rules: {
      "no-restricted-syntax": [
        "error",
        ...["Literal[value", "TemplateElement[value.raw"].map((node) => ({
          selector: `${node}=/\\bdc-(blue|ink|muted|navy|teal)\\b|\\bdc-border(?!-)/]`,
          message: "Use the V7.6 colour names; the R6 names were removed in F63 (SPEC §9.1).",
        })),
      ],
    },
  },
  {
    files: ["src/lib/dc/snapshot.ts"],
    rules: { "no-restricted-imports": ["error", { patterns: [paFiles] }] },
  },
  {
    files: ["src/components/dc/**"],
    ignores: ["src/components/dc/RegistryPopulationUpload.tsx"],
    rules: { "no-restricted-imports": ["error", { patterns: [paFiles, fileReads, populationReader] }] },
  },
  {
    files: ["src/lib/dc/**"],
    ignores: ["src/lib/dc/types.ts"],
    rules: {
      "no-restricted-syntax": [
        "error",
        {
          selector: "ExportNamedDeclaration > :matches(TSTypeAliasDeclaration, TSInterfaceDeclaration)",
          message: "Data Center types live in src/lib/dc/types.ts, which mirrors SCHEMA §9 (CODING_STANDARDS §4).",
        },
      ],
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Gitignored wizards and page-check scripts (docs/agents/page-checks.md)
    ".wizard/**",
  ]),
]);

export default eslintConfig;
