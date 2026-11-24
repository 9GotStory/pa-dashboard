import assert from "node:assert/strict";
import test from "node:test";
import { seamNames, unlistedTests } from "../check-seams.mjs";

// check-seams.mjs (#382): every test file under src/ is named in the table of
// CODING_STANDARDS.md §5. In F92, fold.test.ts landed before §5 had a row for
// fold.ts, and review caught it only after the code was done.

const STANDARDS = `# CODING_STANDARDS

## 4. Frontend

- types come from \`src/lib/dc/types.test.ts\` (outside §5: does not count)

## 5. เทสต์และ seam ที่ตกลงกัน

เขียนเทสต์ที่ seam เหล่านี้เท่านั้น เช่น \`prose.ts\` (not in the table: does not count)

| seam | วิธีทดสอบ | จับอะไรได้ / ไม่ได้ |
|---|---|---|
| GAS handlers | \`node:vm\` in \`src/scripts/test/\`, files \`*.test.js\` (\`batch-all.test.js\`, \`seed.test.js\`) | logic |
| \`src/lib/dc/values.ts\`, \`format.ts\` and \`src/lib/dc/tables/{หน้า}.ts\` | \`tsx --test src/lib/dc/*.test.ts\` | values |
| \`src/lib/dc/sync-status.ts\` | stub | status |
| \`.claude/hooks/thai-reply.mjs\` | child process | hook |
| \`src/scripts/hdc-catalog.js\` (\`find\`, \`refresh\`) | child process | catalog |

- CI runs \`src/lib/dc/after.ts\` (after the table: does not count)

## 6. Git

\`src/lib/dc/git.ts\`
`;

const unlisted = (...paths) => unlistedTests(paths, seamNames(STANDARDS));

test("a test file whose source the table names, as a full path or as a bare file name, is listed", () => {
  assert.deepEqual(
    unlisted(
      "src/lib/dc/values.test.ts",
      "src/lib/dc/format.test.ts",
      "src/scripts/test/hdc-catalog.test.js",
      "src/scripts/test/thai-reply.test.js",
    ),
    [],
  );
});

test("a name in backticks outside §5's table does not count: another section, or §5's prose and bullets", () => {
  const paths = [
    "src/lib/dc/types.test.ts",
    "src/lib/dc/prose.test.ts",
    "src/lib/dc/after.test.ts",
    "src/lib/dc/git.test.ts",
  ];
  assert.deepEqual(unlisted(...paths), paths);
});

test("a path with {…} covers every test file in its own folder, and none in another folder", () => {
  assert.deepEqual(unlisted("src/lib/dc/tables/anc.test.ts", "src/lib/dc/tables/epi.test.ts"), []);
  assert.deepEqual(unlisted("src/lib/dc/anc.test.ts", "src/lib/dc/tables/sub/anc.test.ts"), [
    "src/lib/dc/anc.test.ts",
    "src/lib/dc/tables/sub/anc.test.ts",
  ]);
});

test("a test file the table names as x.test.js itself is listed", () => {
  assert.deepEqual(unlisted("src/scripts/test/batch-all.test.js", "src/scripts/test/seed.test.js"), []);
});

test("a name that only ends with the test's name does not count: sync-status.ts is not status.test.ts's", () => {
  assert.deepEqual(unlisted("src/lib/dc/status.test.ts", "src/scripts/test/all.test.js"), [
    "src/lib/dc/status.test.ts",
    "src/scripts/test/all.test.js",
  ]);
});

test("every test file the table does not name is reported, not only the first", () => {
  assert.deepEqual(
    unlisted("src/lib/dc/fold.test.ts", "src/lib/dc/values.test.ts", "src/scripts/test/storage.test.js"),
    ["src/lib/dc/fold.test.ts", "src/scripts/test/storage.test.js"],
  );
});
