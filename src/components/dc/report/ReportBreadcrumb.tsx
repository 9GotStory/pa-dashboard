import { PressLink } from "../Press";

/**
 * The breadcrumb of a report page (SPEC §9.4): รายงานสุขภาพ first; a crumb
 * without href is plain text. A link is a target 24px high, 44px on a touch
 * screen (SPEC §9.1, F95).
 */
export default function ReportBreadcrumb({ crumbs }: { crumbs: { label: string; href?: string }[] }) {
  return (
    <nav aria-label="ลำดับหน้าของรายงาน" className="mb-3 print:hidden">
      <ol className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-dc-text-secondary">
        {crumbs.map((c, i) => (
          <li key={c.label} className="flex items-center gap-2">
            {i > 0 && <span aria-hidden="true">/</span>}
            {c.href ? (
              <PressLink
                href={c.href}
                className="inline-flex min-h-6 items-center font-semibold text-dc-brand-primary underline-offset-2 hover:underline pointer-coarse:min-h-11"
              >
                {c.label}
              </PressLink>
            ) : (
              c.label
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}
