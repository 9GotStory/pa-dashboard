import type { Metadata } from "next";
import { Toaster } from "sonner";
import { prompt, sarabun } from "@/lib/dc/fonts";

// PA's metadata from before the move to /pa: the root layout's metadata is the
// Data Center's, and page.tsx is a client component, which cannot export it.
export const metadata: Metadata = {
  title: "PA Dashboard - Song District Health KPIs",
  description: "Health indicators for Song District, Phrae Province",
};

// The toaster sits here and in /sync's layout rather than in the root layout,
// so the Data Center pages do not load sonner (SPEC §9.6). The fonts are the
// Data Center's: PA's weights and variables, but not preloaded, since PA's 20
// preloaded files held back the CSS that /pa's first paint waits on (#332).
// display: contents lays the page out as it was directly in <body>, where the
// font variables used to be.
export default function PaLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div className={`${prompt.variable} ${sarabun.variable} contents`}>
      {children}
      <Toaster position="top-center" richColors />
    </div>
  );
}
