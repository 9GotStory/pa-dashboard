import assert from "node:assert/strict";
import fs from "node:fs";
import test, { after, before } from "node:test";
import { chromium } from "playwright-core";
import {
  composite,
  contrastRatio,
  exitCode,
  failingPairs,
  groupPairs,
  measurePage,
  requiredRatio,
  summaryLine,
} from "../dc-contrast.mjs";

// dc-contrast.mjs (#383). The expected ratios come from sources other than
// the code: WCAG 2.2's understanding doc of 1.4.3 (#767676 on white is the
// lightest grey that passes 4.5:1, #777777 does not) and axe-core 4.14.1's
// color-contrast figures on this site's pages (#383's issue).

const rgb = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);

test("contrastRatio: WCAG's examples on white, either order", () => {
  assert.equal(contrastRatio(rgb("#000000"), rgb("#ffffff")), 21);
  assert.equal(contrastRatio(rgb("#ffffff"), rgb("#ffffff")), 1);
  assert.ok(contrastRatio(rgb("#767676"), rgb("#ffffff")) >= 4.5);
  assert.ok(contrastRatio(rgb("#777777"), rgb("#ffffff")) < 4.5);
  assert.equal(contrastRatio(rgb("#ffffff"), rgb("#767676")), contrastRatio(rgb("#767676"), rgb("#ffffff")));
});

test("contrastRatio: axe-core's figures for this site's pairs", () => {
  // #5b7064 on #e8f5e9 on /reports, and the SVG labels' fill #5b7064 on white
  assert.equal(contrastRatio(rgb("#5b7064"), rgb("#e8f5e9")).toFixed(2), "4.73");
  assert.equal(contrastRatio(rgb("#5b7064"), rgb("#ffffff")).toFixed(2), "5.32");
});

const hex = (rgb) =>
  "#" +
  rgb
    .map((v) =>
      Math.round(v * 255)
        .toString(16)
        .padStart(2, "0"),
    )
    .join("");
const layer = (hexColor, alpha = 1, groups = []) => ({ rgba: [...rgb(hexColor), alpha], groups });

test("composite: layers bottom to top over the page's white, translucent ones blended", () => {
  assert.equal(hex(composite([])), "#ffffff");
  assert.equal(hex(composite([layer("#174e42")])), "#174e42");
  // black at half over black at half over white: a quarter of white is left, 63.75
  assert.equal(hex(composite([layer("#000000", 0.5), layer("#000000", 0.5)])), "#404040");
  // an opaque layer hides what is under it
  assert.equal(hex(composite([layer("#ff0000"), layer("#e8f5e9")])), "#e8f5e9");
});

test("composite: an opacity group blends once, as a whole, not each of its layers", () => {
  // white text on a black button at opacity 0.5, over white: the text's
  // pixels are white at half over white, the button's black at half over white
  const opacities = { 1: 0.5 };
  const button = layer("#000000", 1, [1]);
  assert.equal(hex(composite([button, layer("#ffffff", 1, [1])], opacities)), "#ffffff");
  assert.equal(hex(composite([button], opacities)), "#808080");
  // a group inside a group: 0.5 × 0.5 of black over white
  assert.equal(hex(composite([layer("#000000", 1, [1, 2])], { 1: 0.5, 2: 0.5 })), "#bfbfbf");
});

// WCAG 2.2's large text: at least 18 pt (24 px), or 14 pt (18.66 px) bold.
test("requiredRatio: 3 for large text, 4.5 for the rest", () => {
  assert.equal(requiredRatio(24, 400), 3);
  assert.equal(requiredRatio(23.9, 400), 4.5);
  assert.equal(requiredRatio(18.66, 700), 3);
  assert.equal(requiredRatio(18.66, 600), 4.5);
  assert.equal(requiredRatio(18.6, 700), 4.5);
  assert.equal(requiredRatio(14, 900), 4.5);
});

// Rows as the page's measure gives them, each with the page and width it was
// on. The ratios are axe-core's and #377's figures from #383's issue.
const row = (fields) => ({ kind: "text", disabled: false, need: 4.5, ...fields });
const SIDE = row({ text: "ที่มา", fg: "#5b7064", bg: "#e8f5e9", ratio: 4.73, where: "/reports 1280" });
const SVG = row({ kind: "svg", text: "1,234", fg: "#5b7064", bg: "#ffffff", ratio: 5.32, where: "/ 360" });
const HERO = row({ text: "สอง", fg: "#ffffff", bg: "#174e42", ratio: 8.47, need: 3, where: "/ 1280" });
const CLEAR = row({ text: "ล้างการเลือก", fg: "#9aa5a0", bg: "#ffffff", ratio: 2.36, disabled: true, where: "/ 360" });

test("groupPairs: one pair per kind, colours, threshold and disabled, counting each text and naming each page", () => {
  const pairs = groupPairs([
    SVG,
    SIDE,
    { ...SIDE, text: "ปรับปรุง", where: "/reports 360" },
    { ...SIDE, where: "/reports 1280" },
    { ...SIDE, disabled: true },
  ]);
  assert.deepEqual(
    pairs.map(({ kind, fg, bg, need, disabled, count, texts, wheres }) => ({
      kind,
      fg,
      bg,
      need,
      disabled,
      count,
      texts,
      wheres,
    })),
    [
      {
        kind: "text",
        fg: "#5b7064",
        bg: "#e8f5e9",
        need: 4.5,
        disabled: false,
        count: 3,
        texts: ["ที่มา", "ปรับปรุง"],
        wheres: ["/reports 1280", "/reports 360"],
      },
      {
        kind: "text",
        fg: "#5b7064",
        bg: "#e8f5e9",
        need: 4.5,
        disabled: true,
        count: 1,
        texts: ["ที่มา"],
        wheres: ["/reports 1280"],
      },
      {
        kind: "svg",
        fg: "#5b7064",
        bg: "#ffffff",
        need: 4.5,
        disabled: false,
        count: 1,
        texts: ["1,234"],
        wheres: ["/ 360"],
      },
    ],
  );
});

test("groupPairs: nearest the threshold first, unmeasurable rows ahead of all, each pair's lowest ratio kept", () => {
  const pairs = groupPairs([
    HERO,
    SVG,
    { ...SIDE, ratio: 4.74 },
    SIDE,
    CLEAR,
    { kind: "text", text: "บนรูป", unmeasurable: "background-image on div.hero", where: "/ 1280" },
  ]);
  assert.deepEqual(
    pairs.map((p) => [p.unmeasurable ?? p.text ?? p.texts[0], p.ratio]),
    [
      ["background-image on div.hero", undefined],
      ["ล้างการเลือก", 2.36],
      ["ที่มา", 4.73],
      ["1,234", 5.32],
      ["สอง", 8.47],
    ],
  );
});

test("exitCode: 0 with no pair below AA but a disabled one, 1 with another below or an unmeasurable row, 2 when a page did not open", () => {
  assert.equal(exitCode(groupPairs([SIDE, SVG, HERO, CLEAR]), []), 0);
  assert.equal(exitCode(groupPairs([SIDE, { ...SVG, ratio: 4.49 }]), []), 1);
  assert.equal(exitCode(groupPairs([SIDE, { kind: "text", text: "x", unmeasurable: "img", where: "/ 360" }]), []), 1);
  assert.equal(exitCode(groupPairs([SIDE]), ["/sync 360: net::ERR_CONNECTION_REFUSED"]), 2);
});

test("failingPairs: the pairs below AA that are not disabled and the unmeasurable rows, in groupPairs' order", () => {
  const unmeasurable = { kind: "text", text: "บนรูป", unmeasurable: "background-image on div.hero", where: "/ 1280" };
  const pairs = groupPairs([
    SIDE,
    SVG,
    HERO,
    CLEAR,
    { ...SVG, text: "ไม่ผ่าน", ratio: 4.49, fg: "#777777" },
    unmeasurable,
  ]);
  assert.deepEqual(
    failingPairs(pairs).map((p) => p.unmeasurable ?? p.texts[0]),
    ["background-image on div.hero", "ไม่ผ่าน"],
  );
  assert.deepEqual(failingPairs(groupPairs([SIDE, SVG, HERO, CLEAR])), []);
});

test("summaryLine: counts the texts measured apart from the unmeasurable ones", () => {
  const rows = [SIDE, SVG, CLEAR, { kind: "text", text: "บนรูป", unmeasurable: "img", where: "/ 1280" }];
  assert.equal(
    summaryLine(rows, groupPairs(rows)),
    "dc-contrast: 3 text(s) measured, 3 pair(s), 1 below AA (1 disabled), 1 unmeasurable",
  );
});

// The measure that runs in the page, on fixtures/contrast.html in Google
// Chrome: one text a case, each expected pair written by hand from the
// fixture's colours.
let browser;
let rows;
before(async () => {
  browser = await chromium.launch({ channel: "chrome" });
  const page = await browser.newPage({ viewport: { width: 800, height: 600 } });
  await page.setContent(fs.readFileSync(new URL("fixtures/contrast.html", import.meta.url), "utf8"));
  rows = await measurePage(page, "fixture");
});
after(() => browser?.close());

// The row of a text, as { kind, fg, bg, disabled, need } or { kind, unmeasurable }.
function rowOf(text) {
  const found = rows.filter((r) => r.text === text);
  assert.equal(found.length, 1, `rows of "${text}": ${JSON.stringify(found)}`);
  const { kind, fg, bg, disabled, need, unmeasurable, where } = found[0];
  assert.equal(where, "fixture");
  return unmeasurable ? { kind, unmeasurable } : { kind, fg, bg, disabled, need };
}
const pair = (fg, bg, fields = {}) => ({ kind: "text", fg, bg, disabled: false, need: 4.5, ...fields });

test("measurePage: an SVG label's colour is its fill, not the color it inherits", () => {
  assert.deepEqual(rowOf("svg-fill"), pair("#5b7064", "#ffffff", { kind: "svg" }));
});

test("measurePage: an SVG label with a white stroke on a bar is against the bar's fill", () => {
  assert.deepEqual(rowOf("on-bar"), pair("#ffffff", "#155f4b", { kind: "svg" }));
});

test("measurePage: a chart's line under an SVG label is not its ground; the filled area under it is", () => {
  assert.deepEqual(rowOf("over-line"), pair("#5b7064", "#e8f5e9", { kind: "svg" }));
});

test("measurePage: text on the ground of an element beside it, as the Hero's", () => {
  assert.deepEqual(rowOf("hero-text"), pair("#ffffff", "#174e42", { need: 3 }));
});

test("measurePage: a pattern of dots over the ground paints only at its dots, so the text is against the ground", () => {
  assert.deepEqual(rowOf("dots-text"), pair("#ffffff", "#174e42", { need: 3 }));
});

test("measurePage: text that does not show is not measured", () => {
  for (const text of ["sr-only-text", "clipped-text", "offscreen-text", "covered-text"])
    assert.deepEqual(
      rows.filter((r) => r.text === text),
      [],
      text,
    );
});

test("measurePage: a disabled button, an aria-disabled one and the label of a disabled field are disabled", () => {
  assert.deepEqual(rowOf("disabled-button"), pair("#9aa5a0", "#ffffff", { disabled: true }));
  assert.deepEqual(rowOf("aria-disabled-button"), pair("#9aa5a0", "#ffffff", { disabled: true }));
  assert.deepEqual(rowOf("disabled-label"), pair("#000000", "#ffffff", { disabled: true }));
  assert.deepEqual(rowOf("enabled-button"), pair("#000000", "#ffffff"));
});

test("measurePage: what a <select> shows, and a placeholder in its own colour", () => {
  assert.deepEqual(rowOf("select-value"), pair("#333333", "#ffffff", { kind: "select" }));
  assert.deepEqual(rowOf("placeholder-text"), pair("#5b7064", "#ffffff", { kind: "placeholder" }));
});

test("measurePage: text on two translucent grounds, one over the other", () => {
  // black at half over black at half over white: a quarter of white, 63.75
  assert.deepEqual(rowOf("translucent-text"), pair("#ffffff", "#404040"));
});

test("measurePage: text on a gradient is unmeasurable, naming the element", () => {
  assert.deepEqual(rowOf("gradient-text"), { kind: "text", unmeasurable: "background-image on section.gradient" });
});

test("measurePage: a gradient under an opaque card is not the text's ground; the card is", () => {
  assert.deepEqual(rowOf("card-on-gradient"), pair("#000000", "#ffffff"));
});

test("measurePage: a translucent veil over the text is composited over both colours", () => {
  // white at half over black: 127.5 of each channel
  assert.deepEqual(rowOf("under-veil"), pair("#808080", "#ffffff"));
});

test("measurePage: a text after an element's child is measured as well as the one before", () => {
  assert.deepEqual(rowOf("lead-text"), pair("#000000", "#ffffff"));
  assert.deepEqual(rowOf("tail-text"), pair("#000000", "#ffffff"));
});

test("measurePage: text below the fold is measured", () => {
  assert.deepEqual(rowOf("below-fold"), pair("#000000", "#ffffff"));
});
