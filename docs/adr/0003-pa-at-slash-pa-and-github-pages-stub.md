# ADR-0003: PA Dashboard ย้ายไป /pa และ GitHub Pages เป็นหน้า stub

- สถานะ: ยอมรับ · 29 ต.ค. 2569 (D2, D3)
- เกี่ยวข้อง: SPEC §4, §11, §12.6

## บริบท

หน้าแรกของ repo จะกลายเป็น Data Center แต่ PA Dashboard ต้องใช้ต่อได้เหมือนเดิม และมีลิงก์ PA ที่แชร์ไปแล้วในรูป `/pa-dashboard/?cat=…` บน GitHub Pages

## การตัดสินใจ

- PA ย้ายไป `/pa` โดยย้ายไฟล์เท่านั้น ไม่แก้โค้ด PA ทั้งฝั่งเว็บและฝั่ง GAS (`BATCH_ALL` คงรูปแบบและการคำนวณเดิม)
- GitHub Pages คงไว้เป็นหน้า stub (`index.html` กับ `404.html` เนื้อหาเดียวกัน) ที่ส่งต่อไปโดเมนใหม่ (`/pa-dashboard/?cat=X` → `/pa?cat=X`, `/pa-dashboard/sync` → `/sync`) ไม่มี redirect ในแอป
- ระหว่างตัด `basePath` จนถึงขึ้น stub `deploy.yml` ต้องไม่ deploy อัตโนมัติ

## ผลที่ตามมา

- PA เป็นกล่องดำที่ห้ามแก้ กฎนี้อยู่ใน `CODING_STANDARDS.md`
- ลิงก์เก่าใช้ได้ตลอดโดยไม่มีค่าใช้จ่าย
