"use client";

import { useReducedMotion, type HTMLMotionProps } from "motion/react";
import * as m from "motion/react-m";
import Link from "next/link";
import type { ComponentProps } from "react";
import { PRESS, PRESS_WIDE } from "@/lib/dc/motion";

const MotionLink = m.create(Link);

/** wide: a row or a card, which shrinks less (PRESS_WIDE) */
type Wide = { wide?: boolean };

// The whileTap of a person who asks for reduced motion. Not undefined: Motion
// gives an element with a whileTap tabIndex 0, so the server's HTML, made
// without knowing the setting, has it, and the browser's render must too.
const STILL = {};

/**
 * The whileTap of a control of the Data Center (SPEC §9.1 "สถานะของ
 * control", F90): it shrinks a little while pressed. Not for a person who
 * asks for reduced motion, as MotionConfig would still snap it to the
 * shrunk size.
 */
export function usePress(wide = false) {
  const reduce = useReducedMotion();
  if (reduce) return STILL;
  return wide ? PRESS_WIDE : PRESS;
}

/** A <button> that shrinks while pressed, unless it is disabled or aria-disabled */
export function PressButton({ wide, ...props }: HTMLMotionProps<"button"> & Wide) {
  const press = usePress(wide);
  const off = props.disabled || props["aria-disabled"] === true || props["aria-disabled"] === "true";
  return <m.button whileTap={off ? undefined : press} {...props} />;
}

/** An <a> that shrinks while pressed: a link within the page or to another site */
export function PressA(props: HTMLMotionProps<"a">) {
  return <m.a whileTap={usePress()} {...props} />;
}

/** A next/link Link that shrinks while pressed */
export function PressLink({ wide, ...props }: ComponentProps<typeof MotionLink> & Wide) {
  return <MotionLink whileTap={usePress(wide)} {...props} />;
}

/** The <summary> of a <details> that shrinks while pressed */
export function PressSummary({ wide, ...props }: HTMLMotionProps<"summary"> & Wide) {
  return <m.summary whileTap={usePress(wide)} {...props} />;
}
