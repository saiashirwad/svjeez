import { expect, test } from "bun:test";
import { mkdtempSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const cli = (...args: string[]) =>
  Bun.spawnSync([process.execPath, join(import.meta.dir, "../src/cli.ts"), ...args]);

const skill = readFileSync(join(import.meta.dir, "../skills/svjeez/SKILL.md"), "utf8");

test("svjeez skill prints the skill", () => {
  expect(cli("skill").stdout.toString()).toBe(skill);
});

test("svjeez skill --install copies the skill, its references and its examples, and can run again", () => {
  const dir = mkdtempSync(join(tmpdir(), "svjeez-skill-"));

  for (let run = 0; run < 2; run++)
    expect(cli("skill", "--install", "--dir", dir).exitCode).toBe(0);
  expect(readFileSync(join(dir, "svjeez/SKILL.md"), "utf8")).toBe(skill);

  for (const sub of ["examples", "references"]) {
    const shipped = readdirSync(join(import.meta.dir, "../skills/svjeez", sub)).sort();
    expect(shipped.length).toBeGreaterThan(0);
    expect(readdirSync(join(dir, "svjeez", sub)).sort()).toEqual(shipped);
  }
});

test("svjeez frames rejects an unknown --color-scheme before launching a browser", () => {
  const dir = mkdtempSync(join(tmpdir(), "svjeez-frames-"));
  const file = join(dir, "scene.svg");
  writeFileSync(file, '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1 1"/>');
  const result = cli("frames", file, "--color-scheme", "sepia");
  expect(result.exitCode).toBe(1);
  expect(result.stderr.toString()).toContain(
    '--color-scheme is system, light or dark, got "sepia".',
  );
});

test("svjeez video names the package to install when @svjeez/video is missing", () => {
  const dir = mkdtempSync(join(tmpdir(), "svjeez-video-"));
  const file = join(dir, "scene.svg");
  writeFileSync(file, '<svg xmlns="http://www.w3.org/2000/svg" width="1" height="1"/>');

  const result = Bun.spawnSync(
    [process.execPath, join(import.meta.dir, "../src/cli.ts"), "video", file],
    { cwd: dir },
  );

  expect(result.exitCode).toBe(1);
  expect(result.stderr.toString()).toContain(
    "svjeez video needs @svjeez/video. Install it with `npm i -D @svjeez/video`.",
  );
});

test("svjeez video rejects a --format that contradicts --out", () => {
  const result = cli("video", "scene.svg", "--out", "scene.mp4", "--format", "webm");
  expect(result.exitCode).toBe(1);
  expect(result.stderr.toString()).toContain("--format webm doesn't match --out scene.mp4.");
});

test("svjeez render is no longer a command", () => {
  const result = cli("render", "scene.svg");
  expect(result.exitCode).toBe(1);
  expect(result.stderr.toString()).toContain("svjeez frames <file>");
});
