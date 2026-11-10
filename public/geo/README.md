# ขอบเขตตำบล อำเภอสอง

`song-tambon.geojson` คือขอบเขต 8 ตำบลของอำเภอสอง จังหวัดแพร่ (FeatureCollection, 8 features) ที่หน้าแรกของ Data Center ใช้วาดแผนที่ ([ADR-0004](../../docs/adr/0004-static-geojson-boundaries.md), SCHEMA §8)

| เรื่อง | ค่า |
|---|---|
| แหล่ง | MOPH GIS layer `tambon` <https://pherportal.moph.go.th/arcgis/rest/services/MOPH_DATA/tambon/MapServer/0> |
| URL ที่ใช้ดาวน์โหลด | <https://pherportal.moph.go.th/arcgis/rest/services/MOPH_DATA/tambon/MapServer/0/query?where=ADMIN_ID2%3D%275406%27&outFields=ADMIN_ID3%2CNAME3%2CNAME2%2CNAME1&returnGeometry=true&outSR=4326&geometryPrecision=5&f=geojson> |
| วันที่ดาวน์โหลด | 4 พ.ย. 2569 |
| properties | `ADMIN_ID3` รหัสตำบล 6 หลัก (= `tambon_master.id`) · `NAME3` ชื่อตำบล · `NAME2` อำเภอ · `NAME1` จังหวัด |

ไฟล์คือ response ของ URL ข้างบนโดยไม่แก้ไข ถ้าจะดาวน์โหลดใหม่ ให้บันทึก response ของ URL เดิมทับไฟล์ ตรวจตามเกณฑ์ของ F17 ใน FEATURES.md แล้วแก้วันที่ดาวน์โหลดในไฟล์นี้และใน `BOUNDARY_DOWNLOADED` ของ `src/app/(dc)/page.tsx` ซึ่งส่วนที่มาของข้อมูลของหน้าแรกแสดง
