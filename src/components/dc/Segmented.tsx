import type { LucideIcon } from "lucide-react";

// One compact segmented control (design.md §4): a button per option, the one on show pressed.
// tall makes each button 44px high, the target of a report page's control (SPEC §9.4).
export default function Segmented<T extends string>({
  label,
  options,
  value,
  onChange,
  tall = false,
}: {
  label: string;
  options: [T, string, LucideIcon?][];
  value: T;
  onChange: (value: T) => void;
  tall?: boolean;
}) {
  return (
    <div role="group" aria-label={label} className="flex rounded-md border border-dc-border-subtle bg-dc-surface p-0.5">
      {options.map(([option, text, Icon]) => (
        <button
          key={option}
          type="button"
          aria-pressed={option === value}
          onClick={() => onChange(option)}
          className={`inline-flex ${tall ? "min-h-11" : "min-h-10"} items-center gap-1.5 rounded px-3 text-xs font-bold ${
            option === value ? "bg-dc-brand-primary text-white" : "text-dc-brand-deep hover:bg-dc-canvas"
          }`}
        >
          {Icon && <Icon aria-hidden="true" className="size-4" />}
          {text}
        </button>
      ))}
    </div>
  );
}
