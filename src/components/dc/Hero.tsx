import { ArrowRight, ChevronRight } from "lucide-react";

/**
 * The Hero of the home page after V7.6 (SPEC §9.2): the page's <h1>, one
 * filled link to the ข้อมูลพื้นที่ section and, with population, a text link
 * to the เปรียบเทียบประชากรรายตำบล section. Both go to the sections' id; the
 * (dc) layout's scroll margin keeps their heading clear of the Masthead. The
 * art is an abstract picture, not a map, and is shorter on a phone so the
 * heading and the links fit the first screen. From lg, where the art is a
 * tall right column, it carries a large "สอง." for the eye and a tagline a
 * screen reader reads, at its bottom left. Its letter spacing is looser than
 * V7.6's -.09em, which is set for a narrower font: in Prompt the letters of
 * "สอง." run into each other at -.09em.
 * While the Hero is on the page, <html> scrolls smoothly unless the person
 * asks for reduced motion: scroll-behavior works only on the element that
 * scrolls, and set here it leaves the other pages and PA as they are.
 */
export default function Hero({ hasComparison }: { hasComparison: boolean }) {
  return (
    <section
      aria-labelledby="hero-title"
      className="mb-8 grid overflow-hidden rounded-[20px] bg-dc-surface motion-safe:[html:has(&)]:scroll-smooth sm:mb-10 lg:min-h-[460px] lg:grid-cols-[1.07fr_0.93fr]"
    >
      <div className="flex flex-col justify-center px-5 py-6 sm:px-12 sm:py-12 lg:px-16">
        <h1 id="hero-title" className="font-prompt text-4xl leading-[1.3] font-bold text-dc-brand-deep sm:text-5xl lg:text-6xl">
          มองเห็นพื้นที่{" "}
          <span className="block text-dc-brand-accent">เข้าใจสุขภาพ.</span>
        </h1>
        <p className="mt-4 max-w-[490px] text-[13px] leading-[1.9] text-dc-text-secondary sm:mt-5 sm:text-[15px]">
          ศูนย์รวมข้อมูลประชากร โครงสร้างช่วงวัย และรายงานสาธารณสุขอำเภอสอง เพื่อให้ทุกการตัดสินใจเริ่มต้นจากบริบทของพื้นที่จริง
        </p>
        <div className="mt-6 flex flex-wrap items-center gap-3 sm:mt-8">
          <a
            href="#area"
            className="inline-flex min-h-12 items-center gap-2 rounded-xl bg-dc-brand-primary px-5 font-bold text-white hover:bg-dc-brand-deep"
          >
            สำรวจข้อมูลพื้นที่
            <ArrowRight aria-hidden="true" className="size-4" />
          </a>
          {hasComparison && (
            <a href="#comparison" className="inline-flex min-h-11 items-center gap-1.5 px-2 font-bold text-dc-brand-primary hover:underline">
              เปรียบเทียบประชากร
              <ChevronRight aria-hidden="true" className="size-4" />
            </a>
          )}
        </div>
      </div>

      <div className="relative h-28 sm:h-56 lg:h-auto">
        <svg aria-hidden="true" viewBox="0 0 570 520" preserveAspectRatio="xMidYMid slice" className="absolute inset-0 size-full">
          <defs>
            <pattern id="hero-dots" width="26" height="26" patternUnits="userSpaceOnUse">
              <circle cx="1" cy="1" r="0.85" className="fill-dc-highlight-soft/25" />
            </pattern>
          </defs>
          <rect width="570" height="520" className="fill-dc-brand-dark-surface" />
          <rect width="570" height="520" fill="url(#hero-dots)" />
          <g fill="none" transform="rotate(-15 355 220)" className="stroke-dc-highlight-soft/20">
            {[
              [160, 150],
              [200, 184],
              [240, 220],
              [280, 260],
            ].map(([rx, ry]) => (
              <ellipse key={rx} cx="355" cy="220" rx={rx} ry={ry} />
            ))}
          </g>
          <path d="M78 370Q165 280 275 308T523 171" fill="none" strokeWidth="2" strokeDasharray="4 8" className="stroke-dc-highlight-soft/25" />
          <path d="M122 150C161 87 255 88 296 135S400 179 438 139" fill="none" strokeWidth="1.6" className="stroke-dc-highlight-soft/50" />
          <path d="M70 425c90-50 170-17 244-63s146-42 213-32" fill="none" className="stroke-dc-highlight-soft/20" />
          <path d="M90 445c90-50 167-19 247-60s150-40 190-29" fill="none" className="stroke-dc-highlight-soft/20" />
          <circle cx="295" cy="135" r="6.5" className="fill-dc-highlight-soft" />
          <circle cx="295" cy="135" r="14" fill="none" className="stroke-dc-highlight-soft/40" />
          <circle cx="438" cy="139" r="4" className="fill-dc-highlight-soft" />
        </svg>
        <div className="absolute bottom-0 left-0 hidden px-12 py-10 lg:block">
          <p aria-hidden="true" className="font-prompt text-[128px] leading-[1.15] font-bold tracking-[-.04em] text-dc-highlight-soft">
            สอง<span className="text-dc-highlight-soft/75">.</span>
          </p>
          <div aria-hidden="true" className="mt-4 h-px w-25 bg-dc-highlight-soft/75" />
          <p className="mt-4 max-w-[300px] text-[13px] leading-[1.85] text-dc-highlight-soft/75">
            ข้อมูลท้องถิ่นที่เข้าถึงได้
            <br />
            เพื่อสร้างภาพอนาคตสุขภาพที่ชัดเจน
          </p>
        </div>
      </div>
    </section>
  );
}
