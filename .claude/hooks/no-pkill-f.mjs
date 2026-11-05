// PreToolUse hook (Bash): pkill -f and pgrep -f match the pattern against
// whole command lines, and the shell running this Bash call has the pattern in
// its own command line, so pkill -f kills that shell (exit 144) and pgrep -f
// lists it.
import { readFileSync } from "node:fs";

const { tool_input } = JSON.parse(readFileSync(0, "utf8"));
const command = String(tool_input?.command ?? "");

if (/\b(pkill|pgrep)\b[^\n;&|]*\s(-[A-Za-z]*f[A-Za-z]*|--full)\b/.test(command)) {
  console.log(
    JSON.stringify({
      hookSpecificOutput: {
        hookEventName: "PreToolUse",
        permissionDecision: "deny",
        permissionDecisionReason:
          "pkill -f / pgrep -f also match this Bash call's own shell, so pkill -f kills it (exit 144). Stop a server by the PID saved when it started (`node x.mjs & echo $! > x.pid`, later `kill $(cat x.pid)`), or find the listener with `ss -ltnp`.",
      },
    }),
  );
}
