import { formatCount } from "@/lib/dc/format";
import type { UnitCount } from "../report/resultsText";
import { BarRect } from "./Bar";
import UnitList from "./UnitList";

const ROW = 30;
// Columns of the chart as shares of its width: names, bars, counts, as UnitChart's
const BARS_X = "34%";
const BARS_WIDTH = "50%";

/**
 * The count of each ตำบล or หน่วยบริการ as horizontal bars on a scale of the
 * largest, laid out as UnitChart: a ด้าน of AGED9 is a count, not a ร้อยละ,
 * so there is no 0–100 scale and no เกณฑ์ (SPEC §9.4). On a phone, UnitList
 * shows the same bars.
 */
export default function CountChart({ title, units }: { title: string; units: UnitCount[] }) {
  const height = units.length * ROW;
  const top = Math.max(...units.map((u) => u.count), 1);
  const label = `${title}: ` + units.map((u) => `${u.name} ${formatCount(u.count)}`).join(", ");
  const rows = units.map((u) => ({
    key: u.key,
    name: u.name,
    share: (u.count / top) * 100,
    value: formatCount(u.count),
  }));
  return (
    <>
      <UnitList title={title} rows={rows} goal={null} />
      <svg
        data-unit-chart
        role="img"
        aria-label={label}
        width="100%"
        height={height}
        className="hidden text-xs sm:block"
      >
        {rows.map((r, i) => (
          <g key={r.key}>
            <text y={i * ROW + ROW / 2} dominantBaseline="middle" className="fill-dc-brand-deep">
              {r.name}
            </text>
            <svg x={BARS_X} y={i * ROW + 8} width={BARS_WIDTH} height={ROW - 16}>
              <rect width="100%" height="100%" rx="3" className="fill-dc-canvas" />
              <BarRect width={`${r.share}%`} height="100%" rx="3" className="fill-dc-brand-primary" />
            </svg>
            <text
              x="100%"
              y={i * ROW + ROW / 2}
              dominantBaseline="middle"
              textAnchor="end"
              className="fill-dc-brand-deep font-semibold tabular-nums"
            >
              {r.value}
            </text>
          </g>
        ))}
      </svg>
    </>
  );
}
