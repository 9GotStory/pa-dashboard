"use client";

import { LazyMotion, MotionConfig } from "motion/react";
import { createContext, useCallback, useContext, useState, type ReactNode } from "react";
import { TRANSITION } from "@/lib/dc/motion";

const loadFeatures = () => import("./motion-features").then((mod) => mod.default);

const Ready = createContext(false);

/**
 * Whether Motion's feature set has loaded. Until then an m component keeps
 * the values of its first render whatever its animate says, so a bar that
 * must show a new value (Bar, F92) renders a plain element before then.
 */
export function useMotionReady() {
  return useContext(Ready);
}

/**
 * Motion for the Data Center pages (ADR-0018, SPEC §9.1): the m components
 * under it animate once the feature set has loaded, and change at once
 * before then. strict throws on a full motion component. reducedMotion
 * "user" only snaps transforms to their end for a person who asks for
 * reduced motion, so usePress drops the press itself.
 */
export default function MotionRoot({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const features = useCallback(
    () =>
      loadFeatures().then((f) => {
        setReady(true);
        return f;
      }),
    [],
  );
  return (
    <LazyMotion features={features} strict>
      <MotionConfig reducedMotion="user" transition={TRANSITION}>
        <Ready value={ready}>{children}</Ready>
      </MotionConfig>
    </LazyMotion>
  );
}
