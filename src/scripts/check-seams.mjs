// Fail when a test file under src/ is not named in the table of
// CODING_STANDARDS.md §5, the seams agreed for tests (#382). In F92 a test
// landed before §5 had its row, and review caught it only after the code was
// done; this tells the author before review.
//
// A test file <dir>/x.test.ts (or .js) is listed when a backtick span in a
// row of that table is either a path or file name whose part after the last
// "/" is x.ts, x.js, x.mjs, x.test.ts or x.test.js, or a path with {…} in the
// same folder as the test, such as src/lib/dc/tables/{หน้า}.ts. It does not
// check the other way: a row may have no test file of its own name.
// Usage: node src/scripts/check-seams.mjs
import fs from "node:fs";
import path from "node:path";

// The backtick spans in the rows of §5's table.
export function seamNames(markdown) {
  const names = [];
  let inSection5 = false;
  for (const line of markdown.split("\n")) {
    if (line.startsWith("## ")) inSection5 = line.startsWith("## 5.");
    if (!inSection5 || !line.startsWith("|")) continue;
    for (const m of line.matchAll(/`([^`]+)`/g)) names.push(m[1]);
  }
  return names;
}

// The test paths that no name in names covers, in the order given.
export function unlistedTests(testPaths, names) {
  const dirOf = (p) => p.slice(0, p.lastIndexOf("/"));
  return testPaths.filter((testPath) => {
    const x = testPath
      .split("/")
      .pop()
      .replace(/\.test\.[jt]s$/, "");
    const sourceNames = [".ts", ".js", ".mjs", ".test.ts", ".test.js"].map((ext) => x + ext);
    return !names.some(
      (name) =>
        sourceNames.includes(name.split("/").pop()) || (/\{[^}]+\}/.test(name) && dirOf(name) === dirOf(testPath)),
    );
  });
}

if (import.meta.main) {
  const names = seamNames(fs.readFileSync("CODING_STANDARDS.md", "utf8"));
  if (names.length === 0) {
    console.error(
      "check-seams: no name found in the table of CODING_STANDARDS.md §5; has its heading or format changed?",
    );
    process.exit(1);
  }
  const tests = fs
    .readdirSync("src", { recursive: true })
    .map((p) => "src/" + p.split(path.sep).join("/"))
    .filter((p) => /\.test\.[jt]s$/.test(p))
    .sort();
  const unlisted = unlistedTests(tests, names);
  if (unlisted.length > 0) {
    console.error("check-seams: these test files are not in the table of CODING_STANDARDS.md §5 (the agreed seams):");
    unlisted.forEach((p) => console.error("  " + p));
    console.error(
      "Add a row for the seam, or the test file's name to the row that covers it, in that table; or move the test to a seam already there.",
    );
    process.exit(1);
  }
  console.log(`check-seams: all ${tests.length} test files under src/ are in the table of CODING_STANDARDS.md §5`);
}
