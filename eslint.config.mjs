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
// components take the result as props, and the modules รายงานประชากร runs in
// the browser add up through population-totals.ts (SPEC §9.5).
const populationReader = {
  regex: "^(@/lib/dc|\\.)/population$",
  message:
    "Data Center code that runs in the browser does not import population.ts, which holds the /sync file reader (SPEC §9.5, §9.6): take the computed values as props, or add up with population-totals.ts.",
};
// values.ts loads population-report.ts on every page for POPULATION_REPORT
// (CODING_STANDARDS §4, F68).
const csvModule = {
  regex: "^(@/lib/dc|\\.)/csv$",
  message:
    "population-report.ts does not import csv.ts: values.ts loads it on every page (CODING_STANDARDS §4). The population CSV lives in population-csv.ts.",
};
// Of population-report.ts, values.ts takes POPULATION_REPORT alone: with a
// function of it, /reports and every report page carry รายงานประชากร's data
// layer, 1.8 KB more on /reports in F74 (SPEC §9.6). What both need is in a
// module of its own, as changeOf in change.ts.
const populationData = {
  regex: "^(@/lib/dc|\\.)/population-report$",
  allowImportNames: ["POPULATION_REPORT"],
  message:
    "values.ts takes POPULATION_REPORT alone from population-report.ts, or every page carries รายงานประชากร's data layer (CODING_STANDARDS §4): put what both need in a module of its own, as change.ts.",
};

// PA does not use Motion (ADR-0019), nor do the Masthead and Footer that /pa
// shares (F97).
const noMotion = {
  "@typescript-eslint/no-restricted-imports": [
    "error",
    {
      patterns: [
        {
          group: ["motion", "motion/*", "framer-motion", "framer-motion/*"],
          message: "PA, and the Masthead and Footer it shares, do not use Motion (ADR-0019, CODING_STANDARDS §1).",
        },
      ],
    },
  ],
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
    files: ["src/lib/dc/population-csv.ts", "src/lib/dc/population-totals.ts"],
    rules: { "no-restricted-imports": ["error", { patterns: [paFiles, fileReads, populationReader] }] },
  },
  {
    files: ["src/lib/dc/population-report.ts"],
    rules: { "no-restricted-imports": ["error", { patterns: [paFiles, fileReads, populationReader, csvModule] }] },
  },
  {
    files: ["src/lib/dc/values.ts"],
    rules: { "no-restricted-imports": ["error", { patterns: [paFiles, fileReads, populationData] }] },
  },
  // Motion (ADR-0018, CODING_STANDARDS §4): the Data Center renders m under
  // MotionRoot's strict LazyMotion, never the full motion component, which
  // carries every feature into the JavaScript the HTML loads. These use
  // typescript-eslint's rule, so the per-file options of the core
  // no-restricted-imports above stay as they are.
  {
    files: ["src/app/(dc)/**/*.{ts,tsx}", "src/components/dc/**/*.{ts,tsx}", "src/lib/dc/**/*.{ts,tsx}"],
    rules: {
      "@typescript-eslint/no-restricted-imports": [
        "error",
        {
          paths: [
            ...["motion/react", "framer-motion"].map((name) => ({
              name,
              importNames: ["motion"],
              message: "Data Center code renders m from motion/react-m, under MotionRoot's LazyMotion (ADR-0018).",
            })),
            {
              name: "motion/react-client",
              message: "Data Center code renders m from motion/react-m, under MotionRoot's LazyMotion (ADR-0018).",
            },
          ],
        },
      ],
    },
  },
  {
    files: ["src/**/*.{ts,tsx}"],
    ignores: ["src/app/(dc)/**", "src/components/dc/**", "src/lib/dc/**"],
    rules: noMotion,
  },
  {
    files: ["src/components/dc/{Masthead,MainNav,Footer}.tsx"],
    rules: noMotion,
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
    // main's build from dc-lcp.mjs (docs/agents/page-checks.md)
    ".dc-lcp/**",
  ]),
]);

export default eslintConfig;
