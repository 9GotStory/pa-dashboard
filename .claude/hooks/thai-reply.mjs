// Stop hook: CLAUDE.md says to write to the user in Thai. When the last reply
// of a turn is mostly English, send Claude back to resend it in Thai. Code,
// URLs and paths are left out of the count; short replies are let through.
import { readFileSync } from "node:fs";

const input = JSON.parse(readFileSync(0, "utf8"));
if (input.stop_hook_active) process.exit(0);

const prose = String(input.last_assistant_message ?? "")
  .replace(/```[\s\S]*?```/g, "")
  .replace(/`[^`\n]*`/g, "")
  .replace(/https?:\/\/\S+/g, "")
  .replace(/\S*\/\S*/g, "");
const letters = prose.match(/[A-Za-z฀-๿]/g) ?? [];
const thai = letters.filter((c) => c >= "฀").length;

if (letters.length >= 40 && thai / letters.length < 0.3) {
  console.log(
    JSON.stringify({
      decision: "block",
      reason:
        "CLAUDE.md: write to the user in Thai. Your last reply was mostly English: send the same reply again in Thai, with the same content.",
    }),
  );
}
