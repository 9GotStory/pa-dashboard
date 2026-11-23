"use client";

import { LazyMotion, MotionConfig } from "motion/react";
import type { ReactNode } from "react";
import { TRANSITION } from "@/lib/dc/motion";

const loadFeatures = () => import("./motion-features").then((mod) => mod.default);

/**
 * Motion for the Data Center pages (ADR-0018, SPEC §9.1): the m components
 * under it animate once the feature set has loaded, and change at once
 * before then. strict throws on a full motion component. reducedMotion
 * "user" only snaps transforms to their end for a person who asks for
 * reduced motion, so usePress drops the press itself.
 */
export default function MotionRoot({ children }: { children: ReactNode }) {
  return (
    <LazyMotion features={loadFeatures} strict>
      <MotionConfig reducedMotion="user" transition={TRANSITION}>
        {children}
      </MotionConfig>
    </LazyMotion>
  );
}
