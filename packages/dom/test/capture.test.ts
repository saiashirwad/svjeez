import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { deflateSync } from "node:zlib";
import { ease, font } from "svjeez";
import { compress } from "woff2-encoder";
import { boxes } from "../src/find.ts";
import { unwrap } from "../src/fonts.ts";
import { sides } from "../src/paint.ts";
import {
  act,
  click,
  browser,
  cssEase,
  fill,
  find,
  rect,
  html,
  hover,
  loop,
  snap,
  snapshots,
  wait,
  type Box,
  type Browser,
  type Flow,
  type Item,
  type TextRun,
} from "../src/index.ts";

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

const boxAt = (items: readonly Item[], i: number): Box => {
  const it = items[i];

  if (it?.kind !== "box") throw new Error(`Expected a box at ${i}, got ${it?.kind}.`);

  return it;
};

const runAt = (items: readonly Item[], i: number): TextRun => {
  const it = items[i];

  if (it?.kind !== "text") throw new Error(`Expected text at ${i}, got ${it?.kind}.`);

  return it;
};

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

  test("colors that differ between schemes are pairs", async () => {
    await using local = await browser({ fonts: [regular] });
    const card = await local.mount('<div class="card">Hi</div>', { css: CSS });
    const snap = await card.snap();

    expect(snap.root.background).toEqual({ light: "rgb(255,255,255)", dark: "rgb(17,17,17)" });
    expect(snap.root.border?.color).toBe("rgb(221,221,221)");
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
    expect(typed.root.children[0]).toMatchObject({ shadows: [{ spread: 3 }] });

    await card.html('<div class="card"><input placeholder="email"></div>');
    expect(JSON.stringify(await card.snap())).not.toContain('"text":"hi"');
    await card.close();
  });

  test("run: sub-flows spread in, and each snap carries its name and timing", async () => {
    const card = await dom.mount('<div class="card"><input placeholder="email"></div>', {
      css: CSS,
    });

    const type = (text: string) => [fill("input", text), snap("typed", { over: 1 })];

    const steps = await card.run([
      snap("idle"),
      wait(0.5),
      ...type("hi"),
      act((page) => page.fill("input", "")),
      snap("idle", { over: 0.5, curve: ease.pop }),
      html('<div class="card"><p>done</p></div>'),
      snap(),
    ]);

    const names = steps.map((s) => ("wait" in s ? "wait" : ("root" in s ? s : s[0]).name));

    expect(names).toEqual(["idle", "wait", "typed", "idle", undefined]);
    expect(steps[1]).toEqual({ wait: 0.5 });
    expect(steps[2]).toMatchObject([{ name: "typed" }, { over: 1 }]);
    expect(steps[3]).toEqual([expect.anything(), { over: 0.5, curve: ease.pop }]);
    expect(JSON.stringify(find(steps, "typed"))).toContain('"text":"hi"');
    expect(JSON.stringify(steps[3])).not.toContain('"text":"hi"');
    expect(JSON.stringify(steps[4])).toContain('"text":"done"');
    await card.close();
  });

  test("loop returns to the first state, so the way back is a step", async () => {
    const card = await dom.mount('<div class="card"><input placeholder="email"></div>', {
      css: CSS,
    });

    const steps = await card.run([snap("idle"), fill("input", "hey"), snap("typed", { over: 1 })]);
    const looped = loop(steps, { over: 0.5, wait: 0.25 });

    expect(looped).toHaveLength(4);
    expect(looped[2]).toEqual([expect.anything(), { over: 0.5 }]);
    expect(JSON.stringify(looped[2])).toContain(JSON.stringify(find(steps, "idle")).slice(0, 200));
    expect(looped[3]).toEqual({ wait: 0.25 });
    expect(() => loop([wait(1)])).toThrow("snapshot to return to");

    await card.close();
  });

  test("run: plain data runs the same way, checked before it starts", async () => {
    const card = await dom.mount(
      '<div class="card"><input placeholder="email"><button class="badge">go</button></div>',
      { css: CSS },
    );

    const steps = await card.run([
      { snap: "idle" },
      { click: "input" },
      { press: "h" },
      { fill: ["input", "hey"] },
      { snap: "typed", over: 1 },
      { hover: "button" },
      { move: [0, 0] },
      { wait: 1 },
      { html: '<div class="card"><p>done</p></div>' },
      { snap: "done", over: 0.5 },
    ]);

    expect(steps.map((s) => ("wait" in s ? s.wait : ("root" in s ? s : s[0]).name))).toEqual([
      "idle",
      "typed",
      1,
      "done",
    ]);
    expect(JSON.stringify(find(steps, "typed"))).toContain('"text":"hey"');
    expect(JSON.stringify(find(steps, "done"))).toContain('"text":"done"');

    const failure = (p: Promise<unknown>) =>
      p.then(
        () => "",
        (e: Error) => e.message,
      );

    expect(await failure(card.run([fill("input", "x"), snap("a", { over: 1 })]))).toContain(
      "first snap has timing",
    );
    expect(await failure(card.run([act(() => undefined), wait(1), snap("a")]))).toContain(
      "before the first snap",
    );
    // SAFETY: deliberately not an instruction, to see run() reject what the types would.
    expect(await failure(card.run([{ scroll: "x" } as never]))).toContain("scroll");
    await card.close();
  });

  test("instructions take a part name, by data-part or the parts option, else a selector", async () => {
    const markup =
      '<div class="card"><input data-part="email" placeholder="email"><input class="pw" placeholder="password"><button class="badge">go</button></div>';

    const card = await dom.mount(markup, { css: CSS, parts: { password: ".pw" } });

    const steps = await card.run([
      fill("email", "a@b.c"),
      fill("password", "secret"),
      click("button"),
      snap("typed"),
    ]);

    const typed = find(steps, "typed")!;

    expect(JSON.stringify(boxes(typed, "email"))).toContain('"text":"a@b.c"');
    expect(JSON.stringify(boxes(typed, "password"))).toContain('"text":"secret"');
    await card.close();
  });

  test("html() clears hover and focus, so the new markup starts at rest", async () => {
    const button = (label: string) =>
      `<div class="card"><input placeholder="email"><button class="hov">${label}</button></div>`;

    const css = CSS + ".hov{background:#eee}.hov:hover{background:#c00}";
    const card = await dom.mount(button("go"), { css });

    const steps = await card.run([
      hover("button"),
      snap("hovered"),
      html(button("again")),
      snap("after"),
    ]);

    const hovered = find(steps, "hovered");
    const after = find(steps, "after");

    expect(JSON.stringify(hovered)).toContain("rgb(204,0,0)");
    expect(JSON.stringify(after)).not.toContain("rgb(204,0,0)");
    await card.close();
  });

  test("dom.run mounts, runs the flow and closes the page", async () => {
    await using local = await browser({ fonts: [regular], css: CSS });

    const steps = await local.run('<div class="card"><input placeholder="email"></div>', [
      snap("idle"),
      fill("input", "hi"),
      snap("typed"),
    ]);

    expect(steps).toHaveLength(2);
    expect(find(steps, "idle")!.root.border?.widths).toEqual([1, 1, 1, 1]);
    expect(JSON.stringify(find(steps, "typed"))).toContain('"text":"hi"');
  });

  test("css can be built from the markup", async () => {
    const card = await dom.mount('<div class="card">Hi</div>', {
      css: (html) => CSS + `.card::after{content:"${html.length}"}`,
    });

    expect((await card.snap()).root.shadows).toHaveLength(1);
    await card.html('<div class="card badge">Hi again</div>');
    expect((await card.snap()).root.children[0]).toMatchObject({ text: "Hi again" });
    await card.close();
  });
});

describe("real pages", () => {
  const probe = `@font-face{font-family:Probe;src:url(data:font/ttf;base64,${readFileSync(
    join(import.meta.dir, "../../svjeez/tests/fixtures/SpaceMono-Regular.ttf"),
  ).toString("base64")}) format("truetype")}`;

  const page = `${probe} .p { font: 16px Probe; padding: 8px }`;

  test("the page's own web fonts come with the snapshot", async () => {
    const card = await dom.mount('<div class="p">Hello</div>', { css: page });
    const snap = await card.snap();

    expect(snap.fonts).toEqual([
      {
        family: "Probe",
        weight: "400",
        style: "normal",
        src: expect.stringMatching(/^data:font\/ttf;base64,/),
      },
    ]);
    await card.close();
  });

  test("snapshots() keeps each font file once, however many snapshots use it", async () => {
    const dir = mkdtempSync(join(tmpdir(), "svjeez-dom-"));
    const file = join(dir, "snapshots.json");

    try {
      const steps = await snapshots(file, { fonts: [regular] }, (d) =>
        d.run('<div class="p">Hello</div>', [snap("a"), snap("b")], { css: page }),
      );

      const saved = JSON.parse(readFileSync(file, "utf8"));

      expect(Object.keys(saved.fonts)).toHaveLength(1);
      expect(saved.tapes[0].snaps[1].fonts[0].src).toBe(Object.keys(saved.fonts)[0]);

      const again = await snapshots(
        file,
        { fonts: [regular], executablePath: "/nowhere/chrome" },
        (d) => d.run('<div class="p">Hello</div>', [snap("a"), snap("b")], { css: page }),
      );

      expect(again).toEqual(JSON.parse(JSON.stringify(steps)));
    } finally {
      rmSync(dir, { recursive: true });
    }
  });

  test("a turned element is read as laid out, with its transform", async () => {
    const card = await dom.mount(
      '<div class="card"><div class="turn" style="width:40px;height:10px;background:#c00;rotate:90deg"></div></div>',
      { css: CSS },
    );

    const turned = (await card.snap()).root.children[0];

    expect(turned).toMatchObject({ box: { width: 40, height: 10 } });
    expect(turned?.kind === "box" && turned.transform?.matrix).toEqual([0, 1, -1, 0, 0, 0]);
    await card.close();
  });

  test("inset shadows are read apart from outer ones", async () => {
    const card = await dom.mount(
      '<div class="card" style="box-shadow:inset 0 0 0 999px rgb(0 0 0 / .1), 0 1px 2px #000">x</div>',
      { css: CSS },
    );

    const { root } = await card.snap();

    expect(root.shadows).toHaveLength(1);
    expect(root.insets).toEqual([{ color: "rgba(0,0,0,0.1)", x: 0, y: 0, blur: 0, spread: 999 }]);
    await card.close();
  });

  test("a woff2 the page loaded comes back as a TTF", async () => {
    const ttf = readFileSync(
      join(import.meta.dir, "../../svjeez/tests/fixtures/SpaceMono-Regular.ttf"),
    );

    const woff2 = Buffer.from(await compress(ttf)).toString("base64");
    const css = `@font-face{font-family:Packed;src:url(data:font/woff2;base64,${woff2}) format("woff2")} .p { font: 16px Packed; padding: 8px }`;
    const card = await dom.mount('<div class="p">Hi</div>', { css });
    const snap = await card.snap();

    expect(snap.fonts?.[0]?.src).toMatch(/^data:font\/ttf;base64,/);

    await card.close();
  });

  test("a woff unwraps into the same tables", async () => {
    const ttf = new Uint8Array(
      readFileSync(join(import.meta.dir, "../../svjeez/tests/fixtures/SpaceMono-Regular.ttf")),
    );

    const view = new DataView(ttf.buffer, ttf.byteOffset);
    const count = view.getUint16(4);

    const tables = Array.from({ length: count }, (_, i) => {
      const at = 12 + i * 16;

      const data = ttf.subarray(
        view.getUint32(at + 8),
        view.getUint32(at + 8) + view.getUint32(at + 12),
      );

      const packed = deflateSync(data);

      return {
        tag: view.getUint32(at),
        sum: view.getUint32(at + 4),
        data,
        packed: packed.length < data.length ? packed : data,
      };
    });

    const size = 44 + 20 * count + tables.reduce((n, t) => n + ((t.packed.length + 3) & ~3), 0);
    const woff = new Uint8Array(size);
    const w = new DataView(woff.buffer);
    let at = 44 + 20 * count;

    w.setUint32(0, 0x774f4646);
    w.setUint32(4, view.getUint32(0));
    w.setUint16(12, count);
    tables.forEach((t, i) => {
      const e = 44 + i * 20;
      w.setUint32(e, t.tag);
      w.setUint32(e + 4, at);
      w.setUint32(e + 8, t.packed.length);
      w.setUint32(e + 12, t.data.length);
      w.setUint32(e + 16, t.sum);
      woff.set(t.packed, at);
      at += (t.packed.length + 3) & ~3;
    });

    const back = font(await unwrap(woff), { family: "Space Mono" });

    expect(back.format).toBe("ttf");
    expect(back.metrics).toEqual(regular.metrics);
  });

  test("linear and radial gradients are read as layers, in sRGB", async () => {
    const card = await dom.mount(
      '<div class="card" style="height:60px;background:linear-gradient(to right, oklch(0.7 0.2 30), transparent), radial-gradient(circle at 25% 50%, red 10px, blue)"></div>',
      { css: CSS },
    );

    const { root } = await card.snap();
    const [radial, linear] = root.gradients ?? [];

    expect(root.gradients).toHaveLength(2);
    expect(radial).toMatchObject({ kind: "radial", cx: 16 + 1 + 68, rx: expect.any(Number) });
    expect(linear).toMatchObject({ kind: "linear", x1: 17, x2: 16 + 1 + 272 });
    expect(linear?.kind === "linear" && linear.y1 === linear.y2).toBe(true);
    const [from, to] = linear!.stops.map((s) => s.color);

    expect(from).toMatch(/^rgb\(/);
    expect(String(to)).toBe(String(from).replace("rgb(", "rgba(").replace(")", ",0)"));

    await card.html(
      '<div class="card" style="height:60px;background:repeating-linear-gradient(45deg, #000 0 4px, #fff 4px 8px)"></div>',
    );
    const striped = await card.snap();

    expect(striped.root.gradients?.[0]).toMatchObject({ repeat: true });
    await card.close();
  });

  test("::before and ::after are read as boxes with their text, where Chromium put them", async () => {
    const css =
      CSS +
      `.tag::before { content: "#"; color: #c00; padding-right: 4px }
       .dot { position: relative }
       .dot::after { content: ""; position: absolute; right: 4px; top: 4px; width: 8px; height: 8px; border-radius: 50%; background: #0a0 }
       .turn { display: block; position: relative; height: 10px }
       .turn::after { content: ""; position: absolute; left: 0; top: 0; width: 20px; height: 10px; background: #00c; rotate: 90deg }`;

    const card = await dom.mount(
      '<div class="card dot"><span class="tag">design</span><i class="turn"></i></div>',
      { css },
    );

    const { root } = await card.snap();
    const tag = boxAt(root.children, 0);
    const i = boxAt(root.children, 1);
    const dot = boxAt(root.children, 2);
    const turned = boxAt(i.children, 0);

    expect(tag).toMatchObject({ tag: "span" });
    expect(tag.children[0]).toMatchObject({
      kind: "box",
      tag: "::before",
      children: [{ text: "#" }],
    });
    const hash = runAt(boxAt(tag.children, 0).children, 0);
    const word = runAt(tag.children, 1);

    expect(hash.color).toBe("rgb(204,0,0)");
    expect(word.x).toBeGreaterThan(hash.x + hash.advances.at(-1)!);
    expect(word.y).toBe(hash.y);
    expect(dot).toMatchObject({
      tag: "::after",
      background: "rgb(0,170,0)",
      radii: [4, 4, 4, 4],
      box: {
        x: root.box.x + root.box.width - 1 - 4 - 8,
        y: root.box.y + 1 + 4,
        width: 8,
        height: 8,
      },
    });
    expect(turned).toMatchObject({ tag: "::after", box: { ...i.box, width: 20, height: 10 } });
    expect(turned.transform?.matrix).toEqual([0, 1, -1, 0, 0, 0]);
    await card.close();
  });

  test("a see-through fill under backdrop-filter: blur() reads more solid", async () => {
    const card = await dom.mount(
      '<div class="card" style="background:rgb(255 255 255 / .2);backdrop-filter:blur(12px)">x</div>',
      { css: CSS },
    );

    const { root } = await card.snap();
    const [light] = sides(root.background!);

    expect(light).toBe("rgba(255,255,255,0.6)");
    await card.close();
  });

  test("a ::before's counter and attr() content is read as Chromium wrote it", async () => {
    const card = await dom.mount(
      `<ol class="card" style="counter-reset: n; list-style: none"><li data-x="a">one</li><li data-x="b">two</li></ol>
      <style>li::before { counter-increment: n; content: counter(n) ". " attr(data-x) }</style>`,
      { css: CSS },
    );

    const snap = await card.snap();
    await card.close();

    const befores = (it: Item): string[] =>
      it.kind !== "box"
        ? []
        : it.tag === "::before"
          ? it.children.flatMap((c) => (c.kind === "text" ? [c.text] : []))
          : it.children.flatMap(befores);

    const texts = befores(snap.root);

    expect(texts).toEqual(["1. a", "2. b"]);
  });

  test("a color input's swatch is read in its value", async () => {
    const card = await dom.mount(
      `<div class="card"><input type="color" value="#ff0000" style="appearance: none; width: 20px; height: 20px; padding: 0; border: 0; border-radius: 4px"></div>`,
      { css: CSS },
    );

    const snap = await card.snap();
    await card.close();
    const input = snap.root.children.find((c): c is Box => c.kind === "box" && c.tag === "input");

    expect(input?.children).toMatchObject([
      { tag: "::swatch", background: "rgb(255,0,0)", box: input!.box, radii: [4, 4, 4, 4] },
    ]);
  });

  test("a read waits for animations on the page's clock, not ones a scroll drives", async () => {
    const card = await dom.mount(
      `<div class="card"><p style="animation: grow linear; animation-timeline: scroll(self)">hi</p></div>
      <style>@keyframes grow { to { opacity: 0.5 } }</style>`,
      { css: CSS },
    );

    const snap = await card.snap();
    await card.close();

    expect(snap.root.children.length).toBeGreaterThan(0);
  }, 10_000);

  test("z-index paints in stacking order, and a fixed element escapes the parent that clips it", async () => {
    const card = await dom.mount(
      '<div class="card" style="position:relative"><div data-key="top" style="position:relative;z-index:2">a</div><div data-key="flow">b</div><div style="overflow:hidden;height:4px"><div data-key="fixed" style="position:fixed;z-index:1">c</div></div></div>',
      { css: CSS },
    );

    const { root } = await card.snap();
    const keys = root.children.map((c) => (c.kind === "box" ? (c.key ?? c.tag) : c.kind));

    expect(keys).toEqual(["flow", "div", "fixed", "top"]);
    await card.close();
  });
});

describe("page animations", () => {
  test("a running animation is read by element, and its keyframes are not applied to the snapshot", async () => {
    const card = await dom.mount(
      `<div class="card"><i data-part="spin" style="display:block;width:20px;height:20px;background:#c00;animation:turn 2s linear infinite"></i></div>
      <style>@keyframes turn { to { transform: rotate(360deg) } }</style>`,
      { css: CSS },
    );

    const snap = await card.snap();
    await card.close();

    const [spin] = boxes(snap, "spin");

    expect(spin?.transform).toBeUndefined();
    expect(spin?.anims).toMatchObject([
      { type: "animation", name: "turn", duration: 2, iterations: null, direction: "normal" },
    ]);
    expect(spin?.anims?.[0]?.keys.at(-1)?.props.transform).toContain("rotate");
  });

  test("a transition in progress is read with the property it moves", async () => {
    const card = await dom.mount(
      `<div class="card"><i data-part="slide" style="display:block;width:20px;height:20px;background:#c00;transition:opacity 4s linear"></i></div>`,
      { css: CSS },
    );

    await card.snap();

    const steps = await card.run([
      act((page) =>
        page.evaluate(() => document.querySelector("i")!.style.setProperty("opacity", "0.2")),
      ),
      snap("moving"),
    ]);

    const [slide] = boxes(find(steps, "moving")!, "slide");

    expect(slide?.anims).toMatchObject([{ type: "transition", name: "opacity" }]);
    await card.close();
  });
});

describe("cssEase", () => {
  test("reads keywords, cubic-bezier and end-jumping steps, and leaves the rest", () => {
    expect(cssEase("linear")).toBe(ease.linear);
    expect(cssEase("ease-in-out")).toEqual(ease.bezier(0.42, 0, 0.58, 1));
    expect(cssEase(" cubic-bezier(0.1, 0.2, 0.3, 1) ")).toEqual(ease.bezier(0.1, 0.2, 0.3, 1));
    expect(cssEase("steps(4)")).toEqual(ease.steps(4));
    expect(cssEase("step-end")).toEqual(ease.steps(1));
    expect(cssEase("steps(4, start)")).toBeUndefined();
    expect(cssEase("linear(0, 1)")).toBeUndefined();
  });
});

describe("snapshots", () => {
  test("a second call reads the file and never launches, and timing on a snap is never stale", async () => {
    const dir = mkdtempSync(join(tmpdir(), "svjeez-dom-"));
    const file = join(dir, "nested", "snapshots.json");
    let runs = 0;

    const flow = (text: string, hold: number): Flow => [
      snap("idle"),
      wait(hold),
      fill("input", text),
      snap("typed", { over: 1, curve: ease.pop }),
    ];

    const run = (f: Flow) => async (d: Browser) => {
      runs++;

      const card = await d.mount('<div class="card"><input placeholder="email"></div>', {
        css: CSS,
      });

      return { hi: await card.snap(), steps: await card.run(f) };
    };

    try {
      const first = await snapshots(file, { inputs: ["v1"], fonts: [regular] }, run(flow("hi", 1)));
      const bogus = { inputs: ["v1"], executablePath: "/nowhere/chrome" };
      const second = await snapshots(file, bogus, run(flow("hi", 1)));

      expect(runs).toBe(2);
      expect(second).toEqual(JSON.parse(JSON.stringify(first)));
      expect(JSON.parse(readFileSync(file, "utf8")).hash).toMatch(/^[0-9a-f]{64}$/);

      const later = await snapshots(file, bogus, run(flow("hi", 2)));

      expect(later.steps[1]).toEqual({ wait: 2 });
      expect(later.steps[2]).toEqual([find(second.steps, "typed")!, { over: 1, curve: ease.pop }]);
      await expect(snapshots(file, bogus, run(flow("yo", 1)))).rejects.toThrow();
      await expect(
        snapshots(
          file,
          bogus,
          run([snap("idle"), fill("input", "hi"), snap("typed", { over: 1 }), snap()]),
        ),
      ).rejects.toThrow();
      await expect(
        snapshots(file, { ...bogus, inputs: ["v2"] }, run(flow("hi", 1))),
      ).rejects.toThrow();
    } finally {
      rmSync(dir, { recursive: true });
    }
  });
});

describe("real sites", () => {
  const page = (body: string, css = "") =>
    "data:text/html;charset=utf-8," +
    encodeURIComponent(`<!doctype html><style>${css}</style>${body}`);

  test("inline svg: symbol, defs, clipPath and use are read as one graphic", async () => {
    const card = await dom.open(
      page(
        `<svg width="0" height="0"><defs><clipPath id="c"><rect width="10" height="10"/></clipPath></defs><symbol id="s" viewBox="0 0 10 10"><path d="M0 0h10v10z"/></symbol></svg>
        <div id="w"><svg width="40" height="40" viewBox="0 0 10 10" fill="red"><g clip-path="url(#c)"><use href="#s"/></g><clipPath id="d"><rect width="5" height="5"/></clipPath></svg></div>`,
      ),
      { root: "#w", width: 100, height: 100 },
    );

    const text = JSON.stringify(await card.snap());

    expect(text).toContain('"kind":"graphic"');
    expect(text).toContain("M0 0h10v10z");
    await card.close();
  });

  test("a scheme that changes the markup keeps the light read where it differs", async () => {
    const card = await dom.open(
      page(
        `<p id="a">same</p><p id="b"><i class="l">sun</i><i class="d">moon</i></p>`,
        `.d{display:none}@media (prefers-color-scheme:dark){.l{display:none}.d{display:inline}}`,
      ),
      { root: "body", width: 200, height: 100, pad: 0 },
    );

    const text = JSON.stringify(await card.snap());

    expect(text).toContain("sun");
    expect(text).not.toContain("moon");
    await card.close();
  });

  test("root body is the viewport from the origin, and what lies outside it is left out", async () => {
    const card = await dom.open(
      page(
        `<p>inside</p><div style="height:3000px"></div><p>far below</p>`,
        `body{background:#eee}`,
      ),
      { root: "body", width: 300, height: 200, pad: 0 },
    );

    const s = await card.snap();

    expect(s.box).toEqual({ x: 0, y: 0, width: 300, height: 200 });
    expect(JSON.stringify(s)).toContain("inside");
    expect(JSON.stringify(s)).not.toContain("far below");
    await card.close();
  });
});
