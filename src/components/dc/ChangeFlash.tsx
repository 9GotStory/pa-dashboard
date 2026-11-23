"use client";

import * as m from "motion/react-m";
import { CHANGE, FLASH } from "@/lib/dc/motion";

/**
 * A highlight behind a line of the home page that flashes and fades each time
 * on changes (SPEC §9.1 "motion", F93), so the viewer sees the line changed
 * with the ตำบล picked; the screen reader's text says it already. Its parent
 * is relative and the line's text comes after it, relative too, to show over
 * it. Each value is a variant of its own, so Motion plays the keyframes again
 * whenever on changes. Nothing shows when the page opens (initial false, at
 * FLASH's last keyframe) or before Motion's features load.
 */
export default function ChangeFlash({ on }: { on: string }) {
  const variant = `on-${on}`;
  return (
    <m.span
      aria-hidden="true"
      initial={false}
      animate={variant}
      variants={{ [variant]: FLASH }}
      transition={CHANGE}
      className="absolute -inset-x-1.5 inset-y-0 rounded-md bg-dc-highlight-soft"
    />
  );
}
