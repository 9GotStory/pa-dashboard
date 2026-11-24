"use client";

import * as m from "motion/react-m";
import { FLASH } from "@/lib/dc/motion";

/**
 * A line of the home page whose text changes with the ตำบล picked, with a
 * highlight behind it that flashes and fades each time the text changes
 * (SPEC §9.1 "motion", F93), so the viewer sees the line changed; the screen
 * reader's text says it already. Its parent is relative, for the highlight
 * to sit behind the text. Each text is a variant of its own, so Motion plays
 * the keyframes again whenever it changes. Nothing shows when the page opens
 * (initial false, at FLASH's last keyframe) or before Motion's features load.
 */
export default function ChangeFlash({ text }: { text: string }) {
  const variant = `text-${text}`;
  return (
    <>
      <m.span
        aria-hidden="true"
        initial={false}
        animate={variant}
        variants={{ [variant]: FLASH }}
        className="absolute -inset-x-1.5 inset-y-0 rounded-md bg-dc-highlight-soft"
      />
      <span className="relative">{text}</span>
    </>
  );
}
