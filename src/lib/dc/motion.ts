// The one duration and easing of the Data Center's motion (SPEC §9.1,
// CODING_STANDARDS §4): MotionRoot hands TRANSITION to MotionConfig, so no
// component writes a number of its own. They are Tailwind's defaults for
// transition-colors (150ms, cubic-bezier(0.4, 0, 0.2, 1)), so a control's
// colour and its press move together.
export const TRANSITION = { duration: 0.15, ease: [0.4, 0, 0.2, 1] as [number, number, number, number] };

// How far a control shrinks while pressed (F90): a button or a link by 3%, a
// row or a card, which can be a page wide, by 1%, so both move a few pixels.
export const PRESS = { scale: 0.97 };
export const PRESS_WIDE = { scale: 0.99 };

// How a bar slides to its new value, and a folded part grows and shrinks
// (F92): slower than TRANSITION, so the viewer sees which bars changed, on
// the same easing. INSTANT is the same change at once, for a viewer who asks
// for reduced motion: width and height are not transforms, which
// MotionConfig would still for them.
export const CHANGE = { duration: 0.3, ease: TRANSITION.ease };
export const INSTANT = { duration: 0 };

// The body of a folded part (src/lib/dc/fold.ts, F92): grown to the height
// of what is in it (auto, which Motion measures), or shrunk to nothing. Motion
// starts each from the height the body has, so a shut body must already be at
// 0 when it starts to grow.
export const FOLD_BODY = {
  shown: { height: "auto" },
  hidden: { height: 0 },
};

// How the results come in after แสดงผล (F91): from clear to shown, as
// keyframes so the fade starts from clear even when it is already shown.
export const FADE_IN = { opacity: [0, 1] };

// The highlight behind a line of the home page that a ตำบล pick changed
// (ChangeFlash, F93): it shows at once and fades over TRANSITION. A fade, so
// it plays for a viewer who asks for reduced motion too.
export const FLASH = { opacity: [1, 0] };

// The "กำลังโหลดแผนที่…" cover once the map has loaded (F93): from
// STILL_SHOWN, it fades out over TRANSITION, then goes.
export const FADED = { opacity: 0 };

// The grey blocks of a box that waits for data (ReportLoading, F91): they dim
// and come back until the data comes, which tells the viewer the page is
// still at work. A wait, not a press, so slower than TRANSITION. STILL_SHOWN
// is the same blocks, still, for a viewer who asks for reduced motion.
export const PULSE = { opacity: [1, 0.5, 1] };
export const PULSE_TRANSITION = { duration: 1.6, ease: "easeInOut", repeat: Infinity } as const;
export const STILL_SHOWN = { opacity: 1 };
