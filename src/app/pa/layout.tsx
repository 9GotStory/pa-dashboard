import type { Metadata } from "next";
import { Toaster } from "sonner";
import Footer from "@/components/dc/Footer";
import Masthead from "@/components/dc/Masthead";
import SkipLink from "@/components/dc/SkipLink";
import { prompt, sarabun } from "@/lib/dc/fonts";

// PA's metadata from before the move to /pa: the root layout's metadata is the
// Data Center's, and page.tsx is a client component, which cannot export it.
export const metadata: Metadata = {
  title: "PA Dashboard - Song District Health KPIs",
  description: "Health indicators for Song District, Phrae Province",
};

// The Data Center's text and focus ring, as the (dc) layout's wrapper sets
// them, for the frame alone: PA's content does not take them (SPEC §4).
const DC_FRAME_TEXT = "dc contents font-dc text-sm/[1.65] text-dc-brand-deep";

// PA under the Data Center's Masthead and Footer (ADR-0019, SPEC §9.1 "PA ใต้
// Masthead", F97). The toaster sits here and in /sync's layout rather than in
// the root layout, so the Data Center pages do not load sonner (SPEC §9.6).
// The fonts are the Data Center's: PA's weights and variables, but not
// preloaded, since PA's 20 preloaded files held back the CSS that /pa's first
// paint waits on (#332). display: contents lays the page out as it was
// directly in <body>, where the font variables used to be, and keeps <body>
// the box the Masthead sticks in. PA's own <main> stays the one main; the
// skip link targets the block around it, whose scroll margin is the (dc)
// layout's, taller than the Masthead, so the jump does not hide PA's title. KPITable's sticky header and columns
// (z-20 to z-50) would paint over the Masthead's z-30 as they scroll under
// it, so each <table> is a stacking context of its own; KPIDetailModal, a
// sibling of the tables, keeps its z-50 over the Masthead.
export default function PaLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div className={`${prompt.variable} ${sarabun.variable} contents`}>
      <div className={DC_FRAME_TEXT}>
        <SkipLink />
        <Masthead />
      </div>
      <div id="main" tabIndex={-1} className="scroll-mt-32 focus:outline-none md:scroll-mt-20 [&_table]:isolate">
        {children}
      </div>
      <div className={DC_FRAME_TEXT}>
        <Footer />
      </div>
      <Toaster position="top-center" richColors />
    </div>
  );
}
