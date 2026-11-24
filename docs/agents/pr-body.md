# PR body

The `pr` skill gives the headings: Summary, Evidence, Merge Danger. This file is how far each one goes here, because the merge is decided from the PR alone. Write from this skeleton; it replaces reading earlier PR bodies. The body is in Thai with GLOSSARY.md terms; code, commands and file names stay as they are.

Done when every acceptance check of the ticket has its own line of evidence, every review finding is marked fixed or kept, and `node src/scripts/check-glossary.mjs --file <body>` passes.

## Collect the evidence as it happens

Keep a file in the scratchpad and append what Evidence will quote when it happens: `npm test` counts and `dc:budget` before and after, the build, each acceptance check, each review finding and what became of it. A compaction drops these from context.

## Skeleton

```markdown
## Summary

One paragraph: what now exists, and the SPEC or SCHEMA sections it follows.

Diff-style trees or pseudocode of the new flows, then a tree of the changed
files with one comment each.

ต่างจาก issue #n: what differs and why, or "ไม่ต่างจาก issue #n".

ส่วนเล็กที่ไม่อยู่ใน SPEC: the small decisions the docs leave open, each with
its reason.

## Evidence

- **Before (`main` <sha>):** behaviour, `npm test` counts, `dc:budget`.
  **After:** the same measures, plus lint, typecheck and build.

The new tests as pseudocode in a text block, and where their expected values
come from (CODING_STANDARDS §5).

Each acceptance check of FEATURES F## in a text block: its number, ผ่าน or not,
what ran and what it showed. Before and after screenshots, saved in
.wizard/<ticket>/shots/: with the user's go-ahead and Chrome open, uploaded
(page-checks.md "Screenshots on GitHub") and shown here; otherwise each
described in words with its path.

code review:

- **Standards:** hard violations, then what was fixed (with the commit) and
  what was kept (with why).
- **Spec:** the same.

## Merge Danger

**Door:** two-way or one-way, and how to undo it.

**Blast Radius:** one word, then what changes and what stays the same on each
surface, PA included.

ยังไม่ได้ตรวจ: what nobody has checked yet, such as what needs production data,
a later ticket, or CI.

Closes #n

🤖 Generated with [Claude Code](https://claude.com/claude-code)
```

## After `gh pr create`

CI's `build_check` starts a few seconds after the PR opens and takes 6–9 minutes. Wait in the background (`run_in_background`), on the run of the commit the PR carries:

```sh
sha=$(git rev-parse HEAD)
until id=$(gh run list --commit "$sha" --workflow ci.yml --json databaseId --jq '.[0].databaseId') && [ -n "$id" ]; do sleep 5; done
gh run watch "$id" --exit-status
```

`gh pr checks --watch` run before the check exists reports no checks and exits 0, which reads as green (F88).
