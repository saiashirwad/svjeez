// Puts reels where a PR body can show them: a `pr-assets/<n>` branch that holds only the reels, written with git
// plumbing so the PR branch never carries them, and a section of the PR body between two markers.
import { basename, resolve } from "node:path";

const REPO = resolve(import.meta.dir, "../..");
const START = "<!-- reel:start -->";
const END = "<!-- reel:end -->";

const run = (cmd: string[], stdin?: string) => {
  const out = Bun.spawnSync(cmd, {
    cwd: REPO,
    stdin: stdin === undefined ? undefined : Buffer.from(stdin),
  });

  if (out.exitCode !== 0)
    throw new Error(`${cmd.join(" ")} failed: ${out.stderr.toString().trim()}`);

  return out.stdout.toString().trim();
};

/** The `owner/name` of the origin remote. */
export const repository = () =>
  run(["gh", "repo", "view", "--json", "nameWithOwner", "--jq", ".nameWithOwner"]);

/** Commit `files` as the only contents of `pr-assets/<pr>` and push it. Returns the commit, which URLs pin to. */
export const upload = (pr: number, files: readonly string[]): string => {
  const tree = files
    .map((file) => `100644 blob ${run(["git", "hash-object", "-w", file])}\t${basename(file)}`)
    .join("\n");

  const commit = run([
    "git",
    "commit-tree",
    run(["git", "mktree"], `${tree}\n`),
    "-m",
    `Reels for #${pr}`,
  ]);

  run(["git", "push", "--force", "-q", "origin", `${commit}:refs/heads/pr-assets/${pr}`]);

  return commit;
};

/** A raw URL GitHub serves with the file's own type, so an SVG animates where the body shows it. */
export const rawUrl = (repo: string, commit: string, file: string) =>
  `https://github.com/${repo}/raw/${commit}/${basename(file)}`;

/** Upload `files`, then write the section `markdown` builds from their URLs into the PR body. Returns the PR's URL. */
export const publish = (
  pr: number,
  files: readonly string[],
  markdown: (url: (file: string) => string) => string,
): string => {
  const repo = repository();
  const commit = upload(pr, files);
  updateBody(
    pr,
    markdown((file) => rawUrl(repo, commit, file)),
  );

  return `https://github.com/${repo}/pull/${pr}`;
};

/** Replace the reel section of the PR body, or add one at the end. */
export const updateBody = (pr: number, section: string) => {
  const body = run(["gh", "pr", "view", String(pr), "--json", "body", "--jq", ".body"]);
  const block = `${START}\n${section.trim()}\n${END}`;
  const at = body.indexOf(START);
  const end = body.indexOf(END);

  const next =
    at >= 0 && end > at
      ? `${body.slice(0, at)}${block}${body.slice(end + END.length)}`
      : `${body.trimEnd()}\n\n${block}\n`;

  run(["gh", "pr", "edit", String(pr), "--body-file", "-"], next);
};
