"use client";

import { LazyMotion, MotionConfig, useReducedMotion } from "motion/react";
import { createContext, useCallback, useContext, useState, type ReactNode } from "react";
import { CHANGE, INSTANT, TRANSITION } from "@/lib/dc/motion";

const loadFeatures = () => import("./motion-features").then((mod) => mod.default);

const MotionReady = createContext(false);

/**
 * Whether Motion's feature set has loaded. Until then an m component keeps
 * the values of its first render whatever its animate says, so a bar that
 * must show a new value (Bar, F92) renders a plain element before then.
 */
export function useMotionReady() {
  return useContext(MotionReady);
}

/**
 * The transition of a bar or a fold that moves to a new value (F92): CHANGE,
 * or INSTANT for a viewer who asks for reduced motion, as width and height
 * are not transforms, which MotionConfig would still.
 */
export function useChangeTransition() {
  return useReducedMotion() ? INSTANT : CHANGE;
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
        <MotionReady value={ready}>{children}</MotionReady>
      </MotionConfig>
    </LazyMotion>
  );
}
