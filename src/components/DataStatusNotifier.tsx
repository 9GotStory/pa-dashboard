"use client";

import { useEffect } from "react";
import { toast } from "sonner";

export default function DataStatusNotifier({ 
  success = true, 
  recordCount = 0 
}: { 
  success?: boolean;
  recordCount?: number;
}) {
  useEffect(() => {
    if (success) {
      toast.success("อัปเดตข้อมูลเรียบร้อย ✅", {
        description: `โหลดข้อมูลครบถ้วน ${recordCount} รายการ พร้อมใช้งาน`,
        duration: 4000,
      });
    } else {
      toast.error("เชื่อมต่อข้อมูลไม่สำเร็จ ❌", {
        description: "โปรดตรวจสอบการเชื่อมต่ออินเทอร์เน็ต หรือลองใหม่อีกครั้ง",
      });
    }
  }, [success, recordCount]);

  return null; // This component renders nothing visually
}
