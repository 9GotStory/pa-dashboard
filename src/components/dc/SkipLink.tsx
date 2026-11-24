// The link to the main content, first on every page under the Masthead: the
// (dc) layout's and, since F97, PA's (SPEC §9.1). It targets the element with
// id="main".
export default function SkipLink() {
  return (
    <a
      href="#main"
      className="absolute -top-24 left-4 z-50 rounded-md border-2 border-dc-brand-accent bg-white px-3.5 py-2.5 font-bold text-dc-brand-deep transition-colors hover:bg-dc-highlight-soft focus:top-2 active:bg-dc-surface-muted"
    >
      ข้ามไปยังเนื้อหาหลัก
    </a>
  );
}
