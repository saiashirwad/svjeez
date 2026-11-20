import { describe, expect, test } from "bun:test";
import { fileURLToPath } from "node:url";

const cli = fileURLToPath(new URL("../src/cli.ts", import.meta.url));

const run = (...args: string[]) => {
  const { exitCode, stdout, stderr } = Bun.spawnSync(["bun", cli, ...args]);

  return { exitCode, out: stdout.toString(), err: stderr.toString() };
};

describe("svjeez CLI arguments", () => {
  test("--help prints usage and exits 0, on its own or after a command", () => {
    for (const args of [["--help"], ["frames", "--help"]]) {
      const { exitCode, out } = run(...args);

      expect(exitCode).toBe(0);
      expect(out).toContain("usage:");
    }
  });

  test("an unknown flag names itself and the usage, with no stack trace", () => {
    const { exitCode, err } = run("svg", "scene.tsx", "--nope");

    expect(exitCode).toBe(1);
    expect(err).toStartWith("svjeez svg: Unknown option '--nope'");
    expect(err).toContain("usage:");
    expect(err).not.toContain("    at ");
  });
});
