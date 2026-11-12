import { formatCount } from "@/lib/dc/format";

const ROW = 30;
// Columns of the chart as shares of its width: names, bars, counts, as UnitChart's
const BARS_X = "34%";
const BARS_WIDTH = "50%";

/**
 * The count of each ตำบล or หน่วยบริการ as horizontal bars on a scale of the
 * largest, laid out as UnitChart: a ด้าน of AGED9 is a count, not a ร้อยละ,
 * so there is no 0–100 scale and no เกณฑ์ (SPEC §9.4)
 */
export default function CountChart({ title, units }: { title: string; units: { key: string; name: string; count: number }[] }) {
  const height = units.length * ROW;
  const top = Math.max(...units.map((u) => u.count), 1);
  const label = `${title}: ` + units.map((u) => `${u.name} ${formatCount(u.count)}`).join(", ");
  return (
    <svg role="img" aria-label={label} width="100%" height={height} className="block text-xs">
      {units.map((u, i) => (
        <g key={u.key}>
          <text y={i * ROW + ROW / 2} dominantBaseline="middle" className="fill-dc-brand-deep">
            {u.name}
          </text>
          <svg x={BARS_X} y={i * ROW + 8} width={BARS_WIDTH} height={ROW - 16}>
            <rect width="100%" height="100%" rx="3" className="fill-dc-canvas" />
            <rect width={`${(u.count / top) * 100}%`} height="100%" rx="3" className="fill-dc-brand-primary" />
          </svg>
          <text x="100%" y={i * ROW + ROW / 2} dominantBaseline="middle" textAnchor="end" className="fill-dc-brand-deep font-semibold tabular-nums">
            {formatCount(u.count)}
          </text>
        </g>
      ))}
    </svg>
  );
}
