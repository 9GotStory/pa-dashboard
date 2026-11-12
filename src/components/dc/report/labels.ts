import { formatCount, formatPct } from "@/lib/dc/format";
import type { DcCatalog, Period, ReportQuery } from "@/lib/dc/types";
import { measureLabel } from "@/lib/dc/values";

// The words the report pages share: the names of ช่วงเวลา and เปรียบเทียบตาม,
// counts, ร้อยละ, เกณฑ์ and ผลประเมิน as shown, and the filters in one line.

type Names = Pick<DcCatalog, "areas" | "hospitals">;

/** ช่วงเวลา as the form lists it (name) and as a chart axis shortens it (short) */
export const PERIOD_LABELS: Record<Period, { name: string; short: string }> = {
  year: { name: "ทั้งปี", short: "ทั้งปี" },
  q1: { name: "ไตรมาส 1 (ต.ค.–ธ.ค.)", short: "ไตรมาส 1" },
  q2: { name: "ไตรมาส 2 (ม.ค.–มี.ค.)", short: "ไตรมาส 2" },
  q3: { name: "ไตรมาส 3 (เม.ย.–มิ.ย.)", short: "ไตรมาส 3" },
  q4: { name: "ไตรมาส 4 (ก.ค.–ก.ย.)", short: "ไตรมาส 4" },
  m10: { name: "ตุลาคม", short: "ต.ค." },
  m11: { name: "พฤศจิกายน", short: "พ.ย." },
  m12: { name: "ธันวาคม", short: "ธ.ค." },
  m01: { name: "มกราคม", short: "ม.ค." },
  m02: { name: "กุมภาพันธ์", short: "ก.พ." },
  m03: { name: "มีนาคม", short: "มี.ค." },
  m04: { name: "เมษายน", short: "เม.ย." },
  m05: { name: "พฤษภาคม", short: "พ.ค." },
  m06: { name: "มิถุนายน", short: "มิ.ย." },
  m07: { name: "กรกฎาคม", short: "ก.ค." },
  m08: { name: "สิงหาคม", short: "ส.ค." },
  m09: { name: "กันยายน", short: "ก.ย." },
};

/** What เปรียบเทียบตาม compares by */
export const UNIT_LABELS: Record<ReportQuery["by"], string> = { area: "ตำบล", hosp: "หน่วยบริการ" };

/** เป้าหมาย or ผลงาน as shown, "—" without data (SPEC §9.4) */
export function countText(n: number | null): string {
  return n === null ? "—" : formatCount(n);
}

/** ร้อยละ as shown, "—" when the เป้าหมาย is 0 (SPEC §9.4) */
export function pctText(pct: number | null): string {
  return pct === null ? "—" : formatPct(pct);
}

export function areaLabel(area: string, names: Names): string {
  return area === "all" ? "ทั้งอำเภอ" : `ตำบล${names.areas.find((a) => a.id === area)?.name_th}`;
}

/** เกณฑ์ as shown: "ไม่มีเกณฑ์" for a รายการ without one (SPEC §9.4) */
export function goalText(goal: number | null): string {
  return goal === null ? "ไม่มีเกณฑ์" : `≥ ${goal}`;
}

/** ผลประเมิน as shown: "—" without a ร้อยละ or a เกณฑ์, never ไม่ผ่าน (SPEC §9.4) */
export function passText(passed: boolean | null): string {
  return passed === null ? "—" : passed ? "ผ่านเกณฑ์" : "ไม่ผ่านเกณฑ์";
}

/**
 * The filters in one line, for the results, the CSV and screen readers: the
 * fields of the page's form (all by default, as ReportFilters) and the
 * รายการ open
 */
export function describe(q: ReportQuery, names: Names, fields?: (keyof ReportQuery)[]): string {
  const has = (field: keyof ReportQuery) => !fields || fields.includes(field);
  return [
    `ปีงบประมาณ ${q.year}`,
    ...(has("area") ? [areaLabel(q.area, names)] : []),
    ...(has("period") ? [PERIOD_LABELS[q.period].name] : []),
    ...(q.measure === null ? [] : [`รายการ ${measureLabel(q.measure)}`]),
    ...(has("by") ? [`เปรียบเทียบราย${UNIT_LABELS[q.by]}`] : []),
  ].join(" · ");
}
