import Link from "next/link";

// Placeholder until F18 builds the Data Center home page (SPEC §9.2).
export default function Home() {
  return (
    <div className="flex flex-col items-center gap-2 py-12 text-center">
      <h1 className="text-2xl font-bold font-prompt">Song Health Data Center</h1>
      <p className="text-slate-500">ศูนย์ข้อมูลสุขภาพอำเภอสอง จังหวัดแพร่</p>
      <Link href="/pa" className="mt-4 font-prompt font-semibold underline underline-offset-4">
        PA Dashboard
      </Link>
    </div>
  );
}
