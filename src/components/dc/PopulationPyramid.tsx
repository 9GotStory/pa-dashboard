"use client";

import { RotateCcw } from "lucide-react";
import { useState } from "react";
import { formatCount, formatPct } from "@/lib/dc/format";
import type { AgeProfile, UnsplitGroup } from "@/lib/dc/types";

// The columns of a ช่วงอายุ row and of the header above the rows: ชาย bar,
// ชาย figure, ช่วงอายุ, หญิง figure, หญิง bar. The figures keep their width
// at 320px, so they never hide; the bars take what is left.
const ROW_GRID =
  "grid grid-cols-[minmax(0,1fr)_2.75rem_2.75rem_2.75rem_minmax(0,1fr)] items-center gap-1 sm:grid-cols-[minmax(0,1fr)_3.25rem_3.5rem_3.25rem_minmax(0,1fr)] sm:gap-2";

// The name of each kind of ประชากรที่ไม่แยกอายุ, in the order SCHEMA §11.4
// lists them. Named again here, not taken from population.ts, which holds
// the /sync file reader too and so stays out of the page's JavaScript (SPEC
// §9.6).
const UNSPLIT_NAMES: Record<UnsplitGroup, string> = {
  nonthai: "ไม่ใช่สัญชาติไทย",
  central: "ทะเบียนบ้านกลาง",
  moving: "ระหว่างการย้าย",
  lunar: "เกิดปีจันทรคติ",
};

/** A ช่วงอายุ as a sentence says it: "0–4 ปี", "80 ปีขึ้นไป" (GLOSSARY) */
function bandName(label: string): string {
  return label === "80+" ? "80 ปีขึ้นไป" : `${label} ปี`;
}

/**
 * The โครงสร้างประชากร section of the home page (SPEC §9.2): the population
 * pyramid of scope, the ตำบล picked or the whole อำเภอ, labelled with source.
 * A button per ช่วงอายุ, the oldest at the top, ชาย to the left and หญิง to
 * the right on one scale, each figure by its bar. Pressing or focusing a row
 * shows its รวม and its ร้อยละ of those split by age under the rows. Beside
 * it on a wide screen, under it on a phone: the people aged 60 and over,
 * their ร้อยละ of those split by age, and the ประชากรที่ไม่แยกอายุ the
 * pyramid leaves out, by kind. Every figure but a row's รวม and ร้อยละ comes
 * as computed (AgeProfile). ล้างการเลือก calls onClear. DistrictExplorer
 * renders it, holding the ตำบล picked.
 */
export default function PopulationPyramid({
  scope,
  age,
  source,
  onClear,
}: {
  scope: string;
  age: AgeProfile;
  source: string;
  onClear: () => void;
}) {
  // The ช่วงอายุ shown, by label, so it stays when another ตำบล is picked.
  const [shown, setShown] = useState<string | null>(null);
  const band = age.bands.find((b) => b.label === shown);
  const bandTotal = band ? band.male + band.female : 0;
  const top = Math.max(...age.bands.flatMap((b) => [b.male, b.female]));
  // A bar's width as a percentage of its half: the area's largest count fills it.
  const barWidth = (count: number) => `${(count / top) * 100}%`;
  const unsplit = (Object.keys(UNSPLIT_NAMES) as UnsplitGroup[]).filter((group) => age.unsplit[group] > 0);
  const unsplitTotal = Object.values(age.unsplit).reduce((sum, count) => sum + count, 0);

  return (
    <section aria-labelledby="pyramid-title" className="min-w-0">
      <h2 id="pyramid-title" className="font-prompt text-lg font-semibold text-dc-brand-deep">
        โครงสร้างประชากร
      </h2>
      <p className="text-xs text-dc-text-secondary">ช่วงอายุ 5 ปี ชายและหญิง · {source}</p>
      <div className="mt-2 flex flex-wrap items-center justify-between gap-x-3">
        <p className="text-sm font-semibold text-dc-brand-deep">{scope}</p>
        <button
          type="button"
          onClick={onClear}
          className="inline-flex min-h-11 items-center gap-1.5 text-xs font-bold text-dc-brand-primary hover:underline"
        >
          <RotateCcw className="size-3.5" />
          ล้างการเลือก
        </button>
      </div>

      <div className="mt-1 grid gap-4 lg:grid-cols-[minmax(0,1.75fr)_minmax(16rem,0.62fr)]">
        <div className="min-w-0 rounded-[10px] border border-dc-border-subtle bg-dc-surface px-2 py-4 sm:px-5">
          <div className="mx-auto max-w-3xl">
            <p aria-hidden="true" className={`${ROW_GRID} border-b border-dc-border-subtle px-1 pb-2 text-[11px] font-bold text-dc-brand-deep sm:px-2`}>
              <span className="inline-flex items-center justify-end gap-1.5">
                <i className="inline-block size-2.5 rounded-sm bg-dc-pyramid-male" />
                ชาย
              </span>
              <span className="text-right font-normal text-dc-text-secondary">คน</span>
              <span className="text-center">อายุ</span>
              <span className="font-normal text-dc-text-secondary">คน</span>
              <span className="inline-flex items-center gap-1.5">
                หญิง
                <i className="inline-block size-2.5 rounded-sm bg-dc-pyramid-female" />
              </span>
            </p>
            <div role="group" aria-label={`พีระมิดประชากร ${scope} · ${source}`} className="mt-1 grid gap-px">
              {[...age.bands].reverse().map((b) => (
                <button
                  key={b.label}
                  type="button"
                  aria-pressed={b.label === shown}
                  aria-label={`ช่วงอายุ ${bandName(b.label)} ชาย ${formatCount(b.male)} คน หญิง ${formatCount(b.female)} คน · ${scope}`}
                  onClick={() => setShown(b.label)}
                  onFocus={() => setShown(b.label)}
                  className={`${ROW_GRID} min-h-7 rounded-md px-1 text-[11px] tabular-nums sm:px-2 sm:text-xs ${
                    b.label === shown ? "bg-dc-highlight-soft" : "hover:bg-dc-canvas"
                  }`}
                >
                  <span aria-hidden="true" className="flex h-3.5 justify-end overflow-hidden rounded-sm bg-dc-surface-muted">
                    <span className="block h-full bg-dc-pyramid-male" style={{ width: barWidth(b.male) }} />
                  </span>
                  <span className="text-right font-semibold text-dc-brand-deep">{formatCount(b.male)}</span>
                  <span className="text-center text-dc-text-secondary">{b.label}</span>
                  <span className="text-left font-semibold text-dc-brand-deep">{formatCount(b.female)}</span>
                  <span aria-hidden="true" className="flex h-3.5 overflow-hidden rounded-sm bg-dc-surface-muted">
                    <span className="block h-full bg-dc-pyramid-female" style={{ width: barWidth(b.female) }} />
                  </span>
                </button>
              ))}
            </div>
            <p aria-live="polite" className="mt-3 rounded-md bg-dc-surface-muted px-3 py-2 text-xs text-dc-brand-deep">
              {band
                ? `${scope} · ช่วงอายุ ${bandName(band.label)} รวม ${formatCount(bandTotal)} คน ร้อยละ ${formatPct((bandTotal / age.age_total) * 100)} ของผู้ที่แยกอายุได้`
                : "เลือกช่วงอายุเพื่อดูยอดรวมและร้อยละ"}
            </p>
          </div>
        </div>

        <div className="min-w-0 rounded-[10px] border border-dc-border-subtle bg-dc-surface px-4 py-4 sm:px-5">
          <dl>
            <dt className="text-xs font-semibold text-dc-text-secondary">อายุ 60 ปีขึ้นไป</dt>
            <dd className="mt-1 font-prompt text-[28px] leading-tight font-bold text-dc-brand-deep tabular-nums">
              {formatCount(age.aged60)} <small className="text-sm font-semibold">คน</small>
            </dd>
            <dd className="mt-3 font-prompt text-xl font-bold text-dc-brand-deep tabular-nums">ร้อยละ {formatPct(age.aged60_pct)}</dd>
            <dd aria-hidden="true" className="mt-2 h-2 overflow-hidden rounded-full bg-dc-surface-muted">
              <span className="block h-full rounded-full bg-dc-brand-accent" style={{ width: `${age.aged60_pct}%` }} />
            </dd>
            <dd className="mt-2 text-xs text-dc-text-secondary">ของ {formatCount(age.age_total)} คนที่แยกอายุได้</dd>
          </dl>
          <p className="mt-4 border-t border-dc-border-subtle pt-3 text-xs text-dc-text-secondary">
            ไม่รวมประชากรที่ไม่แยกอายุ {formatCount(unsplitTotal)} คน
            {unsplit.length > 0 && ` (${unsplit.map((group) => `${UNSPLIT_NAMES[group]} ${formatCount(age.unsplit[group])}`).join(" · ")})`}
          </p>
        </div>
      </div>
    </section>
  );
}
