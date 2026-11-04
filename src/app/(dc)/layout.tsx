import Footer from "@/components/dc/Footer";
import HeadingFocus from "@/components/dc/HeadingFocus";
import Masthead from "@/components/dc/Masthead";

// Frame of the Data Center pages /, /reports and /reports/[id] (SPEC §4,
// §9.1). /pa and /sync sit outside this route group, so PA keeps its look.
// wrap-break-word: HDC names such as "BCG ,HBV1,DTP1,…" have no break point
// after their commas and would widen the page at 360 px.
export default function DcLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div className="dc flex min-h-screen flex-col bg-dc-canvas font-dc text-sm/[1.65] text-dc-ink wrap-break-word">
      <a
        href="#main"
        className="absolute -top-24 left-4 z-50 rounded-md border-2 border-dc-green bg-white px-3.5 py-2.5 font-bold text-dc-navy focus:top-2"
      >
        ข้ามไปยังเนื้อหาหลัก
      </a>
      <Masthead />
      <main id="main" tabIndex={-1} className="mx-auto w-full max-w-7xl flex-1 px-4 pt-5 pb-12 focus:outline-none sm:px-7 sm:pt-7">
        {children}
      </main>
      <Footer />
      <HeadingFocus />
    </div>
  );
}
