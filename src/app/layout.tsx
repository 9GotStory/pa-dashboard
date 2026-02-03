import type { Metadata } from "next";
import { prompt, sarabun } from "@/lib/fonts";
import "./globals.css";

export const metadata: Metadata = {
  title: "PA Dashboard - Song District Health KPIs",
  description: "Health indicators for Song District, Phrae Province",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${prompt.variable} ${sarabun.variable} antialiased text-slate-900 bg-slate-50 font-sans`}
      >
        {children}
      </body>
    </html>
  );
}
