import { expect, test } from "bun:test";
import { relative } from "node:path";
import { SHOTS } from "./shots.ts";

test("the editor test's screenshots go inside the package and are ignored by git", async () => {
  expect(relative(`${import.meta.dirname}/..`, SHOTS).startsWith("..")).toBe(false);

  const ignored = Bun.spawnSync(["git", "check-ignore", "-q", `${SHOTS}/x.png`]);

  expect(ignored.exitCode).toBe(0);
});
