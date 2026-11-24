"use client";

import { useEffect, useState } from "react";
import { refreshCatalog } from "@/lib/dc/catalog-refresh";
import type { CatalogRefreshSummary, CatalogTopicResult } from "@/lib/dc/types";

// The แค็ตตาล็อก HDC section of /sync, shown after the PIN (SPEC §5.3, §12.1,
// ADR-0010): one button refreshes each topic of hdc_topics from the catalog
// API of MOPH with save_catalog, through catalog-refresh.ts. No confirm, no
// rebuild, and only its own button is disabled while it runs: GAS's script
// lock puts its requests in line with a sync. Like RegistryPopulationUpload,
// it calls GAS because /sync is not a page of (dc) (CODING_STANDARDS §4).

const GAS_URL = process.env.NEXT_PUBLIC_GAS_SCRIPT_URL ?? "";

const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

const LABEL: Record<CatalogTopicResult["outcome"], string> = { saved: "บันทึกแล้ว", skipped: "ข้าม", failed: "ล้ม" };

function resultText(t: CatalogTopicResult): string {
  return t.outcome === "saved"
    ? `รายงานใหม่ ${t.added} · อัปเดต ${t.updated} · หายจาก HDC ${t.removed} · ข้าม ${t.skipped} แถว`
    : t.reason;
}

export default function CatalogRefresh() {
  const [running, setRunning] = useState(false);
  const [total, setTotal] = useState<number | null>(null);
  const [topics, setTopics] = useState<CatalogTopicResult[]>([]);
  const [summary, setSummary] = useState<CatalogRefreshSummary | null>(null);
  const [stopped, setStopped] = useState<string | null>(null);

  // The browser's own warning on leaving the page mid-refresh (SPEC §12.1, F96).
  useEffect(() => {
    if (!running) return;
    const warn = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = true; // MDN, beforeunload event: "Included for legacy support, e.g. Chrome/Edge < 119"
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [running]);

  async function refresh() {
    setRunning(true);
    setTotal(null);
    setTopics([]);
    setSummary(null);
    setStopped(null);
    try {
      setSummary(
        await refreshCatalog({
          fetch,
          gasUrl: GAS_URL,
          wait,
          onListed: setTotal,
          onTopic: (result) => setTopics((prev) => [...prev, result]),
        }),
      );
    } catch (err) {
      setStopped(err instanceof Error ? err.message : String(err));
    }
    setRunning(false);
  }

  return (
    <section
      aria-labelledby="hdc-catalog"
      className="dc mt-6 rounded-xl border border-dc-border-subtle bg-white p-6 font-dc text-sm text-dc-brand-deep tabular-nums"
    >
      <h2 id="hdc-catalog" className="font-prompt text-lg font-bold text-dc-brand-deep">
        แค็ตตาล็อก HDC
      </h2>
      <p className="mt-2 text-dc-text-secondary">
        ดึงรายชื่อรายงานจาก HDC Open Data เฉพาะหัวข้อที่อยู่ในชีต <code>hdc_topics</code> ทีละหัวข้อตามลำดับแถว แล้วบันทึกลงชีต{" "}
        <code>hdc_reports</code> โดยไม่แตะคอลัมน์ที่ผู้ดูแลกรอก รายงานใหม่ปิดไว้เสมอ ต้องติ๊ก <code>enabled</code> ในชีตแล้วสั่ง rebuild
        เอง ปุ่มนี้ไม่สั่ง rebuild
      </p>

      {!GAS_URL && <p className="mt-3">ไม่ได้ตั้ง NEXT_PUBLIC_GAS_SCRIPT_URL จึงบันทึกกับ GAS ไม่ได้</p>}

      <button
        type="button"
        onClick={refresh}
        disabled={running || !GAS_URL}
        className="mt-4 rounded-lg bg-dc-brand-primary px-5 py-2.5 font-semibold text-white hover:bg-dc-brand-deep disabled:cursor-not-allowed disabled:opacity-50"
      >
        {running ? "กำลังรีเฟรช…" : "รีเฟรชแค็ตตาล็อก"}
      </button>

      {topics.length > 0 && (
        <ul aria-live="polite" className="mt-4 space-y-2">
          {topics.map((t, i) => (
            <li key={i} className="rounded-lg border border-dc-border-subtle px-3 py-2">
              <span
                className={`mr-2 inline-block rounded px-2 py-0.5 text-xs font-bold text-dc-brand-deep ${t.outcome === "saved" ? "bg-dc-brand-accent/20" : "bg-dc-gold/30"}`}
              >
                {LABEL[t.outcome]}
              </span>
              <span className="font-semibold break-all">{t.name}</span>
              <p className="mt-1">{resultText(t)}</p>
            </li>
          ))}
        </ul>
      )}

      {/* In the page from the start, so a screen reader hears each change without focus moving (F96) */}
      <div role="status">
        {running ? (
          <p className="mt-3 rounded-lg bg-dc-canvas px-3 py-2">
            {total === null ? "กำลังอ่านหัวข้อจาก hdc_topics…" : `ทำไปแล้ว ${topics.length} จาก ${total} หัวข้อ`}
          </p>
        ) : (
          (summary || stopped) && (
            <p
              className={`mt-3 rounded-lg px-3 py-2 ${summary && summary.skipped + summary.failed === 0 ? "bg-dc-brand-accent/10" : "bg-dc-gold/10"}`}
            >
              {summary
                ? `รีเฟรชจบ ${summary.topics.length} หัวข้อ: บันทึก ${summary.saved} · ข้าม ${summary.skipped} · ล้ม ${summary.failed}`
                : `หยุด: ${stopped}`}
            </p>
          )
        )}
      </div>
    </section>
  );
}
