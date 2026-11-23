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

// How the results come in after แสดงผล (F91): from clear to shown, as
// keyframes so the fade starts from clear even when it is already shown.
export const FADE_IN = { opacity: [0, 1] };
