import { RotateCcw } from "lucide-react";
import { PressButton } from "./Press";

/**
 * ล้างการเลือก of the home page (SPEC §9.2): onClear puts every section back
 * to the whole อำเภอ, null while no ตำบล is picked. Then it is dimmed, with no
 * hover, and a press does nothing (F95); aria-disabled, not disabled, so the
 * press that clears the pick leaves focus on it.
 */
export default function ClearPick({ onClear }: { onClear: (() => void) | null }) {
  return (
    <PressButton
      type="button"
      aria-disabled={onClear === null}
      onClick={onClear ?? undefined}
      className={`inline-flex min-h-11 items-center gap-1.5 text-xs font-bold text-dc-brand-primary ${onClear ? "hover:underline" : "cursor-not-allowed opacity-50"}`}
    >
      <RotateCcw className="size-3.5" />
      ล้างการเลือก
    </PressButton>
  );
}
