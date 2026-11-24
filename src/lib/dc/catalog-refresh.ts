// รีเฟรชแค็ตตาล็อก from the แค็ตตาล็อก HDC section of /sync (SPEC §5.3,
// §12.1, Track M): the topics of hdc_topics from ?action=catalog, in row
// order, each topic's reports from the catalog API of MOPH, then its
// save_catalog (SCHEMA §3.4) before the next topic. fetch and the wait come
// in from the caller, so tests pass stubs (CODING_STANDARDS §5).

import type {
  CatalogRefreshSummary,
  CatalogTopicResult,
  DcTopic,
  GasCatalog,
  GasError,
  GasSaveCatalogAnswer,
} from "./types";

const BY_CATEGORY = "https://opendata.moph.go.th/opendata_api/reports/categorie/by-category-id/";

interface Deps {
  fetch: typeof fetch;
  gasUrl: string;
  wait: (ms: number) => Promise<void>;
}

const PAUSE_MS = [1000, 2000]; // min, max before each request to MOPH
const RETRY_WAIT_MS = [5000, 10000, 20000]; // after 429, 5xx or a network error

/**
 * One topic's reports from the catalog API, after a pause, trying again on
 * 429, 5xx or a network error as tools/hdc-catalog-export.js does; or why
 * there are none.
 */
async function topicReports(
  { fetch, wait }: Deps,
  catId: string,
): Promise<{ reports: unknown[] } | { reason: string }> {
  await wait(PAUSE_MS[0] + Math.random() * (PAUSE_MS[1] - PAUSE_MS[0]));
  for (let attempt = 0; ; attempt++) {
    let res: Response | null = null;
    let why: string;
    try {
      // A plain GET, which the API's CORS lets the page read (ADR-0010);
      // not from the browser cache, or a refresh could save an old list.
      res = await fetch(BY_CATEGORY + encodeURIComponent(catId), { cache: "no-store" });
      why = `HTTP ${res.status}`;
    } catch (err) {
      why = errorText(err);
    }
    if (res?.ok) {
      const reports: unknown = await res.json().catch(() => null);
      if (!Array.isArray(reports)) return { reason: "HDC ไม่ได้ตอบเป็นรายการรายงาน" };
      // Never reports: [], which to save_catalog reads as every report
      // removed, and it refuses one (SCHEMA §3.4 step 2).
      if (reports.length === 0) return { reason: "HDC ไม่มีรายงานในหัวข้อนี้ ตรวจ cat_id ใน hdc_topics" };
      return { reports };
    }
    const retryable = !res || res.status === 429 || res.status >= 500;
    if (!retryable || attempt >= RETRY_WAIT_MS.length) return { reason: `ดึงจาก HDC ไม่สำเร็จ: ${why}` };
    await wait(RETRY_WAIT_MS[attempt]);
  }
}

function errorText(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

/** A GAS web app answer as JSON; throws why when GAS is not reached or does not answer 200 */
async function gasJson<T>(fetch: Deps["fetch"], url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json() as Promise<T>;
}

/** One topic: its reports from MOPH, then its save_catalog (SCHEMA §3.4) */
async function refreshTopic(deps: Deps, topic: DcTopic): Promise<CatalogTopicResult> {
  const about = { cat_id: topic.cat_id, name: topic.category_name || topic.cat_id };
  const fetched = await topicReports(deps, topic.cat_id);
  if (!("reports" in fetched)) return { ...about, outcome: "skipped", reason: fetched.reason };
  let answer: GasSaveCatalogAnswer;
  try {
    answer = await gasJson<GasSaveCatalogAnswer>(deps.fetch, deps.gasUrl, {
      method: "POST",
      // text/plain keeps it a simple request: a GAS web app answers no CORS preflight.
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify({ action: "save_catalog", cat_id: topic.cat_id, reports: fetched.reports }),
    });
  } catch (err) {
    return { ...about, outcome: "failed", reason: `ส่งไป GAS ไม่สำเร็จ: ${errorText(err)}` };
  }
  // Busy too: the admin presses the button again later (SPEC §12.1).
  if (answer.status !== "success") return { ...about, outcome: "failed", reason: `GAS ไม่บันทึก: ${answer.message}` };
  const { added, updated, removed, skipped } = answer;
  return { ...about, outcome: "saved", added, updated, removed, skipped };
}

/**
 * Every topic of hdc_topics, top row first: the first topic to save a report
 * keeps it (SPEC §5.3). onListed gets how many topics there are once they are
 * read, so the page can say how far it is (SPEC §12.1, F96); onTopic gets each
 * topic's result as it ends.
 */
export async function refreshCatalog(
  deps: Deps & { onListed?: (total: number) => void; onTopic?: (result: CatalogTopicResult) => void },
): Promise<CatalogRefreshSummary> {
  let listed: DcTopic[];
  try {
    const answer = await gasJson<Partial<Pick<GasCatalog, "topics">> | GasError>(
      deps.fetch,
      `${deps.gasUrl}?action=catalog`,
    );
    if ("status" in answer) throw new Error(answer.message);
    if (!Array.isArray(answer.topics)) throw new Error("คำตอบของ GAS ไม่มี topics");
    listed = answer.topics;
  } catch (err) {
    // Busy, the commonest, means the lock is held, as by a sync (SPEC §12.1).
    throw new Error(
      `อ่านหัวข้อจาก hdc_topics ไม่ได้: ${errorText(err)} · รอสักครู่แล้วกดรีเฟรชแค็ตตาล็อกอีกครั้ง ถ้ากำลัง sync อยู่ให้รอจบก่อน`,
    );
  }
  if (listed.length === 0) {
    throw new Error("hdc_topics ไม่มีหัวข้อ ใส่ cat_id ของหัวข้อในชีตก่อน แล้วกดรีเฟรชแค็ตตาล็อกอีกครั้ง");
  }
  deps.onListed?.(listed.length);
  const topics: CatalogTopicResult[] = [];
  for (const topic of listed) {
    const result = await refreshTopic(deps, topic);
    topics.push(result);
    deps.onTopic?.(result);
  }
  const count = (outcome: CatalogTopicResult["outcome"]) => topics.filter((t) => t.outcome === outcome).length;
  return { saved: count("saved"), skipped: count("skipped"), failed: count("failed"), topics };
}
