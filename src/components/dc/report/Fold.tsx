"use client";

import * as m from "motion/react-m";
import { useReducer, type ReactNode } from "react";
import { FOLDED, foldStep } from "@/lib/dc/fold";
import { FOLD_BODY } from "@/lib/dc/motion";
import { useChange } from "../charts/Bar";
import { useMotionReady } from "../MotionRoot";
import { PressSummary } from "../Press";

// Print shows a shut body whole, over the height of 0 Motion left on it
const BODY = "overflow-hidden print:h-auto!";

/**
 * The folded part of เกี่ยวกับรายงานนี้ (SPEC §9.4, F88): a <details>, so the
 * keyboard, the expanded state for a screen reader and opening without
 * JavaScript are the browser's, and print shows it open. Once Motion's
 * features load, a press grows or shrinks the body instead of the browser's
 * jump (F92, src/lib/dc/fold.ts), at once for a viewer who asks for reduced
 * motion. Until then the body is a plain <div> with no height of its own;
 * then an m.div that starts where the fold is, at 0 when shut, since Motion
 * grows it from the height it has.
 */
export default function Fold({
  chevron,
  summary,
  children,
}: {
  /** Its icon, rendered on the server so lucide stays out of the page's JavaScript */
  chevron: ReactNode;
  summary: string;
  children: ReactNode;
}) {
  const ready = useMotionReady();
  const transition = useChange();
  const [fold, step] = useReducer(foldStep, FOLDED);
  // The chevron turns back at the press, not when the shrink has ended
  const shrinking = fold.open && !fold.shown;
  const body = <div className="border-t border-dc-border-subtle p-4 text-sm leading-relaxed">{children}</div>;
  return (
    <details
      open={fold.open}
      onToggle={(e) => step({ type: "toggle", open: e.currentTarget.open })}
      className="group min-w-0 rounded-lg border border-dc-border-subtle bg-white print:details-content:[content-visibility:visible]"
    >
      <PressSummary
        wide
        onClick={(e) => {
          if (!ready) return;
          e.preventDefault();
          step({ type: "press" });
        }}
        className="flex min-h-11 cursor-pointer list-none items-center gap-2 rounded-lg px-4 font-prompt text-[13px] font-semibold text-dc-brand-deep transition-colors hover:bg-dc-canvas [&::-webkit-details-marker]:hidden"
      >
        <span aria-hidden="true" className={`flex shrink-0 print:hidden ${shrinking ? "" : "group-open:rotate-90"}`}>
          {chevron}
        </span>
        {summary}
      </PressSummary>
      {ready ? (
        <m.div
          initial={false}
          animate={fold.shown ? "shown" : "hidden"}
          variants={FOLD_BODY}
          transition={transition}
          onAnimationComplete={() => step({ type: "done" })}
          className={BODY}
        >
          {body}
        </m.div>
      ) : (
        <div className={BODY}>{body}</div>
      )}
    </details>
  );
}
