import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test, { after } from "node:test";
import { comparePage, exitCode, normalizeHtml, pagesToOpen } from "../dc-compare.mjs";

// dc-compare.mjs (#309): the parts that need no browser. The ids are of the
// shape React 19.2.3's useId gives, read in its react-dom-client: _R_…_ in
// a hydrated tree, H and a counter for a second id of the same component,
// and _r_…_ in one rendered in the browser alone.

test("normalizeHtml takes out the ids of useId wherever they are, keeping each class", () => {
  assert.equal(
    normalizeHtml(
      '<label for="_R_1b6_" class="text-xs font-semibold">ปี</label><select id="_R_1b6_" aria-describedby="_R_1b6H1_ _r_a_" class="min-h-10 rounded-md"></select>',
    ),
    '<label for="«id»" class="text-xs font-semibold">ปี</label><select id="«id»" aria-describedby="«id» «id»" class="min-h-10 rounded-md"></select>',
  );
});

// Names as next build 16.4.3 wrote them on 15 Nov 2569: chunks that
// out/reports/population.html loads, and _buildManifest.js under the build's
// id in out/_next/static/.
test("normalizeHtml takes out the names of chunks and the build's id under /_next/static/, keeping each class", () => {
  assert.equal(
    normalizeHtml(
      '<div class="grid gap-3"><script src="/_next/static/chunks/0cz1d0mv5g_q7.js" async=""></script><link rel="stylesheet" href="/_next/static/chunks/1hl6aft3e8x7i.css"><script>self.__next_f.push([1,"/_next/static/skUREJ1ie7h7GcdmnVcQ7/_buildManifest.js"])</script></div>',
    ),
    '<div class="grid gap-3"><script src="/_next/static/«chunk»" async=""></script><link rel="stylesheet" href="/_next/static/«chunk»"><script>self.__next_f.push([1,"/_next/static/«chunk»"])</script></div>',
  );
});

// The <main> of /reports/c88658f4d09acb8c76e6c06ffb58ebaf (s_epi1) as Chrome
// showed it on 24 Nov 2569, opened 5 times from one build of 900b443 (next
// build 16.4.6, React 19.2.3), cut to the tags around its comments (#374).
// 4 openings had <!--$--> and <!--/$--> around the table's page and a pair
// inside it; 1 had neither. Every opening had the pair before </main> and
// the <!-- --> on each side of the · in แหล่งข้อมูล.
const EPI_TOP =
  '<main id="main" tabindex="-1" class="mx-auto w-full max-w-330 flex-1 px-4 pt-5 pb-12 focus:outline-none sm:px-8 sm:pt-7"><div class="overflow-hidden rounded-[10px] border border-dc-border-subtle bg-white print:border-0">';
const EPI_FILTERS =
  '<section aria-labelledby="filters-title" class="border-b border-dc-border-subtle bg-dc-highlight-soft/50 px-4 py-5 sm:px-6 print:hidden"><h2 id="filters-title" class="font-prompt text-[15px] font-semibold text-dc-brand-deep">ตัวกรองรายงาน</h2></section>';
const EPI_ABOUT =
  '<section aria-labelledby="about-title" class="border-t border-dc-border-subtle bg-dc-canvas/60 px-4 py-5 sm:px-6"><h2 id="about-title" class="font-prompt text-[15px] font-semibold text-dc-brand-deep">เกี่ยวกับรายงานนี้</h2><a href="https://hdc.moph.go.th/pre/public/standard-report-detail/c88658f4d09acb8c76e6c06ffb58ebaf?subcatalogId=4df360514655f79f13901ef1181ca1c7" class="text-dc-brand-primary underline underline-offset-2 transition-colors hover:text-dc-brand-accent active:text-dc-brand-deep">HDC</a> <!-- -->·<!-- --> <a href="https://opendata.moph.go.th/th/services/summary-table/73daf277928bc32a1b3c8e772192543c/s_epi1/c88658f4d09acb8c76e6c06ffb58ebaf" class="text-dc-brand-primary underline underline-offset-2 transition-colors hover:text-dc-brand-accent active:text-dc-brand-deep">HDC Open Data</a></section>';
const EPI_WITH_COMMENTS = `${EPI_TOP}<!--$--><div data-table-page="epi"><!--$--><!--/$-->${EPI_FILTERS}</div><!--/$-->${EPI_ABOUT}</div><!--$--><!--/$--></main>`;
const EPI_WITHOUT_COMMENTS = `${EPI_TOP}<div data-table-page="epi">${EPI_FILTERS}</div>${EPI_ABOUT}</div><!--$--><!--/$--></main>`;

test("normalizeHtml takes out <!--$--> and <!--/$-->, keeping <!-- --> and each class", () => {
  const neither = `${EPI_TOP}<div data-table-page="epi">${EPI_FILTERS}</div>${EPI_ABOUT}</div></main>`;
  assert.equal(normalizeHtml(EPI_WITH_COMMENTS), neither);
  assert.equal(normalizeHtml(EPI_WITHOUT_COMMENTS), neither);
});

// From the HTML next build 16.4.6 wrote on 24 Nov 2569, before any
// JavaScript, cut to the tags around each comment: <!--$?--> in
// out/reports/c88658f4d09acb8c76e6c06ffb58ebaf.html, ahead of the status the
// page shows while its report loads and closed by <!--/$-->, and <!--$!-->
// in out/reports.html, ahead of ค้นหารายงาน. No report page in out/reports/
// has <!--$!-->.
test("normalizeHtml keeps <!--$?--> and <!--$!-->", () => {
  const loading =
    '<!--$?--><template id="B:0"></template><div role="status" class="min-h-svh px-4 py-5 sm:px-6"><p class="text-dc-text-secondary">กำลังโหลดข้อมูลรายงาน…</p></div>';
  assert.equal(normalizeHtml(`${loading}<!--/$-->`), loading);
  const findReports =
    '<!--$!--><template data-dgst=""></template><section aria-labelledby="library-find-title" class="mt-5 sm:mt-6"><h2 id="library-find-title" class="sr-only">ค้นหารายงาน</h2></section>';
  assert.equal(normalizeHtml(findReports), findReports);
});

// Each test writes an out/ of its own, with the files next build writes for a
// page under out/reports/ (the HTML, its .txt and a directory of segments),
// in a temp dir.
const dirs = [];
after(() => dirs.forEach((dir) => fs.rmSync(dir, { recursive: true })));

function builtOut(pages) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "dc-compare-test-"));
  dirs.push(dir);
  fs.mkdirSync(path.join(dir, "reports"));
  for (const page of pages) {
    fs.writeFileSync(path.join(dir, "reports", `${page}.html`), "<!DOCTYPE html>");
    fs.writeFileSync(path.join(dir, "reports", `${page}.txt`), "");
    fs.mkdirSync(path.join(dir, "reports", page));
  }
  fs.writeFileSync(path.join(dir, "reports", "__next._tree.txt"), "");
  fs.writeFileSync(path.join(dir, "reports.html"), "<!DOCTYPE html>");
  return dir;
}

test("pagesToOpen opens every report page of either build, then each URL asked that is not one of them", () => {
  const branch = builtOut(["1b60d68b1cb5b003fcba38a4a0e4027b", "population", "abt2t2k4z4xeqzytwbave"]);
  const main = builtOut(["1b60d68b1cb5b003fcba38a4a0e4027b", "population", "c88658f4d09acb8c76e6c06ffb58ebaf"]);
  assert.deepEqual(
    pagesToOpen(branch, main, [
      "/reports/population?area=540603",
      "/reports/population",
      "/reports/population?area=540603",
    ]),
    [
      "/reports/1b60d68b1cb5b003fcba38a4a0e4027b",
      "/reports/abt2t2k4z4xeqzytwbave",
      "/reports/c88658f4d09acb8c76e6c06ffb58ebaf",
      "/reports/population",
      "/reports/population?area=540603",
    ],
  );
});

// A page as dc-compare reads it: the innerText and the HTML of <main>, and the
// CSV of ดาวน์โหลด CSV. In the shape of the ร้อยละสอบถาม panel of
// /reports/4164a7c49fcb2b8c3ccca67dcdf28bd0 (s_kpi_food) and its CSV name
// (csv.ts); the figures are not the snapshot's.
const FOOD = {
  text: "ร้อยละสอบถาม ปีงบประมาณ 2569\nเด็กอายุครบ 6 เดือน\n215 คน\nถูกสอบถาม\n120 คน",
  html: '<main id="main" class="mx-auto max-w-6xl"><section aria-labelledby="_R_2b6_" class="rounded-[10px] border p-4"><h3 id="_R_2b6_" class="font-prompt text-sm font-semibold">ร้อยละสอบถาม ปีงบประมาณ 2569</h3><dl class="grid gap-3"><div class="rounded-lg bg-dc-canvas p-3"><dt class="text-xs">เด็กอายุครบ 6 เดือน</dt><dd class="text-lg font-semibold">215 คน</dd></div></dl></section></main>',
  csv: { name: "SHDC-s_kpi_food-4164a7c4-2569.csv", text: '\ufeff"พื้นที่","เป้าหมาย"\r\n"บ้านหนุน","24"\r\n' },
};

test("comparePage gives same, on one line, for a page whose text, HTML and CSV are the same on both sides", () => {
  assert.deepEqual(comparePage("/reports/4164a7c49fcb2b8c3ccca67dcdf28bd0", FOOD, { ...FOOD }), {
    url: "/reports/4164a7c49fcb2b8c3ccca67dcdf28bd0",
    verdict: "same",
    lines: ["/reports/4164a7c49fcb2b8c3ccca67dcdf28bd0: same"],
  });
});

test("comparePage gives differs at the HTML for a changed class, with main's line and the branch's, one tag a line", () => {
  const branch = { ...FOOD, html: FOOD.html.replace("text-lg font-semibold", "text-xl font-semibold") };
  assert.deepEqual(comparePage("/reports/4164a7c49fcb2b8c3ccca67dcdf28bd0", branch, FOOD), {
    url: "/reports/4164a7c49fcb2b8c3ccca67dcdf28bd0",
    verdict: "differs",
    lines: [
      "/reports/4164a7c49fcb2b8c3ccca67dcdf28bd0: differs at HTML",
      "  HTML, line 7:",
      '  - <dd class="text-lg font-semibold">215 คน</dd>',
      '  + <dd class="text-xl font-semibold">215 คน</dd>',
    ],
  });
});

test("comparePage gives only on branch, or only on main, for a page one build lacks", () => {
  assert.deepEqual(comparePage("/reports/abt2t2k4z4xeqzytwbave", FOOD, null), {
    url: "/reports/abt2t2k4z4xeqzytwbave",
    verdict: "only on branch",
    lines: ["/reports/abt2t2k4z4xeqzytwbave: only on branch"],
  });
  assert.deepEqual(comparePage("/reports/abt2t2k4z4xeqzytwbave", null, FOOD), {
    url: "/reports/abt2t2k4z4xeqzytwbave",
    verdict: "only on main",
    lines: ["/reports/abt2t2k4z4xeqzytwbave: only on main"],
  });
});

test("comparePage names each part that differs, in order, with at most 5 lines a side and how many more", () => {
  const rows = ["บ้านหนุน", "บ้านกลาง", "ห้วยหม้าย", "เตาปูน", "หัวเมือง", "สะเอียบ", "แดนชุมพล"];
  const main = {
    ...FOOD,
    csv: { name: "SHDC-s_kpi_food-4164a7c4-2569.csv", text: rows.map((row) => `"${row}","24"\r\n`).join("") },
  };
  const branch = {
    ...FOOD,
    text: FOOD.text.replace("120 คน", "121 คน"),
    csv: { name: "SHDC-s_kpi_food-4164a7c4-2569.csv", text: rows.map((row) => `"${row}","24","53.85"\r\n`).join("") },
  };
  assert.deepEqual(comparePage("/reports/4164a7c49fcb2b8c3ccca67dcdf28bd0", branch, main).lines, [
    "/reports/4164a7c49fcb2b8c3ccca67dcdf28bd0: differs at text, CSV",
    "  text, line 5:",
    "  - 120 คน",
    "  + 121 คน",
    "  CSV, line 2:",
    '  - "บ้านหนุน","24"',
    '  - "บ้านกลาง","24"',
    '  - "ห้วยหม้าย","24"',
    '  - "เตาปูน","24"',
    '  - "หัวเมือง","24"',
    "  - … 2 more",
    '  + "บ้านหนุน","24","53.85"',
    '  + "บ้านกลาง","24","53.85"',
    '  + "ห้วยหม้าย","24","53.85"',
    '  + "เตาปูน","24","53.85"',
    '  + "หัวเมือง","24","53.85"',
    "  + … 2 more",
  ]);
});

test("comparePage gives same for a page whose HTML differs only in the ids of useId and the names of chunks", () => {
  const branch = {
    ...FOOD,
    html: FOOD.html
      .replaceAll("_R_2b6_", "_R_2b7_")
      .replace("</main>", '<script src="/_next/static/chunks/0l64633wgukfj.js"></script></main>'),
  };
  const main = {
    ...FOOD,
    html: FOOD.html.replace("</main>", '<script src="/_next/static/chunks/36lpvbb_w2pg3.js"></script></main>'),
  };
  assert.equal(comparePage("/reports/4164a7c49fcb2b8c3ccca67dcdf28bd0", branch, main).verdict, "same");
});

test("comparePage gives same for a page whose HTML differs only in <!--$--> and <!--/$-->", () => {
  const text = "ตัวกรองรายงาน\nเกี่ยวกับรายงานนี้\nHDC · HDC Open Data";
  const branch = { text, html: EPI_WITHOUT_COMMENTS, csv: null };
  const main = { text, html: EPI_WITH_COMMENTS, csv: null };
  assert.equal(comparePage("/reports/c88658f4d09acb8c76e6c06ffb58ebaf", branch, main).verdict, "same");
});

// The exit code, as diff's: 0 when every page is the same, 1 when one is not,
// 2 when the run cannot say, as for a URL asked that neither build has.
const result = (verdict) => ({ url: "/reports/population", verdict, lines: [] });

test("exitCode is 0 when every page is the same", () => {
  assert.equal(exitCode([result("same"), result("same")]), 0);
});

for (const verdict of ["differs", "only on branch", "only on main"]) {
  test(`exitCode is 1 when a page ${verdict === "differs" ? "differs" : `is ${verdict}`}`, () => {
    assert.equal(exitCode([result("same"), result(verdict), result("same")]), 1);
  });
}

test("a URL asked that neither build has is on neither side, and exitCode is 2 whatever the other pages", () => {
  const missing = comparePage("/reports/0000", null, null);
  assert.deepEqual(missing, {
    url: "/reports/0000",
    verdict: "on neither side",
    lines: ["/reports/0000: on neither side"],
  });
  assert.equal(exitCode([result("differs"), missing, result("same")]), 2);
});
