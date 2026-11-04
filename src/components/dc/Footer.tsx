import { readMeta } from "@/lib/dc/snapshot";

// The build time in Thai, in Thai time whatever the build machine's time zone.
const thaiTime = new Intl.DateTimeFormat("th-TH", {
  timeZone: "Asia/Bangkok",
  day: "numeric",
  month: "long",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

// Footer of the Data Center pages (SPEC §9.1): the sources and the time of
// the build, from meta.json at build time.
export default function Footer() {
  const { built_at } = readMeta();
  return (
    <footer className="border-t border-dc-border bg-white text-xs text-dc-muted">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-x-4 gap-y-1 px-4 py-4 sm:px-7">
        <p>Song Health Data Center · ศูนย์ข้อมูลสุขภาพอำเภอสอง จังหวัดแพร่</p>
        <p>
          ข้อมูลจาก{" "}
          <a href="https://opendata.moph.go.th" className="underline underline-offset-2">
            HDC Open Data
          </a>{" "}
          · ขอบเขตตำบลจาก{" "}
          <a
            href="https://pherportal.moph.go.th/arcgis/rest/services/MOPH_DATA/tambon/MapServer/0"
            className="underline underline-offset-2"
          >
            MOPH GIS
          </a>{" "}
          · สร้างหน้าเว็บ <time dateTime={built_at}>{thaiTime.format(new Date(built_at))} น.</time>
        </p>
      </div>
    </footer>
  );
}
