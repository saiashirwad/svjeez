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
  input { font: 16px "Space Mono"; width: 100%; box-sizing: border-box; border: 1px solid #ccc }
  input:focus { outline: none }
  @media (prefers-color-scheme: dark) { .card { background: #111; color: #eee } }
`;

const markup = '<div class="card">Hello <span class="badge" data-part="badge">new</span><input data-part="name"></div>';

let root: string;
let dir: string;

beforeAll(async () => {
  root = mkdtempSync(join(tmpdir(), "svjeez-fidelity-"));

  await snapshots(join(root, "snapshots.json"), { fonts: [regular], css, screenshots: join(root, "shots") }, (dom) =>
    dom.run(markup, [snap("idle"), wait(0.5), fill("name", "typed"), snap("typed", { over: 0.5 }), wait(0.5)]),
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
    // The drawing says the card is another color than the page painted it.
    const wrong = original.replaceAll("rgb(255,255,255)", "rgb(255,0,0)").replaceAll("rgb(17,17,17)", "rgb(0,0,255)");

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
