import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Song Health Data Center",
  description: "ศูนย์ข้อมูลสุขภาพอำเภอสอง จังหวัดแพร่",
};

// PA's <Toaster> is in the /pa and /sync layouts, not here, so the Data Center
// pages do not load sonner (SPEC §9.6). So are PA's fonts, which preload 20
// files; the (dc) layout sets the Data Center's own, which preload none.
export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="th">
      <body className="antialiased text-slate-900 bg-slate-50 font-sans">{children}</body>
    </html>
  );
}
