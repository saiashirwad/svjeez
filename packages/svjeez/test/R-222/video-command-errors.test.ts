import { expect, test } from "bun:test";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { cli, cliPath } from "../helpers/cli";

test("svjeez video names the package to install when @svjeez/video is missing", () => {
  const dir = mkdtempSync(join(tmpdir(), "svjeez-video-"));
  const file = join(dir, "scene.svg");
  writeFileSync(file, '<svg xmlns="http://www.w3.org/2000/svg" width="1" height="1"/>');

  const result = Bun.spawnSync([process.execPath, cliPath, "video", file], { cwd: dir });

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
