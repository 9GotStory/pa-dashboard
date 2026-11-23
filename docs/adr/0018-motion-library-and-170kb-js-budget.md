# ADR-0018: Data Center ใช้ Motion ทำ animation และงบ JavaScript ขยายเป็น 170 KB

- สถานะ: ยอมรับ · 23 พ.ย. 2569 (D17, grill 23 พ.ย. 2569) · แทนข้อ "ไม่เพิ่ม dependency" ของ CODING_STANDARDS §4 เฉพาะแพ็กเกจ `motion` และงบ 150 KB ของ SPEC §9.6 เฉพาะหน้าของ Data Center
- เกี่ยวข้อง: SPEC §9.1, §9.6, CODING_STANDARDS §4, GLOSSARY "ผู้ชม", ADR-0012, ADR-0013, ADR-0015, ADR-0019

## บริบท

Data Center ไม่มี motion สำรวจเว็บจริงเมื่อ 23 พ.ย. 2569 (build 22 พ.ย. 2569) หน้าแรกและหน้ารายงานไม่มี element ที่มี transition เลย `/reports` มี 22 จุดซึ่งเป็นลูกศรขยับ โค้ดใน `src/components/dc/` ไม่มีสถานะกด ทุกการเปลี่ยนสถานะ (เลือกตำบล กดแสดงผล สลับกราฟกับตาราง) เปลี่ยนในเฟรมเดียว และปุ่มดาวน์โหลด CSV ไม่บอกผลใด ๆ

Product Owner ต้องการ animation, micro-interaction และการบอกสถานะของระบบที่ดีขึ้น โดยต่อยอดแบบอ้างอิงเดิม (V7.6, V1.4, V0.4.2) และให้ใช้ไลบรารีมาตรฐานแทนการเขียน animation เอง ผู้ชมรวมประชาชน ไม่ใช่เฉพาะเจ้าหน้าที่

งบ JavaScript ของ SPEC §9.6 แทบเต็มอยู่แล้ว `dc:budget` ของ `main` 1ff6378: `/` 148.2 KB, `/reports` 145.1 KB, `/reports/population` 148.4 KB, `/reports/{id}` สูงสุด 138.9 KB จากงบ 150 KB

วัด Motion 14.14.0 นอก repo เมื่อ 23 พ.ย. 2569 (esbuild แบบ minify แล้ว `gzip -9` ไม่นับ React):

| วิธีใช้                                    | gzip    |
| ------------------------------------------ | ------- |
| `LazyMotion` กับ `m`                       | 15.9 KB |
| รวมชุด `domAnimation`                      | 37.9 KB |
| รวม `AnimatePresence` กับ `MotionConfig`   | 40.1 KB |
| component `motion` เต็ม                    | 46.6 KB |
| `LazyMotion` กับ `m` และชุด `domMax`       | 53.6 KB |

เอกสารของ Motion ระบุว่า `LazyMotion` กับ `m` เริ่มที่ราว 5 kb (<https://motion.dev/docs/react-reduce-bundle-size>) การวัดนี้ได้มากกว่า จึงใช้ตัวเลขที่วัด

## การตัดสินใจ

- Data Center ใช้แพ็กเกจ `motion` ผ่าน `LazyMotion` กับ `m` เท่านั้น ไม่ใช้ component `motion` เต็ม · ชุด feature โหลดทีหลังด้วย dynamic import และไม่นับในงบ แบบเดียวกับ Leaflet
- งบ JavaScript ของหน้า Data Center เป็น 170 KB (เดิม 150 KB) · ถ้า Next.js แยกชุด feature ออกจาก JavaScript ที่ HTML โหลดไม่ได้ ให้หยุดถามผู้ใช้ก่อนขยายงบอีก (ประเมินราว 195 KB)
- เกณฑ์ LCP ของ SPEC §9.6 ไม่เปลี่ยน: บนเว็บจริงต่ำกว่า 2.5 วินาที และบนเครื่องช้ากว่า `main` ไม่เกิน 10%
- ระบบ motion มีระบบเดียว: การเปลี่ยนสีตอน hover และ focus ใช้ transition ของ Tailwind ที่มีอยู่ ที่เหลือทั้งหมดใช้ Motion · ไม่ติดตั้ง tw-animate-css
- ทุก motion ต้องเข้าข้อใดข้อหนึ่ง: ตอบการกระทำของผู้ชม, บอกว่าข้อมูลส่วนไหนเปลี่ยน, หรือบอกสถานะรอ · ไม่มี scroll reveal ตัวเลขวิ่งนับขึ้น parallax และ animation วนประดับ · ข้อยกเว้นเดียวคือเส้นของภาพใน Hero หน้าแรก ซึ่งวาดตัวเองหนึ่งครั้งตอนเปิดหน้า ถ้าทำด้วย Motion แล้วเส้นเริ่มช้าจนสังเกตได้หรือกระพริบ ให้ตัดข้อนี้ออก ไม่เขียน CSS เองแทน
- ชุด feature ที่ใช้คือ `domAnimation` · ไม่ทำ animation ของ layout (แถบเลือกที่เลื่อนตามปุ่ม แถวที่สลับตำแหน่งตอนเรียง) และไม่ทำ animation ระหว่างหน้า
- ผู้ชมที่ตั้งลดการเคลื่อนไหว (`prefers-reduced-motion`) ไม่เห็นการเคลื่อนที่ (ยุบตอนกด แท่งเลื่อน กางหุบ เส้นใน Hero) แต่เนื้อหายังจางเข้าสั้น ๆ ได้
- การบอกสถานะใน Data Center อยู่ที่ตัว control เอง ไม่ใช้ toast · sonner ยังอยู่เฉพาะ PA กับ `/sync`
- หลัก "ใช้ไลบรารี" ใช้กับของใหม่ คือ motion และ overlay ใหม่ถ้ามี · กราฟ SVG และ control ที่เขียนเองและใช้งานอยู่ไม่เปลี่ยนไปใช้ไลบรารี
- PA ไม่ใช้ Motion (ADR-0019)

## ทางเลือกที่ไม่เลือก

- **transition ของ Tailwind กับ tw-animate-css:** ไม่เพิ่ม JavaScript และอยู่ในงบ 150 KB เดิม เป็นทางที่ผู้ช่วยแนะนำ · Product Owner เลือก Motion โดยรับว่าต้องขยายงบ
- **เขียน keyframes เองเป็น token ใน `@theme`:** ไม่เพิ่ม dependency แต่ Product Owner ไม่ต้องการเขียน animation เอง
- **component `motion` เต็ม:** 46.6 KB ในทุกหน้า มากกว่า `LazyMotion` กับ `m` ราว 3 เท่าตอนโหลดแรก
- **ชุด `domMax` เพื่อ animation ของ layout:** มากกว่า `domAnimation` ราว 16 KB เพื่อแถบเลื่อนกับแถวสลับที่ ซึ่งไม่ช่วยให้อ่านข้อมูลดีขึ้น
- **animation ระหว่างหน้า:** หน้าเป็น static จึงเปลี่ยนเร็วอยู่แล้ว และเสี่ยงทำการย้าย focus ไปหัวข้อหลังเปลี่ยนหน้า (SPEC §9.1) พัง

## ผลที่ตามมา

- ทุกหน้าของ Data Center โหลด JavaScript เพิ่มราว 16 KB ตอนแรก และราว 22 KB ทีหลัง ตัวเลขนี้วัดด้วย esbuild ตัวเลขจริงต้องวัดด้วย `dc:budget` ใน ticket แรก
- animation เริ่มทำงานเมื่อชุด feature โหลดเสร็จ ก่อนหน้านั้นสถานะเปลี่ยนทันทีแบบเดิม
- เอกสารของ Motion ระบุว่า `reducedMotion="user"` ของ `MotionConfig` ปิดเฉพาะ animation ของ transform กับ layout ส่วน opacity และสียังทำงาน (<https://motion.dev/docs/react-motion-config>) เส้นใน Hero จึงต้องปิดเองเมื่อผู้ชมตั้งลดการเคลื่อนไหว
- CODING_STANDARDS §4, SPEC §9.1 และ §9.6 แก้ตามแล้วใน F87 · `dc:budget` แก้ใน F90
