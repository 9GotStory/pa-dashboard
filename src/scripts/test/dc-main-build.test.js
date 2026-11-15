import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test, { after } from "node:test";
import { sameBuild, snapshotHash } from "../dc-main-build.mjs";

// dc-main-build.mjs: the parts that decide on reusing main's build, which
// dc-lcp.mjs (#294) and dc-compare.mjs (#309) share, against files in temp
// dirs.

// #294: main's build in .dc-lcp/main/ is reused only for the same snapshot.
// Each test writes its files, such as a small snapshot of public/data/'s
// shape, in a temp dir.
const dirs = [];
after(() => dirs.forEach((dir) => fs.rmSync(dir, { recursive: true })));

function tempDir(files) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "dc-main-build-test-"));
  dirs.push(dir);
  for (const [file, text] of files) {
    fs.mkdirSync(path.dirname(path.join(dir, file)), { recursive: true });
    fs.writeFileSync(path.join(dir, file), text);
  }
  return dir;
}

const FILES = [
  ["meta.json", '{"built_at":"2026-11-14T08:00:00Z"}'],
  ["catalog.json", "[]"],
  ["reports/a1.json", '{"rows":[1]}'],
];

test("snapshotHash changes when a file's content changes", () => {
  const edited = FILES.map(([file, text]) => [file, file === "reports/a1.json" ? '{"rows":[2]}' : text]);
  assert.notEqual(snapshotHash(tempDir(FILES)), snapshotHash(tempDir(edited)));
});

test("snapshotHash changes when a file is added", () => {
  assert.notEqual(snapshotHash(tempDir(FILES)), snapshotHash(tempDir([...FILES, ["reports/b2.json", "{}"]])));
});

test("snapshotHash changes when a file is renamed", () => {
  const renamed = FILES.map(([file, text]) => [file === "reports/a1.json" ? "reports/a2.json" : file, text]);
  assert.notEqual(snapshotHash(tempDir(FILES)), snapshotHash(tempDir(renamed)));
});

test("snapshotHash is the same for the same files written in another order", () => {
  assert.equal(snapshotHash(tempDir(FILES)), snapshotHash(tempDir(FILES.toReversed())));
});

// The key of main's build in .dc-lcp/main/built-from.json: main's SHA, the
// snapshot's hash and the hash of node_modules/.package-lock.json.
const KEY = {
  main: "c5df97d0e3a1b2c4d5e6f708192a3b4c5d6e7f80",
  snapshot: "4f1c0a9e5b7d3c2a1e0f9d8c7b6a5e4d3c2b1a0f9e8d7c6b5a4f3e2d1c0b9a8e",
  packages: "9e8d7c6b5a4f3e2d1c0b9a8e4f1c0a9e5b7d3c2a1e0f9d8c7b6a5e4d3c2b1a0f",
};

test("sameBuild is true when built-from.json holds the same three values", () => {
  const dir = tempDir([["built-from.json", JSON.stringify(KEY)]]);
  assert.equal(sameBuild(path.join(dir, "built-from.json"), { ...KEY }), true);
});

for (const field of Object.keys(KEY)) {
  test(`sameBuild is false when ${field} differs`, () => {
    const dir = tempDir([["built-from.json", JSON.stringify(KEY)]]);
    assert.equal(
      sameBuild(path.join(dir, "built-from.json"), { ...KEY, [field]: "0".repeat(KEY[field].length) }),
      false,
    );
  });
}

test("sameBuild is false when there is no built-from.json", () => {
  const dir = tempDir([]);
  assert.equal(sameBuild(path.join(dir, "built-from.json"), KEY), false);
});

test("sameBuild is false when built-from.json is cut short", () => {
  const dir = tempDir([["built-from.json", JSON.stringify(KEY).slice(0, 40)]]);
  assert.equal(sameBuild(path.join(dir, "built-from.json"), KEY), false);
});
