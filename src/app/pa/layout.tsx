import type { Metadata } from "next";

// PA's metadata from before the move to /pa: the root layout's metadata is the
// Data Center's, and page.tsx is a client component, which cannot export it.
export const metadata: Metadata = {
  title: "PA Dashboard - Song District Health KPIs",
  description: "Health indicators for Song District, Phrae Province",
};

export default function PaLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return children;
}
