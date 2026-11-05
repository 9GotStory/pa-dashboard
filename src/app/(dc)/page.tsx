import Link from "next/link";
import DistrictExplorer from "@/components/dc/DistrictExplorer";
import { formatBuildTime, formatThaiDate } from "@/lib/dc/format";
import { readCatalog, readMeta } from "@/lib/dc/snapshot";

// The Data Center home page (SPEC §9.2), built from catalog.json and meta.json
// at build time: the latest data date, the ตำบล of the อำเภอ on a map with
// their หน่วยบริการ, a card per หัวข้อ into the report library, and the
// sources. The population blocks of R6 wait for phase 2.
export default function Home() {
  const { areas, hospitals, mains } = readCatalog();
  const { built_at, latest_date_com } = readMeta();
  const topics = mains.flatMap((main) =>
    main.topics.map((topic) => ({ topic, count: topic.groups.reduce((n, g) => n + g.reports.length, 0) })),
  );

  return (
    <>
      <div className="mb-5 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="font-prompt text-2xl font-bold text-dc-navy sm:text-[30px]">ข้อมูลพื้นฐานอำเภอสอง</h1>
          <p className="mt-1 text-dc-muted">เขตการปกครอง · หน่วยบริการ · คลังรายงานสุขภาพ จังหวัดแพร่</p>
          <p className="mt-3 inline-flex items-center gap-2 rounded-md border border-dc-gold/50 bg-dc-gold/10 px-3 py-2 text-xs font-semibold text-dc-ink">
            <span aria-hidden="true" className="size-2 shrink-0 rounded-full bg-dc-gold" />
            วันที่ข้อมูลล่าสุด {formatThaiDate(latest_date_com) || "—"}
          </p>
        </div>
        <dl className="rounded-[10px] border border-l-4 border-dc-border border-l-dc-blue bg-dc-blue-light px-5 py-4 md:min-w-56">
          <dt className="text-xs font-semibold text-dc-muted">เขตการปกครอง</dt>
          <dd className="mt-1 font-prompt text-[28px] leading-none font-bold text-dc-navy">
            {areas.length} <small className="text-sm font-semibold">ตำบล</small>
          </dd>
          <dd className="mt-1.5 text-xs text-dc-muted">อำเภอสอง · จังหวัดแพร่</dd>
        </dl>
      </div>

      <DistrictExplorer areas={areas} hospitals={hospitals} />

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
        className="mt-7 flex flex-col gap-1 rounded-md border border-dc-border bg-dc-blue-light/50 px-4 py-3 text-xs text-dc-ink sm:flex-row sm:gap-4"
      >
        <h2 id="sources-title" className="font-prompt font-semibold whitespace-nowrap text-dc-navy">
          ที่มาของข้อมูล
        </h2>
        <p>
          รายงาน:{" "}
          <a href="https://opendata.moph.go.th" className="text-dc-blue underline underline-offset-2">
            HDC Open Data
          </a>{" "}
          กระทรวงสาธารณสุข · ขอบเขตตำบล:{" "}
          <a
            href="https://pherportal.moph.go.th/arcgis/rest/services/MOPH_DATA/tambon/MapServer/0"
            className="text-dc-blue underline underline-offset-2"
          >
            MOPH GIS
          </a>{" "}
          · แผนที่พื้นหลัง:{" "}
          <a href="https://www.openstreetmap.org/copyright" className="text-dc-blue underline underline-offset-2">
            OpenStreetMap
          </a>{" "}
          · สร้างหน้าเว็บ <time dateTime={built_at}>{formatBuildTime(built_at)}</time>
        </p>
      </section>
    </>
  );
}
