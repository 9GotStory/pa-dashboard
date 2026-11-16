import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test, { after } from "node:test";

// The UserPromptExpansion hook .claude/hooks/ticket-branch.mjs run as Claude
// Code runs it: the hook input on stdin, in a temp git repo.

const HOOK = path.resolve(import.meta.dirname, "../../../.claude/hooks/ticket-branch.mjs");
const dirs = [];
after(() => dirs.forEach((dir) => fs.rmSync(dir, { recursive: true })));

function repo(branches) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "ticket-branch-"));
  dirs.push(dir);
  const git = (...args) => execFileSync("git", args, { cwd: dir, stdio: "ignore" });
  git("init", "-q", "-b", "main");
  git("-c", "user.name=t", "-c", "user.email=t@t", "commit", "-q", "--allow-empty", "-m", "start");
  for (const branch of branches) git("branch", branch);
  return dir;
}

function run(cwd, commandName) {
  const out = execFileSync("node", [HOOK], {
    input: JSON.stringify({
      hook_event_name: "UserPromptExpansion",
      expansion_type: "slash_command",
      command_name: commandName,
      command_args: "#312",
      prompt: `/${commandName} #312`,
      cwd,
    }),
    encoding: "utf8",
  });
  return out ? JSON.parse(out).hookSpecificOutput.additionalContext : null;
}

test("/implement with a feat/ branch left: Claude is told to ask the user before starting", () => {
  const context = run(repo(["feat/F76-track-m-docs", "docs/retro-track-l"]), "implement");
  assert.match(context, /feat\/F76-track-m-docs/);
  assert.doesNotMatch(context, /docs\/retro-track-l/);
  assert.match(context, /ask the user/);
});

test("/wizard with a feat/ branch left: the same", () => {
  assert.match(run(repo(["feat/F78-catalog-refresh-button"]), "wizard"), /feat\/F78-catalog-refresh-button/);
});

test("no feat/ branch: nothing added", () => {
  assert.equal(run(repo([]), "implement"), null);
});

test("not a git repo: nothing added, no error", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "ticket-branch-"));
  dirs.push(dir);
  assert.equal(run(dir, "implement"), null);
});
