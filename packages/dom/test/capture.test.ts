import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { chromium, type Browser, type Page } from "playwright-core";
import {
  captureScript,
  checkVersion,
  type ElementNode,
  type Node,
  type Snapshot,
} from "../src/index.ts";

let browser: Browser;
let page: Page;

// The first test pays for launching Chromium, and the workspace's test scripts run in parallel, so a CI runner can pass 5s.
beforeAll(async () => {
  browser = await chromium.launch().catch(() => chromium.launch({ channel: "chrome" }));
  page = await browser.newPage({ viewport: { width: 400, height: 300 } });
}, 60_000);

afterAll(async () => {
  await browser?.close();
});

const grab = () => page.evaluate<Snapshot>(`(${captureScript})(document.getElementById("root"))`);

const snap = async (html: string): Promise<Snapshot> => {
  await page.setContent(
    `<style>html,body{margin:0;padding:0;font:16px/20px monospace}</style><div id="root">${html}</div>`,
  );

  return grab();
};

const find = (node: Node, test: (el: ElementNode) => boolean): ElementNode | undefined => {
  if (node.type !== "element") return undefined;

  if (test(node)) return node;

  for (const child of node.children) {
    const found = find(child, test);

    if (found) return found;
  }

  return undefined;
};

const byId = (snapshot: Snapshot, id: string) => {
  const found = find(snapshot.root, (el) => el.id === id);

  if (!found) throw new Error(`no #${id} in the snapshot`);

  return found;
};

const near = (actual: number | undefined, expected: number, tolerance = 0.5) =>
  expect(Math.abs((actual ?? NaN) - expected)).toBeLessThanOrEqual(tolerance);

describe("capture", () => {
  test("a styled box", async () => {
    const snapshot = await snap(`
      <div id="box" data-key="card" data-part="body" style="margin:10px 20px;width:100px;height:60px;
        border:3px solid #ff0000;border-radius:12px 8px;box-shadow:2px 4px 6px 1px rgba(0,0,0,.5), inset 0 0 4px blue;
        background-color:#112233;background-image:linear-gradient(to right, red, blue 50%, lime);
        outline:2px dashed green;outline-offset:3px;opacity:.5;overflow:hidden"></div>`);

    expect(snapshot.version).toBe(1);
    expect(snapshot.viewport).toEqual({ width: 400, height: 300 });

    const box = byId(snapshot, "box");

    expect(box).toMatchObject({
      tag: "div",
      key: "card",
      part: "body",
      opacity: 0.5,
      clip: { x: true, y: true },
    });
    expect(box.rect).toEqual({ x: 20, y: 10, width: 106, height: 66 });
    expect(box.radii![0]).toEqual([12, 12]);
    expect(box.radii![1]).toEqual([8, 8]);
    expect(box.background).toBe("rgb(17, 34, 51)");
    expect(box.border![0]).toEqual({ width: 3, style: "solid", color: "rgb(255, 0, 0)" });
    expect(box.outline).toEqual({ width: 2, offset: 3, color: "rgb(0, 128, 0)", style: "dashed" });
    expect(box.shadows).toEqual([
      { x: 2, y: 4, blur: 6, spread: 1, color: "rgba(0, 0, 0, 0.5)", inset: false },
      { x: 0, y: 0, blur: 4, spread: 0, color: "rgb(0, 0, 255)", inset: true },
    ]);
    expect(box.backgrounds).toEqual([
      {
        kind: "linear",
        angle: 90,
        stops: [
          { offset: 0, color: "rgb(255, 0, 0)" },
          { offset: 0.5, color: "rgb(0, 0, 255)" },
          { offset: 1, color: "rgb(0, 255, 0)" },
        ],
      },
    ]);
  }, 30_000);

  test("a radial gradient", async () => {
    const snapshot = await snap(
      `<div id="r" style="width:100px;height:100px;background:radial-gradient(circle at 25% 50%, white 0%, black 100%)"></div>`,
    );

    const [layer] = byId(snapshot, "r").backgrounds!;

    expect(layer).toMatchObject({ kind: "radial", shape: "circle", at: [25, 50] });
  });

  test("multi-line text keeps its advances, letter-spacing and underline", async () => {
    const snapshot = await snap(
      `<p id="t" style="margin:0;width:90px;letter-spacing:2px;text-decoration:underline;color:#00f">aaaa bbbb cccc</p>`,
    );

    const runs = byId(snapshot, "t").children.flatMap((c) => (c.type === "text" ? c.runs : []));

    expect(runs.map((r) => r.text)).toEqual(["aaaa", "bbbb", "cccc"]);
    expect(runs.map((r) => r.y)).toEqual(runs.map((r) => r.y).sort((a, b) => a - b));
    expect(new Set(runs.map((r) => r.y)).size).toBe(3);

    const [first] = runs;

    near(first!.advances[0], 9.6 + 2, 0.1); // a 16px monospace glyph plus the letter-spacing
    expect(first!.advances).toHaveLength(4);
    expect(first).toMatchObject({
      x: 0,
      letterSpacing: 2,
      color: "rgb(0, 0, 255)",
      font: { weight: 400, italic: false, size: 16 },
      decoration: { lines: ["underline"], color: "rgb(0, 0, 255)" },
    });
    near(first!.y, 16, 4); // the baseline sits inside the first 20px line
  });

  test("an inline svg icon", async () => {
    const snapshot =
      await snap(`<svg id="i" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" style="color:#ff00ff">
      <title>x</title><path d="M4 12h16" stroke-width="2" stroke-linecap="round"/><circle cx="12" cy="12" r="5" fill="#00ff00"/></svg>`);

    const { svg, rect } = byId(snapshot, "i");

    expect(rect).toMatchObject({ width: 24, height: 24 });
    expect(svg!.tag).toBe("svg");
    expect(svg!.attrs.viewBox).toBe("0 0 24 24");
    expect(svg!.children.map((c) => c.tag)).toEqual(["path", "circle"]);
    expect(svg!.children[0]!.attrs.d).toBe("M4 12h16");
    expect(svg!.children[0]!.style).toMatchObject({
      fill: "none",
      stroke: "rgb(255, 0, 255)",
      "stroke-width": "2px",
      "stroke-linecap": "round",
    });
    expect(svg!.children[1]!.style.fill).toBe("rgb(0, 255, 0)");
  });

  test("a rotated and skewed element, and its children", async () => {
    const snapshot =
      await snap(`<div style="padding:50px"><div id="x" style="width:100px;height:40px;
      transform:rotate(30deg) skewX(10deg);transform-origin:10px 5px;background:red">
      <div id="kid" style="width:20px;height:10px;margin-left:30px"></div></div></div>`);

    const outer = byId(snapshot, "x");

    // The rect is the untransformed layout box.
    expect(outer.rect).toEqual({ x: 50, y: 50, width: 100, height: 40 });
    expect(outer.transform!.origin).toEqual([60, 55]);
    const [a, b, c, d, e, f] = outer.transform!.matrix;
    const t = Math.tan((10 * Math.PI) / 180);
    const cos = Math.cos(Math.PI / 6);
    const sin = Math.sin(Math.PI / 6);

    near(a, cos, 0.001);
    near(b, sin, 0.001);
    near(c, cos * t - sin, 0.001);
    near(d, sin * t + cos, 0.001);
    near(e, 0, 0.001);
    near(f, 0, 0.001);

    // The child is laid out in the same flat space; the ancestor's transform composes on top.
    expect(byId(snapshot, "kid").rect).toEqual({ x: 80, y: 50, width: 20, height: 10 });
    expect(byId(snapshot, "kid").transform).toBeUndefined();
  });

  test("text under a rotated ancestor is measured in layout space", async () => {
    const snapshot = await snap(
      `<div style="width:200px;height:40px;transform:rotate(90deg)"><span id="s">abc</span></div>`,
    );

    const [run] = byId(snapshot, "s").children.flatMap((c) => (c.type === "text" ? c.runs : []));

    expect(run).toMatchObject({ text: "abc" });
    near(run!.x, 0, 0.1);
    near(run!.advances[0], 9.6, 0.5);
    near(run!.y, 16, 4);
  });

  test("a CSS animation and a transition, mid-flight", async () => {
    const snapshot = await snap(
      `<style>
        @keyframes slide { from { transform: translateX(0px); opacity: 1 } to { transform: translateX(80px); opacity: .2 } }
        #a { width:20px;height:20px;background:red;animation:slide 2s ease-in 1s 3 alternate both paused }
        #b { width:20px;height:20px;background:red;transition:background-color 4s linear }
        #b.go { background-color: blue }
      </style><div id="a"></div><div id="b"></div>`,
    );

    await page.evaluate(() => {
      document.getElementById("b")!.classList.add("go");
      document.getAnimations().find((x) => x instanceof CSSAnimation)!.currentTime = 1500;
    });
    const after = await grab();

    expect(snapshot.root.children.length).toBe(2);
    const [anim] = byId(after, "a").animations!;

    expect(anim).toMatchObject({
      kind: "animation",
      name: "slide",
      duration: 2000,
      delay: 1000,
      endDelay: 0,
      iterations: 3,
      direction: "alternate",
      easing: "linear", // the animation-timing-function lives on each keyframe
      fill: "both",
      currentTime: 1500,
      playbackRate: 1,
      playState: "paused",
    });
    expect(anim!.keyframes.map((k) => [k.offset, k.easing])).toEqual([
      [0, "ease-in"],
      [1, "ease-in"],
    ]);
    expect(anim!.keyframes[1]!.props).toMatchObject({
      transform: "translateX(80px)",
      opacity: "0.2",
    });
    // Layout already reflects the moment: 0.5s into the animation, so it has left the start.
    expect(byId(after, "a").opacity).toBeLessThan(1);

    const [transition] = byId(after, "b").animations!;

    expect(transition).toMatchObject({
      kind: "transition",
      name: "background-color",
      duration: 4000,
    });
    expect(transition!.keyframes.at(-1)!.props.backgroundColor).toBe("rgb(0, 0, 255)");
  });

  test("invisible nodes are skipped", async () => {
    const snapshot = await snap(
      `<div id="a" style="display:none">x</div><div id="b" style="visibility:hidden;height:10px">y</div><div id="c"></div><div id="d" style="height:5px"></div>`,
    );

    expect(snapshot.root.children.map((c) => (c.type === "element" ? c.id : "text"))).toEqual([
      "d",
    ]);
  });

  test("an img keeps its source and fit", async () => {
    const dot = "data:image/gif;base64,R0lGODlhAQABAAAAACw=";

    const snapshot = await snap(
      `<img id="p" src="${dot}" width="50" height="30" style="object-fit:cover">`,
    );

    expect(byId(snapshot, "p").image).toMatchObject({ src: dot, objectFit: "cover" });
    expect(byId(snapshot, "p").rect).toMatchObject({ width: 50, height: 30 });
  });
});

describe("form controls", () => {
  const texts = (el: ElementNode) =>
    el.children.flatMap((c) => (c.type === "text" ? c.runs.map((r) => r.text) : []));

  const runs = (el: ElementNode) => el.children.flatMap((c) => (c.type === "text" ? c.runs : []));

  test("an input's value is its text, inside the content box", async () => {
    const snapshot = await snap(
      `<input id="i" value="Ada" style="width:100px;height:30px;padding:0 8px;border:1px solid #000;box-sizing:border-box;font:16px/20px monospace">`,
    );

    const input = byId(snapshot, "i");
    const [run] = runs(input);

    expect(texts(input)).toEqual(["Ada"]);
    expect(input.clip).toEqual({ x: true, y: true });
    near(run?.x, input.rect.x + 1 + 8);
    // Centered in the 28px content box: a 20px line starts 4px down, and its baseline is below that.
    expect(run!.y).toBeGreaterThan(input.rect.y + 1 + 4);
    expect(run!.y).toBeLessThan(input.rect.y + 1 + 4 + 20);
    expect(run?.advances).toHaveLength(3);
  });

  test("an empty input shows its placeholder, faded by its opacity", async () => {
    const snapshot = await snap(
      `<style>#p::placeholder{color:rgb(100,100,100);opacity:.5}</style><input id="p" placeholder="Search" style="font:16px monospace"><input id="q" placeholder="Gone" value="x">`,
    );

    const [run] = runs(byId(snapshot, "p"));

    expect(run?.text).toBe("Search");
    expect(run?.color).toBe("rgba(100, 100, 100, 0.5)");
    expect(texts(byId(snapshot, "q"))).toEqual(["x"]);
  });

  test("a password is bullets", async () => {
    const snapshot = await snap(`<input id="w" type="password" value="hunter2">`);

    expect(texts(byId(snapshot, "w"))).toEqual(["\u2022".repeat(7)]);
  });

  test("a textarea wraps its value into lines and keeps its scroll", async () => {
    const snapshot = await snap(
      `<textarea id="t" style="width:80px;height:100px;padding:4px;border:0;font:16px/20px monospace;resize:none">one two three\nfour</textarea>`,
    );

    const lines = runs(byId(snapshot, "t"));

    expect(lines.length).toBeGreaterThanOrEqual(3);
    expect(lines.map((l) => l.text).join(" ")).toBe("one two three four");
    expect(lines[1]!.y - lines[0]!.y).toBeCloseTo(20, 0);
    expect(lines[0]!.x).toBeCloseTo(byId(snapshot, "t").rect.x + 4, 0);
  });

  test("a select shows its selected option and a chevron", async () => {
    const snapshot = await snap(
      `<select id="s"><option>One</option><option selected>Two</option></select><select id="n" style="appearance:none"><option>Bare</option></select>`,
    );

    expect(texts(byId(snapshot, "s"))).toEqual(["Two"]);
    expect(byId(snapshot, "s").control).toMatchObject({ kind: "select" });
    expect(texts(byId(snapshot, "n"))).toEqual(["Bare"]);
    expect(byId(snapshot, "n").control).toBeUndefined();
  });

  test("native checkboxes and radios carry their state, not their chrome", async () => {
    const snapshot = await snap(
      `<input id="a" type="checkbox" checked><input id="b" type="checkbox"><input id="c" type="radio" checked style="accent-color:rgb(255,0,0)"><input id="d" type="checkbox" style="appearance:none;width:16px;height:16px;border:1px solid #000">`,
    );

    const a = byId(snapshot, "a");

    expect(a.control).toEqual({
      kind: "checkbox",
      checked: true,
      indeterminate: false,
      accent: "rgb(0, 117, 255)",
    });

    expect(a.border).toBeUndefined();
    expect(a.background).toBeUndefined();
    expect(byId(snapshot, "b").control).toMatchObject({ checked: false });
    expect(byId(snapshot, "c").control).toMatchObject({ kind: "radio", accent: "rgb(255, 0, 0)" });
    expect(byId(snapshot, "d").control).toBeUndefined();
    expect(byId(snapshot, "d").border).toBeDefined();
  });

  test("the measuring mirror is removed", async () => {
    await snap(`<input value="x">`);
    expect(await page.evaluate(() => document.documentElement.children.length)).toBe(2);
  });
});

describe("checkVersion", () => {
  test("accepts version 1", () => {
    expect(checkVersion({ version: 1 }).version).toBe(1);
  });

  test("tells the user to capture again", () => {
    expect(() => checkVersion({ version: 2 })).toThrow(/capture the page again/);
    expect(() => checkVersion({})).toThrow(/found no version/);
    expect(() => checkVersion({ version: "1" })).toThrow(/not a version 1 Snapshot/);
  });
});
