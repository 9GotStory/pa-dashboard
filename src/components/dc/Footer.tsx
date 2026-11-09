import { formatBuildTime, formatThaiDate } from "@/lib/dc/format";
import { readMeta } from "@/lib/dc/snapshot";

// The day public/geo/song-tambon.geojson was downloaded, as public/geo/README.md
// records it (SCHEMA §8); a new download changes both.
const BOUNDARY_DOWNLOADED = "4 พฤศจิกายน 2569";

// Footer of the Data Center pages (SPEC §9.1): the sources with the latest
// data date and the boundary download date, and the time of the build, from
// meta.json at build time.
export default function Footer() {
  const { built_at, latest_date_com } = readMeta();
  return (
    <footer className="border-t border-dc-border bg-white text-xs text-dc-muted">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-x-4 gap-y-1 px-4 py-4 sm:px-7">
        <p>Song Health Data Center · ศูนย์ข้อมูลสุขภาพอำเภอสอง จังหวัดแพร่</p>
        <p>
          รายงานจาก{" "}
          <a href="https://opendata.moph.go.th" className="underline underline-offset-2">
            HDC Open Data
          </a>{" "}
          วันที่ข้อมูลล่าสุด {formatThaiDate(latest_date_com) || "—"} · ขอบเขตตำบลจาก{" "}
          <a
            href="https://pherportal.moph.go.th/arcgis/rest/services/MOPH_DATA/tambon/MapServer/0"
            className="underline underline-offset-2"
          >
            MOPH GIS
          </a>{" "}
          ดาวน์โหลด {BOUNDARY_DOWNLOADED} · สร้างหน้าเว็บ <time dateTime={built_at}>{formatBuildTime(built_at)}</time>
        </p>
      </div>
    </footer>
  );
}
