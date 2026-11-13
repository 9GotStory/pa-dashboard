import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import { medianRun, readLcp, tooSlow } from "../dc-lcp.mjs";

// dc-lcp.mjs (#277): the pure parts that read Lighthouse's JSON and judge
// the SPEC §9.6 rule. The fixture is cut from a Lighthouse 13.5.0 run against
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
