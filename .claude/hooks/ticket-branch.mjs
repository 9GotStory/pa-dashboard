// UserPromptExpansion hook (/implement, /wizard): a ticket branch is deleted
// after its squash merge (CODING_STANDARDS §6), so a feat/ branch still there
// is a ticket not merged yet. Starting the next ticket on top of it stacks the
// branches: on 15 Nov 2569 F77 branched off F76's unpushed branch, the user
// having typed the /clear and /implement of a reply whose PR was not opened.
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

const { cwd } = JSON.parse(readFileSync(0, "utf8"));
const branches = execFileSync("git", ["for-each-ref", "--format=%(refname:short)", "refs/heads/feat/"], {
  cwd,
  encoding: "utf8",
})
  .split("\n")
  .filter(Boolean);

if (branches.length > 0) {
  console.log(
    JSON.stringify({
      hookSpecificOutput: {
        hookEventName: "UserPromptExpansion",
        additionalContext: `Ticket branches not merged into main yet (CODING_STANDARDS §6 deletes one after its squash merge): ${branches.join(", ")}. Unless one is this ticket's own branch, ask the user before starting: open or merge that PR first (push, gh pr create, merge after green CI), or branch on top of it.`,
      },
    }),
  );
}
