"use client";

import { useReducedMotion } from "motion/react";
import * as m from "motion/react-m";
import type { ReactNode } from "react";
import { PULSE, PULSE_TRANSITION, STILL_SHOWN } from "@/lib/dc/motion";

/**
 * กำลังโหลด… in place of results that wait for their data or their code
 * (SPEC §9.1 "การบอกสถานะ", F91): the line, then grey blocks in the rough
 * shape of the results, which dim and come back until they come (still for
 * a viewer who asks for reduced motion). The box is a screen tall: the
 * results it stands for are taller than the screen on a phone, and on most
 * reports on a desktop, so the sections below stay off the screen while they
 * load and do not jump down when the data comes. frame: the filters and the
 * line under ผลรายงาน too, for a whole report; without it, a section of one.
 */
export default function ReportLoading({ children, frame = true }: { children: ReactNode; frame?: boolean }) {
  const reduce = useReducedMotion();
  return (
    <div role="status" className="min-h-svh px-4 py-5 sm:px-6">
      <p className="text-dc-text-secondary">{children}</p>
      {/* Shown in the HTML at the first keyframe, opacity 1, and pulse once Motion's features load.
          Not initial={false}: that skips the first animation, which here is the only one. */}
      <m.div
        aria-hidden
        animate={reduce ? STILL_SHOWN : PULSE}
        transition={reduce ? undefined : PULSE_TRANSITION}
        className="mt-4 space-y-4"
      >
        {frame && (
          <>
            <div className="grid grid-cols-2 gap-3 sm:flex">
              {[0, 1, 2].map((i) => (
                <div key={i} className="h-10 rounded-md bg-dc-surface-muted sm:w-36" />
              ))}
            </div>
            <div className="h-4 w-48 max-w-full rounded bg-dc-surface-muted" />
          </>
        )}
        <div className="grid gap-4 md:grid-cols-2">
          <div className="h-40 rounded-[9px] bg-dc-surface-muted" />
          <div className="h-40 rounded-[9px] bg-dc-surface-muted" />
        </div>
        <div className="h-64 rounded-[9px] bg-dc-surface-muted" />
      </m.div>
    </div>
  );
}
