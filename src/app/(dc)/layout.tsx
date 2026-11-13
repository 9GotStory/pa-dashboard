import Footer from "@/components/dc/Footer";
import HeadingFocus from "@/components/dc/HeadingFocus";
import Masthead from "@/components/dc/Masthead";
import { prompt, sarabun } from "@/lib/dc/fonts";

// Frame of the Data Center pages /, /reports and /reports/[id] (SPEC §4,
// §9.1). /pa and /sync sit outside this route group, so PA keeps its look.
// The wrapper sets the font variables that font-dc and font-prompt read.
// wrap-break-word: HDC names such as "BCG ,HBV1,DTP1,…" have no break point
// after their commas and would widen the page at 360 px. The scroll margin is
// taller than the sticky Masthead (two rows below md, one from md), so an
// element scrolled to by focus is not hidden under it.
export default function DcLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div
      className={`${prompt.variable} ${sarabun.variable} dc flex min-h-screen flex-col bg-dc-canvas **:scroll-mt-32 md:**:scroll-mt-20 font-dc text-sm/[1.65] text-dc-brand-deep wrap-break-word`}
    >
      <a
        href="#main"
        className="absolute -top-24 left-4 z-50 rounded-md border-2 border-dc-brand-accent bg-white px-3.5 py-2.5 font-bold text-dc-brand-deep focus:top-2"
      >
        ข้ามไปยังเนื้อหาหลัก
      </a>
      <Masthead />
      <main
        id="main"
        tabIndex={-1}
        className="mx-auto w-full max-w-330 flex-1 px-4 pt-5 pb-12 focus:outline-none sm:px-8 sm:pt-7"
      >
        {children}
      </main>
      <Footer />
      <HeadingFocus />
    </div>
  );
}
