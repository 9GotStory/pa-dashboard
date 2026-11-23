import { domAnimation } from "motion/react";

// Motion's feature set, which MotionRoot loads with a dynamic import, so it is
// in none of the JavaScript the HTML loads (ADR-0018, dc:budget checks).
// Import it nowhere else.
export default domAnimation;
