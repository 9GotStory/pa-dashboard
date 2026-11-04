import type { Metadata } from "next";
import { prompt, sarabun } from "@/lib/fonts";
import "./globals.css";

export const metadata: Metadata = {
  title: "Song Health Data Center",
  description: "ศูนย์ข้อมูลสุขภาพอำเภอสอง จังหวัดแพร่",
};

import { Toaster } from "sonner";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="th">
      <body
        className={`${prompt.variable} ${sarabun.variable} antialiased text-slate-900 bg-slate-50 font-sans`}
      >
        {children}
        <Toaster position="top-center" richColors />
      </body>
    </html>
  );
}
