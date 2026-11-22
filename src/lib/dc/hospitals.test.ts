import assert from "node:assert/strict";
import test from "node:test";
import { hospitalName } from "./hospitals";

// #346 / SCHEMA §4.4: คำนำหน้าหน่วยบริการ of the 17 หน่วยบริการ as
// hcode.moph.go.th named them on 22 Nov 2569, part of them.
const HOSPITALS = [
  { hospcode: "11170", hospname: "สอง", tambon_id: "540601", hospprefix: "รพ." },
  { hospcode: "06413", hospname: "บ้านหนุน", tambon_id: "540601", hospprefix: "รพ.สต." },
  { hospcode: "10368", hospname: "แม่แรม", tambon_id: "540604", hospprefix: "สสช." },
  { hospcode: "06414", hospname: "ทุ่งน้าว", tambon_id: "540608", hospprefix: "" },
  { hospcode: "06415", hospname: "วังดิน", tambon_id: "540602", hospprefix: "รพ.สต" },
  { hospcode: "06416", hospname: "ลูนิเกตุ", tambon_id: "540603" },
];

test("each คำนำหน้าหน่วยบริการ → written right before hospname: รพ.สอง, รพ.สต.บ้านหนุน, สสช.แม่แรม", () => {
  assert.equal(hospitalName("11170", HOSPITALS), "รพ.สอง");
  assert.equal(hospitalName("06413", HOSPITALS), "รพ.สต.บ้านหนุน");
  assert.equal(hospitalName("10368", HOSPITALS), "สสช.แม่แรม");
});

test("hospprefix blank, not one of the 3, or missing (catalog.json before #346) → hospname alone", () => {
  assert.equal(hospitalName("06414", HOSPITALS), "ทุ่งน้าว");
  assert.equal(hospitalName("06415", HOSPITALS), "วังดิน");
  assert.equal(hospitalName("06416", HOSPITALS), "ลูนิเกตุ");
});

test("a hospcode not in hospitals → หน่วยบริการ {hospcode}", () => {
  assert.equal(hospitalName("77777", HOSPITALS), "หน่วยบริการ 77777");
});
