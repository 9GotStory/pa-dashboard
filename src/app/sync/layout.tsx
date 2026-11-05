import { Toaster } from "sonner";
import { prompt, sarabun } from "@/lib/fonts";

// /sync's page is frozen (CODING_STANDARDS §1), so the toaster its toasts need
// and PA's fonts sit in this layout. As in /pa's layout, the root layout leaves
// them out so the Data Center pages neither load sonner nor preload the 20 font
// files (SPEC §9.6), and display: contents keeps the page's layout.
export default function SyncLayout({
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
