"use client";

import { useEffect, useRef, useState, type ChangeEvent } from "react";
import { formatCount } from "@/lib/dc/format";
import { populationTotals, readRegistryFiles, registryYear } from "@/lib/dc/population";
import type { DcCatalog, GasRegistryPopulation, RegistryFileRead } from "@/lib/dc/types";

// The ประชากรทะเบียนราษฎร upload of /sync, shown after the PIN (SPEC §12.1,
// ADR-0011): stat_t files from stat.bora are read and checked here by
// population.ts, saved one year at a time with save_registry_population, then
// one rebuild. The only Data Center component that calls GAS, since /sync is
// not a page of (dc) (CODING_STANDARDS §4).

const GAS_URL = process.env.NEXT_PUBLIC_GAS_SCRIPT_URL ?? "";

type GasError = { status: "error"; message: string };
/** GAS's POST answers, as far as this section reads them (SCHEMA §3.7, §3.8) */
type GasAnswer = { status: "success"; count?: number; remaining_today?: number } | GasError;

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json() as Promise<T>;
}

function postGas(body: object): Promise<GasAnswer> {
  // text/plain keeps it a simple request: a GAS web app answers no CORS preflight.
  return fetchJson<GasAnswer>(GAS_URL, {
    method: "POST",
    headers: { "Content-Type": "text/plain;charset=utf-8" },
    body: JSON.stringify(body),
  });
}

function errorText(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

/** A checked file before the save: its year, rows and totals, or why it is refused */
function summary(read: RegistryFileRead): string {
  if (!read.ok) return read.reason;
  const t = populationTotals(read.rows);
  return `ปี ${registryYear(read.yymm)} · ${read.rows.length} แถว · รวม ${formatCount(t.total)} คน (ชาย ${formatCount(t.male)} หญิง ${formatCount(t.female)}) · บ้าน ${formatCount(t.house)} หลัง`;
}

/** How a step of the save went: a file saved or not, the rebuild requested or not */
interface Outcome {
  ok: boolean;
  text: string;
}

/** POST save_registry_population of one checked file (SCHEMA §3.8) */
async function saveYear(read: Extract<RegistryFileRead, { ok: true }>): Promise<Outcome> {
  try {
    const answer = await postGas({ action: "save_registry_population", kind: "population", yymm: read.yymm, rows: read.rows });
    return answer.status === "success"
      ? { ok: true, text: `บันทึกปี ${registryYear(read.yymm)} แล้ว ${answer.count} แถว` }
      : { ok: false, text: `GAS ไม่บันทึก: ${answer.message}` };
  } catch (err) {
    return { ok: false, text: `ส่งไม่สำเร็จ: ${errorText(err)}` };
  }
}

/** POST rebuild (SCHEMA §3.7), its result worded as the sync section words it */
async function rebuildSite(): Promise<Outcome> {
  try {
    const answer = await postGas({ action: "rebuild", reason: "/sync registry_population" });
    if (answer.status !== "success") throw new Error(answer.message || "Unknown GAS Error");
    return { ok: true, text: `สั่ง rebuild แล้ว วันนี้สั่งได้อีก ${answer.remaining_today} ครั้ง` };
  } catch (err) {
    return { ok: false, text: `ไม่ได้สั่ง rebuild: ${errorText(err)}` };
  }
}

type Loaded<T> = { state: "loading" } | { state: "ready"; value: T } | { state: "failed"; error: string };

/** A picked file: how it read, and once the save reached it, how that went */
interface Picked {
  read: RegistryFileRead;
  outcome?: Outcome;
}

export default function RegistryPopulationUpload() {
  const [district, setDistrict] = useState<Loaded<string>>({ state: "loading" });
  const [sheetYears, setSheetYears] = useState<Loaded<string[]>>({ state: "loading" });
  const [attempt, setAttempt] = useState(0);
  const [picked, setPicked] = useState<Picked[]>([]);
  const [rebuild, setRebuild] = useState<Outcome | null>(null);
  const [saving, setSaving] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  // district_code from the site's own catalog.json, so files are checked
  // without asking GAS (SCHEMA §11.2).
  useEffect(() => {
    let ignore = false;
    fetchJson<Pick<DcCatalog, "meta">>("/data/catalog.json").then(
      (catalog) => {
        if (!ignore) setDistrict({ state: "ready", value: catalog.meta.district_code });
      },
      (err) => {
        if (!ignore) setDistrict({ state: "failed", error: errorText(err) });
      },
    );
    return () => {
      ignore = true;
    };
  }, []);

  // The years registry_population has (SCHEMA §3.9), read again after a save
  // or a retry. Busy comes back as an error to retry (SCHEMA §3.9).
  useEffect(() => {
    if (!GAS_URL) return;
    let ignore = false;
    fetchJson<GasRegistryPopulation | GasError>(`${GAS_URL}?action=registry_population`)
      .then((answer) => {
        if ("status" in answer) throw new Error(answer.message);
        if (!Array.isArray(answer.years)) throw new Error("คำตอบของ GAS ไม่มี years");
        return answer.years.filter((y) => y.population.length > 0).map((y) => registryYear(y.yymm));
      })
      .then(
        (years) => {
          if (!ignore) setSheetYears({ state: "ready", value: years });
        },
        (err) => {
          if (!ignore) setSheetYears({ state: "failed", error: errorText(err) });
        },
      );
    return () => {
      ignore = true;
    };
  }, [attempt]);

  function reloadYears() {
    setSheetYears({ state: "loading" });
    setAttempt((n) => n + 1);
  }

  async function pick(e: ChangeEvent<HTMLInputElement>) {
    if (district.state !== "ready") return;
    const files = Array.from(e.target.files ?? []);
    const texts = await Promise.all(files.map(async (file) => ({ name: file.name, text: await file.text() })));
    setRebuild(null);
    setPicked(readRegistryFiles(texts, district.value).map((read) => ({ read })));
  }

  async function save() {
    setSaving(true);
    let anySaved = false;
    for (const [i, { read }] of picked.entries()) {
      const outcome = read.ok ? await saveYear(read) : { ok: false, text: `ไม่ส่ง: ${read.reason}` };
      anySaved ||= outcome.ok;
      setPicked((prev) => prev.map((p, j) => (j === i ? { ...p, outcome } : p)));
    }
    // One rebuild of the website when any year was saved (SPEC §12.1): the
    // years are saved either way.
    if (anySaved) {
      setRebuild(await rebuildSite());
      reloadYears();
    }
    // Cleared so that picking the same files again, to retry, is a change.
    if (input.current) input.current.value = "";
    setSaving(false);
  }

  const toSave = picked.filter((p) => p.read.ok).length;
  const finished = !saving && picked.some((p) => p.outcome);

  return (
    <section aria-labelledby="registry-population" className="dc mt-6 rounded-xl border border-dc-border bg-white p-6 font-dc text-sm text-dc-ink">
      <h2 id="registry-population" className="font-prompt text-lg font-bold text-dc-navy">
        ประชากรทะเบียนราษฎร (กรมการปกครอง)
      </h2>
      <p className="mt-2 text-dc-muted">
        ดาวน์โหลดไฟล์ <code>stat_t{"{ปี}"}.txt</code> จาก{" "}
        <a href="https://stat.bora.dopa.go.th/" target="_blank" rel="noopener noreferrer" className="font-semibold text-dc-blue underline underline-offset-2">
          stat.bora
        </a>{" "}
        เมนู ดาวน์โหลดสถิติ → จำนวนประชากร → ปี → ระดับตำบล Text File เช่น <code>stat_t68.txt</code> คือยอด ณ 31 ธ.ค. 2568
        เลือกได้หลายปีพร้อมกัน ระบบตรวจไฟล์ก่อนส่ง และบันทึกปีเดิมซ้ำจะแทนที่ของเดิม
      </p>

      <div className="mt-3 rounded-lg bg-dc-canvas px-3 py-2">
        {!GAS_URL ? (
          <p>ไม่ได้ตั้ง NEXT_PUBLIC_GAS_SCRIPT_URL จึงอ่านและบันทึกกับ GAS ไม่ได้</p>
        ) : sheetYears.state === "loading" ? (
          <p>กำลังอ่านปีที่มีในชีต…</p>
        ) : sheetYears.state === "failed" ? (
          <p>
            อ่านปีที่มีในชีตไม่ได้: {sheetYears.error}{" "}
            <button type="button" onClick={reloadYears} className="font-semibold text-dc-blue underline underline-offset-2">
              ลองอีกครั้ง
            </button>
          </p>
        ) : (
          <p>ปีที่มีในชีตแล้ว: {sheetYears.value.length > 0 ? sheetYears.value.join(" · ") : "ยังไม่มี"}</p>
        )}
      </div>

      {district.state === "failed" ? (
        <p className="mt-4">อ่าน district_code จาก catalog.json ไม่ได้ ({district.error}) จึงตรวจไฟล์ไม่ได้</p>
      ) : (
        <div className="mt-4">
          <label htmlFor="registry-population-files" className="block font-semibold">
            เลือกไฟล์ stat_t{"{ปี}"}.txt (เลือกได้หลายไฟล์)
          </label>
          <input
            ref={input}
            id="registry-population-files"
            type="file"
            accept=".txt"
            multiple
            onChange={pick}
            disabled={district.state !== "ready" || saving}
            className="mt-2 block w-full text-dc-ink file:mr-3 file:rounded-md file:border-0 file:bg-dc-blue-light file:px-3 file:py-2 file:font-semibold file:text-dc-blue-dark disabled:opacity-50"
          />
        </div>
      )}

      {picked.length > 0 && (
        <ul aria-live="polite" className="mt-4 space-y-2">
          {picked.map(({ read, outcome }, i) => {
            const ok = outcome ? outcome.ok : read.ok;
            return (
              <li key={i} className="rounded-lg border border-dc-border px-3 py-2">
                <span className={`mr-2 inline-block rounded px-2 py-0.5 text-xs font-bold text-dc-navy ${ok ? "bg-dc-teal/20" : "bg-dc-gold/30"}`}>
                  {outcome ? (outcome.ok ? "บันทึกแล้ว" : "ไม่บันทึก") : read.ok ? "ผ่านการตรวจ" : "ไม่รับไฟล์"}
                </span>
                <span className="font-semibold break-all">{read.name}</span>
                <p className="mt-1">{outcome ? outcome.text : summary(read)}</p>
              </li>
            );
          })}
        </ul>
      )}

      {rebuild && (
        <p role="status" className={`mt-3 rounded-lg px-3 py-2 ${rebuild.ok ? "bg-dc-teal/10" : "bg-dc-gold/10"}`}>
          {rebuild.text}
        </p>
      )}

      {picked.length > 0 && !finished && (
        <button
          type="button"
          onClick={save}
          disabled={saving || toSave === 0 || !GAS_URL}
          className="mt-4 rounded-lg bg-dc-blue px-5 py-2.5 font-semibold text-white hover:bg-dc-blue-dark disabled:cursor-not-allowed disabled:opacity-50"
        >
          {saving ? "กำลังบันทึก…" : `บันทึก ${toSave} ปี`}
        </button>
      )}
    </section>
  );
}
