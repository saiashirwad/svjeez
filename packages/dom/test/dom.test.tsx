/** @jsxImportSource svjeez */
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { font, render } from "svjeez";
import { validateSvg } from "svjeez/frames";
import { Dom, Morph, parts, snapshotter, type Snapshotter } from "../src/index.ts";

const regular = font(
  readFileSync(join(import.meta.dir, "../../svjeez/tests/fixtures/SpaceMono-Regular.ttf")),
  { family: "Space Mono" },
);

const CSS = `
  .card { font: 16px "Space Mono"; color: #111; background: #fff; border: 1px solid #ddd; border-radius: 12px; padding: 16px; width: 240px; box-shadow: 0 1px 3px rgb(0 0 0 / .1) }
  .badge { display: inline-block; background: #222; color: #fff; border-radius: 6px; padding: 2px 8px }
  @media (prefers-color-scheme: dark) { .card { background: #111; color: #eee } }
`;

let shot: Snapshotter;

beforeAll(async () => {
  shot = await snapshotter({ css: CSS, fonts: [regular] });
});

afterAll(() => shot.close());

describe("snapshot", () => {
  test("reads boxes, radii, shadows and text lines as the browser laid them out", async () => {
    const snap = await shot.html(
      '<div class="card">Hello there <span class="badge" data-part="badge">new</span></div>',
    );

    expect(snap.root.box).toEqual({ x: 16, y: 16, width: 274, height: expect.any(Number) });
    expect(snap.root.radii).toEqual([12, 12, 12, 12]);
    expect(snap.root.border?.widths).toEqual([1, 1, 1, 1]);
    expect(snap.root.shadows).toHaveLength(1);
    expect(snap.root.children[0]).toMatchObject({
      kind: "text",
      text: "Hello there",
      family: "Space Mono",
      size: 16,
    });
    expect(parts(snap, "badge")).toHaveLength(1);
  });

  test("colors that differ between schemes become variables, and the drawn SVG defines them", async () => {
    const snap = await shot.html('<div class="card">Hi</div>');

    expect(snap.root.background).toMatch(/^var\(--dom-/);
    expect(snap.root.border?.color).toBe("rgb(221,221,221)");

    const svg = render(
      { width: snap.width, height: snap.height, duration: 1, title: "card" },
      <Dom snapshot={snap} />,
    );

    expect(validateSvg(svg).errors).toEqual([]);
    expect(svg).toContain("prefers-color-scheme:dark");
    expect(svg).not.toContain("<filter");
  });

  test("a line break the browser chose stays a line break", async () => {
    const snap = await shot.html('<div class="card">one two three four five six seven</div>');
    const lines = snap.root.children.filter((it) => it.kind === "text");

    expect(lines.length).toBeGreaterThan(1);
    expect(lines.map((l) => l.kind === "text" && l.text).join(" ")).toBe(
      "one two three four five six seven",
    );
  });
});

describe("Morph", () => {
  test("pairs elements across an insertion, so the ones after it slide instead of swapping", async () => {
    const before = await shot.html('<div class="card"><p>first</p><p>last</p></div>');
    const after = await shot.html(
      '<div class="card"><p>first</p><span class="badge">new</span><p>last</p></div>',
    );
    const svg = render(
      { width: 320, height: 240, duration: 2, title: "morph" },
      <Morph from={before} to={after} at={0.5} />,
    );

    expect(validateSvg(svg).errors).toEqual([]);
    // "last" moves down as one text element; it is not drawn twice to crossfade.
    expect(svg.match(/>last</g)).toHaveLength(1);
  });
});
