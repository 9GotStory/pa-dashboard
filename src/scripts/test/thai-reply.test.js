import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

// The Stop hook .claude/hooks/thai-reply.mjs run as Claude Code runs it: the
// hook input on stdin, the turn read from a transcript file. Entry shapes
// copied from a real transcript (10 Nov 2569): what the user types has origin
// "human"; a skill's text loaded mid-turn (isMeta), a subagent's report
// (origin "peer") and a task notification are user entries the user never
// typed, and so is the hook's own feedback (isMeta, "Stop hook feedback: …").

const HOOK = path.resolve(import.meta.dirname, "../../../.claude/hooks/thai-reply.mjs");
const ENGLISH = "The build is running in the background while I commit the change and write the notes.";
const THAI = "กำลังรอ build เต็มกับผู้รีวิวสองแกน ได้ผลครบแล้วจะรวมผลและสรุปให้";

const typed = (text) => ({ type: "user", origin: { kind: "human" }, message: { role: "user", content: text } });
const skill = {
  type: "user",
  isMeta: true,
  message: { role: "user", content: [{ type: "text", text: "Base directory for this skill: …" }] },
};
const peer = {
  type: "user",
  isMeta: true,
  origin: { kind: "peer" },
  message: { role: "user", content: "Another Claude session sent a message: …" },
};
const notification = {
  type: "user",
  origin: { kind: "task-notification" },
  message: { role: "user", content: "<task-notification>…" },
};
const note = (text) => ({ type: "assistant", message: { role: "assistant", content: [{ type: "text", text }] } });
const feedback = {
  type: "user",
  isMeta: true,
  message: { role: "user", content: "Stop hook feedback:\nCLAUDE.md: write to the user in Thai, …" },
};
const toolResult = {
  type: "user",
  message: { role: "user", content: [{ type: "tool_result", tool_use_id: "t", content: "ok" }] },
};

// The hook's decision for a turn whose last reply is in Thai.
function run(entries) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "thai-reply-"));
  const transcript = path.join(dir, "t.jsonl");
  fs.writeFileSync(transcript, entries.map((e) => JSON.stringify(e)).join("\n") + "\n");
  const out = execFileSync("node", [HOOK], {
    input: JSON.stringify({ transcript_path: transcript, last_assistant_message: THAI, stop_hook_active: false }),
    encoding: "utf8",
  });
  fs.rmSync(dir, { recursive: true });
  return out ? JSON.parse(out) : null;
}

test("an English note before a skill loaded mid-turn is still in the turn", () => {
  const result = run([typed("/implement #204"), note(ENGLISH), toolResult, skill, note(THAI)]);
  assert.equal(result?.decision, "block");
  assert.match(result.reason, /1 note\(s\)/);
});

test("a subagent's report and a task notification do not start a new turn", () => {
  const result = run([typed("merge"), note(ENGLISH), toolResult, peer, notification, note(THAI)]);
  assert.equal(result?.decision, "block");
});

test("an English note before the last typed message belongs to an earlier turn", () => {
  assert.equal(run([typed("/implement #204"), note(ENGLISH), typed("ตามที่แนะนำ"), note(THAI)]), null);
});

test("an English note the hook already quoted is not quoted again when a subagent's report wakes Claude", () => {
  assert.equal(
    run([typed("/implement #233"), note(ENGLISH), feedback, note(THAI), peer, notification, note(THAI)]),
    null,
  );
});

test("an English note after the hook's feedback is still caught", () => {
  const result = run([typed("/implement #233"), note(ENGLISH), feedback, note(THAI), peer, note(ENGLISH), note(THAI)]);
  assert.match(result?.reason ?? "", /1 note\(s\)/);
});
