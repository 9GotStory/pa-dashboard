import { Toaster } from "sonner";

// /sync's page is frozen (CODING_STANDARDS §1), so the toaster its toasts need
// sits in this layout. As in /pa's layout, the root layout leaves it out so the
// Data Center pages do not load sonner (SPEC §9.6).
export default function SyncLayout({
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
