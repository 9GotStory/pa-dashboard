import type { DcCatalog, DcReportData, ReportQuery } from "../types";
import { count, countsBy, pctOf } from "../values";
import { ancValues } from "./anc";

// The data layer of the ตัวชี้วัดเดียวรายปี page (SPEC §9.4, ADR-0015) for
// s_kpi_food, s_kpi_dental28 and s_kpi_dental33: one row per หมู่บ้าน, ทั้งปี
// alone (SCHEMA §4.6.6, §4.6.12), and for s_kpi_food its เดือนอายุ and
// ร้อยละสอบถาม. Its result has no type in types.ts (SPEC §2.7): the view
// takes it as ReturnType<typeof annualValues>.

/** The เดือนอายุ 1–6 of s_kpi_food, เดือนอายุ k being column r{k} (SCHEMA §4.6.6) */
const AGE_MONTHS = [1, 2, 3, 4, 5, 6] as const;

/**
 * Every value the ตัวชี้วัดเดียวรายปี page shows for a query: the ANC page's
 * for ทั้งปี (reportQuery gives no other ช่วงเวลา, as the quarter family of
 * s_kpi_food is empty every year), and of s_kpi_food the count of each
 * เดือนอายุ in the area and ร้อยละสอบถาม of the area and of each unit
 */
export function annualValues(
  data: DcReportData,
  query: ReportQuery,
  names: Pick<DcCatalog, "areas" | "hospitals">,
  years: string[],
) {
  const { block, total, change, goal, passed, units, trend } = ancValues(data, query, names, years);
  // ร้อยละสอบถาม is of s_kpi_food alone: the dental tables have no column total
  const asking =
    block && total && block.headers.includes("total")
      ? askingOf(count(block, "total", query.area) ?? 0, total.target)
      : null;
  // Column total of each unit, keyed as totalsBy names them (both go by unitRows)
  const childrenOf = new Map((block && asking && countsBy(block, "total", query, names))?.map((u) => [u.key, u.count]));
  return {
    block,
    total,
    change,
    goal,
    passed,
    /** The ตำบล or หน่วยบริการ of query.by in the area, each with its ร้อยละสอบถาม (null as asking); null as ancValues */
    units:
      units &&
      units.map((u) => ({
        ...u,
        asking: asking && askingOf(childrenOf.get(u.key) ?? 0, u.totals.target),
      })),
    trend,
    /**
     * ตอบว่ากินนมแม่อย่างเดียว at each เดือนอายุ 1–6 in the area, as counts:
     * one child may count at several, so they add up to more than ผลงาน
     * (SCHEMA §4.6.6). null for a table without them (the dental tables) and
     * with total null; with a total the district has data that year, so an
     * empty column is 0, not "—".
     */
    ageMonths:
      block && total && block.headers.includes("r1")
        ? AGE_MONTHS.map((month) => ({ month, count: count(block, `r${month}`, query.area) ?? 0 }))
        : null,
    /**
     * ร้อยละสอบถาม (GLOSSARY) of s_kpi_food in the area. null for a table
     * without the column total (the dental tables) and for a year the
     * district has no ผลงาน, as ageMonths.
     */
    asking,
  };
}

/**
 * ร้อยละสอบถาม (GLOSSARY): เด็กอายุครบ 6 เดือน (total), those ถูกสอบถาม
 * (target) and target ÷ total × 100, each summed before dividing; pct null
 * with no children (SCHEMA §4.6.6)
 */
function askingOf(children: number, asked: number) {
  return { children, asked, pct: pctOf(asked, children) };
}
