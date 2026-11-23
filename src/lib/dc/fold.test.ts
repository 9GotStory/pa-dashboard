import assert from "node:assert/strict";
import test from "node:test";
import { FOLDED, foldStep } from "./fold";

// FEATURES F92: the folded part of เกี่ยวกับรายงานนี้ opens and shuts in one
// smooth movement (SPEC §9.1 "motion"), while its <details> stays the one
// that opens without JavaScript and in print.

test("a press on a folded part opens its <details> at once and shows the body, which grows", () => {
  assert.deepEqual(foldStep(FOLDED, { type: "press" }), { open: true, shown: true });
});

test("a press on an open part hides the body first: its <details> stays open while the body shrinks", () => {
  assert.deepEqual(foldStep({ open: true, shown: true }, { type: "press" }), { open: true, shown: false });
});

test("a press while the body shrinks shows it again, growing from where it is", () => {
  assert.deepEqual(foldStep({ open: true, shown: false }, { type: "press" }), { open: true, shown: true });
});

test("the end of a shrink closes the <details>, so a screen reader hears it collapsed", () => {
  assert.deepEqual(foldStep({ open: true, shown: false }, { type: "done" }), FOLDED);
});

test("the end of a grow leaves the part open", () => {
  const opened = { open: true, shown: true };
  assert.equal(foldStep(opened, { type: "done" }), opened);
});

test("the browser opening or closing the <details> itself (before Motion loads, find in page) shows or hides the body with it", () => {
  const opened = foldStep(FOLDED, { type: "toggle", open: true });
  assert.deepEqual(opened, { open: true, shown: true });
  assert.deepEqual(foldStep(opened, { type: "toggle", open: false }), FOLDED);
});

test("a toggle that only echoes the open the fold already has changes nothing, even while the body shrinks", () => {
  const opened = { open: true, shown: true };
  const shrinking = { open: true, shown: false };
  assert.equal(foldStep(opened, { type: "toggle", open: true }), opened);
  assert.equal(foldStep(shrinking, { type: "toggle", open: true }), shrinking);
  assert.equal(foldStep(FOLDED, { type: "toggle", open: false }), FOLDED);
});
