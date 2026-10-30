// Fail when a change adds a phrase that GLOSSARY.md says to avoid (the เลี่ยง
// column of its tables). Only phrases of more than one word are checked: a
// single word such as "sheet" or "KPI" depends on context, so code review
// judges those (CODING_STANDARDS.md).
//
// Checks the lines added since the merge base with <base> (the working tree
// and untracked files included) and the commit messages since then.
// Usage: node src/scripts/check-glossary.mjs [base]   (default origin/main)
import { execFileSync } from "node:child_process";
import fs from "node:fs";

const base = process.argv[2] || "origin/main";
const git = (...args) =>
  execFileSync("git", ["-c", "core.quotePath=false", ...args], { encoding: "utf8", maxBuffer: 256 * 1024 * 1024 });

const phrases = [];
let inAvoidTable = false;
for (const line of fs.readFileSync("GLOSSARY.md", "utf8").split("\n")) {
  if (!line.startsWith("|")) {
    inAvoidTable = false;
    continue;
  }
  const avoid = (line.split("|")[3] || "").trim();
  if (avoid === "เลี่ยง") {
    inAvoidTable = true;
  } else if (inAvoidTable) {
    for (const m of avoid.matchAll(/"([^"]+)"/g)) {
      if (/[ -]/.test(m[1].trim())) phrases.push(m[1].trim());
    }
  }
}
if (phrases.length === 0) {
  console.error("check-glossary: no phrase found in the เลี่ยง column of GLOSSARY.md; has its table format changed?");
  process.exit(1);
}

let mergeBase;
try {
  mergeBase = git("merge-base", base, "HEAD").trim();
} catch {
  console.error(`check-glossary: no merge base with ${base}. Run git fetch origin main, or check out with fetch-depth: 0 in CI.`);
  process.exit(1);
}

// [where, text] of every added line.
const added = [];
let file = null;
let lineNo = 0;
let inHunk = false;
for (const line of git("diff", "--unified=0", "--no-color", mergeBase, "--", ".", ":!GLOSSARY.md").split("\n")) {
  if (line.startsWith("diff --git ")) {
    inHunk = false;
  } else if (line.startsWith("@@")) {
    inHunk = true;
    lineNo = Number(line.match(/\+(\d+)/)[1]);
  } else if (!inHunk) {
    if (line.startsWith("+++ ")) file = line.slice(4).replace(/^b\//, "");
  } else if (line.startsWith("+")) {
    added.push([`${file}:${lineNo}`, line.slice(1)]);
    lineNo++;
  }
}
for (const untracked of git("ls-files", "--others", "--exclude-standard").split("\n")) {
  if (!untracked || untracked === "GLOSSARY.md") continue;
  const text = fs.readFileSync(untracked, "utf8");
  if (text.includes("\0")) continue;
  text.split("\n").forEach((line, i) => added.push([`${untracked}:${i + 1}`, line]));
}
for (const line of git("log", "--format=%B", `${mergeBase}..HEAD`).split("\n")) {
  added.push(["commit message", line]);
}

const hits = [];
for (const [where, text] of added) {
  const lower = text.toLowerCase();
  for (const phrase of phrases) {
    if (lower.includes(phrase.toLowerCase())) hits.push(`${where}: "${phrase}" in ${text.trim().slice(0, 120)}`);
  }
}
if (hits.length > 0) {
  console.error("check-glossary: GLOSSARY.md says to avoid these phrases; use the term in its first column instead:");
  hits.forEach((hit) => console.error("  " + hit));
  process.exit(1);
}
console.log(`check-glossary: none of the ${phrases.length} avoided phrases in the change since ${base}`);
