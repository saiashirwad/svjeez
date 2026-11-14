/** @jsxImportSource svjeez */
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { font, render, span } from "svjeez";
import { validateSvg } from "svjeez/frames";
import { boxes, browser, Dom, rect, size, snapshots, type Browser } from "../src/index.ts";

const regular = font(
  readFileSync(join(import.meta.dir, "../../svjeez/tests/fixtures/SpaceMono-Regular.ttf")),
  { family: "Space Mono" },
);

const CSS = `
  .card { font: 16px "Space Mono"; color: #111; background: #fff; border: 1px solid #ddd; border-radius: 12px; padding: 16px; width: 240px; box-shadow: 0 1px 3px rgb(0 0 0 / .1) }
  .badge { display: inline-block; background: #222; color: #fff; border-radius: 6px; padding: 2px 8px }
  .wide { padding: 8px 24px; background: #06c }
  input { font: 16px "Space Mono"; width: 100%; box-sizing: border-box; border: 1px solid #ccc }
  input:focus { outline: none; box-shadow: 0 0 0 3px #6af }
  @media (prefers-color-scheme: dark) { .card { background: #111; color: #eee } }
`;

const draw = (snap: Parameters<typeof size>[0], props: Partial<Parameters<typeof Dom>[0]> = {}) =>
  render(
    { ...size(snap), duration: 4, title: "dom" },
    <Dom states={snap} fonts={[regular]} {...props} />,
  );

let dom: Browser;

beforeAll(async () => {
  dom = await browser({ fonts: [regular] });
});

afterAll(() => dom.close());

describe("snap", () => {
  test("reads boxes, radii, shadows and text lines as the browser laid them out", async () => {
    const card = await dom.mount(
      '<div class="card">Hello there <span class="badge" data-part="badge">new</span></div>',
      { css: CSS },
    );
    const snap = await card.snap();

    expect(snap.pad).toBe(16);
    expect(snap.box).toEqual({ x: 16, y: 16, width: 274, height: expect.any(Number) });
    expect(snap.root.box).toEqual(snap.box);
    expect(snap.width).toBe(306);
    expect(snap.root.radii).toEqual([12, 12, 12, 12]);
    expect(snap.root.border?.widths).toEqual([1, 1, 1, 1]);
    expect(snap.root.shadows).toHaveLength(1);
    expect(snap.root.children[0]).toMatchObject({
      kind: "text",
      text: "Hello there",
      family: "Space Mono",
      size: 16,
    });
    expect(boxes(snap, "badge")).toHaveLength(1);
    await card.close();
  });

  test("an element gets a part from a selector or a data-part, and keeps its key and id", async () => {
    const card = await dom.mount(
      '<div class="card"><p id="a" data-key="k">one</p><span class="badge">two</span><i data-part="third">3</i></div>',
      { css: CSS, parts: { two: ".badge", first: "#a" } },
    );
    const snap = await card.snap();

    expect(rect(snap, "two")).toMatchObject({ width: expect.any(Number) });
    expect(rect(snap, "third")).toBeDefined();
    expect(rect(snap, "missing")).toBeUndefined();
    expect(rect(snap, "two", 1)).toBeUndefined();
    expect(boxes(snap, "first")[0]).toMatchObject({ id: "a", key: "k", tag: "p" });
    await card.close();
  });

  test("colors that differ between schemes are pairs, and the drawing defines their variables", async () => {
    await using local = await browser({ fonts: [regular] });
    const card = await local.mount('<div class="card">Hi</div>', { css: CSS });
    const snap = await card.snap();

    expect(snap.root.background).toEqual({ light: "rgb(255,255,255)", dark: "rgb(17,17,17)" });
    expect(snap.root.border?.color).toBe("rgb(221,221,221)");

    const svg = draw(snap);

    expect(validateSvg(svg).errors).toEqual([]);
    expect(svg).toContain("prefers-color-scheme:dark");
    expect(svg).not.toContain("<filter");
  });

  test("schemes: light reads one pass and plain colors", async () => {
    await using local = await browser({ schemes: "light" });
    const card = await local.mount('<div class="card">Hi</div>', { css: CSS });

    expect((await card.snap()).root.background).toBe("rgb(255,255,255)");
  });

  test("a line break the browser chose stays a line break", async () => {
    const card = await dom.mount('<div class="card">one two three four five six seven</div>', {
      css: CSS,
    });
    const snap = await card.snap();
    const lines = snap.root.children.filter((it) => it.kind === "text");

    expect(lines.length).toBeGreaterThan(1);
    expect(lines.map((l) => l.kind === "text" && l.text).join(" ")).toBe(
      "one two three four five six seven",
    );
    await card.close();
  });

  test("the page stays open, so state carries from one snap to the next", async () => {
    const card = await dom.mount('<div class="card"><input placeholder="email"></div>', {
      css: CSS,
    });
    const idle = await card.snap();
    const typed = await card.snap((page) => page.fill("input", "hi"));
    const same = await card.snap();

    expect(idle.root.children[0]).toMatchObject({ tag: "input" });
    expect(typed.root.children[0]).toMatchObject({ tag: "input" });
    expect(JSON.stringify(typed)).toContain('"text":"hi"');
    expect(JSON.stringify(same)).toContain('"text":"hi"');
    expect(JSON.stringify(idle)).not.toContain('"text":"hi"');
    // The focus ring is a shadow that only the typed state has.
    expect(typed.root.children[0]).toMatchObject({ shadows: [{ spread: 3 }] });

    await card.render('<div class="card"><input placeholder="email"></div>');
    expect(JSON.stringify(await card.snap())).not.toContain('"text":"hi"');
    await card.close();
  });

  test("css can be built from the markup", async () => {
    const card = await dom.mount('<div class="card">Hi</div>', {
      css: (html) => CSS + `.card::after{content:"${html.length}"}`,
    });

    expect((await card.snap()).root.shadows).toHaveLength(1);
    await card.render('<div class="card badge">Hi again</div>');
    expect((await card.snap()).root.children[0]).toMatchObject({ text: "Hi again" });
    await card.close();
  });
});

describe("Dom", () => {
  test("pairs elements across an insertion, so the ones after it slide instead of swapping", async () => {
    const card = await dom.mount('<div class="card"><p>first</p><p>last</p></div>', { css: CSS });
    const before = await card.snap();

    await card.render(
      '<div class="card"><p>first</p><span class="badge">new</span><p>last</p></div>',
    );
    const after = await card.snap();
    const svg = draw([before, after], { at: [0.5] });

    expect(validateSvg(svg).errors).toEqual([]);
    // "last" moves down as one text element; it is not drawn twice to crossfade.
    expect(svg.match(/>last</g)).toHaveLength(1);
    await card.close();
  });

  test("a class change morphs the element, drawn once, whatever its tag or classes", async () => {
    const card = await dom.mount('<div class="card"><span class="badge">new</span></div>', {
      css: CSS,
    });
    const before = await card.snap();

    await card.render('<div class="card"><span class="badge wide">new</span></div>');
    const after = await card.snap();
    const svg = draw([before, after], { at: [0.5] });

    expect(svg.match(/>new</g)).toHaveLength(1);
    expect(svg).toContain("@keyframes");
    await card.close();
  });

  test("data-key pairs elements across a tag change", async () => {
    const card = await dom.mount(
      '<div class="card"><div class="badge" data-key="s">new</div></div>',
      {
        css: CSS,
      },
    );
    const before = await card.snap();

    await card.render(
      '<div class="card"><section class="badge wide" data-key="s">new</section></div>',
    );
    const after = await card.snap();

    expect(draw([before, after], { at: [0.5] }).match(/>new</g)).toHaveLength(1);

    // The same two states without the key: different tags, so each fades.
    await card.render('<div class="card"><div class="badge">new</div></div>');
    const plain = await card.snap();
    await card.render('<div class="card"><section class="badge wide">new</section></div>');
    const plainAfter = await card.snap();

    expect(draw([plain, plainAfter], { at: [0.5] }).match(/>new</g)).toHaveLength(2);

    const pair = draw([plain, plainAfter], {
      at: [0.5],
      pair: (box) => (box.tag === "div" || box.tag === "section" ? "badge" : undefined),
    });

    expect(pair.match(/>new</g)).toHaveLength(1);
    await card.close();
  });

  test("any number of states play on one timeline", async () => {
    const card = await dom.mount('<div class="card"><input placeholder="email"></div>', {
      css: CSS,
    });
    const idle = await card.snap();
    const typed = await card.snap((page) => page.fill("input", "hi"));

    await card.render('<div class="card"><input placeholder="email"><p>failed</p></div>');
    const failed = await card.snap();

    const svg = draw([idle, typed, [failed, span(1.5, 0.5)]], { at: [0.5] });

    expect(validateSvg(svg).errors).toEqual([]);
    // Two transitions, each a drawing of its own, handed over once.
    expect(svg.match(/animation-name:/g)?.length).toBeGreaterThan(2);
    expect(svg).toContain(">failed<");
    expect(size([idle, typed, failed]).height).toBe(failed.height);

    expect(() => draw([idle, typed, failed], { at: [0.5] })).toThrow("at[1]");
    expect(() => draw([[idle, span(0, 1)], typed], { at: [0.5] })).toThrow("first state");
    expect(() => draw([idle, typed, failed], { at: [0.5, 0.8], over: 0.6 })).toThrow("overlap");
    await card.close();
  });

  test("text typed into a field reveals one character at a time instead of crossfading", async () => {
    const card = await dom.mount('<div class="card"><input placeholder="email"></div>', {
      css: CSS,
    });
    const idle = await card.snap();
    const typed = await card.snap((page) => page.fill("input", "hi there"));
    const run = JSON.stringify(typed).match(/"text":"hi there"[^}]*"advances":(\[[^\]]*\])/);
    const advances = JSON.parse(run![1]!) as number[];

    expect(advances).toHaveLength(8);
    expect(advances.every((n, i) => n > (advances[i - 1] ?? 0))).toBe(true);

    const svg = draw([idle, typed], { at: [0.5], over: 0.8 });

    expect(validateSvg(svg).errors).toEqual([]);
    // Drawn once, behind a clip that widens in steps; the placeholder is drawn once and cut.
    expect(svg.match(/>hi there</g)).toHaveLength(1);
    expect(svg.match(/>email</g)).toHaveLength(1);
    expect(svg).toContain("<clipPath");
    expect(svg).toMatch(/width:\s*[\d.]+px/);

    // Deleting un-types the same text backwards, and the placeholder returns.
    const back = draw([typed, idle], { at: [0.5], over: 0.8 });

    expect(back.match(/>hi there</g)).toHaveLength(1);
    expect(back.match(/>email</g)).toHaveLength(1);
    expect(back).toContain("<clipPath");
    await card.close();
  });

  test("a changed number counts, and other changed text still crossfades", async () => {
    const card = await dom.mount('<div class="card"><p>214 lines</p></div>', { css: CSS });
    const before = await card.snap();

    await card.render('<div class="card"><p>230 lines</p></div>');
    const after = await card.snap();
    const svg = draw([before, after], { at: [0.5] });

    expect(validateSvg(svg).errors).toEqual([]);
    expect(svg).toContain(">222 lines<");
    expect(svg.match(/ lines</g)).toHaveLength(17);

    await card.render('<div class="card"><p>no lines</p></div>');
    const other = draw([before, await card.snap()], { at: [0.5] });

    expect(other).toContain(">214 lines<");
    expect(other).toContain(">no lines<");
    expect(other).not.toContain("<clipPath");
    expect(other.match(/ lines</g)).toHaveLength(2);
    await card.close();
  });

  test("a snapshot survives JSON and draws the same", async () => {
    const card = await dom.mount('<div class="card">Hi <span class="badge">new</span></div>', {
      css: CSS,
    });
    const snap = await card.snap();
    const again = JSON.parse(JSON.stringify(snap));

    expect(draw(again)).toBe(draw(snap));
    await card.close();
  });
});

describe("snapshots", () => {
  test("a second call with the same inputs reads the file and never launches", async () => {
    const dir = mkdtempSync(join(tmpdir(), "svjeez-dom-"));
    const file = join(dir, "nested", "snapshots.json");
    let runs = 0;

    const run = async (d: Browser) => {
      runs++;
      const card = await d.mount('<div class="card">Hi</div>', { css: CSS });

      return { hi: await card.snap(), two: [await card.snap(), await card.snap()] };
    };

    try {
      const first = await snapshots(file, { inputs: ["v1"], fonts: [regular] }, run);
      // A browser that can't start proves nothing was launched.
      const bogus = { inputs: ["v1"], executablePath: "/nowhere/chrome" };
      const second = await snapshots(file, bogus, run);

      expect(runs).toBe(1);
      expect(second).toEqual(JSON.parse(JSON.stringify(first)));
      expect(JSON.parse(readFileSync(file, "utf8")).hash).toMatch(/^[0-9a-f]{64}$/);

      await expect(snapshots(file, { ...bogus, inputs: ["v2"] }, run)).rejects.toThrow();
    } finally {
      rmSync(dir, { recursive: true });
    }
  });
});
