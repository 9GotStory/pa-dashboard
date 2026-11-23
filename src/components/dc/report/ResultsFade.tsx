"use client";

import * as m from "motion/react-m";
import type { ReactNode } from "react";
import { FADE_IN } from "@/lib/dc/motion";

/**
 * The results below ResultsHeader, which fade in each time แสดงผล is
 * pressed (SPEC §9.1 "motion", F91). applied is useUrlQuery's count of the
 * presses: each count is a variant of its own, and Motion plays keyframes
 * again whenever the variant changes, so a press that leaves the query as it
 * was fades in too. Nothing fades when the page opens (initial false) or on
 * back and forward. A fade is not movement, so it plays for a viewer who
 * asks for reduced motion too.
 */
export default function ResultsFade({ applied, children }: { applied: number; children: ReactNode }) {
  const variant = `applied-${applied}`;
  return (
    <m.div initial={false} animate={variant} variants={{ [variant]: FADE_IN }}>
      {children}
    </m.div>
  );
}
