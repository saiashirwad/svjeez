import { expect, test } from "bun:test";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { cli } from "../helpers/cli";

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
