import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test, { after } from "node:test";
import { medianRun, readLcp, sameBuild, snapshotHash, tooSlow } from "../dc-lcp.mjs";

// dc-lcp.mjs (#277): the pure parts that read Lighthouse's JSON and judge
// the SPEC §9.6 rule, and since #294 those that decide on reusing main's
// build, against files in temp dirs. The fixture is cut from a Lighthouse 13.5.0 run against
// /reports/c88658f4d09acb8c76e6c06ffb58ebaf on 13 Nov 2569 (.wizard/f64/lcp/run1.json).
const RUN1 = JSON.parse(fs.readFileSync(new URL("./fixtures/lighthouse-lcp-20261113.json", import.meta.url), "utf8"));

test("readLcp gives the LCP in ms and the LCP element from lcp-breakdown-insight", () => {
  assert.deepEqual(readLcp(RUN1), {
    ms: 2057.489,
    element:
      '<h1 class="font-prompt text-[22px] font-semibold leading-snug text-dc-brand-deep sm:t…"> ความครอบคลุมของเด็กอายุครบ 1 ปีที่ได้รับวัคซีน BCG ,HBV1,DTP1,DTP3,HBV3,Hib3,โปลิโอ3, MMR1…',
  });
});

test("medianRun picks the middle of 3 runs by LCP, keeping that run's element", () => {
  // run2 and run3 of the same measurement as RUN1 (.wizard/f64/lcp/), element as in RUN1
  const element = readLcp(RUN1).element;
  const run2 = { ms: 2035.568, element };
  const run3 = { ms: 2051.382, element };
  assert.equal(medianRun([readLcp(RUN1), run2, run3]), run3);
  assert.equal(medianRun([run3, run2, readLcp(RUN1)]), run3);
});

// SPEC §9.6: a branch passes when its median is at most 10% slower than main's.
test("tooSlow passes a branch exactly 10% slower than main", () => {
  assert.equal(tooSlow(2200, 2000), false);
});

test("tooSlow fails a branch a little over 10% slower than main", () => {
  assert.equal(tooSlow(2200.001, 2000), true);
  assert.equal(tooSlow(2256.53, 2051.382), true);
});

test("tooSlow passes a branch faster than main or as fast", () => {
  assert.equal(tooSlow(2035.568, 2051.382), false);
  assert.equal(tooSlow(2051.382, 2051.382), false);
});

// #294: main's build in .dc-lcp/main/ is reused only for the same snapshot.
// Each test writes its files, such as a small snapshot of public/data/'s
// shape, in a temp dir.
const dirs = [];
after(() => dirs.forEach((dir) => fs.rmSync(dir, { recursive: true })));

function tempDir(files) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "dc-lcp-test-"));
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
