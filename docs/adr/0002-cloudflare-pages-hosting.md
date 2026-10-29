# ADR-0002: Hosting บน Cloudflare Pages ไม่มี basePath

- สถานะ: ยอมรับ · 29 ต.ค. 2569 (D1, D6)
- เกี่ยวข้อง: SPEC §4, §12.5, §15

## บริบท

เดิม deploy บน GitHub Pages ที่ `https://9gotstory.github.io/pa-dashboard/` ซึ่งบังคับ path ชื่อ repo (`basePath: '/pa-dashboard'`) และมีข้อจำกัดเรื่อง build อัตโนมัติ

## การตัดสินใจ

- ย้ายไป Cloudflare Pages ต่อกับ repo โดยตรง production branch = `main` ปิด preview deployments
- ไม่มี `basePath` Data Center อยู่ที่ `/` PA อยู่ที่ `/pa`
- เฟส 1 ใช้ `<project>.pages.dev` ยังไม่มีโดเมนเอง ทุกจุดที่อ้างโดเมนต้องแก้ที่เดียว (ค่า `<ORIGIN>` ใน stub)

## ผลที่ตามมา

- ลิงก์เก่าบน `github.io` ต้องมีหน้า stub ส่งต่อ (ADR-0003)
- Cloudflare Access ระดับ path ใช้กับ `pages.dev` ไม่ได้ จึงยังไม่มี (เกี่ยวกับ ADR-0005)
- ตัวแปร build (`NEXT_PUBLIC_*`) ย้ายไปตั้งที่ Cloudflare และ `ci.yml` ต้องส่ง env เข้า build step เอง
