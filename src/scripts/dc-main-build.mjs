// main's build kept in .dc-lcp/main/ (#294), shared by dc-lcp.mjs and
// dc-compare.mjs (#309): the key that decides whether it can be reused, and
// the build of main that replaces it.
import { spawnSync } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

// In the repo and gitignored, so a reboot keeps it, unlike a temp dir.
export const MAIN_BUILD = ".dc-lcp/main";
const BUILT_FROM = path.join(MAIN_BUILD, "built-from.json");
// The one file of .next/ that dc-budget.mjs reads besides out/; the whole
// .next/ is about 189 MB.
const LOADABLE_MANIFEST = ".next/server/app/(dc)/reports/[id]/page/react-loadable-manifest.json";

const sha256 = (data) => crypto.createHash("sha256").update(data).digest("hex");

// The hash of a directory's files: each relative path, sorted, then the hash
// of its content, so a renamed file or a moved boundary between two files
// changes it too.
export function snapshotHash(dir) {
  const files = fs
    .readdirSync(dir, { recursive: true })
    .filter((file) => fs.statSync(path.join(dir, file)).isFile())
    .map((file) => file.split(path.sep).join("/"))
    .sort();
  return sha256(files.map((file) => `${file}\0${sha256(fs.readFileSync(path.join(dir, file)))}\n`).join(""));
}

// Whether built-from.json names the build that key describes: main's SHA,
// the snapshot's hash and the hash of node_modules/.package-lock.json. A
// file cut short names none, so main is built again.
export function sameBuild(file, key) {
  if (!fs.existsSync(file)) return false;
  let saved;
  try {
    saved = JSON.parse(fs.readFileSync(file, "utf8"));
  } catch {
    return false;
  }
  return saved.main === key.main && saved.snapshot === key.snapshot && saved.packages === key.packages;
}

export function run(command, args, options) {
  const { status, stdout } = spawnSync(command, args, { encoding: "utf8", ...options });
  if (status !== 0) throw new Error(`${[command, ...args].join(" ")} failed`);
  return stdout?.trim();
}

export function git(...args) {
  return run("git", args, { stdio: ["ignore", "pipe", "inherit"] });
}

// The key of a build of main from this public/data/ and node_modules/.
export function mainBuildKey() {
  return {
    main: git("rev-parse", "main"),
    snapshot: snapshotHash("public/data"),
    packages: sha256(fs.readFileSync("node_modules/.package-lock.json")),
  };
}

// Whether main's build in MAIN_BUILD is the one key describes.
export function hasMainBuild(key) {
  return sameBuild(BUILT_FROM, key);
}

// Builds main (mainSha, its short SHA) and keeps the build in MAIN_BUILD with
// key, then checks out start again, leaving no out/. name begins each line it
// prints. Should the process exit on main, as on a failed build or Ctrl-C,
// start is checked out on the way out.
export function buildMain({ name, key, mainSha, start }) {
  fs.rmSync(MAIN_BUILD, { recursive: true, force: true });
  // main is built in this working tree: a git worktree of main with
  // node_modules symlinked does not build, as Turbopack refuses files
  // outside the worktree's root.
  console.log(`${name}: building main (${mainSha})`);
  const back = () => {
    if (spawnSync("git", ["checkout", "--quiet", start], { stdio: "inherit" }).status !== 0) {
      console.error(`${name}: could not check out ${start} again: run git checkout ${start}`);
    }
  };
  git("checkout", "--quiet", "main");
  process.on("exit", back);
  run("npx", ["next", "build"], { stdio: "inherit" });
  fs.cpSync("out", path.join(MAIN_BUILD, "out"), { recursive: true });
  fs.cpSync(LOADABLE_MANIFEST, path.join(MAIN_BUILD, LOADABLE_MANIFEST));
  // Last, so a copy cut short is built again next time.
  fs.writeFileSync(BUILT_FROM, `${JSON.stringify(key, null, 2)}\n`);
  // When the branch's build fails, no out/ of main is left for dc:check.
  fs.rmSync("out", { recursive: true });
  git("checkout", "--quiet", start);
  process.off("exit", back);
}
