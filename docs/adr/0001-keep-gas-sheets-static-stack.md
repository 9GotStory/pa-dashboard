# ADR-0001: คง stack GAS + Google Sheets + Next.js static export

- สถานะ: ยอมรับ · 29 ต.ค. 2569
- เกี่ยวข้อง: SPEC §3, §11

## บริบท

repo มี branch `develop` ที่ย้ายไป Backend v2 (Fastify + PostgreSQL + Podman) ตาม ADR เดิมใน `docs/architecture/0001-backend-v2-architecture.md` ของ branch นั้น แต่ทีมตัดสินใจไม่ใช้ต่อ ส่วน `main` คือระบบที่ใช้งานจริง: Google Apps Script เป็น API, Google Sheets เป็นฐานข้อมูล, Next.js static export เป็นหน้าเว็บ

## การตัดสินใจ

Song Health Data Center สร้างบน stack ของ `main`: GAS + Google Sheets + Next.js static export ไม่ใช้ Backend v2 และไม่แตะ branch `develop`

## ผลที่ตามมา

- ไม่มี server ที่ต้องดูแลเอง ค่าใช้จ่ายเป็นศูนย์
- ข้อจำกัดของ GAS (GET ส่งค่าทาง query เท่านั้น, POST ต้อง `text/plain`, ทำงานพร้อมกันได้จำกัด, ไม่มี custom header) เป็นข้อจำกัดของระบบ และเป็นเหตุผลของ ADR-0006
- `develop` ค้างไว้ ไม่ merge ไม่ลบ
