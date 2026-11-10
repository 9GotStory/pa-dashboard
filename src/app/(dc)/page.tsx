import { CalendarDays } from "lucide-react";
import Link from "next/link";
import DistrictExplorer from "@/components/dc/DistrictExplorer";
import Hero from "@/components/dc/Hero";
import { formatBuildTime, formatCount, formatThaiDate } from "@/lib/dc/format";
import { homePopulation, registryAsOf } from "@/lib/dc/population";
import { readCatalog, readMeta, readPopulation } from "@/lib/dc/snapshot";

// The day public/geo/song-tambon.geojson was downloaded, as public/geo/README.md
// records it (SCHEMA §8); a new download changes both.
const BOUNDARY_DOWNLOADED = "4 พฤศจิกายน 2569";

// The Data Center home page (SPEC §9.2), built from catalog.json, meta.json
// and population.json at build time: the Hero, the ประชากรทะเบียนราษฎร of
// the อำเภอ, the ตำบล on a map with their หน่วยบริการ, population and
// population pyramid, a card per หัวข้อ into the report library, and the
// sources with the latest data date. The client gets the population as
// computed (HomePopulation), never the rows; without population data the
// page is as in phase 1, under the Hero.
export default function Home() {
  const { areas, hospitals, mains } = readCatalog();
  const { built_at, latest_date_com } = readMeta();
  const population = homePopulation(readPopulation(), areas);
  // The label of the ภาพรวมประชากร and of the ตำบล table, one text so the two match
  // (SPEC §9.2). Made here, not in the client: population.ts holds the /sync
  // file reader too.
  const source = population ? `ทะเบียนราษฎร ${registryAsOf(population.yymm)} · กรมการปกครอง` : "";
  const topics = mains.flatMap((main) =>
    main.topics.map((topic) => ({ topic, count: topic.groups.reduce((n, g) => n + g.reports.length, 0) })),
  );

  return (
    <>
      <Hero hasComparison={population !== null} />

      {/* The อำเภอ's population and its เขตการปกครอง, read-only text in one strip; without population, the เขตการปกครอง alone as in phase 1 */}
      <section aria-labelledby="overview-title" className="mb-8 sm:mb-10">
        <div className="mb-4 flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
          <h2 id="overview-title" className="font-prompt text-2xl font-bold text-dc-brand-deep sm:text-[32px]">
            {population ? "ภาพรวมประชากรอำเภอสอง" : "ภาพรวมอำเภอสอง"}
          </h2>
          {population && (
            <p className="inline-flex items-center gap-2 text-xs font-semibold text-dc-text-secondary">
              <CalendarDays aria-hidden="true" className="size-4 shrink-0" />
              {source}
            </p>
          )}
        </div>
        <dl
          className={`grid overflow-hidden rounded-[20px] bg-dc-surface ${population ? "sm:grid-cols-3 lg:grid-cols-[1.55fr_1fr_1fr_0.8fr]" : "sm:w-fit"}`}
        >
          {population && (
            <>
              <div className="min-w-0 px-5 py-5 sm:col-span-3 sm:px-8 sm:py-7 lg:col-span-1">
                <dt className="text-xs font-semibold text-dc-text-secondary">ประชากรทั้งหมด</dt>
                <dd className="mt-2 font-prompt text-[40px] leading-none font-bold text-dc-brand-deep tabular-nums sm:text-[52px]">
                  {formatCount(population.district.totals.total)} <small className="text-sm font-medium text-dc-text-secondary">คน</small>
                </dd>
              </div>
              {(
                [
                  ["ประชากรชาย", population.district.totals.male, "bg-dc-pyramid-male"],
                  ["ประชากรหญิง", population.district.totals.female, "bg-dc-pyramid-female"],
                ] as const
              ).map(([label, count, dot]) => (
                <div key={label} className="min-w-0 border-t border-dc-border-subtle px-5 py-5 sm:border-t-0 sm:px-7 sm:py-7">
                  <dt className="flex items-center gap-2 text-xs font-semibold text-dc-text-secondary">
                    <span aria-hidden="true" className={`size-2.5 rounded-full ${dot}`} />
                    {label}
                  </dt>
                  <dd className="mt-3 font-prompt text-[32px] leading-none font-bold text-dc-brand-deep tabular-nums sm:text-[38px]">
                    {formatCount(count)} <small className="text-xs font-medium text-dc-text-secondary">คน</small>
                  </dd>
                </div>
              ))}
            </>
          )}
          <div className="min-w-0 border-t border-dc-border-subtle px-5 py-5 first:border-t-0 sm:border-t-0 sm:px-7 sm:py-7">
            <dt className="text-xs font-semibold text-dc-text-secondary">เขตการปกครอง</dt>
            <dd className="mt-3 font-prompt text-[32px] leading-none font-bold text-dc-brand-deep tabular-nums sm:text-[38px]">
              {areas.length} <small className="text-xs font-medium text-dc-text-secondary">ตำบล</small>
            </dd>
            <dd className="mt-2 text-xs text-dc-text-secondary">อำเภอสอง · จังหวัดแพร่</dd>
          </div>
        </dl>
      </section>

      <DistrictExplorer areas={areas} hospitals={hospitals} population={population} source={source} />

      <section aria-labelledby="topics-title" className="mt-7">
        <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 id="topics-title" className="font-prompt text-lg font-semibold text-dc-navy">
              รายงานตามหัวข้อ
            </h2>
            <p className="text-xs text-dc-muted">เลือกหัวข้อเพื่อดูรายงานในคลังรายงาน</p>
          </div>
          <Link
            href="/reports"
            className="inline-flex min-h-10 items-center self-start rounded-md border border-dc-border bg-white px-3 text-xs font-bold text-dc-blue hover:bg-dc-blue-light sm:self-auto"
          >
            ดูรายงานทั้งหมด <span aria-hidden="true">&nbsp;→</span>
          </Link>
        </div>
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {topics.map(({ topic, count }, i) => (
            <li key={topic.cat_id} className="min-w-0">
              <Link
                href={`/reports?cat=${topic.cat_id}`}
                className="flex h-full items-center gap-3 rounded-lg border border-dc-border bg-white p-4 hover:border-dc-blue hover:bg-dc-blue-light/40"
              >
                <span
                  aria-hidden="true"
                  className="flex size-8 shrink-0 items-center justify-center rounded-md bg-dc-blue-light text-[11px] font-bold text-dc-blue"
                >
                  {String(i + 1).padStart(2, "0")}
                </span>
                <span className="min-w-0 flex-1">
                  <small className="block text-[11px] font-semibold text-dc-teal">{topic.main_report_name}</small>
                  <strong className="block text-[13px] leading-snug font-semibold text-dc-ink">{topic.category_name}</strong>
                  <small className="mt-0.5 block text-xs text-dc-muted">{count} รายงาน</small>
                </span>
                <span aria-hidden="true" className="text-lg text-dc-muted">
                  →
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <section
        aria-labelledby="sources-title"
        className="mt-7 flex flex-col gap-1 rounded-md border border-dc-border-subtle bg-dc-surface-muted px-4 py-3 text-xs text-dc-brand-deep sm:flex-row sm:gap-4"
      >
        <h2 id="sources-title" className="font-prompt font-semibold whitespace-nowrap text-dc-brand-deep">
          ที่มาของข้อมูล
        </h2>
        <p>
          รายงาน:{" "}
          <a href="https://opendata.moph.go.th" className="text-dc-brand-primary underline underline-offset-2">
            HDC Open Data
          </a>{" "}
          กระทรวงสาธารณสุข ข้อมูลล่าสุด {formatThaiDate(latest_date_com) || "—"} ·{" "}
          {population && (
            <>
              ประชากร:{" "}
              <a href="https://stat.bora.dopa.go.th/" className="text-dc-brand-primary underline underline-offset-2">
                stat.bora
              </a>{" "}
              กรมการปกครอง ·{" "}
            </>
          )}
          ขอบเขตตำบล:{" "}
          <a
            href="https://pherportal.moph.go.th/arcgis/rest/services/MOPH_DATA/tambon/MapServer/0"
            className="text-dc-brand-primary underline underline-offset-2"
          >
            MOPH GIS
          </a>{" "}
          ดาวน์โหลด {BOUNDARY_DOWNLOADED} · แผนที่พื้นหลัง:{" "}
          <a href="https://www.openstreetmap.org/copyright" className="text-dc-brand-primary underline underline-offset-2">
            OpenStreetMap
          </a>{" "}
          · สร้างหน้าเว็บ <time dateTime={built_at}>{formatBuildTime(built_at)}</time>
        </p>
      </section>
    </>
  );
}
