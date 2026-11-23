// The folded part of เกี่ยวกับรายงานนี้ (SPEC §9.1 "motion", §9.4, F92): a
// <details>, so it opens without JavaScript and in print, whose body grows
// and shrinks once Motion can move it.

/**
 * open: the <details>'s open. shown: whether the body is growing or grown,
 * not shrinking or shut; the <details> stays open while its body shrinks.
 */
type Fold = { open: boolean; shown: boolean };

/**
 * What moves a fold: press, a press on its summary that Motion moves; done,
 * the end of the body's movement; toggle, the <details>'s toggle event with
 * its open, which is the browser's own opening or closing (before Motion can
 * move the body, or find in page) or the echo of the fold's.
 */
type FoldEvent = { type: "press" } | { type: "done" } | { type: "toggle"; open: boolean };

export const FOLDED: Fold = { open: false, shown: false };

export function foldStep(fold: Fold, event: FoldEvent): Fold {
  switch (event.type) {
    case "press":
      return { open: true, shown: !fold.shown };
    case "done":
      return fold.shown ? fold : FOLDED;
    case "toggle":
      return event.open === fold.open ? fold : { open: event.open, shown: event.open };
  }
}
