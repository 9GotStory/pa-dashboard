/**
 * The compact Hero of /reports after V1.4 (SPEC §9.3): the page's <h1> and a
 * line on what the page is for. From md the art of stacked documents and its
 * caption take the right column; below md there is no art, so the search and
 * the list sit close under the heading. The art is drawn with the V7.6 tokens
 * in place of V1.4's raw hex.
 */
export default function ReportsHero() {
  return (
    <section
      aria-labelledby="reports-title"
      className="grid overflow-hidden rounded-[25px] bg-dc-surface md:min-h-[214px] md:grid-cols-[minmax(0,1.24fr)_minmax(0,0.76fr)]"
    >
      <div className="flex min-w-0 flex-col justify-center px-6 py-7 sm:px-9 sm:py-8 lg:px-11">
        <h1 id="reports-title" className="font-prompt text-[36px] leading-[1.25] font-bold text-dc-brand-deep sm:text-[40px] lg:text-[43px]">
          รายงานสุขภาพ<span className="text-dc-brand-accent">.</span>
        </h1>
        <p className="mt-3 max-w-[535px] text-[13px] leading-[1.85] text-dc-text-secondary sm:text-sm">
          สำรวจและค้นหารายงานด้านสุขภาพและสาธารณสุขของอำเภอสอง จังหวัดแพร่
        </p>
      </div>

      <div className="relative hidden bg-dc-brand-dark-surface md:block">
        <svg aria-hidden="true" viewBox="0 0 460 225" fill="none" preserveAspectRatio="xMidYMid slice" className="absolute inset-0 size-full">
          <circle cx="451" cy="75" r="155" className="stroke-dc-highlight-soft/10" />
          <circle cx="96" cy="241" r="160" className="stroke-dc-highlight-soft/10" />
          <path d="M0 197C113 105 163 206 270 87C356-2 402 49 470 5" strokeWidth="1.3" className="stroke-dc-highlight-soft/30" />
          <path d="M-10 223C124 154 177 245 299 126C364 64 419 105 477 53" strokeWidth="1.1" className="stroke-dc-highlight-soft/15" />
          <circle cx="80" cy="155" r="3.5" className="fill-dc-highlight-soft" />
          <circle cx="375" cy="55" r="3.5" className="fill-dc-highlight-soft/70" />
          <g transform="translate(215 27)" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round">
            <rect x="-25" y="18" width="104" height="140" rx="10" transform="rotate(-11 27 88)" className="stroke-dc-highlight-soft/30" />
            <rect x="-4" y="13" width="104" height="140" rx="10" className="fill-dc-brand-accent/60 stroke-dc-highlight-soft/65" />
            <rect x="17" y="31" width="108" height="145" rx="12" className="fill-dc-brand-primary stroke-dc-highlight-soft/70" />
            <path d="M39 62H98M39 85H108M39 108H87M39 131H100" strokeWidth="3.5" className="stroke-dc-highlight-soft/80" />
          </g>
        </svg>
        <p className="absolute bottom-5 left-8 flex items-center gap-2 text-[11px] text-dc-highlight-soft">
          <span aria-hidden="true" className="h-px w-7 bg-dc-highlight-soft/70" />
          ค้นพบข้อมูลได้ง่ายในที่เดียว
        </p>
      </div>
    </section>
  );
}
