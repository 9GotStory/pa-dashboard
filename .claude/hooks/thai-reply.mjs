// Stop hook: CLAUDE.md says to write to the user in Thai, and the user sees
// every text Claude writes, the notes between tool calls as well as the last
// reply. When the last reply of a turn is mostly English, send Claude back to
// resend it in Thai. When only notes earlier in the turn were, send Claude
// back once to say so, quoting them, so the rest of the session writes them
// in Thai. Code, URLs and paths are left out of the count; short texts are
// let through.
// The last reply comes from last_assistant_message, since the transcript may
// not have it yet; the earlier notes come from the transcript, whose format
// is Claude Code's own and undocumented, so a transcript that cannot be read
// checks the last reply alone.
import { readFileSync } from "node:fs";

const input = JSON.parse(readFileSync(0, "utf8"));
if (input.stop_hook_active) process.exit(0);

// True when text is long enough to judge and under 30% Thai.
function mostlyEnglish(text) {
  const prose = text
    .replace(/```[\s\S]*?```/g, "")
    .replace(/`[^`\n]*`/g, "")
    .replace(/https?:\/\/\S+/g, "")
    .replace(/\S*\/\S*/g, "");
  const letters = prose.match(/[A-Za-z฀-๿]/g) ?? [];
  const thai = letters.filter((c) => c >= "฀").length;
  return letters.length >= 40 && thai / letters.length < 0.3;
}

// The texts Claude wrote in this turn, the last reply aside: those after the
// last message the user typed. A tool result is not one, nor is a user entry
// Claude Code writes itself: a skill's text loaded mid-turn (isMeta), a
// subagent's report or a task notification (origin other than "human").
// Notes before this hook's own last feedback were quoted already: a subagent's
// report that wakes Claude later in the turn must not quote them again.
function turnNotes(transcriptPath, last) {
  let entries;
  try {
    entries = readFileSync(transcriptPath, "utf8")
      .split("\n")
      .filter(Boolean)
      .map((line) => JSON.parse(line))
      .filter((e) => !e.isSidechain && (e.type === "user" || e.type === "assistant"));
  } catch {
    return [];
  }
  const typed = (e) => {
    const content = e.message?.content;
    if (e.isMeta || (e.origin?.kind ?? "human") !== "human") return false;
    return typeof content === "string" || (Array.isArray(content) && !content.some((c) => c.type === "tool_result"));
  };
  const feedback = (e) =>
    e.isMeta && typeof e.message?.content === "string" && e.message.content.startsWith("Stop hook feedback:");
  const start = entries.findLastIndex((e) => e.type === "user" && (typed(e) || feedback(e)));
  return entries
    .slice(start + 1)
    .filter((e) => e.type === "assistant" && Array.isArray(e.message?.content))
    .flatMap((e) => e.message.content.filter((c) => c.type === "text").map((c) => c.text.trim()))
    .filter((text) => text && text !== last.trim());
}

function block(reason) {
  console.log(JSON.stringify({ decision: "block", reason }));
  process.exit(0);
}

const last = String(input.last_assistant_message ?? "");
if (mostlyEnglish(last)) {
  block(
    "CLAUDE.md: write to the user in Thai. Your last reply was mostly English: send the same reply again in Thai, with the same content.",
  );
}
const english = turnNotes(input.transcript_path, last).filter(mostlyEnglish);
if (english.length > 0) {
  const quoted = english.slice(0, 3).map((text) => `"${text.slice(0, 60).replace(/\s+/g, " ")}…"`);
  block(
    `CLAUDE.md: write to the user in Thai, the notes between tool calls included. ${english.length} note(s) of this turn were mostly English: ${quoted.join(", ")}. Write the next ones in Thai; answer this in one Thai line, without resending them.`,
  );
}
