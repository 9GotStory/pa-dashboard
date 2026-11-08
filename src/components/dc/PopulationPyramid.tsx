import { formatCount, formatPct } from "@/lib/dc/format";
import type { AgeProfile, UnsplitGroup } from "@/lib/dc/types";

const ROW = 24;
// The two halves of the chart as a percentage of its width: ชาย bars grow
// left and หญิง bars right from the ช่วงอายุ in the middle. No viewBox, so the
// text keeps its CSS size at any width.
const HALF = 43;

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
 * The population pyramid of the home page (SPEC §9.2), after R6's: ชาย and
 * หญิง of each ช่วงอายุ on one scale, ชาย to the left, หญิง to the right and
 * the oldest at the top. Its header names the area as the panel does
 * (areaName) and the year with source, then the people aged 60 and over and
 * their ร้อยละ of those the bars count; below, the ประชากรที่ไม่แยกอายุ the
 * bars leave out, by kind. DistrictExplorer renders it under the ตำบล table
 * for the area picked.
 */
export default function PopulationPyramid({ areaName, age, source }: { areaName: string; age: AgeProfile; source: string }) {
  const top = Math.max(...age.bands.flatMap((b) => [b.male, b.female]));
  // A bar's width as a percentage of its half: the area's largest count fills it.
  const barWidth = (count: number) => (count / top) * 100;
  const unsplit = (Object.keys(UNSPLIT_NAMES) as UnsplitGroup[]).filter((group) => age.unsplit[group] > 0);
  const unsplitTotal = Object.values(age.unsplit).reduce((sum, count) => sum + count, 0);
  const label =
    `พีระมิดประชากร ${areaName} ${source}: อายุ 60 ปีขึ้นไป ${formatCount(age.aged60)} คน ร้อยละ ${formatPct(age.aged60_pct)} · ` +
    age.bands.map((b) => `${bandName(b.label)} ชาย ${formatCount(b.male)} หญิง ${formatCount(b.female)}`).join(", ");

  return (
    <section aria-labelledby="pyramid-title" className="overflow-hidden rounded-[10px] border border-dc-border bg-white">
      <div className="flex flex-col gap-2 border-b border-dc-border px-4 py-4 sm:flex-row sm:items-start sm:justify-between sm:px-5">
        <div>
          <h2 id="pyramid-title" className="font-prompt text-lg font-semibold text-dc-navy">
            พีระมิดประชากร
          </h2>
          <p className="text-xs text-dc-muted">
            <span className="font-semibold text-dc-blue-dark">{areaName}</span> · ช่วงอายุ 5 ปี ชายและหญิง
          </p>
        </div>
        <p className="self-start rounded border border-dc-border bg-dc-canvas px-2.5 py-1.5 text-[11px] font-bold text-dc-muted">
          {source}
        </p>
      </div>

      <div className="mx-auto max-w-2xl px-4 py-4 sm:px-5">
        <dl className="flex flex-wrap items-baseline gap-x-2.5">
          <dt className="text-xs font-semibold text-dc-muted">อายุ 60 ปีขึ้นไป</dt>
          <dd className="font-prompt text-xl font-bold text-dc-navy">
            {formatCount(age.aged60)} <small className="text-sm font-semibold">คน</small>
          </dd>
          <dd className="text-xs text-dc-muted">
            ร้อยละ {formatPct(age.aged60_pct)} ของ {formatCount(age.age_total)} คนในพีระมิด
          </dd>
        </dl>

        <div className="mt-3">
          <p className="mb-2 flex flex-wrap gap-x-4 text-[11px] text-dc-muted">
            <span className="inline-flex items-center gap-1.5">
              <i aria-hidden="true" className="inline-block h-2 w-4 rounded-sm bg-dc-teal" />
              ชาย
            </span>
            <span className="inline-flex items-center gap-1.5">
              <i aria-hidden="true" className="inline-block h-2 w-4 rounded-sm bg-dc-gold" />
              หญิง
            </span>
            <span>หน่วย: คน</span>
          </p>
          <svg role="img" aria-label={label} width="100%" height={age.bands.length * ROW} className="block text-xs">
            {[...age.bands].reverse().map((b, i) => (
              <g key={b.label}>
                <svg y={i * ROW + 4} width={`${HALF}%`} height={ROW - 8}>
                  <title>{`ชาย ${bandName(b.label)} ${formatCount(b.male)} คน`}</title>
                  <rect width="100%" height="100%" rx="3" className="fill-dc-canvas" />
                  <rect x={`${100 - barWidth(b.male)}%`} width={`${barWidth(b.male)}%`} height="100%" rx="3" className="fill-dc-teal" />
                </svg>
                <text x="50%" y={i * ROW + ROW / 2} dominantBaseline="middle" textAnchor="middle" className="fill-dc-ink tabular-nums">
                  {b.label}
                </text>
                <svg x={`${100 - HALF}%`} y={i * ROW + 4} width={`${HALF}%`} height={ROW - 8}>
                  <title>{`หญิง ${bandName(b.label)} ${formatCount(b.female)} คน`}</title>
                  <rect width="100%" height="100%" rx="3" className="fill-dc-canvas" />
                  <rect width={`${barWidth(b.female)}%`} height="100%" rx="3" className="fill-dc-gold" />
                </svg>
              </g>
            ))}
          </svg>
          <p className="mt-2 flex justify-between border-t border-dc-border pt-2 text-[11px] text-dc-muted">
            <span>
              <span aria-hidden="true">← </span>ชาย
            </span>
            <span>ช่วงอายุ (ปี)</span>
            <span>
              หญิง<span aria-hidden="true"> →</span>
            </span>
          </p>
        </div>

        <p className="mt-3 text-xs text-dc-muted">
          ไม่รวมประชากรที่ไม่แยกอายุ {formatCount(unsplitTotal)} คน
          {unsplit.length > 0 && ` (${unsplit.map((group) => `${UNSPLIT_NAMES[group]} ${formatCount(age.unsplit[group])}`).join(" · ")})`}
        </p>
      </div>
    </section>
  );
}
