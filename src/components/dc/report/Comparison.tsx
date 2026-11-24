import type { ReactNode } from "react";
import type { ReportSort } from "@/lib/dc/types";
import Segmented from "../Segmented";

/**
 * A เปรียบเทียบ section of a report page (SPEC §9.4 "การเรียง"): its bars and
 * its table (children, both in the order of sort, from sortedUnits) under
 * one control that orders them by รหัส{unitLabel} or by the section's value
 * (valueLabel). The page keeps sort, so it stays through แสดงผล and another
 * รายการ or ด้าน. Inside a page's grid of panels, it spans both columns.
 */
export default function Comparison(props: {
  unitLabel: string;
  valueLabel: string;
  sort: ReportSort;
  onSort: (sort: ReportSort) => void;
  children: ReactNode;
}) {
  const { unitLabel, valueLabel, sort, onSort, children } = props;
  const label = `เรียงราย${unitLabel}ตาม`;
  const sorts: [ReportSort, string][] = [
    ["code", `รหัส${unitLabel}`],
    ["value", valueLabel],
  ];
  return (
    <div className="grid gap-4 lg:col-span-2 lg:grid-cols-2">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 lg:col-span-2">
        {/* The group's name on screen; the group itself is named by its aria-label */}
        <span aria-hidden="true" className="text-xs text-dc-text-secondary">
          {label}
        </span>
        <Segmented label={label} options={sorts} value={sort} onChange={onSort} />
      </div>
      {children}
    </div>
  );
}
