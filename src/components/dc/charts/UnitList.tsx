/** A row of UnitList: its name, its bar as a share 0–100 of the track (null = no bar) and its value as shown */
type UnitRow = { key: string; name: string; share: number | null; value: string };

/**
 * UnitChart and CountChart on a phone (SPEC §9.4): a row per ตำบล or
 * หน่วยบริการ with its whole name on a line of its own, then its bar and
 * value where TrendList has them, so a long name with its คำนำหน้าหน่วยบริการ
 * never runs into the bar. goal marks the เกณฑ์ on the 0–100 track of every
 * row; null has none.
 */
export default function UnitList({ title, rows, goal }: { title: string; rows: UnitRow[]; goal: number | null }) {
  return (
    <ol data-unit-chart aria-label={title} className="space-y-2 sm:hidden">
      {rows.map((r) => (
        <li key={r.key} className="grid grid-cols-[3rem_minmax(0,1fr)_4.5rem] items-center gap-x-2 gap-y-1">
          <span className="col-span-3 text-xs text-dc-brand-deep">{r.name}</span>
          <span aria-hidden="true" className="relative col-start-2 h-2.5 overflow-hidden rounded-full bg-dc-canvas">
            {r.share !== null && (
              <span className="block h-full rounded-full bg-dc-brand-primary" style={{ width: `${r.share}%` }} />
            )}
            {goal !== null && (
              <span
                className="absolute inset-y-0 border-l-2 border-dashed border-dc-gold"
                style={{ left: `${goal}%` }}
              />
            )}
          </span>
          <strong className="text-right text-xs font-semibold text-dc-brand-deep tabular-nums">{r.value}</strong>
        </li>
      ))}
    </ol>
  );
}
