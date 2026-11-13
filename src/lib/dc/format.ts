// What PA prints for a percentage and for date_com, written again here
// because Data Center code does not import PA files (CODING_STANDARDS §4),
// and the build time that the footer and the home page show.

/**
 * A percentage with 2 decimals (a copy of PA's formatPct). toFixed rounds
 * the float as stored, so 89.585 → "89.58", the same as PA shows.
 */
export function formatPct(val: number): string {
  return val.toFixed(2);
}

/** A ช่วงอายุ as a sentence says it: "0–4 ปี", "80 ปีขึ้นไป" (GLOSSARY) */
export function bandName(label: string): string {
  return label === "80+" ? "80 ปีขึ้นไป" : `${label} ปี`;
}

const counts = new Intl.NumberFormat("th-TH");

/** A เป้าหมาย or ผลงาน with Thai digit grouping: 1234567 → "1,234,567" */
export function formatCount(val: number): string {
  return counts.format(val);
}

/**
 * date_com (YYYYMMDDHHmm; s_epi1 adds seconds) as PA shows it, e.g.
 * "3 พฤศจิกายน 2569 เวลา 05:57 น."; "" for "" (a block ปี without rows) or
 * any value that is not 12–14 digits, as PA leaves it blank
 */
export function formatThaiDate(dateCom: string): string {
  if (!/^\d{12,14}$/.test(dateCom)) return "";
  const part = (from: number, to: number) => Number(dateCom.slice(from, to));
  const date = new Date(part(0, 4), part(4, 6) - 1, part(6, 8), part(8, 10), part(10, 12));
  return (
    date.toLocaleDateString("th-TH", {
      day: "numeric",
      month: "long",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }) + " น."
  );
}

const thaiTime = new Intl.DateTimeFormat("th-TH", {
  timeZone: "Asia/Bangkok",
  day: "numeric",
  month: "long",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

/**
 * meta.built_at (ISO) in Thai time whatever the build machine's time zone,
 * e.g. "4 พฤศจิกายน 2569 เวลา 15:29 น."
 */
export function formatBuildTime(iso: string): string {
  return thaiTime.format(new Date(iso)) + " น.";
}
