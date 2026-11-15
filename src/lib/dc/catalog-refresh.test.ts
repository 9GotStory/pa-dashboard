import assert from "node:assert/strict";
import test from "node:test";
import { refreshCatalog } from "./catalog-refresh";

// FEATURES F78: the รีเฟรชแค็ตตาล็อก button of /sync (SPEC §12.1), with stubs
// that answer for GAS (?action=catalog, save_catalog) and for the catalog API
// of MOPH, and a wait that only records how long it was asked to wait.

const GAS = "https://script.google.com/macros/s/x/exec";
const MOPH = "https://opendata.moph.go.th/opendata_api/reports/categorie/by-category-id/";

// Three topics of hdc_topics in sheet order (SCHEMA §6): not sorted by order
// nor by cat_id, so the order of the requests can only come from the rows.
const EPI = "4df360514655f79f13901ef1181ca1c7";
const SURVEILLANCE = "bebf866fceaef84c4078965eaf619565";
const SCREENING = "6966b0664b89805a484d7ac96c6edc48";
// A topic some tests add after the three: NCD of Service Plan (SCHEMA §6).
const FOURTH = "b2b59e64c4e6c92d4b1ec16a599d882b";
const TOPICS = [
  { cat_id: EPI, order: 20, category_name: "การสร้างเสริมภูมิคุ้มกันโรค" },
  { cat_id: SURVEILLANCE, order: 30, category_name: "การเฝ้าระวังด้านส่งเสริมสุขภาพและอนามัยสิ่งแวดล้อม" },
  { cat_id: SCREENING, order: 10, category_name: "การคัดกรอง" },
];

function report(catId: string, opendataId: string) {
  return { cat_id: catId, opendata_id: opendataId, source_table: "s_epi1", report_name: "BCG" };
}

type Answer = { status: number; body: unknown } | "network error";

/**
 * A fetch that answers GAS and MOPH from the given lists, one answer per
 * request in turn (the last one repeats), and records every request.
 */
function stub({
  catalog = [{ status: 200, body: { topics: TOPICS } }] as Answer[],
  moph = {} as Record<string, Answer[]>,
  save = {} as Record<string, Answer[]>,
} = {}) {
  const requests: { method: string; url: string; body?: { action: string; cat_id: string; reports: unknown[] } }[] = [];
  const waits: number[] = [];
  const next = (answers: Answer[], n: number) => answers[Math.min(n, answers.length - 1)];
  const fetch = async (input: string | URL | Request, init?: RequestInit) => {
    const url = String(input);
    const method = init?.method ?? "GET";
    const body = typeof init?.body === "string" ? JSON.parse(init.body) : undefined;
    requests.push({ method, url, body });
    const seen = (match: (r: (typeof requests)[number]) => boolean) => requests.filter(match).length - 1;
    let answer: Answer;
    if (url === `${GAS}?action=catalog`) {
      answer = next(
        catalog,
        seen((r) => r.url === url),
      );
    } else if (url.startsWith(MOPH)) {
      const catId = url.slice(MOPH.length);
      answer = next(
        moph[catId] ?? [{ status: 200, body: [report(catId, `${catId.slice(0, 8)}aaaaaaaa`)] }],
        seen((r) => r.url === url),
      );
    } else if (url === GAS && method === "POST") {
      answer = next(
        save[body.cat_id] ?? [
          { status: 200, body: { status: "success", added: 1, updated: 0, removed: 0, skipped: 0 } },
        ],
        seen((r) => r.body?.cat_id === body.cat_id),
      );
    } else {
      throw new Error(`unexpected request ${method} ${url}`);
    }
    if (answer === "network error") throw new TypeError("Failed to fetch");
    return new Response(typeof answer.body === "string" ? answer.body : JSON.stringify(answer.body), {
      status: answer.status,
    });
  };
  const wait = async (ms: number) => {
    waits.push(ms);
  };
  return { deps: { fetch, gasUrl: GAS, wait }, requests, waits };
}

const mophGets = (requests: { method: string; url: string }[]) =>
  requests.filter((r) => r.url.startsWith(MOPH)).map((r) => r.url.slice(MOPH.length));

test("topics in the row order of hdc_topics: each topic's GET to MOPH, then its save_catalog, before the next topic", async () => {
  const { deps, requests } = stub();
  await refreshCatalog(deps);
  assert.deepEqual(
    requests.map((r) =>
      r.method === "POST"
        ? `POST ${r.body?.cat_id}`
        : r.url.startsWith(MOPH)
          ? `GET ${r.url.slice(MOPH.length)}`
          : r.url,
    ),
    [
      `${GAS}?action=catalog`,
      `GET ${EPI}`,
      `POST ${EPI}`,
      `GET ${SURVEILLANCE}`,
      `POST ${SURVEILLANCE}`,
      `GET ${SCREENING}`,
      `POST ${SCREENING}`,
    ],
  );
  // save_catalog gets the API's array as it came (SCHEMA §3.4).
  const post = requests.find((r) => r.body?.cat_id === SURVEILLANCE)?.body;
  assert.equal(post?.action, "save_catalog");
  assert.deepEqual(post?.reports, [report(SURVEILLANCE, "bebf866faaaaaaaa")]);
  assert.deepEqual(mophGets(requests), [EPI, SURVEILLANCE, SCREENING]);
});

test("429, 5xx and a network error from MOPH: waits 5, 10 and 20 s and tries again until the topic is saved", async () => {
  const ok = { status: 200, body: [report(EPI, "c88658f4d09acb8c76e6c06ffb58ebaf")] };
  const { deps, requests, waits } = stub({
    catalog: [{ status: 200, body: { topics: [TOPICS[0]] } }],
    moph: { [EPI]: [{ status: 429, body: "" }, { status: 503, body: "" }, "network error", ok] },
  });
  const summary = await refreshCatalog(deps);
  assert.deepEqual(mophGets(requests), [EPI, EPI, EPI, EPI]);
  // A pause of 1–2 s before the first request, then the retry waits.
  assert.equal(waits.length, 4);
  assert.ok(waits[0] >= 1000 && waits[0] <= 2000, `pause ${waits[0]}`);
  assert.deepEqual(waits.slice(1), [5000, 10000, 20000]);
  assert.equal(summary.saved, 1);
});

test("a pause of 1–2 s before every request to MOPH", async () => {
  const { deps, waits } = stub();
  await refreshCatalog(deps);
  assert.equal(waits.length, 3);
  for (const ms of waits) assert.ok(ms >= 1000 && ms <= 2000, `pause ${ms}`);
});

test("skipped with the reason and no save_catalog: 5xx on every try, 403, not a JSON array, an empty array", async () => {
  const FIFTH = "db30e434e30565c12fbac44958e338d5";
  const { deps, requests } = stub({
    catalog: [
      {
        status: 200,
        body: {
          topics: [
            ...TOPICS,
            { cat_id: FOURTH, order: 50, category_name: "NCD" },
            { cat_id: FIFTH, order: 60, category_name: "" },
          ],
        },
      },
    ],
    moph: {
      [EPI]: [{ status: 502, body: "" }],
      [SURVEILLANCE]: [{ status: 403, body: "" }],
      [SCREENING]: [{ status: 200, body: "<html>maintenance</html>" }],
      [FOURTH]: [{ status: 200, body: { data: [] } }],
      [FIFTH]: [{ status: 200, body: [] }],
    },
  });
  const summary = await refreshCatalog(deps);
  assert.deepEqual(
    requests.filter((r) => r.method === "POST"),
    [],
  );
  // 502 is tried 4 times (3 retries), 403 once.
  assert.deepEqual(mophGets(requests), [EPI, EPI, EPI, EPI, SURVEILLANCE, SCREENING, FOURTH, FIFTH]);
  assert.deepEqual(
    summary.topics.map((t) => [t.cat_id, t.outcome, t.outcome === "saved" ? "" : t.reason]),
    [
      [EPI, "skipped", "ดึงจาก HDC ไม่สำเร็จ: HTTP 502"],
      [SURVEILLANCE, "skipped", "ดึงจาก HDC ไม่สำเร็จ: HTTP 403"],
      [SCREENING, "skipped", "HDC ไม่ได้ตอบเป็นรายการรายงาน"],
      [FOURTH, "skipped", "HDC ไม่ได้ตอบเป็นรายการรายงาน"],
      [FIFTH, "skipped", "HDC ไม่มีรายงานในหัวข้อนี้ ตรวจ cat_id ใน hdc_topics"],
    ],
  );
  // The name is the topic's category_name, or its cat_id before its first refresh.
  assert.deepEqual(
    summary.topics.map((t) => t.name),
    ["การสร้างเสริมภูมิคุ้มกันโรค", "การเฝ้าระวังด้านส่งเสริมสุขภาพและอนามัยสิ่งแวดล้อม", "การคัดกรอง", "NCD", FIFTH],
  );
});

test("a network error on every try: skipped with the browser's reason", async () => {
  const { deps } = stub({
    catalog: [{ status: 200, body: { topics: [TOPICS[0]] } }],
    moph: { [EPI]: ["network error"] },
  });
  const summary = await refreshCatalog(deps);
  assert.deepEqual(summary.topics[0], {
    cat_id: EPI,
    name: "การสร้างเสริมภูมิคุ้มกันโรค",
    outcome: "skipped",
    reason: "ดึงจาก HDC ไม่สำเร็จ: Failed to fetch",
  });
});

test("save_catalog errors: failed with GAS's message as received (Busy is not tried again), or why GAS was not reached; the next topic still goes", async () => {
  const { deps, requests } = stub({
    save: {
      [EPI]: [{ status: 200, body: { status: "error", message: "Busy" } }],
      [SURVEILLANCE]: ["network error"],
    },
  });
  const summary = await refreshCatalog(deps);
  assert.equal(requests.filter((r) => r.body?.cat_id === EPI).length, 1);
  assert.deepEqual(
    summary.topics.map((t) => [t.cat_id, t.outcome, t.outcome === "saved" ? "" : t.reason]),
    [
      [EPI, "failed", "GAS ไม่บันทึก: Busy"],
      [SURVEILLANCE, "failed", "ส่งไป GAS ไม่สำเร็จ: Failed to fetch"],
      [SCREENING, "saved", ""],
    ],
  );
});

test("the summary counts topics saved, skipped and failed, and each topic's result reaches onTopic as it ends", async () => {
  const { deps } = stub({
    catalog: [{ status: 200, body: { topics: [...TOPICS, { cat_id: FOURTH, order: 50, category_name: "NCD" }] } }],
    moph: { [SURVEILLANCE]: [{ status: 200, body: [] }] },
    save: {
      [EPI]: [{ status: 200, body: { status: "success", added: 34, updated: 0, removed: 0, skipped: 0 } }],
      [SCREENING]: [{ status: 200, body: { status: "error", message: "No valid reports" } }],
    },
  });
  const seen: string[] = [];
  const summary = await refreshCatalog({ ...deps, onTopic: (t) => seen.push(`${t.cat_id} ${t.outcome}`) });
  assert.deepEqual(
    { saved: summary.saved, skipped: summary.skipped, failed: summary.failed },
    { saved: 2, skipped: 1, failed: 1 },
  );
  assert.deepEqual(summary.topics[0], {
    cat_id: EPI,
    name: "การสร้างเสริมภูมิคุ้มกันโรค",
    outcome: "saved",
    added: 34,
    updated: 0,
    removed: 0,
    skipped: 0,
  });
  assert.deepEqual(seen, [`${EPI} saved`, `${SURVEILLANCE} skipped`, `${SCREENING} failed`, `${FOURTH} saved`]);
});

test("?action=catalog fails: stops with GAS's message or why, before any request to MOPH", async () => {
  const cases: [Answer, string][] = [
    [{ status: 200, body: { status: "error", message: "Busy" } }, "อ่านหัวข้อจาก hdc_topics ไม่ได้: Busy"],
    [{ status: 500, body: "" }, "อ่านหัวข้อจาก hdc_topics ไม่ได้: HTTP 500"],
    ["network error", "อ่านหัวข้อจาก hdc_topics ไม่ได้: Failed to fetch"],
    [{ status: 200, body: { rows: [] } }, "อ่านหัวข้อจาก hdc_topics ไม่ได้: คำตอบของ GAS ไม่มี topics"],
    [{ status: 200, body: { topics: [] } }, "hdc_topics ไม่มีหัวข้อ ใส่ cat_id ของหัวข้อในชีตก่อน"],
  ];
  for (const [answer, message] of cases) {
    const { deps, requests } = stub({ catalog: [answer] });
    await assert.rejects(refreshCatalog(deps), { message });
    assert.deepEqual(
      requests.map((r) => r.url),
      [`${GAS}?action=catalog`],
    );
  }
});
