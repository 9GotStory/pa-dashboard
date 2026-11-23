"use client";

import * as m from "motion/react-m";
import { useChangeTransition, useMotionReady } from "../MotionRoot";

// The bars of the report pages slide from their old value to a new one when
// the results change (SPEC §9.1 "motion", F92). A bar first shows at its
// value (initial false), so the HTML and a first render never grow from 0.
// Before Motion's features load it is a plain element: an m component would
// keep the value of its first render.

/** A bar as a <span> of width, a CSS width such as "40%" */
export function Bar({ width, className }: { width: string; className: string }) {
  const ready = useMotionReady();
  const transition = useChangeTransition();
  if (!ready) return <span className={className} style={{ width }} />;
  return <m.span initial={false} animate={{ width }} transition={transition} className={className} />;
}

/** A bar as an SVG <rect>: x and the width across, y and the height down, each an SVG length such as "40%" */
export function BarRect({
  x,
  y,
  width,
  height,
  rx,
  className,
}: {
  x?: string;
  y?: string;
  width: string;
  height: string;
  rx?: string;
  className: string;
}) {
  const ready = useMotionReady();
  const transition = useChangeTransition();
  if (!ready) return <rect x={x} y={y} width={width} height={height} rx={rx} className={className} />;
  // attrY: y is the attribute, which Motion would otherwise take for a transform
  return (
    <m.rect
      x={x}
      rx={rx}
      initial={false}
      animate={y === undefined ? { width, height } : { attrY: y, width, height }}
      transition={transition}
      className={className}
    />
  );
}
