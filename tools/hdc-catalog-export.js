// HDC catalog export — a snippet for the browser DevTools console, not a node script.
//
// Why a snippet: the catalog API (/opendata_api/reports/*) answers 403 to anything that
// is not a browser, and project scripts never spoof browser headers (ADR-0010). So the
// admin runs this on opendata.moph.go.th itself and hands the downloaded file to
// `node src/scripts/hdc-catalog.js find|refresh --from <file>` (SPEC §12.3).
//
// How to run (about 51 topics, 1–2 minutes):
//   1. Open https://opendata.moph.go.th in the browser, press F12 → Console.
//   2. Paste this whole file and press Enter. Progress is printed per topic.
//   3. One file `hdc-catalog-YYYYMMDD.json` is downloaded; move it into `catalog-exports/`
//      in the repo (that folder is in .gitignore).
//
// What it does, and nothing more:
//   - refuses to run unless the page origin is exactly https://opendata.moph.go.th
//   - sends same-origin GET requests to exactly two paths: /opendata_api/reports/categories
//     and /opendata_api/reports/categorie/by-category-id/{cat_id} (spelled "categorie" by HDC)
//   - never reads document.cookie, localStorage or anything else on the page; the browser
//     attaches its own cookies to same-origin requests exactly as for a page navigation
//   - one request at a time with a 1–2 s pause; on 429, 5xx or a network error it waits
//     5 s / 10 s / 20 s and retries, then records the topic in `errors` and moves on
//   - ends with a single download in the SCHEMA §5.5 format:
//       { exported_at, source, categories: [...], reports: { [cat_id]: [...] }, errors: [...] }
//     `errors[].status`: HTTP status, 0 = network error, -1 = response was not a JSON array
(async () => {
  "use strict";

  const ORIGIN = "https://opendata.moph.go.th";
  const CATEGORIES_PATH = "/opendata_api/reports/categories";
  const BY_CATEGORY_PATH = "/opendata_api/reports/categorie/by-category-id/";
  const PAUSE_MS = [1000, 2000]; // min, max between requests
  const RETRY_WAIT_MS = [5000, 10000, 20000]; // after 429 / 5xx / network error

  if (window.location.origin !== ORIGIN) {
    console.error(
      `hdc-catalog-export: run this on ${ORIGIN} (current origin: ${window.location.origin}). Nothing was requested.`,
    );
    return;
  }

  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  const pause = () => sleep(PAUSE_MS[0] + Math.random() * (PAUSE_MS[1] - PAUSE_MS[0]));

  // One same-origin GET with retry. Resolves to { ok: true, data } or { ok: false, status }.
  async function getJsonArray(path) {
    for (let attempt = 0; ; attempt++) {
      let response = null;
      try {
        response = await fetch(ORIGIN + path, {
          method: "GET",
          mode: "same-origin",
          credentials: "same-origin",
          cache: "no-store",
          headers: { accept: "application/json" },
        });
      } catch {
        response = null; // network error
      }

      if (response && response.ok) {
        let data;
        try {
          data = await response.json();
        } catch {
          return { ok: false, status: -1 };
        }
        return Array.isArray(data) ? { ok: true, data } : { ok: false, status: -1 };
      }

      const status = response ? response.status : 0;
      const retryable = status === 0 || status === 429 || status >= 500;
      if (!retryable || attempt >= RETRY_WAIT_MS.length) return { ok: false, status };
      const wait = RETRY_WAIT_MS[attempt];
      console.warn(
        `  ${path} → ${status}; waiting ${wait / 1000}s before retry ${attempt + 1}/${RETRY_WAIT_MS.length}`,
      );
      await sleep(wait);
    }
  }

  console.log("hdc-catalog-export: fetching categories…");
  const categoriesResult = await getJsonArray(CATEGORIES_PATH);
  if (!categoriesResult.ok) {
    console.error(
      `hdc-catalog-export: categories failed (status ${categoriesResult.status}); nothing exported.`,
    );
    return;
  }
  const categories = categoriesResult.data
    .map((c) => ({ cat_id: String(c.cat_id || ""), category_name: String(c.category_name || "") }))
    .filter((c) => c.cat_id);
  console.log(`hdc-catalog-export: ${categories.length} topics`);

  const reports = {};
  const errors = [];
  for (let i = 0; i < categories.length; i++) {
    const { cat_id, category_name } = categories[i];
    const label = `[${i + 1}/${categories.length}] ${category_name} (${cat_id})`;
    await pause();
    const result = await getJsonArray(BY_CATEGORY_PATH + encodeURIComponent(cat_id));
    if (result.ok) {
      reports[cat_id] = result.data;
      console.log(`  ${label}: ${result.data.length} rows`);
    } else {
      errors.push({ cat_id, status: result.status });
      console.warn(`  ${label}: FAILED (status ${result.status})`);
    }
  }

  const now = new Date();
  const ymd =
    String(now.getFullYear()) +
    String(now.getMonth() + 1).padStart(2, "0") +
    String(now.getDate()).padStart(2, "0");
  const fileName = `hdc-catalog-${ymd}.json`;
  const payload = {
    exported_at: now.toISOString(),
    source: ORIGIN,
    categories,
    reports,
    errors,
  };

  const blob = new Blob([JSON.stringify(payload)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);

  console.log(
    `hdc-catalog-export: done — ${Object.keys(reports).length}/${categories.length} topics, ${errors.length} errors → ${fileName} (move it into catalog-exports/)`,
  );
})();
