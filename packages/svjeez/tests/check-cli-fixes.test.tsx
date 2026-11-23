/** @jsxImportSource svjeez */
import { describe, expect, test } from "bun:test";
import { existsSync } from "node:fs";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Group, Shape, Stack, Text, enter, font, rect, scene, span, track } from "svjeez";
import { check } from "svjeez/tools";

const cli = join(import.meta.dir, "../src/cli.ts");
const mono = await font.load(new URL("./fixtures/SpaceMono-Regular.ttf", import.meta.url));

describe("check fixes (#166)", () => {
  test("rotating parent does not trigger false layout-overlap on a Stack", () => {
    const model = scene({ size: [300, 300], duration: 4, title: "Swing" }, () => (
      <Group offset={[150, 150]} rotate={track(-9).to(9, span(0, 2)).to(-9, span(2, 2))}>
        <Stack key="tags" gap={4}>
          <Shape key="a" geometry={rect(120, 20)} fill="#111111" />
          <Shape key="b" geometry={rect(120, 20)} fill="#222222" />
          <Shape key="c" geometry={rect(120, 20)} fill="#333333" />
        </Stack>
      </Group>
    ));

    expect(check(model).problems.filter((p) => p.code === "layout-overlap")).toEqual([]);
  });

  test("enter() offset larger than Stack gap does not trigger layout-overlap while entering", () => {
    const model = scene({ size: [200, 200], duration: 3, loop: false, title: "Enter" }, () => (
      <Stack key="list" gap={6} at={[20, 20]}>
        <Shape
          key="a"
          geometry={rect(80, 20)}
          fill="#111111"
          motion={enter(span(0, 0.5), { from: { opacity: 0, offset: [0, 24] } })}
        />
        <Shape
          key="b"
          geometry={rect(80, 20)}
          fill="#222222"
          motion={enter(span(0.2, 0.5), { from: { opacity: 0, offset: [0, 24] } })}
        />
      </Stack>
    ));

    expect(check(model).problems.filter((p) => p.code === "layout-overlap")).toEqual([]);
  });

  test("overlap catches grazing text across neighboring stacks and opaque shape covering visible text", () => {
    const grazing = scene({ size: [300, 200], duration: 2, loop: false, title: "Grazing" }, () => (
      <Group>
        <Text key="a" font={mono} size={14} at={[20, 40]} fill="#111111">
          The Royal Courtyard
        </Text>
        <Text key="b" font={mono} size={14} at={[20, 49]} fill="#111111">
          Evening Reception
        </Text>
      </Group>
    ));

    expect(check(grazing).problems.some((p) => p.code === "overlap")).toBe(true);

    const covered = scene({ size: [300, 200], duration: 2, loop: false, title: "Covered" }, () => (
      <Group>
        <Text key="msg" font={mono} size={14} at={[20, 40]} fill="#111111">
          Join us for dinner
        </Text>
        <Shape key="card" geometry={rect(160, 40)} at={[20, 46]} fill="#FFFFFF" />
      </Group>
    ));

    const found = check(covered).problems.filter((p) => p.code === "overlap");
    expect(found).toHaveLength(1);
    expect(found[0]!.message).toContain("covered by");
  });
});

describe("CLI fixes (#169)", () => {
  test("svg --out auto-creates parent directories and check supports --format json and --fail-on warning", async () => {
    const dir = await mkdtemp(join(tmpdir(), "svjeez-cli-"));

    try {
      const sceneFile = join(dir, "warn.tsx");
      const entry = join(import.meta.dir, "../src/index.ts");

      await writeFile(
        sceneFile,
        `import { Group, Shape, rect, scene } from ${JSON.stringify(entry)};
export default scene({ size: [100, 100], duration: 2, title: "Warn" }, () =>
  Group({ children: Shape({ geometry: rect(20, 20), at: [10, 10], fill: "#111111" }) }),
);
`,
      );

      const nestedOut = join(dir, "nested", "deep", "out.svg");
      const emitRun = Bun.spawnSync([process.execPath, cli, "svg", sceneFile, "--out", nestedOut]);
      expect(emitRun.exitCode).toBe(0);
      expect(existsSync(nestedOut)).toBe(true);

      const jsonRun = Bun.spawnSync([
        process.execPath,
        cli,
        "check",
        sceneFile,
        "--format",
        "json",
      ]);

      expect(jsonRun.exitCode).toBe(0);
      const report = JSON.parse(jsonRun.stdout.toString());
      expect(report.ok).toBe(true);
      expect(report.problems.some((p: { code: string }) => p.code === "static")).toBe(true);

      const strictRun = Bun.spawnSync([
        process.execPath,
        cli,
        "check",
        sceneFile,
        "--fail-on",
        "warning",
      ]);

      expect(strictRun.exitCode).toBe(1);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});
