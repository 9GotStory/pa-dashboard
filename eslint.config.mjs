import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    rules: {
      // eslint-config-next 16.4 เปิดกฎนี้เป็น error และ src/app/sync/page.tsx
      // (ไฟล์ PA ที่ freeze ตาม CODING_STANDARDS §1) ติดอยู่ 1 จุด ลดเป็น warning
      // จนกว่า F11 จะแตะ /sync ตาม SPEC §12.1 แล้วแก้ pattern นั้นไปพร้อมกัน
      "react-hooks/set-state-in-effect": "warn",
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
