"use client";

import { useEffect, useRef, type ReactNode, type RefObject } from "react";

// ส่วนเปิดดูรายละเอียด (SPEC §9.4): a page's ภาพรวม lists รายการ or ด้าน, and
// one of them opens in a รายละเอียด kept in the URL (?measure=, ?domain=).

/** The id of the รายละเอียด, which the buttons of ภาพรวม control */
const DETAIL_ID = "report-detail";

/**
 * The state of a page's รายละเอียด: shown is the item open (null: ภาพรวม)
 * and show pushes the query that opens another or closes it, so back and
 * forward go through them. Opening moves focus to the heading of the
 * รายละเอียด and closing to that of ภาพรวม (overview) once the page shows
 * it; a link that opens one straight away, back and forward leave focus be.
 */
export function useDetail(shown: string | null, show: (item: string | null) => void) {
  const overview = useRef<HTMLHeadingElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  // Where focus goes once the page shows what was asked: set by open and close only
  const moving = useRef<RefObject<HTMLHeadingElement | null>>(null);
  useEffect(() => {
    if (moving.current) focus(moving.current.current);
    moving.current = null;
  }, [shown]);
  const move = (to: RefObject<HTMLHeadingElement | null>, item: string | null) => {
    // The item shown already: no change of URL for the effect to see
    if (item === shown) return focus(to.current);
    moving.current = to;
    show(item);
  };
  return {
    /** For the heading of ภาพรวม, where focus goes back on close */
    overview,
    heading,
    /** The props of the real <button> that opens item (SPEC §9.4) */
    button: (item: string) => ({
      type: "button" as const,
      "aria-expanded": item === shown,
      "aria-controls": DETAIL_ID,
      onClick: () => move(heading, item),
    }),
    close: () => move(overview, null),
  };
}

/** Scrolls to the section a heading opens, with what is above the heading in it, and focuses the heading */
function focus(heading: HTMLHeadingElement | null) {
  heading?.closest("section")?.scrollIntoView({ block: "start" });
  heading?.focus({ preventScroll: true });
}

/**
 * Where the รายละเอียด of useDetail goes: always on the page, as the buttons
 * of ภาพรวม point at it, and empty for ภาพรวม (title null). Its heading
 * (useDetail's heading) takes focus without a ring, as no key put it there;
 * ปิดรายละเอียด (useDetail's close) goes back to ภาพรวม.
 */
export default function Detail(props: {
  headingRef: RefObject<HTMLHeadingElement | null>;
  onClose: () => void;
  /** What is open, as "วัคซีน MMR"; null for ภาพรวม */
  title: string | null;
  /** What kind of item is open, as "รายละเอียดเฉพาะวัคซีนที่เลือก" */
  eyebrow: string;
  /** The year and area of the figures */
  context: string;
  children?: ReactNode;
}) {
  const { headingRef, onClose, title, eyebrow, context, children } = props;
  return (
    <div id={DETAIL_ID}>
      {title !== null && (
        <section aria-labelledby={`${DETAIL_ID}-title`} className="mt-6">
          <div className="mb-4 flex flex-wrap items-start justify-between gap-2 border-b border-dc-border-subtle pb-3">
            <div className="min-w-0">
              <p className="text-[11px] font-semibold text-dc-brand-accent">{eyebrow}</p>
              <h3
                id={`${DETAIL_ID}-title`}
                ref={headingRef}
                tabIndex={-1}
                className="mt-0.5 font-prompt text-xl font-semibold text-dc-brand-deep focus:outline-none"
              >
                {title}
              </h3>
              <p className="mt-1 text-xs text-dc-text-secondary">{context}</p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="min-h-10 rounded-md border border-dc-border-subtle bg-white px-3 text-xs text-dc-text-secondary hover:bg-dc-surface-muted print:hidden"
            >
              ปิดรายละเอียด
            </button>
          </div>
          {children}
        </section>
      )}
    </div>
  );
}
