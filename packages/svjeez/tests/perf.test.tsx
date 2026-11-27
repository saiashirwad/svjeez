import { describe, expect, test } from "bun:test";
import { join } from "node:path";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { Shape, circle, ease, scene, span, track } from "svjeez";
import { svg } from "svjeez/tools";
import { measurePerf } from "svjeez/frames";

const pulse = svg.emit(
  scene({ size: [40, 40], duration: 2, title: "Perf" }, () => (
    <Shape geometry={circle(10)} fill="#3EE6D6" scale={track(1).to(1.5, span(0, 1), ease.inOut)} />
  )),
);

const browser = await measurePerf(pulse, { ms: 200, windows: 1 }).then(
  () => true,
  (error: Error) => {
    if (process.env.CI) throw error;
    console.warn(`skipping perf tests: ${error.message.split("\n")[0]}`);

    return false;
  },
);

describe("measurePerf input", () => {
  test("rejects bad options before launching a browser", async () => {
    await expect(measurePerf(pulse, { ms: 0 })).rejects.toThrow("positive ms");
    await expect(measurePerf(pulse, { windows: 1.5 })).rejects.toThrow("whole number of windows");
    await expect(measurePerf(pulse, { throttle: 0.5 })).rejects.toThrow("throttle of 1 or more");
  });
});

describe.if(browser)("measurePerf", () => {
  test("measures windows across the duration with sane numbers", async () => {
    const report = await measurePerf(pulse, { ms: 400, windows: 3, duration: 2, loops: true });

    expect(report.windows).toHaveLength(3);
    expect(report.windows.map((w) => w.from)).toEqual([0, 2 / 3, 4 / 3]);
    expect(report.windows[0]!.to).toBeCloseTo(0.4);
    expect(report.fps).toBeGreaterThan(5);
    expect(report.fps).toBeLessThan(250);
    expect(report.dropped).toBeGreaterThanOrEqual(0);
    expect(report.dropped).toBeLessThanOrEqual(100);
    expect(report.p95).toBeGreaterThan(0);
    expect(report.main).toBeGreaterThanOrEqual(0);
    expect(report.size.raw).toBe(Buffer.byteLength(pulse));
    expect(report.size.gzip).toBeLessThan(report.size.raw);
    expect(report.windows).toContain(report.slowest);
  });

  test("keeps windows inside a scene that plays once", async () => {
    const report = await measurePerf(pulse, { ms: 500, windows: 2, duration: 2, loops: false });

    for (const w of report.windows) expect(w.to).toBeLessThanOrEqual(2);
  });

  test("svjeez perf prints a summary and --fail-under exits 1", () => {
    const file = join(mkdtempSync(join(tmpdir(), "svjeez-perf-")), "scene.svg");
    writeFileSync(file, pulse);

    const cli = (...args: string[]) =>
      Bun.spawnSync([
        process.execPath,
        join(import.meta.dir, "../src/cli.ts"),
        "perf",
        file,
        ...args,
      ]);

    const ok = cli("--ms", "300", "--windows", "2");
    expect(ok.exitCode).toBe(0);
    expect(ok.stdout.toString()).toMatch(/\d+ fps, p95 frame [\d.]+ ms, \d+% dropped/);
    expect(ok.stdout.toString()).toContain("slowest window");

    const json = JSON.parse(cli("--ms", "300", "--windows", "2", "--json").stdout.toString());
    expect(json.windows).toHaveLength(2);

    const low = cli("--ms", "300", "--windows", "1", "--fail-under", "100000");
    expect(low.exitCode).toBe(1);
    expect(low.stderr.toString()).toContain("under --fail-under");
  });
});
