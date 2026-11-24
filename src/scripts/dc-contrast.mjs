// The colour pairs (คู่สี, GLOSSARY) of the text a page shows against WCAG
// AA (#383): each text's colour and the colour painted under it on the
// rendered page, read from the page, not from classes or token values.
// Text, labels in an SVG (their fill), what a <select> shows and the
// placeholder of an empty field are measured; graphics (bars, a progress
// bar, a focus ring) are not, as no machine can say which shapes must be
// seen to be understood. The ground is what paints under the text: the
// background of an HTML element and the fill of an SVG shape, a sibling or
// an element placed on its own as much as an ancestor; a stroke is a line,
// not a ground, and the stroke round a label's letters does not help it.
// Text that does not show is left out (sr-only, clipped by an overflow, off
// the screen, covered whole), and a control that cannot be used
// (aria-disabled="true", :disabled, the text and label of either) is marked
// disabled, which AA exempts. A ground that is a picture or a gradient is a
// row of its own, unmeasurable, naming the element.
//
// Written here, from #377's measure, rather than with axe-core: on this
// site's 27 URLs at 360 and 1280 px, axe-core 4.14.1's color-contrast agreed
// with that measure on all 8,689 texts both judged, within 0.03, but judges
// no text in an SVG (1,007 of its 1,124 incomplete), no disabled control,
// and reads a placeholder in the field's colour (CODING_STANDARDS §3).
//
// Usage: npm run dc:contrast -- [--base <url>] [--width <px> ...] <path> ...
// Without --base it serves out/ as dc-check.mjs does; with it, it opens a
// server already running, such as npm run dc:sync-local's or the live site,
// and sends nothing but GET and HEAD (the prefetch of next/link), aborting
// any other request and naming it. Widths default to 360 and 1280 px. Map tiles
// are blocked, and each page is read once it has loaded its data, as
// dc-compare.mjs waits. It logs in to nothing and presses nothing: a state
// after a click is a Playwright script's own, importing measurePage,
// groupPairs and formatPairs from this file (docs/agents/page-checks.md).
// Prints a summary line, then a row a pair, unmeasurable rows first and then
// the pairs nearest their threshold. Exits 0 when no pair is below AA, 1
// when one that is not disabled is or a row is unmeasurable, 2 when it
// cannot run (no out/, a page that does not open). The pages are opened with
// playwright-core in the installed Google Chrome (CODING_STANDARDS §3).
import fs from "node:fs";
import { chromium } from "playwright-core";
import { serve } from "./dc-serve.mjs";

// WCAG 2.2's relative luminance of an sRGB colour, each channel 0–1.
export function luminance(rgb) {
  const [r, g, b] = rgb.map((v) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

// WCAG 2.2's contrast ratio of two sRGB colours, unrounded, 1–21.
export function contrastRatio(a, b) {
  const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (light + 0.05) / (dark + 0.05);
}

// Source-over of premultiplied colours [r, g, b, a]: top over bottom.
const over = (top, bottom) => top.map((v, i) => v + bottom[i] * (1 - top[3]));

// The layers that paint one point, bottom to top, flattened onto premultiplied
// transparent, from depth on: the layers that share an opacity group at depth
// are flattened together, then the group's opacity applies once to the whole,
// as the browser paints an element with opacity < 1 and its content.
function flatten(layers, opacities, depth) {
  let result = [0, 0, 0, 0];
  for (let i = 0; i < layers.length;) {
    const group = layers[i].groups[depth];
    if (group === undefined) {
      const [r, g, b, a] = layers[i++].rgba;
      result = over([r * a, g * a, b * a, a], result);
      continue;
    }
    let end = i;
    while (end < layers.length && layers[end].groups[depth] === group) end++;
    const opacity = opacities[group];
    result = over(
      flatten(layers.slice(i, end), opacities, depth + 1).map((v) => v * opacity),
      result,
    );
    i = end;
  }
  return result;
}

// The colour a point shows: its layers, bottom to top, over the page's
// white. A layer is { rgba: [r, g, b, a] with each 0–1, groups: the ids of
// the opacity groups it is in, outermost first }; opacities maps each id to
// its opacity.
export function composite(layers, opacities = {}) {
  return over(flatten(layers, opacities, 0), [1, 1, 1, 1]).slice(0, 3);
}

// The ratio WCAG AA asks of text (1.4.3): 3:1 for large text, at least 24 px,
// or 18.66 px (14 pt) at weight 700 or more; 4.5:1 for the rest.
export function requiredRatio(sizePx, weight) {
  return sizePx >= 24 || (sizePx >= 18.66 && weight >= 700) ? 3 : 4.5;
}

// The colour pairs (คู่สี) of the rows measured: a pair for each kind, two
// colours, threshold and disabled or not, with its lowest ratio, how many
// texts have it, its texts and the pages it is on, each once in the order
// met; and a row for each reason and element that could not be measured.
// Unmeasurable rows come first, then the pairs nearest their threshold.
export function groupPairs(rows) {
  const pairs = new Map();
  for (const { text, where, ratio, ...rest } of rows) {
    const key = rest.unmeasurable
      ? JSON.stringify([rest.unmeasurable])
      : JSON.stringify([rest.kind, rest.fg, rest.bg, rest.need, rest.disabled]);
    const pair = pairs.get(key) ?? { ...rest, ratio, count: 0, texts: [], wheres: [] };
    pairs.set(key, pair);
    pair.count++;
    if (ratio < pair.ratio) pair.ratio = ratio;
    if (!pair.texts.includes(text)) pair.texts.push(text);
    if (!pair.wheres.includes(where)) pair.wheres.push(where);
  }
  const closeness = (pair) => (pair.unmeasurable ? -Infinity : pair.ratio / pair.need);
  return [...pairs.values()].sort((a, b) => closeness(a) - closeness(b));
}

// Whether a pair is below its threshold, compared unrounded.
const below = (pair) => pair.ratio < pair.need;

// The exit code of a run: 2 when a page could not be measured (errors names
// each), 1 when a pair that is not disabled is below its threshold or a row
// could not be measured, else 0. A disabled control is exempt (WCAG 1.4.3).
export function exitCode(pairs, errors) {
  if (errors.length > 0) return 2;
  return pairs.some((pair) => pair.unmeasurable || (!pair.disabled && below(pair))) ? 1 : 0;
}

// What paints under each text the page shows, read from the page (runs inside
// it, so it uses nothing from this module). For each text: its kind (text,
// svg, select, placeholder), its first 40 characters, its size on screen and
// weight, whether it is part of a control that cannot be used, and its
// samples: at up to 3 points across each of its first 3 boxes, the layers
// that paint the point under the text, bottom to top, and the text's own
// colour as the top layer (composite's form); or, when a layer under it is a
// picture or a gradient, unmeasurable with the element. Text that shows at
// no point is left out: hidden, clipped by an overflow or a clip, off the
// screen, or covered at every point by an element that paints over it. The
// page is scrolled so each text is near the middle of the viewport when it is
// read, then scrolled back.
async function collectInPage() {
  const cvs = Object.assign(document.createElement("canvas"), { width: 1, height: 1 });
  const cx = cvs.getContext("2d", { willReadFrequently: true });
  const colours = new Map();
  // A computed CSS colour as [r, g, b, a], each 0–1: r, g and b in sRGB as
  // Chrome's canvas paints the colour opaque, a from the text, as the canvas
  // keeps a to 8 bits. Chrome computes a colour as rgb(r, g, b), rgba(r, g,
  // b, a) or a function with "/ a" last, such as oklch(l c h / a).
  const rgba = (css) => {
    if (!colours.has(css)) {
      const legacy = css.match(/^rgba\((.+),\s*([\d.e-]+)\)$/);
      const modern = css.match(/^(.+?)\s*\/\s*([\d.e-]+)\)$/);
      const [opaque, alpha] = legacy
        ? [`rgb(${legacy[1]})`, legacy[2]]
        : modern
          ? [`${modern[1]})`, modern[2]]
          : [css, "1"];
      cx.fillStyle = "#000";
      cx.fillStyle = opaque;
      cx.fillRect(0, 0, 1, 1);
      const d = cx.getImageData(0, 0, 1, 1).data;
      colours.set(css, [d[0] / 255, d[1] / 255, d[2] / 255, parseFloat(alpha)]);
    }
    return colours.get(css);
  };
  const styles = new Map();
  const style = (el) => {
    if (!styles.has(el)) styles.set(el, getComputedStyle(el));
    return styles.get(el);
  };
  const name = (el) =>
    el.localName +
    (el.id
      ? `#${el.id}`
      : [...el.classList]
          .slice(0, 2)
          .map((c) => `.${c}`)
          .join(""));
  const isSvg = (el) =>
    el instanceof SVGElement && !(el instanceof SVGSVGElement && !(el.parentElement instanceof SVGElement));

  // The opacity groups an element is in, outermost first: itself and each
  // ancestor with opacity < 1, by id.
  const groupIds = new Map();
  const opacities = {};
  const groupsOf = (el) => {
    const groups = [];
    for (let e = el; e; e = e.parentElement) {
      const opacity = parseFloat(style(e).opacity);
      if (opacity >= 1) continue;
      if (!groupIds.has(e)) {
        groupIds.set(e, groupIds.size + 1);
        opacities[groupIds.size] = opacity;
      }
      groups.unshift(groupIds.get(e));
    }
    return groups;
  };

  // What a fill of url(#id) paints at a point of the shape's user space, when
  // #id is a plain pattern of flat shapes, as the Hero's dots are: the fill
  // of the shape of its tile under the point, or { rgba: transparent } where
  // none is. undefined for any other paint server (a gradient, a pattern
  // with a viewBox, a transform, its own units or an href), which the caller
  // reports as unmeasurable.
  const patternAt = (shape, fill, at) => {
    const pattern = document.getElementById(fill.match(/^url\("?#([^")]+)"?\)$/)?.[1]);
    if (!(pattern instanceof SVGPatternElement)) return undefined;
    const plain =
      pattern.getAttribute("patternUnits") === "userSpaceOnUse" &&
      ["viewBox", "patternTransform", "patternContentUnits", "href", "xlink:href"].every(
        (a) => !pattern.hasAttribute(a),
      );
    if (!plain) return undefined;
    const [x, y, w, h] = [pattern.x, pattern.y, pattern.width, pattern.height].map((l) => l.baseVal.value);
    const mod = (v, n) => ((v % n) + n) % n;
    const local = new DOMPoint(mod(at.x - x, w), mod(at.y - y, h));
    let paint = { rgba: [0, 0, 0, 0], groups: groupsOf(shape) };
    for (const child of pattern.children) {
      if (!(child instanceof SVGGeometryElement)) return undefined;
      const cs = style(child);
      if (cs.fill === "none" || !child.isPointInFill(local)) continue;
      if (cs.fill.startsWith("url(")) return undefined;
      const [r, g, b, a] = rgba(cs.fill);
      paint = { rgba: [r, g, b, a * parseFloat(cs.fillOpacity) * parseFloat(cs.opacity)], groups: groupsOf(shape) };
    }
    return paint;
  };

  // What an element paints at a point (x, y of the viewport): null for
  // nothing, a layer, or { unmeasurable }. A shape of an SVG paints its fill
  // where the point is inside it; its stroke is a line, not a ground.
  const PICTURES = new Set(["img", "canvas", "video", "iframe", "object", "embed", "image"]);
  const paintAt = (el, x, y) => {
    if (PICTURES.has(el.localName)) {
      // A picture that did not load, as a blocked map tile, paints nothing.
      if (el.localName === "img" && (!el.complete || el.naturalWidth === 0)) return null;
      return { unmeasurable: `picture ${name(el)}` };
    }
    const cs = style(el);
    if (isSvg(el)) {
      if (!(el instanceof SVGGeometryElement) || cs.fill === "none") return null;
      const at = new DOMPoint(x, y).matrixTransform(el.getScreenCTM().inverse());
      if (!el.isPointInFill(at)) return null;
      if (cs.fill.startsWith("url("))
        return patternAt(el, cs.fill, at) ?? { unmeasurable: `fill ${cs.fill} on ${name(el)}` };
      const [r, g, b, a] = rgba(cs.fill);
      return { rgba: [r, g, b, a * parseFloat(cs.fillOpacity)], groups: groupsOf(el) };
    }
    if (cs.backgroundImage !== "none") return { unmeasurable: `background-image on ${name(el)}` };
    const colour = rgba(cs.backgroundColor);
    return colour[3] > 0 ? { rgba: colour, groups: groupsOf(el) } : null;
  };

  // The canvas: the root's background, or the body's when the root has none,
  // which then paints the whole canvas (CSS backgrounds §2.11.2).
  const root = document.documentElement;
  const canvasOwners = rgba(style(root).backgroundColor)[3] > 0 ? [root] : [root, document.body];
  const canvas = { rgba: rgba(style(canvasOwners.at(-1)).backgroundColor), groups: [] };

  // The texts to measure: { el, kind, text, colour, boxes(), disabled }.
  const disabled = (el) => {
    if (el.closest('[aria-disabled="true"], :disabled')) return true;
    const control = el.closest("label")?.control;
    return Boolean(control && (control.disabled || control.getAttribute("aria-disabled") === "true"));
  };
  const items = [];
  const seen = new Set();
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    const el = node.parentElement;
    const text = node.textContent.replace(/\s+/g, " ").trim();
    if (!text || seen.has(el) || el.closest("script, style, noscript, template, select, textarea")) continue;
    seen.add(el);
    const svg = el instanceof SVGElement;
    items.push({
      el,
      text,
      kind: svg ? "svg" : "text",
      colour: () => {
        const cs = style(el);
        if (!svg) return rgba(cs.color);
        if (cs.fill === "none") return null;
        if (cs.fill.startsWith("url(")) return { unmeasurable: `fill ${cs.fill} on ${name(el)}` };
        const [r, g, b, a] = rgba(cs.fill);
        return [r, g, b, a * parseFloat(cs.fillOpacity)];
      },
      boxes: () => {
        if (svg) return [el.getBoundingClientRect()];
        const range = document.createRange();
        range.selectNodeContents(node);
        return [...range.getClientRects()];
      },
    });
  }
  // A control's text: from its left padding, as wide as a few characters
  const controlBox = (el) => {
    const r = el.getBoundingClientRect();
    const cs = style(el);
    const left = r.left + parseFloat(cs.borderLeftWidth) + parseFloat(cs.paddingLeft);
    const size = parseFloat(cs.fontSize);
    return [new DOMRect(left, r.top + r.height / 2 - size / 2, Math.min(3 * size, r.right - left), size)];
  };
  for (const el of document.querySelectorAll("select")) {
    const text = el.selectedOptions[0]?.textContent.replace(/\s+/g, " ").trim();
    if (text)
      items.push({ el, text, kind: "select", colour: () => rgba(style(el).color), boxes: () => controlBox(el) });
  }
  for (const el of document.querySelectorAll("input[placeholder], textarea[placeholder]")) {
    if (el.value || !el.placeholder.trim()) continue;
    const boxes = () => {
      if (el.localName === "input") return controlBox(el);
      const r = el.getBoundingClientRect();
      const cs = style(el);
      const size = parseFloat(cs.fontSize);
      const top = r.top + parseFloat(cs.borderTopWidth) + parseFloat(cs.paddingTop);
      const left = r.left + parseFloat(cs.borderLeftWidth) + parseFloat(cs.paddingLeft);
      return [new DOMRect(left, top, Math.min(3 * size, r.right - left), size)];
    };
    items.push({
      el,
      text: el.placeholder.replace(/\s+/g, " ").trim(),
      kind: "placeholder",
      colour: () => rgba(getComputedStyle(el, "::placeholder").color),
      boxes,
    });
  }

  // The points of a text: 3 across the middle of each of its first 3 boxes
  const pointsOf = (item) =>
    item
      .boxes()
      .filter((b) => b.width > 0 && b.height > 0)
      .slice(0, 3)
      .flatMap((b) => [0.25, 0.5, 0.75].map((f) => [b.left + b.width * f, b.top + b.height / 2]));

  const measure = (item) => {
    const { el } = item;
    const colour = item.colour();
    if (!colour) return null;
    const cs = style(el);
    let size = parseFloat(cs.fontSize);
    // The scale of the SVG's user units to screen pixels, as dc-check.mjs's smallTextRule
    const m = el instanceof SVGGraphicsElement ? el.getScreenCTM() : null;
    if (m) size *= Math.sqrt(Math.abs(m.a * m.d - m.b * m.c));
    const row = {
      kind: item.kind,
      text: item.text.slice(0, 40),
      size,
      weight: parseInt(cs.fontWeight, 10),
      disabled: disabled(el),
      samples: [],
    };
    if (colour.unmeasurable) return { ...row, unmeasurable: colour.unmeasurable };
    const fg = { rgba: colour, groups: groupsOf(el) };
    for (const [x, y] of pointsOf(item)) {
      if (x < 0 || y < 0 || x >= innerWidth || y >= innerHeight) continue;
      const stack = document.elementsFromPoint(x, y);
      const at = stack.indexOf(el);
      // Not on the text here: clipped, or outside its glyphs
      if (at < 0) continue;
      const over = stack.slice(0, at).filter((e) => !el.contains(e));
      if (over.some((e) => paintAt(e, x, y))) continue;
      const layers = [canvas];
      for (const e of stack.slice(at).reverse()) {
        if (canvasOwners.includes(e)) continue;
        const paint = paintAt(e, x, y);
        if (paint?.unmeasurable) return { ...row, unmeasurable: paint.unmeasurable };
        if (paint) layers.push(paint);
      }
      row.samples.push([...layers, fg]);
    }
    return row.samples.length > 0 ? row : null;
  };

  // Every shape and text hit-testable while measuring, as elementsFromPoint
  // skips pointer-events: none. An SVG shape's auto hits its fill and stroke.
  const hit = document.createElement("style");
  hit.textContent = "*, *::before, *::after { pointer-events: auto !important; }";
  document.head.append(hit);
  const start = [scrollX, scrollY];
  const rows = [];
  try {
    // Animations that end (the enter of Motion), not the ones that loop
    await Promise.race([
      Promise.all(
        document
          .getAnimations()
          .filter((a) => a.effect?.getComputedTiming().endTime !== Infinity)
          .map((a) => a.finished.catch(() => {})),
      ),
      new Promise((resolve) => setTimeout(resolve, 3000)),
    ]);
    await document.fonts.ready;
    // Shown texts, by the scroll that puts them nearest the viewport's middle,
    // in steps of half a viewport
    const step = innerHeight / 2;
    const maxScroll = Math.max(0, root.scrollHeight - innerHeight);
    const byScroll = new Map();
    for (const item of items) {
      if (!item.el.checkVisibility({ visibilityProperty: true, opacityProperty: true })) continue;
      const box = item.boxes()[0];
      if (!box) continue;
      const middle = box.top + scrollY + box.height / 2;
      const scroll = Math.min(Math.round(Math.max(0, middle - innerHeight / 2) / step) * step, maxScroll);
      if (!byScroll.has(scroll)) byScroll.set(scroll, []);
      byScroll.get(scroll).push(item);
    }
    for (const [scroll, group] of [...byScroll].sort((a, b) => a[0] - b[0])) {
      window.scrollTo({ left: 0, top: scroll, behavior: "instant" });
      await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      for (const item of group) {
        const row = measure(item);
        if (row) rows.push(row);
      }
    }
  } finally {
    hit.remove();
    window.scrollTo({ left: start[0], top: start[1], behavior: "instant" });
  }
  return { rows, opacities };
}

const toHex = (rgb) =>
  "#" +
  rgb
    .map((v) =>
      Math.round(v * 255)
        .toString(16)
        .padStart(2, "0"),
    )
    .join("");

// The rows of the texts a Playwright page shows, as it is now, each with
// where (the page and its state, for the table) : { kind, text, where,
// disabled, need, fg, bg, ratio } with the lowest ratio of the text's points,
// or { kind, text, where, unmeasurable } naming what could not be measured.
// Opens nothing and presses nothing, so a script of its own can put the page
// in a state first.
export async function measurePage(page, where = page.url()) {
  const { rows, opacities } = await page.evaluate(collectInPage);
  return rows.map(({ kind, text, size, weight, disabled, samples, unmeasurable }) => {
    if (unmeasurable) return { kind, text, where, unmeasurable };
    const pairs = samples.map((layers) => {
      const fg = composite(layers, opacities);
      const bg = composite(layers.slice(0, -1), opacities);
      return { fg, bg, ratio: contrastRatio(fg, bg) };
    });
    const worst = pairs.reduce((a, b) => (b.ratio < a.ratio ? b : a));
    return {
      kind,
      text,
      where,
      disabled,
      need: requiredRatio(size, weight),
      fg: toHex(worst.fg),
      bg: toHex(worst.bg),
      ratio: worst.ratio,
    };
  });
}

// The table's lines: a pair a line, FAIL or ok by the unrounded ratio and
// disabled for a control that cannot be used, or UNMEASURABLE and what; then
// how many texts, up to 3 of them, and up to 4 of the pages they are on.
export function formatPairs(pairs) {
  const some = (list, n) => list.slice(0, n).join(", ") + (list.length > n ? `, +${list.length - n}` : "");
  return pairs.map((p) => {
    const found = `×${p.count} "${some(p.texts, 3)}" on ${some(p.wheres, 4)}`;
    if (p.unmeasurable) return `UNMEASURABLE ${p.kind.padEnd(11)} ${p.unmeasurable} ${found}`;
    const verdict = p.ratio < p.need ? "FAIL" : "ok";
    const ratio = `${p.ratio.toFixed(2).padStart(5)} / ${p.need}`;
    return `${verdict.padEnd(4)} ${ratio.padEnd(11)} ${p.kind.padEnd(11)} ${(p.disabled ? "disabled" : "").padEnd(8)} ${p.fg} on ${p.bg} ${found}`;
  });
}

// The summary line of rows grouped into pairs.
export function summaryLine(rows, pairs) {
  const fails = pairs.filter((p) => !p.unmeasurable && p.ratio < p.need);
  const disabled = fails.filter((p) => p.disabled).length;
  const unmeasurable = pairs.filter((p) => p.unmeasurable).length;
  return `dc-contrast: ${rows.length} text(s) measured, ${pairs.length - unmeasurable} pair(s), ${fails.length} below AA (${disabled} disabled), ${unmeasurable} unmeasurable`;
}

// How long a page may take to load its data once the network is idle, in ms,
// and what every status of a page loading begins with, as dc-compare.mjs.
const LOAD_TIMEOUT = 20_000;
const LOADING = "กำลังโหลด";
const DEFAULT_WIDTHS = [360, 1280];
const HEIGHT = 800;

function die(message) {
  console.error(`dc-contrast: ${message}`);
  process.exit(2);
}

// The arguments: { base, widths, paths }, or die naming what is wrong.
function parseArgs(args) {
  let base;
  const widths = [];
  const paths = [];
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--base") base = args[++i];
    else if (args[i] === "--width") widths.push(Number(args[++i]));
    else paths.push(args[i]);
  }
  if (base !== undefined && !/^https?:\/\//.test(base)) die(`--base ${base}: a URL such as http://localhost:3217`);
  const badWidth = widths.find((w) => !(Number.isInteger(w) && w > 0));
  if (badWidth !== undefined) die(`--width ${badWidth}: a width in px, such as 360`);
  if (paths.length === 0) die("no page: npm run dc:contrast -- [--base <url>] [--width <px> ...] <path> ...");
  const bad = paths.find((p) => !p.startsWith("/"));
  if (bad) die(`${bad}: a page is a path from the site's root, such as "/reports/population?area=540603"`);
  return { base: base?.replace(/\/$/, ""), widths: widths.length > 0 ? widths : DEFAULT_WIDTHS, paths };
}

// The rows of a page at a width, or throws naming why it was not measured.
// Requests other than GET and HEAD are aborted and each is added to sent.
async function measureUrl(browser, url, width, where, sent) {
  const page = await browser.newPage({ viewport: { width, height: HEIGHT } });
  try {
    await page.route("**/*", (route) => {
      const request = route.request();
      if (!["GET", "HEAD"].includes(request.method())) {
        sent.push(`${where}: ${request.method()} ${request.url()} aborted`);
        return route.abort();
      }
      if (new URL(request.url()).hostname === "tile.openstreetmap.org") return route.abort();
      return route.fallback();
    });
    const response = await page.goto(url, { waitUntil: "networkidle" });
    if (!response?.ok()) throw new Error(`HTTP ${response?.status()}`);
    await page.waitForFunction(
      (loading) => !(document.querySelector("main") ?? document.body).innerText.includes(loading),
      LOADING,
      { timeout: LOAD_TIMEOUT },
    );
    const rows = await measurePage(page, where);
    if (rows.length === 0) throw new Error("no text shows");
    return rows;
  } finally {
    await page.close();
  }
}

if (import.meta.main) {
  const { base, widths, paths } = parseArgs(process.argv.slice(2));
  if (!base && !fs.existsSync("out/index.html")) die("out/ has no build: run npm run build first, or give --base");
  const server = base ? null : await serve("out");
  const origin = base ?? `http://127.0.0.1:${server.address().port}`;
  const rows = [];
  const errors = [];
  const sent = [];
  let browser;
  try {
    browser = await chromium.launch({ channel: "chrome" });
    for (const width of widths) {
      for (const urlPath of paths) {
        const where = `${urlPath} ${width}px`;
        try {
          rows.push(...(await measureUrl(browser, origin + urlPath, width, where, sent)));
        } catch (error) {
          // Playwright messages end in a multi-line call log; the first line names the failure.
          errors.push(`${where}: ${error.message.split("\n")[0]}`);
        }
      }
    }
  } catch (error) {
    die(error.message.split("\n")[0]);
  } finally {
    await browser?.close();
    server?.close();
  }
  const pairs = groupPairs(rows);
  console.log(summaryLine(rows, pairs));
  for (const line of [...errors, ...sent]) console.log(`dc-contrast: ${line}`);
  console.log(formatPairs(pairs).join("\n"));
  process.exitCode = exitCode(pairs, errors);
}
