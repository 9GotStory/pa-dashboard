"use client";

import { ChevronRight } from "lucide-react";
import type { RefObject } from "react";
import { reportCsv } from "@/lib/dc/csv";
import { aged9Values } from "@/lib/dc/tables/aged9";
import type { Cell, DcCatalog, DcReportData, ReportQuery } from "@/lib/dc/types";
import CountTable from "../report/CountTable";
import Detail, { useDetail } from "../report/Detail";
import { areaLabel, countText, describe } from "../report/labels";
import { CountPanel } from "../report/panels";
import QuarterFigures from "../report/QuarterFigures";
import ReportActions from "../report/ReportActions";
import ReportFilters from "../report/ReportFilters";
import ReportLoader from "../report/ReportLoader";
import ReportStatus, { NoYear } from "../report/ReportStatus";
import ResultsHeader from "../report/ResultsHeader";
import { resultsText, unitTable } from "../report/resultsText";
import { useReportQuery } from "../report/useReportQuery";

type Names = Pick<DcCatalog, "areas" | "hospitals">;
type Values = ReturnType<typeof aged9Values>;

/** The filters of the AGED9 page (SPEC §9.4): ทั้งปี only, and a ด้าน opens from ผลการคัดกรองทั้ง 9 ด้าน */
const FIELDS: (keyof ReportQuery)[] = ["year", "area", "by"];

/**
 * ผลรายงาน of s_aged9 after AGED9 V0.4.2 (SPEC §9.4): ความครอบคลุม as ANC
 * lays it out without ไตรมาส, ผลการคัดกรองทั้ง 9 ด้าน, and the รายละเอียด of
 * the ด้าน opened from it, laid out from the values of aged9Values.
 * data-table-page names the page in its chunk, which dc-check looks for in
 * the scripts other reports load.
 */
export default function Aged9Page({ id, names, years }: { id: string; names: Names; years: string[] }) {
  return (
    <div data-table-page="aged9">
      <ReportLoader id={id}>{(data) => <Aged9 data={data} names={names} years={years} />}</ReportLoader>
    </div>
  );
}

function Aged9({ data, names, years }: { data: DcReportData; names: Names; years: string[] }) {
  const { query, search, apply, push, heading } = useReportQuery(data, names);
  const { block, total, goal, units, trend, domains, detail } = aged9Values(data, query, names, years);
  const { overviewHeading, detailHeading, buttonProps, close } = useDetail(query.domain === null ? null : String(query.domain), (domain) =>
    push({ ...query, domain: domain === null ? null : Number(domain) }),
  );
  const { summary, unitLabel, totalLabel } = resultsText(data.report, query, names, null, { fields: FIELDS });
  const shown = block && { report: data.report, year: query.year, filters: summary, dateCom: block.max_date_com };
  // The unit table of the ด้าน open, or ความครอบคลุม then the 9 ด้าน (SPEC §9.4 CSV)
  const csv = !shown
    ? null
    : detail
      ? detail.count !== null && detail.units
        ? domainCsv(shown, detail.domain, [[unitLabel, "จำนวนรายการ"], ...detail.units.map((u) => [u.name, u.count]), [totalLabel, detail.count]])
        : null
      : domainCsv(shown, null, [
          ...(total && units ? unitTable(unitLabel, units, total, totalLabel) : [["ความครอบคลุม", "ไม่มีข้อมูล: ผลงานรวมทั้งอำเภอว่างทั้งปี"]]),
          [],
          ["ด้าน", "จำนวนรายการ"],
          ...domains.map((d) => [`${d.domain}. ${d.label}`, d.count ?? "—"]),
        ]);

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
        <ReportStatus>ไม่มีข้อมูลของ{areaLabel(query.area, names)}ในปี {query.year}</ReportStatus>
      ) : (
        <>
          <QuarterFigures {...{ total, goal, units, trend, unitLabel, totalLabel }} quarters={[]} year={query.year} />
          <div className="px-4 pb-6 sm:px-6">
            <Domains domains={domains} open={query.domain} headingRef={overviewHeading} buttonProps={buttonProps} />
            <Detail
              headingRef={detailHeading}
              onClose={close}
              title={detail?.label ?? null}
              eyebrow="รายละเอียดด้านที่เลือก"
              context={describe({ ...query, domain: null }, names, ["year", "area"])}
            >
              {detail && <DomainFigures detail={detail} year={query.year} unitLabel={unitLabel} totalLabel={totalLabel} />}
            </Detail>
          </div>
        </>
      )}
    </>
  );
}

/** The CSV download of a table shown, named with -domain{n} when a ด้าน is open (SPEC §9.4) */
function domainCsv(shown: Omit<Parameters<typeof reportCsv>[0], "part" | "table">, domain: number | null, table: Cell[][]) {
  return () => reportCsv({ ...shown, part: domain === null ? undefined : `domain${domain}`, table });
}

/** ผลการคัดกรองทั้ง 9 ด้าน: each ด้าน as a button with its count; headingRef and buttonProps are useDetail's */
function Domains(props: {
  domains: Values["domains"];
  open: number | null;
  headingRef: RefObject<HTMLHeadingElement | null>;
  buttonProps: ReturnType<typeof useDetail>["buttonProps"];
}) {
  const { domains, open, headingRef, buttonProps } = props;
  return (
    <section aria-labelledby="domains-title" className="overflow-hidden rounded-[9px] border border-dc-border-subtle bg-white">
      <div className="p-4">
        <h3 id="domains-title" ref={headingRef} tabIndex={-1} className="font-prompt text-base font-semibold text-dc-brand-deep focus:outline-none">
          ผลการคัดกรองทั้ง 9 ด้าน
        </h3>
        <p className="text-xs text-dc-text-secondary">จำนวนรายการจากข้อมูลต้นทาง · เลือกด้านเพื่อดูรายละเอียดรายพื้นที่</p>
      </div>
      <ul>
        {domains.map((d) => (
          <li key={d.domain} className="border-t border-dc-border-subtle">
            <button
              {...buttonProps(String(d.domain))}
              className={`grid w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-4 py-3 text-left hover:bg-dc-surface-muted ${d.domain === open ? "bg-dc-highlight-soft" : "bg-white"}`}
            >
              <span className="text-[13px] font-medium text-dc-brand-deep">
                {d.domain}. {d.label}
              </span>
              <span className="inline-flex items-center gap-1 text-[13px] font-semibold text-dc-brand-primary tabular-nums">
                {countText(d.count)}
                <span className="sr-only">{d.count === null ? "ไม่มีข้อมูล" : "รายการ"}</span>
                <ChevronRight aria-hidden="true" className="size-3.5 text-dc-text-secondary" />
              </span>
            </button>
          </li>
        ))}
      </ul>
      <p className="border-t border-dc-border-subtle px-4 py-3 text-[11px] text-dc-text-secondary">
        จำนวนรายด้านไม่ใช่อัตราความเสี่ยง ไม่ใช่ผลผ่านหรือไม่ผ่าน และไม่จำเป็นต้องเท่ากับผลงานที่คัดกรองครบ 9 ด้าน
      </p>
    </section>
  );
}

/**
 * The รายละเอียด of a ด้าน (SPEC §9.4): the warning that it is จำนวนรายการ,
 * and the count of each ตำบล or หน่วยบริการ beside its table; a note when the
 * district has no ผลงาน of it that year
 */
function DomainFigures(props: { detail: NonNullable<Values["detail"]>; year: string; unitLabel: string; totalLabel: string }) {
  const { detail, year, unitLabel, totalLabel } = props;
  return (
    <>
      {/* What a ด้าน counts (SPEC §9.4, GLOSSARY "ด้าน") */}
      <p className="mb-4 text-xs font-semibold text-dc-brand-deep">จำนวนรายการตามข้อมูลต้นทาง ไม่ใช่จำนวนผู้มีความเสี่ยง</p>
      {detail.count !== null && detail.units ? (
        <div className="grid gap-4 lg:grid-cols-2">
          <CountPanel unitLabel={unitLabel} units={detail.units} />
          <CountTable unitLabel={unitLabel} units={detail.units} total={detail.count} totalLabel={totalLabel} />
        </div>
      ) : (
        <p className="text-sm text-dc-text-secondary">
          ไม่มีข้อมูลด้าน{detail.label} ในปีงบประมาณ {year}: ผลงานรวมทั้งอำเภอว่างทั้งปี
        </p>
      )}
    </>
  );
}
