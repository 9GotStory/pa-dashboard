import type { Metadata } from "next";
import { Toaster } from "sonner";

// PA's metadata from before the move to /pa: the root layout's metadata is the
// Data Center's, and page.tsx is a client component, which cannot export it.
export const metadata: Metadata = {
  title: "PA Dashboard - Song District Health KPIs",
  description: "Health indicators for Song District, Phrae Province",
};

// The toaster sits here and in /sync's layout rather than in the root layout,
// so the Data Center pages do not load sonner (SPEC §9.6).
export default function PaLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <>
      {children}
      <Toaster position="top-center" richColors />
    </>
  );
}
