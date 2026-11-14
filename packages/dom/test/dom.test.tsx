/** @jsxImportSource svjeez */
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Clip, ease, font, render } from "svjeez";
import { validateSvg } from "svjeez/frames";
import {
  act,
  boxes,
  click,
  browser,
  Dom,
  fill,
  find,
  rect,
  duration,
  html,
  hover,
  size,
  snap,
  snapshots,
  wait,
  type Browser,
  type Flow,
  type Snapshot,
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
      // Back where it started: names may repeat.
      snap("idle", { over: 0.5, ease: ease.pop }),
      html('<div class="card"><p>done</p></div>'),
      snap(),
    ]);
    const names = steps.map((s) => ("wait" in s ? "wait" : ("root" in s ? s : s[0]).name));

    expect(names).toEqual(["idle", "wait", "typed", "idle", undefined]);
    expect(steps[1]).toEqual({ wait: 0.5 });
    expect(steps[2]).toMatchObject([{ name: "typed" }, { over: 1 }]);
    expect(steps[3]).toEqual([expect.anything(), { over: 0.5, ease: ease.pop }]);
    expect(JSON.stringify(find(steps, "typed"))).toContain('"text":"hi"');
    expect(JSON.stringify(steps[3])).not.toContain('"text":"hi"');
    expect(JSON.stringify(steps[4])).toContain('"text":"done"');
    // 0.5 held, 1 typing, 0.5 back, 0.6 by default.
    expect(duration(steps)).toBeCloseTo(2.6);
    expect(validateSvg(draw(steps)).errors).toEqual([]);
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

    // Checked before anything runs, so the page is never touched.
    expect(await failure(card.run([fill("input", "x"), snap("a", { over: 1 })]))).toContain(
      "first snap has timing",
    );
    expect(await failure(card.run([act(() => undefined), wait(1), snap("a")]))).toContain(
      "before the first snap",
    );
    expect(await failure(card.run([{ scroll: "x" } as never]))).toContain("scroll");
    await card.close();
  });

  test("instructions take a part name, by data-part or the parts option, else a selector", async () => {
    const markup =
      '<div class="card"><input data-part="email" placeholder="email"><input class="pw" placeholder="password"><button class="badge">go</button></div>';
    const card = await dom.mount(markup, { css: CSS, parts: { password: ".pw" } });
    const [typed] = (await card.run([
      fill("email", "a@b.c"),
      fill("password", "secret"),
      click("button"),
      snap("typed"),
    ])) as [Snapshot];

    expect(JSON.stringify(boxes(typed, "email"))).toContain('"text":"a@b.c"');
    expect(JSON.stringify(boxes(typed, "password"))).toContain('"text":"secret"');
    await card.close();
  });

  test("html() clears hover and focus, so the new markup starts at rest", async () => {
    const button = (label: string) =>
      `<div class="card"><input placeholder="email"><button class="hov">${label}</button></div>`;
    const css = CSS + ".hov{background:#eee}.hov:hover{background:#c00}";
    const card = await dom.mount(button("go"), { css });
    const [hovered, after] = (await card.run([
      hover("button"),
      snap("hovered"),
      html(button("again")),
      snap("after"),
    ])) as [Snapshot, Snapshot];

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
    // The browser's css applies: the card's border is there.
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

describe("Dom", () => {
  test("pairs elements across an insertion, so the ones after it slide instead of swapping", async () => {
    const card = await dom.mount('<div class="card"><p>first</p><p>last</p></div>', { css: CSS });
    const before = await card.snap();

    await card.html(
      '<div class="card"><p>first</p><span class="badge">new</span><p>last</p></div>',
    );
    const after = await card.snap();
    const svg = draw([before, wait(0.5), after]);

    expect(validateSvg(svg).errors).toEqual([]);
    // "last" moves down as one text element; it is not drawn twice to crossfade.
    expect(svg.match(/>last</g)).toHaveLength(1);
    await card.close();
  });

  test("a box inserted before a sibling with the same tag pairs by what each says", async () => {
    const card = await dom.mount(
      '<div class="card"><div>title</div><div>Auto-merge <span class="badge">+214</span></div></div>',
      { css: CSS },
    );
    const before = await card.snap();

    await card.html(
      '<div class="card"><div>title</div><div>All 14 checks passed</div><div>Auto-merge <span class="badge">+230</span></div></div>',
    );
    const after = await card.snap();
    const svg = draw([before, wait(0.5), after]);

    expect(validateSvg(svg).errors).toEqual([]);
    // The footer slides down as itself, so its label is drawn once and its number counts; the new row fades in.
    expect(svg.match(/>Auto-merge</g)).toHaveLength(1);
    expect(svg).toContain(">+222<");
    expect(svg.match(/>All 14 checks passed</g)).toHaveLength(1);
    await card.close();
  });

  test("a class change morphs the element, drawn once, whatever its tag or classes", async () => {
    const card = await dom.mount('<div class="card"><span class="badge">new</span></div>', {
      css: CSS,
    });
    const before = await card.snap();

    await card.html('<div class="card"><span class="badge wide">new</span></div>');
    const after = await card.snap();
    const svg = draw([before, wait(0.5), after]);

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

    await card.html(
      '<div class="card"><section class="badge wide" data-key="s">new</section></div>',
    );
    const after = await card.snap();

    expect(draw([before, wait(0.5), after]).match(/>new</g)).toHaveLength(1);

    // The same two states without the key: different tags, so each fades.
    await card.html('<div class="card"><div class="badge">new</div></div>');
    const plain = await card.snap();
    await card.html('<div class="card"><section class="badge wide">new</section></div>');
    const plainAfter = await card.snap();

    expect(draw([plain, wait(0.5), plainAfter]).match(/>new</g)).toHaveLength(2);

    const pair = draw([plain, wait(0.5), plainAfter], {
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

    await card.html('<div class="card"><input placeholder="email"><p>failed</p></div>');
    const failed = await card.snap();

    const steps = [idle, wait(0.5), typed, wait(0.4), [failed, { over: 0.5 }]] as const;
    const svg = draw(steps);

    expect(validateSvg(svg).errors).toEqual([]);
    // Two transitions, each a drawing of its own, handed over once.
    expect(svg.match(/animation-name:/g)?.length).toBeGreaterThan(2);
    expect(svg).toContain(">failed<");
    expect(size([idle, typed, failed]).height).toBe(failed.height);
    // 0.5 held, 0.6 by default, 0.4 held, 0.5.
    expect(duration(steps)).toBeCloseTo(2);
    expect(duration([idle, typed, wait(1)])).toBeCloseTo(1.6);

    expect(() => draw([wait(1), idle, typed])).toThrow("before the first state");
    expect(() => draw([[idle, { over: 1 }], typed])).toThrow("first state");
    expect(() => draw([idle, wait(-1), typed])).toThrow("wait of 0 or more");
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

    const svg = draw([idle, wait(0.5), [typed, { over: 0.8 }]]);

    expect(validateSvg(svg).errors).toEqual([]);
    // Drawn once, behind a clip that widens in steps; the placeholder is drawn once and cut.
    expect(svg.match(/>hi there</g)).toHaveLength(1);
    expect(svg.match(/>email</g)).toHaveLength(1);
    expect(svg).toContain("<clipPath");
    expect(svg).toMatch(/width:\s*[\d.]+px/);

    // Deleting un-types the same text backwards, and the placeholder returns.
    const back = draw([typed, wait(0.5), [idle, { over: 0.8 }]]);

    expect(back.match(/>hi there</g)).toHaveLength(1);
    expect(back.match(/>email</g)).toHaveLength(1);
    expect(back).toContain("<clipPath");
    await card.close();
  });

  test("a changed number counts, and other changed text still crossfades", async () => {
    const card = await dom.mount('<div class="card"><p>214 lines</p></div>', { css: CSS });
    const before = await card.snap();

    await card.html('<div class="card"><p>230 lines</p></div>');
    const after = await card.snap();
    const svg = draw([before, wait(0.5), after]);

    expect(validateSvg(svg).errors).toEqual([]);
    expect(svg).toContain(">222 lines<");
    expect(svg.match(/ lines</g)).toHaveLength(17);

    await card.html('<div class="card"><p>no lines</p></div>');
    const other = draw([before, wait(0.5), await card.snap()]);

    expect(other).toContain(">214 lines<");
    expect(other).toContain(">no lines<");
    expect(other).not.toContain("<clipPath");
    expect(other.match(/ lines</g)).toHaveLength(2);
    await card.close();
  });

  test("a flow reused later through <Clip at> plays the same moves, shifted", async () => {
    const card = await dom.mount('<div class="card"><p>214 lines</p></div>', { css: CSS });
    const steps = await card.run([
      snap(),
      wait(0.5),
      html('<div class="card"><p>230 lines</p><span class="badge">new</span></div>'),
      snap({ over: 1 }),
      wait(0.5),
      html('<div class="card"><p>214 lines</p></div>'),
      snap(),
    ]);
    const scene = (node: Parameters<typeof render>[1]) =>
      render({ ...size(steps), duration: 8, title: "dom" }, node);
    const now = scene(<Dom states={steps} fonts={[regular]} />);
    const later = scene(
      <Clip at={3}>
        <Dom states={steps} fonts={[regular]} />
      </Clip>,
    );
    // Every key time, as a fraction of the 8s loop.
    const keys = (svg: string) =>
      [...svg.matchAll(/([\d.]+)%\s*\{/g)]
        .map((m) => (Number(m[1]) / 100) * 8)
        .filter((s) => s > 0.01 && s < 7.99);

    expect(validateSvg(later).errors).toEqual([]);
    expect(now).not.toBe(later);
    // Nothing moves before the clip starts, and the first move starts 0.5s in, as it does unclipped.
    expect(Math.min(...keys(now))).toBeCloseTo(0.5, 1);
    expect(Math.min(...keys(later))).toBeCloseTo(3.5, 1);
    expect(Math.max(...keys(later)) - Math.max(...keys(now))).toBeCloseTo(3, 1);
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
  test("a second call reads the file and never launches, and timing on a snap is never stale", async () => {
    const dir = mkdtempSync(join(tmpdir(), "svjeez-dom-"));
    const file = join(dir, "nested", "snapshots.json");
    let runs = 0;

    const flow = (text: string, hold: number): Flow => [
      snap("idle"),
      wait(hold),
      fill("input", text),
      snap("typed", { over: 1, ease: ease.pop }),
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
      // A browser that can't start proves nothing was launched.
      const bogus = { inputs: ["v1"], executablePath: "/nowhere/chrome" };
      const second = await snapshots(file, bogus, run(flow("hi", 1)));

      expect(runs).toBe(2);
      expect(second).toEqual(JSON.parse(JSON.stringify(first)));
      expect(draw(second.steps)).toBe(draw(first.steps));
      expect(JSON.parse(readFileSync(file, "utf8")).hash).toMatch(/^[0-9a-f]{64}$/);

      // New timing replays the same snapshots; new text, a new instruction or new inputs read the page again.
      const later = await snapshots(file, bogus, run(flow("hi", 2)));

      expect(later.steps[1]).toEqual({ wait: 2 });
      expect(later.steps[2]).toEqual([find(second.steps, "typed")!, { over: 1, ease: ease.pop }]);
      expect(duration(later.steps)).toBe(3);
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
