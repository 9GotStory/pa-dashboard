"use client";

import { useEffect, useRef, useState, type ChangeEvent } from "react";
import { formatCount } from "@/lib/dc/format";
import { ageRowsTotals, populationTotals, readRegistryFiles, registryYear, villageCount } from "@/lib/dc/population";
import type {
  DcCatalog,
  GasError,
  GasRegistryPopulation,
  GasUploadAnswer,
  RegistryFileRead,
  RegistryPopulationAgeRow,
  RegistryPopulationRow,
} from "@/lib/dc/types";

// The ประชากรทะเบียนราษฎร upload of /sync, shown after the PIN (SPEC §12.1,
// ADR-0011, ADR-0014): stat_m files and age files from stat.bora are read and
// checked here by population.ts, saved one file at a time with
// save_registry_population, each year's stat_m (its ตำบล rows, then its
// หมู่บ้าน rows) before its age file, then one rebuild. The only Data Center
// component that calls GAS, since /sync is not a page of (dc)
// (CODING_STANDARDS §4).

const GAS_URL = process.env.NEXT_PUBLIC_GAS_SCRIPT_URL ?? "";

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json() as Promise<T>;
}

function postGas(body: object): Promise<GasUploadAnswer> {
  // text/plain keeps it a simple request: a GAS web app answers no CORS preflight.
  return fetchJson<GasUploadAnswer>(GAS_URL, {
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
  if (read.kind === "age") {
    const t = ageRowsTotals(read.rows);
    return `ปี ${registryYear(read.yymm)} · แถวอายุ ${read.rows.length} แถว จับคู่กับ stat_m ได้ครบ · รวม ${formatCount(t.total)} คน (ชาย ${formatCount(t.male)} หญิง ${formatCount(t.female)}) ตรงกับ stat_m`;
  }
  const t = populationTotals(read.rows);
  return `ปี ${registryYear(read.yymm)} · ${read.rows.length} แถว · รวม ${formatCount(t.total)} คน (ชาย ${formatCount(t.male)} หญิง ${formatCount(t.female)}) · บ้าน ${formatCount(t.house)} หลัง · ${villageCount(read.villages)} หมู่บ้าน (แถวหมู่บ้าน ${read.villages.length} แถว)`;
}

/** How a step of the save went: a file saved or not (or only its ตำบล rows), the rebuild requested or not */
interface Outcome {
  ok: boolean;
  partial?: boolean;
  text: string;
}

/** POST save_registry_population of the rows of one kind of a checked file (SCHEMA §3.8), what they are named for the admin */
async function saveRows(
  kind: "population" | "village" | "age",
  yymm: string,
  rows: RegistryPopulationRow[] | RegistryPopulationAgeRow[],
  what: string,
): Promise<Outcome> {
  try {
    const answer = await postGas({ action: "save_registry_population", kind, yymm, rows });
    return answer.status === "success"
      ? { ok: true, text: `บันทึก${what} ${registryYear(yymm)} แล้ว ${answer.count} แถว` }
      : { ok: false, text: `GAS ไม่บันทึก${what}: ${answer.message}` };
  } catch (err) {
    return { ok: false, text: `ส่ง${what}ไม่สำเร็จ: ${errorText(err)}` };
  }
}

/** POST rebuild (SCHEMA §3.7), its result worded as the sync section words it */
async function rebuildSite(): Promise<Outcome> {
  try {
    const answer = await postGas({ action: "rebuild", reason: "/sync registry_population" });
    if (answer.status !== "success") throw new Error(answer.message);
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
  const [sheetYears, setSheetYears] = useState<Loaded<Record<"population" | "age", string[]>>>({ state: "loading" });
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

  // The years each sheet has rows of (SCHEMA §3.9), read again after a save
  // or a retry. Busy comes back as an error to retry (SCHEMA §3.9).
  useEffect(() => {
    if (!GAS_URL) return;
    let ignore = false;
    fetchJson<GasRegistryPopulation | GasError>(`${GAS_URL}?action=registry_population`)
      .then((answer) => {
        if ("status" in answer) throw new Error(answer.message);
        if (!Array.isArray(answer.years)) throw new Error("คำตอบของ GAS ไม่มี years");
        const yearsOf = (kind: "population" | "age") =>
          answer.years.filter((y) => y[kind].length > 0).map((y) => registryYear(y.yymm));
        return { population: yearsOf("population"), age: yearsOf("age") };
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
    // Every stat_m before the age files, and of a stat_m its ตำบล rows before
    // its หมู่บ้าน rows (SPEC §12.1): GAS checks both age and village rows
    // against the registry_population rows of their year (SCHEMA §3.8), so
    // neither is sent unless the ตำบล rows of their year were saved.
    const isAge = ({ read }: Picked) => read.ok && read.kind === "age";
    const statMFirst = [...picked.entries()].sort(([, a], [, b]) => Number(isAge(a)) - Number(isAge(b)));
    const savedYears = new Set<string>(); // the yymm of each stat_m whose ตำบล rows were saved
    for (const [i, { read }] of statMFirst) {
      let outcome: Outcome;
      if (!read.ok) {
        outcome = { ok: false, text: `ไม่ส่ง: ${read.reason}` };
      } else if (read.kind === "age") {
        outcome = savedYears.has(read.yymm)
          ? await saveRows("age", read.yymm, read.rows, "แถวอายุปี")
          : { ok: false, text: `ไม่ส่ง: บันทึก stat_m ของปี ${registryYear(read.yymm)} ไม่สำเร็จ` };
      } else {
        const tambons = await saveRows("population", read.yymm, read.rows, "ปี");
        if (tambons.ok) savedYears.add(read.yymm);
        const villages = tambons.ok ? await saveRows("village", read.yymm, read.villages, "แถวหมู่บ้านปี") : null;
        outcome = !villages
          ? tambons
          : villages.ok
            ? { ok: true, text: `${tambons.text} · ${villages.text}` }
            : { ok: false, partial: true, text: `${tambons.text} · ${villages.text} เลือกไฟล์นี้อีกครั้งเพื่อบันทึกแถวหมู่บ้าน` };
      }
      anySaved ||= outcome.ok || outcome.partial === true;
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
    <section
      aria-labelledby="registry-population"
      className="dc mt-6 rounded-xl border border-dc-border-subtle bg-white p-6 font-dc text-sm text-dc-brand-deep"
    >
      <h2 id="registry-population" className="font-prompt text-lg font-bold text-dc-brand-deep">
        ประชากรทะเบียนราษฎร (กรมการปกครอง)
      </h2>
      <p className="mt-2 text-dc-text-secondary">
        ดาวน์โหลดไฟล์ <code>stat_m{"{ปี}"}.txt</code> จาก{" "}
        <a
          href="https://stat.bora.dopa.go.th/"
          target="_blank"
          rel="noopener noreferrer"
          className="font-semibold text-dc-brand-primary underline underline-offset-2"
        >
          stat.bora
        </a>{" "}
        เมนู ดาวน์โหลดสถิติ → จำนวนประชากร → ปี → ระดับหมู่บ้าน Text File เช่น <code>stat_m68.txt</code> คือยอด ณ 31 ธ.ค. 2568 (ไฟล์{" "}
        <code>stat_t</code> ระดับตำบลไม่มีหมู่บ้าน จึงใช้ไม่ได้) และไฟล์อายุ{" "}
        <code>
          {"{ปี}"}12cc{"{จังหวัด}"}.txt
        </code>{" "}
        เมนู ดาวน์โหลดสถิติ → จำนวนประชากรแยกรายอายุ → ปี → จังหวัด เช่น <code>6812cc54.txt</code> ซึ่งต้องเลือกพร้อม stat_m
        ของปีเดียวกัน เลือกได้หลายปีพร้อมกัน ระบบตรวจไฟล์ก่อนส่ง และบันทึกปีเดิมซ้ำจะแทนที่ของเดิม ยกเว้นปีที่มีแถวอายุแล้วและตัวเลขเปลี่ยน
        ต้องลบแถวของปีนั้นในชีต <code>registry_population_age</code> ก่อน แล้วเลือกทั้งสองไฟล์ใหม่พร้อมกัน
      </p>

      <div className="mt-3 rounded-lg bg-dc-canvas px-3 py-2">
        {!GAS_URL ? (
          <p>ไม่ได้ตั้ง NEXT_PUBLIC_GAS_SCRIPT_URL จึงอ่านและบันทึกกับ GAS ไม่ได้</p>
        ) : sheetYears.state === "loading" ? (
          <p>กำลังอ่านปีที่มีในชีต…</p>
        ) : sheetYears.state === "failed" ? (
          <p>
            อ่านปีที่มีในชีตไม่ได้: {sheetYears.error}{" "}
            <button
              type="button"
              onClick={reloadYears}
              className="font-semibold text-dc-brand-primary underline underline-offset-2"
            >
              ลองอีกครั้ง
            </button>
          </p>
        ) : (
          <>
            <p>
              ปีที่มีในชีตแล้ว: {sheetYears.value.population.length > 0 ? sheetYears.value.population.join(" · ") : "ยังไม่มี"}
            </p>
            <p>ปีที่มีแถวอายุแล้ว: {sheetYears.value.age.length > 0 ? sheetYears.value.age.join(" · ") : "ยังไม่มี"}</p>
          </>
        )}
      </div>

      {district.state === "failed" ? (
        <p className="mt-4">อ่าน district_code จาก catalog.json ไม่ได้ ({district.error}) จึงตรวจไฟล์ไม่ได้</p>
      ) : (
        <div className="mt-4">
          <label htmlFor="registry-population-files" className="block font-semibold">
            เลือกไฟล์ stat_m{"{ปี}"}.txt และ {"{ปี}"}12cc{"{จังหวัด}"}.txt (เลือกได้หลายไฟล์)
          </label>
          <input
            ref={input}
            id="registry-population-files"
            type="file"
            accept=".txt"
            multiple
            onChange={pick}
            disabled={district.state !== "ready" || saving}
            className="mt-2 block w-full text-dc-brand-deep file:mr-3 file:rounded-md file:border-0 file:bg-dc-highlight-soft file:px-3 file:py-2 file:font-semibold file:text-dc-brand-deep disabled:opacity-50"
          />
        </div>
      )}

      {picked.length > 0 && (
        <ul aria-live="polite" className="mt-4 space-y-2">
          {picked.map(({ read, outcome }, i) => {
            const ok = outcome ? outcome.ok : read.ok;
            const label = outcome
              ? outcome.ok
                ? "บันทึกแล้ว"
                : outcome.partial
                  ? "บันทึกบางส่วน"
                  : "ไม่บันทึก"
              : read.ok
                ? "ผ่านการตรวจ"
                : "ไม่รับไฟล์";
            return (
              <li key={i} className="rounded-lg border border-dc-border-subtle px-3 py-2">
                <span
                  className={`mr-2 inline-block rounded px-2 py-0.5 text-xs font-bold text-dc-brand-deep ${ok ? "bg-dc-brand-accent/20" : "bg-dc-gold/30"}`}
                >
                  {label}
                </span>
                <span className="font-semibold break-all">{read.name}</span>
                <p className="mt-1">{outcome ? outcome.text : summary(read)}</p>
              </li>
            );
          })}
        </ul>
      )}

      {rebuild && (
        <p
          role="status"
          className={`mt-3 rounded-lg px-3 py-2 ${rebuild.ok ? "bg-dc-brand-accent/10" : "bg-dc-gold/10"}`}
        >
          {rebuild.text}
        </p>
      )}

      {picked.length > 0 && !finished && (
        <button
          type="button"
          onClick={save}
          disabled={saving || toSave === 0 || !GAS_URL}
          className="mt-4 rounded-lg bg-dc-brand-primary px-5 py-2.5 font-semibold text-white hover:bg-dc-brand-deep disabled:cursor-not-allowed disabled:opacity-50"
        >
          {saving ? "กำลังบันทึก…" : `บันทึก ${toSave} ไฟล์`}
        </button>
      )}
    </section>
  );
}
