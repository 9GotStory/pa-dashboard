"use client";

import { reportCsv } from "@/lib/dc/csv";
import { formatCount } from "@/lib/dc/format";
import { cavityValues } from "@/lib/dc/tables/cavity";
import type { Cell, DcCatalog, DcReportData, ReportQuery } from "@/lib/dc/types";
import { areaLabel, goalText, passText, pctText } from "../report/labels";
import { UnitPanel } from "../report/panels";
import ReportActions from "../report/ReportActions";
import ReportFilters from "../report/ReportFilters";
import ReportLoader from "../report/ReportLoader";
import ReportStatus, { NoYear } from "../report/ReportStatus";
import ResultsHeader from "../report/ResultsHeader";
import { resultsText } from "../report/resultsText";
import { useReportQuery } from "../report/useReportQuery";

type Names = Pick<DcCatalog, "areas" | "hospitals">;
type Values = ReturnType<typeof cavityValues>;
type Funnel = NonNullable<Values["funnel"]>;
type Units = NonNullable<Values["units"]>;

/** The filters of the กรวยปีเดียว page (SPEC §9.4): no ช่วงเวลา, as the table has ทั้งปี alone */
const FIELDS: (keyof ReportQuery)[] = ["year", "area", "by"];

/** The columns of the unit table and its CSV, after the unit's name */
const COLUMNS = ["เด็ก 0–5 ปี", "ตรวจช่องปาก", "ฟันดีไม่มีผุ", "ร้อยละตรวจช่องปาก", "ร้อยละฟันดีไม่มีผุ"];

/**
 * ผลรายงาน of s_dental_0_5_cavity_free (SPEC §9.4): the กรวย เด็ก 0–5 ปี →
 * ตรวจช่องปาก → ฟันดีไม่มีผุ with its two ร้อยละ, and ร้อยละฟันดีไม่มีผุ
 * รายตำบลหรือรายหน่วยบริการ beside the table of c/b/a; no แนวโน้ม, as the
 * table has one year. data-table-page names the page in its chunk, which
 * dc-check looks for in the scripts other reports load.
 */
export default function CavityPage({ id, names }: { id: string; names: Names; years: string[] }) {
  return (
    <div data-table-page="cavity">
      <ReportLoader id={id}>{(data) => <Cavity data={data} names={names} />}</ReportLoader>
    </div>
  );
}

function Cavity({ data, names }: { data: DcReportData; names: Names }) {
  const { query, search, apply, heading } = useReportQuery(data, names);
  const { block, goal, passed, funnel, units } = cavityValues(data, query, names);
  const { summary, unitLabel, totalLabel } = resultsText(data.report, query, names, null, { fields: FIELDS });
  const csv =
    block && funnel && units
      ? () =>
          reportCsv({
            report: data.report,
            year: query.year,
            filters: summary,
            dateCom: block.max_date_com,
            table: [
              [unitLabel, ...COLUMNS],
              ...units.map((u) => [u.name, ...cells(u.funnel)]),
              [totalLabel, ...cells(funnel)],
            ],
          })
      : null;

  return (
    <>
      {/* Remounted when the query changes (แสดงผล, back, forward), so the form shows what the results show */}
      <ReportFilters key={search} data={data} names={names} query={query} onApply={apply} fields={FIELDS} />
      <ResultsHeader heading={heading} summary={summary} dateCom={block ? block.max_date_com : null}>
        <ReportActions csv={csv} />
      </ResultsHeader>
      {!block ? (
        <NoYear year={query.year} />
      ) : units?.length === 0 ? (
        <ReportStatus>
          ไม่มีข้อมูลของ{areaLabel(query.area, names)}ในปี {query.year}
        </ReportStatus>
      ) : !funnel || !units ? (
        <ReportStatus>ไม่มีข้อมูลในปีงบประมาณ {query.year}: ผลงานรวมทั้งอำเภอว่างทั้งปี</ReportStatus>
      ) : (
        <div className="px-4 pb-6 sm:px-6">
          <FunnelSummary funnel={funnel} goal={goal} passed={passed} />
          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            <UnitPanel unitLabel={unitLabel} units={units} goal={goal} pctLabel="ร้อยละฟันดีไม่มีผุ" />
            <CavityTable unitLabel={unitLabel} units={units} funnel={funnel} totalLabel={totalLabel} />
          </div>
        </div>
      )}
    </>
  );
}

/** The cells of a กรวย after its unit's name: counts as numbers for the CSV, which the table formats */
function cells(f: Funnel): Cell[] {
  return [f.children, f.screened, f.cavityFree, pctText(f.screenedPct), pctText(f.cavityFreePct)];
}

/** A cell as the table shows it */
function cellText(v: Cell) {
  return typeof v === "number" ? formatCount(v) : v;
}

/**
 * The กรวย of the area as ตัวเลขสรุป: each step in คน with a bar against
 * เด็ก 0–5 ปี, then ร้อยละฟันดีไม่มีผุ (the report's ร้อยละ) against the
 * เกณฑ์ and ร้อยละตรวจช่องปาก, which has none
 */
function FunnelSummary(props: { funnel: Funnel; goal: number | null; passed: boolean | null }) {
  const { funnel, goal, passed } = props;
  const steps = [
    { label: "เด็ก 0–5 ปี", column: "c", count: funnel.children },
    { label: "ตรวจช่องปาก", column: "b", count: funnel.screened },
    { label: "ฟันดีไม่มีผุ", column: "a", count: funnel.cavityFree },
  ];
  return (
    <div className="grid gap-3 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
      <section
        aria-labelledby="cavity-funnel"
        className="min-w-0 rounded-lg border border-dc-border-subtle bg-dc-canvas/40 px-4 py-3"
      >
        <h3 id="cavity-funnel" className="mb-2 font-prompt text-sm font-semibold text-dc-brand-deep">
          กรวยฟันดีไม่มีผุ
        </h3>
        <ol className="grid gap-2.5">
          {steps.map((s) => (
            <li key={s.column}>
              <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                <span className="text-xs text-dc-text-secondary">
                  {s.label} ({s.column})
                </span>
                <span className="font-prompt text-xl font-semibold text-dc-brand-deep tabular-nums">
                  {formatCount(s.count)} <span className="text-xs font-normal text-dc-text-secondary">คน</span>
                </span>
              </div>
              <span aria-hidden="true" className="mt-1 block h-2.5 rounded-full bg-dc-surface-muted">
                <span
                  className="block h-full rounded-full bg-dc-brand-accent"
                  style={{ width: `${funnel.children > 0 ? (s.count / funnel.children) * 100 : 0}%` }}
                />
              </span>
            </li>
          ))}
        </ol>
      </section>
      <dl className="grid grid-cols-2 gap-3 lg:grid-cols-1">
        <div className="min-w-0 rounded-lg border border-dc-border-subtle bg-dc-canvas/40 px-4 py-3">
          <dt className="text-xs text-dc-text-secondary">ร้อยละฟันดีไม่มีผุ (a ÷ b)</dt>
          <dd className="font-prompt text-2xl font-semibold text-dc-brand-deep tabular-nums">
            {pctText(funnel.cavityFreePct)}
          </dd>
          <dd className="text-xs text-dc-text-secondary">เกณฑ์ {goalText(goal)}</dd>
          {passed !== null && (
            <dd
              className={`mt-1 inline-block rounded px-2 py-0.5 text-xs font-bold text-dc-brand-deep ${passed ? "bg-dc-brand-accent/20" : "bg-dc-gold/30"}`}
            >
              {passText(passed)}
            </dd>
          )}
        </div>
        <div className="min-w-0 rounded-lg border border-dc-border-subtle bg-dc-canvas/40 px-4 py-3">
          <dt className="text-xs text-dc-text-secondary">ร้อยละตรวจช่องปาก (b ÷ c)</dt>
          <dd className="font-prompt text-2xl font-semibold text-dc-brand-deep tabular-nums">
            {pctText(funnel.screenedPct)}
          </dd>
          <dd className="text-xs text-dc-text-secondary">ไม่มีเกณฑ์</dd>
        </div>
      </dl>
    </div>
  );
}

/** c, b and a of each ตำบล or หน่วยบริการ with both ร้อยละ and the total row, scrolling sideways in its own frame (SPEC §9.1) */
function CavityTable(props: { unitLabel: string; units: Units; funnel: Funnel; totalLabel: string }) {
  const { unitLabel, units, funnel, totalLabel } = props;
  return (
    <section className="min-w-0">
      <div
        role="region"
        tabIndex={0}
        aria-label={`ตารางราย${unitLabel} (เลื่อนดูแนวนอนได้)`}
        className="overflow-x-auto rounded-[9px] border border-dc-border-subtle"
      >
        <table className="w-full border-collapse text-xs tabular-nums">
          <caption className="bg-white px-4 pt-4 pb-3 text-left font-prompt text-sm font-semibold text-dc-brand-deep">
            เด็ก 0–5 ปี ตรวจช่องปาก และฟันดีไม่มีผุราย{unitLabel}
          </caption>
          <thead className="bg-dc-highlight-soft text-dc-brand-deep">
            <tr>
              <th scope="col" className="px-2 py-2 text-left whitespace-nowrap sm:px-3">
                {unitLabel}
              </th>
              {COLUMNS.map((c) => (
                <th key={c} scope="col" className="px-2 py-2 text-right whitespace-nowrap sm:px-3">
                  {c}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="bg-white">
            {units.map((u) => (
              <tr key={u.key} className="border-t border-dc-border-subtle">
                <th scope="row" className="px-2 py-2 text-left font-normal whitespace-nowrap sm:px-3">
                  {u.name}
                </th>
                {cells(u.funnel).map((v, i) => (
                  <td key={COLUMNS[i]} className="px-2 py-2 text-right whitespace-nowrap sm:px-3">
                    {cellText(v)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
          <tfoot className="bg-dc-canvas font-bold">
            <tr className="border-t-2 border-dc-border-subtle">
              <th scope="row" className="px-2 py-2 text-left whitespace-nowrap sm:px-3">
                {totalLabel}
              </th>
              {cells(funnel).map((v, i) => (
                <td key={COLUMNS[i]} className="px-2 py-2 text-right whitespace-nowrap sm:px-3">
                  {cellText(v)}
                </td>
              ))}
            </tr>
          </tfoot>
        </table>
      </div>
    </section>
  );
}
