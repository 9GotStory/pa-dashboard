import Footer from "@/components/dc/Footer";
import HeadingFocus from "@/components/dc/HeadingFocus";
import Masthead from "@/components/dc/Masthead";
import MotionRoot from "@/components/dc/MotionRoot";
import SkipLink from "@/components/dc/SkipLink";
import { prompt, sarabun } from "@/lib/dc/fonts";

// Frame of the Data Center pages /, /reports and /reports/[id] (SPEC §4,
// §9.1). /pa and /sync sit outside this route group: /pa's layout sets the
// same Masthead and Footer around PA (F97), without this wrapper's classes.
// The wrapper sets the font variables that font-dc and font-prompt read.
// wrap-break-word: HDC names such as "BCG ,HBV1,DTP1,…" have no break point
// after their commas and would widen the page at 360 px. The scroll margin is
// taller than the sticky Masthead (two rows below md, one from md), so an
// element scrolled to by focus is not hidden under it. touch-manipulation: a
// tap on a touch screen acts at once, as no double tap zooms (SPEC §9.1,
// F95); a pinch still does. Every heading wraps to lines of even length.
export default function DcLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div
      className={`${prompt.variable} ${sarabun.variable} dc flex min-h-screen touch-manipulation flex-col bg-dc-canvas **:scroll-mt-32 md:**:scroll-mt-20 [&_:is(h1,h2,h3,h4)]:text-balance font-dc text-sm/[1.65] text-dc-brand-deep wrap-break-word`}
    >
      <SkipLink />
      <Masthead />
      <main
        id="main"
        tabIndex={-1}
        className="mx-auto w-full max-w-330 flex-1 px-4 pt-5 pb-12 focus:outline-none sm:px-8 sm:pt-7"
      >
        <MotionRoot>{children}</MotionRoot>
      </main>
      <Footer />
      <HeadingFocus />
    </div>
  );
}
