import { expect, test } from "bun:test";
import { cli } from "../helpers/cli";

test("svjeez render is no longer a command", () => {
  const result = cli("render", "scene.svg");
  expect(result.exitCode).toBe(1);
  expect(result.stderr.toString()).toContain("svjeez frames <file>");
});
