/** @jsxImportSource svjeez */
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { font } from "svjeez";
import { fidelity } from "../src/fidelity.tsx";
import { fill, shotsDir, snap, snapshots, wait } from "../src/index.ts";

const regular = font(
  readFileSync(join(import.meta.dir, "../../svjeez/tests/fixtures/SpaceMono-Regular.ttf")),
  { family: "Space Mono" },
);

const css = `
  .card { font: 16px "Space Mono"; color: #111; background: #fff; border: 1px solid #ddd; border-radius: 12px; padding: 16px; width: 240px; box-shadow: 0 2px 8px rgb(0 0 0 / .2) }
  .badge { display: inline-block; background: #222; color: #fff; border-radius: 6px; padding: 2px 8px }
  input { font: 16px "Space Mono"; width: 100%; box-sizing: border-box; border: 1px solid #ccc }  .custom { appearance: none; display: block; width: 200px; height: 20px; margin: 0; background: transparent }
  .custom::-webkit-slider-runnable-track { height: 4px; border-radius: 4px; background: linear-gradient(to right, #06c 60%, #ccc 60%) }
  .custom::-webkit-slider-thumb { appearance: none; width: 14px; height: 14px; margin-top: -5px; border-radius: 50%; background: #06c; box-shadow: 0 1px 3px rgb(0 0 0 / .4) }
  .approximation { width: 30px; height: 10px; background: conic-gradient(red, blue); }
  .dim { display: block; background: #fc0; color: #000 }
  @media (prefers-color-scheme: dark) { .dim { opacity: .4 } .card { background: #111; color: #eee } }
`;

const markup =
  '<div class="card">Hello <span class="badge" data-part="badge">new</span><span class="dim">dim in dark</span><input data-part="name"><input type="range" value="30" style="display:block;width:200px;margin:8px 0"><input type="range" class="custom" value="60"></div>';

let root: string;
let dir: string;

beforeAll(async () => {
  root = mkdtempSync(join(tmpdir(), "svjeez-fidelity-"));

  await snapshots(
    join(root, "snapshots.json"),
    { fonts: [regular], css, screenshots: join(root, "shots") },
    (dom) =>
      dom.run(markup, [
        snap("idle"),
        wait(0.5),
        fill("name", "typed"),
        snap("typed", { over: 0.5 }),
        wait(0.5),
      ]),
  );

  dir = shotsDir(join(root, "shots"), join(root, "snapshots.json"));
}, 60000);

afterAll(() => {
  if (!process.env.KEEP) rmSync(root, { recursive: true, force: true });
  else console.log(root);
});

describe("fidelity", () => {
  test("a drawing of a simple card matches what Chromium painted, in both schemes", async () => {
    const results = await fidelity(dir);

    expect(results.map((r) => `${r.name}/${r.scheme}`).sort()).toEqual([
      "idle/dark",
      "idle/light",
      "typed/dark",
      "typed/light",
    ]);
    expect(results.filter((r) => r.failed)).toEqual([]);
    expect(Math.max(...results.map((r) => r.mismatch))).toBeLessThan(0.01);
  }, 60000);

  test("a wrong drawing fails and leaves a side-by-side image", async () => {
    const file = join(dir, "recording.json");
    const original = readFileSync(file, "utf8");

    const wrong = original
      .replaceAll("rgb(255,255,255)", "rgb(255,0,0)")
      .replaceAll("rgb(17,17,17)", "rgb(0,0,255)");

    expect(wrong).not.toBe(original);
    writeFileSync(file, wrong);

    try {
      const out = join(root, "diffs");
      const results = await fidelity(dir, { out });

      expect(results.every((r) => r.failed)).toBe(true);
      expect(results[0]!.mismatch).toBeGreaterThan(0.3);
      expect(readFileSync(results[0]!.image!).length).toBeGreaterThan(1000);
    } finally {
      writeFileSync(file, original);
    }
  }, 60000);
});

test("reports approximations by element for a selected state", async () => {
  const file = join(root, "approximations.json");
  const screenshots = join(root, "approximations");
  await snapshots(file, { css, screenshots, schemes: "light" }, (dom) =>
    dom.run('<div class="approximation" data-part="sample"></div>', [
      snap("first"),
      snap("selected"),
    ]),
  );

  const results = await fidelity(shotsDir(screenshots, file), {
    name: "selected",
    out: join(root, "approximations-diff"),
    includePassing: true,
    threshold: 1,
  });

  expect(results).toHaveLength(1);
  expect(results[0]).toMatchObject({
    name: "selected",
    failed: false,
    diagnostics: [{ code: "background", element: '[data-part="sample"]' }],
  });
  expect(readFileSync(results[0]!.image!).length).toBeGreaterThan(100);
}, 60000);
