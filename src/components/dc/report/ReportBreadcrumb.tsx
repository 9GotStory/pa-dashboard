import Link from "next/link";

/** The breadcrumb of a report page (SPEC §9.4): รายงานสุขภาพ first; a crumb without href is plain text */
export default function ReportBreadcrumb({ crumbs }: { crumbs: { label: string; href?: string }[] }) {
  return (
    <nav aria-label="ลำดับหน้าของรายงาน" className="mb-3 print:hidden">
      <ol className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-dc-text-secondary">
        {crumbs.map((c, i) => (
          <li key={c.label} className="flex items-center gap-2">
            {i > 0 && <span aria-hidden="true">/</span>}
            {c.href ? (
              <Link href={c.href} className="font-semibold text-dc-brand-primary underline-offset-2 hover:underline">
                {c.label}
              </Link>
            ) : (
              c.label
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}
