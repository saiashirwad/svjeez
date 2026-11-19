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
    expect(box.backgrounds).toMatchObject([
      {
        kind: "linear",
        angle: 90,
        stops: [
          { offset: 0, color: "rgb(255, 0, 0)" },
          { offset: 0.5, color: "rgb(0, 0, 255)" },
          { offset: 1, color: "rgb(0, 255, 0)" },
        ],
        // The default origin is the padding box, inside the 3px border, and the default clip is the border box.
        place: {
          size: [100, 60],
          origin: { x: 3, y: 3, width: 100, height: 60 },
          clip: { x: 0, y: 0, width: 106, height: 66 },
        },
      },
    ]);
  }, 30_000);

  test("a radial gradient", async () => {
    const snapshot = await snap(
      `<div id="r" style="width:100px;height:100px;background:radial-gradient(circle at 25% 50%, white 0%, black 100%)"></div>`,
    );

    const [layer] = byId(snapshot, "r").backgrounds!;

    // The default size, farthest-corner, reaches the far corner: 75 across and 50 down.
    expect(layer).toMatchObject({ kind: "radial", at: [25, 50], radius: [90.139, 90.139] });
  });

  test("radial gradient sizes: keywords and lengths, for circles and ellipses", async () => {
    const radii = async (css: string) => {
      const snapshot = await snap(
        `<div id="r" style="width:200px;height:100px;background:radial-gradient(${css}, red, blue)"></div>`,
      );

      const [layer] = byId(snapshot, "r").backgrounds!;

      return layer?.kind === "radial" ? { at: layer.at, radius: layer.radius } : undefined;
    };

    expect(await radii("red")).toBeDefined();
    // An ellipse reaches its corner in the same ratio as it reaches the sides.
    expect(await radii("ellipse farthest-corner at 25% 50%")).toEqual({
      at: [50, 50],
      radius: [212.132, 70.711],
    });
    expect(await radii("closest-side at 25% 50%")).toEqual({ at: [50, 50], radius: [50, 50] });
    expect(await radii("circle closest-side at 25% 20%")).toEqual({
      at: [50, 20],
      radius: [20, 20],
    });
    expect(await radii("circle farthest-side at 25% 20%")).toEqual({
      at: [50, 20],
      radius: [150, 150],
    });
    expect(await radii("circle closest-corner at 25% 20%")).toEqual({
      at: [50, 20],
      radius: [53.852, 53.852],
    });
    expect(await radii("circle 30px at left top")).toEqual({ at: [0, 0], radius: [30, 30] });
    expect(await radii("ellipse 60px 25% at right")).toEqual({
      at: [200, 50],
      radius: [60, 25],
    });
    expect(await radii("40px 10px at bottom")).toEqual({ at: [100, 100], radius: [40, 10] });
  });

  test("repeating gradients keep their stops and say so", async () => {
    const snapshot = await snap(
      `<div id="r" style="width:100px;height:100px;background:repeating-linear-gradient(45deg, red, red 10px, blue 10px, blue 20px), repeating-radial-gradient(circle at 10px 20px, red 5px, blue 15px)"></div>`,
    );

    const [linear, radial] = byId(snapshot, "r").backgrounds!;

    expect(radial).toMatchObject({
      kind: "radial",
      repeating: true,
      at: [10, 20],
      stops: [
        { offset: 0.042, color: "rgb(255, 0, 0)" },
        { offset: 0.125, color: "rgb(0, 0, 255)" },
      ],
    });
    expect(linear).toMatchObject({ kind: "linear", repeating: true, angle: 45 });

    if (linear?.kind !== "linear") throw new Error("expected a linear layer");
    // The line through a 100px square at 45deg is 141.42px long, so 10px is 0.0707 of it.
    expect(linear.stops.map((stop) => stop.offset)).toEqual([0, 0.071, 0.071, 0.141]);
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

describe("pseudo-elements", () => {
  const runsOf = (node: Node) => (node.type === "text" ? node.runs : []);

  const pseudos = (el: ElementNode) =>
    el.children.filter((c): c is ElementNode => c.type === "element" && c.tag.startsWith("::"));

  test("an absolutely positioned dot is read from the host's padding box, without touching the DOM", async () => {
    await page.setContent(
      `<style>html,body{margin:0}
        #host{position:relative;margin:30px 20px;width:100px;height:60px;border:4px solid #000}
        #host::after{content:"";position:absolute;top:6px;right:8px;width:10px;height:10px;border-radius:50%;background:red}
      </style><div id="root"><div id="host"></div></div>`,
    );

    const { snapshot, mutations } = await page.evaluate<{ snapshot: Snapshot; mutations: number }>(
      `(() => {
        const watch = new MutationObserver(() => {});

        watch.observe(document, { subtree: true, childList: true, attributes: true });

        const snapshot = (${captureScript})(document.getElementById("root"));

        return { snapshot, mutations: watch.takeRecords().length };
      })()`,
    );

    const host = byId(snapshot, "host");
    const [dot] = pseudos(host);

    expect(dot).toMatchObject({ tag: "::after", part: "::after", background: "rgb(255, 0, 0)" });
    // The host is 108 wide with a 4px border: right:8px leaves the dot 100 - 8 - 10 = 82 into the padding box.
    expect(dot!.rect).toEqual({ x: 20 + 4 + 82, y: 30 + 4 + 6, width: 10, height: 10 });
    expect(dot!.radii![0]).toEqual([5, 5]);
    expect(mutations).toBe(0);
  });

  test("a text badge from content and attr() is measured through a stand-in that leaves no trace", async () => {
    const snapshot = await snap(
      `<style>#b::before{content:attr(data-n) " new";background:#eef;padding:0 4px}</style>
       <p id="b" data-n="3">item</p>`,
    );

    const b = byId(snapshot, "b");
    const [badge, text] = [pseudos(b)[0]!, b.children[1]!];

    expect(b.children[0]).toBe(badge);
    expect(badge).toMatchObject({
      tag: "::before",
      part: "::before",
      background: "rgb(238, 238, 255)",
    });
    expect(badge.children[0]).toMatchObject({ type: "text", runs: [{ text: "3 new" }] });
    // The badge sits before the real text, which starts to its right.
    expect(badge.rect.x).toBe(0);
    expect(text).toMatchObject({ type: "text" });
    expect(runsOf(text!)[0]!.x).toBeGreaterThanOrEqual(badge.rect.width - 0.5);
    expect(
      await page.evaluate(() => document.querySelectorAll("[data-svjeez-pseudo],span").length),
    ).toBe(0);
    expect(await page.evaluate(() => document.adoptedStyleSheets.length)).toBe(0);
    expect(
      await page.evaluate(
        () => getComputedStyle(document.getElementById("b")!, "::before").content,
      ),
    ).not.toBe("none");
  });

  test("a flex item pseudo-element sits between the real children", async () => {
    const snapshot = await snap(
      `<style>#f{display:flex;gap:10px}#f::before{content:"";width:12px;height:12px;background:blue}
        #f::after{content:"end"}</style><div id="f"><i id="k" style="width:30px;height:10px;background:green"></i></div>`,
    );

    const f = byId(snapshot, "f");

    expect(f.children.map((c) => (c.type === "element" ? c.tag : "text"))).toEqual([
      "::before",
      "i",
      "::after",
    ]);
    expect(f.children[0]).toMatchObject({ rect: { x: 0, width: 12, height: 12 } });
    expect(byId(snapshot, "k").rect.x).toBe(22);
    expect(find(f, (e) => e.tag === "::after")!.rect.x).toBe(62);
  });

  test("real children keep their :first-child styling, and the page is left as it was", async () => {
    const snapshot = await snap(
      `<style>#p::before{content:"> "}#p::after{content:" <"}
        #p b:first-child{color:rgb(1,2,3)} #p b:last-child{color:rgb(4,5,6)} #p:empty{background:red}</style>
       <p id="p"><b id="x">one</b></p>`,
    );

    const p = byId(snapshot, "p");

    expect(p.background).toBeUndefined();
    expect(p.children.map((c) => (c.type === "element" ? c.tag : "text"))).toEqual([
      "::before",
      "b",
      "::after",
    ]);

    const x = byId(snapshot, "x");
    const run = runsOf(x.children[0]!)[0]!;

    expect(run.color).toBe("rgb(4, 5, 6)");
    expect(await page.evaluate(() => document.getElementById("p")!.children.length)).toBe(1);
  });

  test("content none, display none, hidden and replaced hosts have no pseudo-element", async () => {
    const snapshot = await snap(
      `<style>
        #a::before{content:none} #b::before{content:"x";display:none} #c::before{content:"x";visibility:hidden}
        #d::after{content:"x"} #e::after{content:"x"}
      </style><div id="a">a</div><div id="b">b</div><div id="c">c</div><input id="d" value="v"><img id="e" alt="" src="data:image/gif;base64,R0lGODlhAQABAAAAACw=">`,
    );

    for (const id of ["a", "b", "c", "d", "e"]) expect(pseudos(byId(snapshot, id))).toEqual([]);
  });

  test("an animated ::after rides on the synthetic node", async () => {
    const snapshot = await snap(
      `<style>@keyframes pulse{from{opacity:1}to{opacity:.2}}
        #h{position:relative;width:40px;height:40px}
        #h::after{content:"";position:absolute;left:0;top:0;width:8px;height:8px;background:red;animation:pulse 2s linear infinite paused}
      </style><div id="h"></div>`,
    );

    const h = byId(snapshot, "h");
    const [dot] = pseudos(h);

    expect(h.animations).toBeUndefined();
    expect(dot!.animations).toHaveLength(1);
    expect(dot!.animations![0]).toMatchObject({
      kind: "animation",
      name: "pulse",
      iterations: "infinite",
    });
  });

  test("counter() content draws nothing", async () => {
    const snapshot = await snap(
      `<style>ol{counter-reset:n}li{counter-increment:n}li::before{content:counter(n)}</style><ol><li id="l">x</li></ol>`,
    );

    expect(pseudos(byId(snapshot, "l"))).toEqual([]);
  });
});

describe("background layers", () => {
  const layersOf = async (css: string, extra = "") => {
    const snapshot = await snap(
      `<div id="b" style="width:200px;height:100px;padding:10px;border:5px solid red;box-sizing:content-box;${extra};${css}"></div>`,
    );

    return byId(snapshot, "b").backgrounds ?? [];
  };

  test("size, position, repeat, origin and clip, per layer", async () => {
    const layers = await layersOf(
      `background-image:url(data:image/gif;base64,R0lGODlhAQABAAAAACw=),linear-gradient(red,blue);
       background-size:50% 20px,cover;background-position:right 10px bottom 5px,center;
       background-repeat:repeat-x,space round;background-origin:content-box,border-box;background-clip:padding-box,content-box`,
    );

    expect(layers).toMatchObject([
      {
        kind: "image",
        place: {
          size: [100, 20],
          // `right 10px bottom 5px` is `calc(100% - 10px) calc(100% - 5px)`.
          position: [
            { percent: 100, px: -10 },
            { percent: 100, px: -5 },
          ],
          repeat: ["repeat", "no-repeat"],
          origin: { x: 15, y: 15, width: 200, height: 100 },
          clip: { x: 5, y: 5, width: 220, height: 120 },
        },
      },
      {
        kind: "linear",
        place: {
          // A gradient has no size of its own: cover is its origin box.
          size: [230, 130],
          position: [
            { percent: 50, px: 0 },
            { percent: 50, px: 0 },
          ],
          repeat: ["space", "round"],
          origin: { x: 0, y: 0, width: 230, height: 130 },
          clip: { x: 15, y: 15, width: 200, height: 100 },
        },
      },
    ]);
  });

  test("a shorter list repeats to the number of layers", async () => {
    const layers = await layersOf(
      `background-image:linear-gradient(red,blue),linear-gradient(blue,red),linear-gradient(lime,red);
       background-size:10px 10px,20px 20px;background-repeat:no-repeat;background-clip:content-box,border-box`,
    );

    expect(layers.map((layer) => layer.place?.size)).toEqual([
      [10, 10],
      [20, 20],
      [10, 10],
    ]);
    expect(layers.map((layer) => layer.place?.repeat)).toEqual(
      layers.map(() => ["no-repeat", "no-repeat"]),
    );
    expect(layers.map((layer) => layer.place?.clip.x)).toEqual([15, 0, 15]);
  });

  test("a url() layer keeps `auto` and the keywords for compile, which can read the image", async () => {
    const layers = await layersOf(
      `background-image:url(data:image/gif;base64,R0lGODlhAQABAAAAACw=),url(data:image/gif;base64,R0lGODlhAQABAAAAACw=),url(data:image/gif;base64,R0lGODlhAQABAAAAACw=);
       background-size:auto,contain,30px auto`,
    );

    expect(layers.map((layer) => layer.place?.size)).toEqual([
      ["auto", "auto"],
      "contain",
      [30, "auto"],
    ]);
  });

  test("a gradient is resolved against its tile", async () => {
    const [layer] = await layersOf(
      "background:radial-gradient(circle closest-side, red, blue) 0 0/50px 40px",
    );

    expect(layer).toMatchObject({
      kind: "radial",
      at: [25, 20],
      radius: [20, 20],
      place: { size: [50, 40] },
    });
  });
});

describe("filter, text-shadow, clip-path and mask-image", () => {
  test("a filter list, in order, with its amounts as numbers", async () => {
    const el = byId(
      await snap(
        `<div id="n" style="width:20px;height:20px;filter:blur(4px) drop-shadow(2px 3px 4px red) brightness(150%) grayscale(.5) hue-rotate(.25turn) opacity(30%) saturate(2) contrast(120%)"></div>`,
      ),
      "n",
    );

    expect(el.filter).toEqual([
      { fn: "blur", radius: 4 },
      { fn: "drop-shadow", x: 2, y: 3, blur: 4, color: "rgb(255, 0, 0)" },
      { fn: "brightness", amount: 1.5 },
      { fn: "grayscale", amount: 0.5 },
      { fn: "hue-rotate", amount: 90 },
      { fn: "opacity", amount: 0.3 },
      { fn: "saturate", amount: 2 },
      { fn: "contrast", amount: 1.2 },
    ]);
    expect(el.notes).toBeUndefined();
  });

  test("a drop-shadow with no color is currentcolor", async () => {
    const el = byId(
      await snap(`<div id="n" style="color:blue;filter:drop-shadow(1px 1px)">x</div>`),
      "n",
    );

    expect(el.filter).toEqual([
      { fn: "drop-shadow", x: 1, y: 1, blur: 0, color: "rgb(0, 0, 255)" },
    ]);
  });

  test("text-shadow is on each run, topmost first", async () => {
    const el = byId(
      await snap(
        `<div id="n" style="text-shadow:1px 2px 3px red, 0 0 4px rgba(0,0,0,.5)">hi</div>`,
      ),
      "n",
    );

    const [text] = el.children;

    expect(text).toMatchObject({
      type: "text",
      runs: [
        {
          shadows: [
            { x: 1, y: 2, blur: 3, color: "rgb(255, 0, 0)" },
            { x: 0, y: 0, blur: 4, color: "rgba(0, 0, 0, 0.5)" },
          ],
        },
      ],
    });
  });

  test("clip-path shapes, resolved to px from the border box's corner", async () => {
    const clip = async (css: string, style = "") =>
      byId(
        await snap(
          `<div id="n" style="width:200px;height:100px;padding:10px;border:5px solid red;${style}clip-path:${css}"></div>`,
        ),
        "n",
      ).clipPath;

    // The border box is 230 by 130.
    expect(await clip("inset(10px 5% round 8px 4px)")).toMatchObject({
      kind: "inset",
      rect: { x: 11.5, y: 10, width: 207, height: 110 },
      radii: [
        [8, 8],
        [4, 4],
        [8, 8],
        [4, 4],
      ],
    });
    expect(await clip("circle(50%)")).toEqual({
      kind: "ellipse",
      center: [115, 65],
      radius: [expect.closeTo(Math.hypot(230, 130) / Math.SQRT2 / 2, 2), expect.any(Number)],
    });
    expect(await clip("circle(at 20px 30%)")).toEqual({
      kind: "ellipse",
      center: [20, 39],
      radius: [20, 20],
    });
    expect(await clip("ellipse(40% 30% at 50% 50%)")).toEqual({
      kind: "ellipse",
      center: [115, 65],
      radius: [92, 39],
    });
    expect(await clip("polygon(50% 0, 100% 100%, 0 100%)")).toEqual({
      kind: "polygon",
      points: [
        [115, 0],
        [230, 130],
        [0, 130],
      ],
      rule: "nonzero",
    });
    expect(await clip("polygon(evenodd, 0 0, 10px 10px, 0 10px)")).toMatchObject({
      rule: "evenodd",
    });
    expect(await clip("path('M0 0 L10 10 L0 10 Z')")).toEqual({
      kind: "path",
      d: "M 0 0 L 10 10 L 0 10 Z",
      at: [0, 0],
      rule: "nonzero",
    });
  });

  test("a clip-path reference box moves the shape", async () => {
    const el = byId(
      await snap(
        `<div id="n" style="width:200px;height:100px;padding:10px;border:5px solid red;clip-path:inset(0) content-box"></div>`,
      ),
      "n",
    );

    expect(el.clipPath).toMatchObject({ rect: { x: 15, y: 15, width: 200, height: 100 } });
  });

  test("mask-image layers are placed like background layers", async () => {
    const el = byId(
      await snap(
        `<div id="n" style="width:100px;height:60px;mask-image:linear-gradient(black, transparent), linear-gradient(red,blue);mask-size:50px 20px, auto;mask-repeat:no-repeat;mask-position:right bottom"></div>`,
      ),
      "n",
    );

    expect(el.masks).toMatchObject([
      {
        kind: "linear",
        angle: 180,
        place: {
          size: [50, 20],
          repeat: ["no-repeat", "no-repeat"],
          origin: { x: 0, y: 0, width: 100, height: 60 },
        },
      },
      { kind: "linear", place: { size: [100, 60] } },
    ]);
    expect(el.backgrounds).toBeUndefined();
  });

  test("a mask url() image is kept as a src", async () => {
    const el = byId(
      await snap(`<div id="n" style="width:10px;height:10px;mask-image:url(a.png)"></div>`),
      "n",
    );

    expect(el.masks).toMatchObject([{ kind: "image", src: expect.stringContaining("a.png") }]);
  });
});

describe("notes: what capture cannot represent", () => {
  const noted = async (html: string, id = "n") => byId(await snap(html), id).notes ?? [];

  test("plain CSS has none", async () => {
    const snapshot = await snap(
      `<div id="n" style="width:20px;height:20px;background:linear-gradient(red,blue) 0 0/auto repeat;transform:rotate(5deg);filter:none">x</div>`,
    );

    expect(byId(snapshot, "n").notes).toBeUndefined();
  });

  test("conic gradients", async () => {
    expect(
      await noted(
        `<div id="n" style="width:20px;height:20px;background-image:conic-gradient(red,blue),repeating-conic-gradient(red 0 10%,blue 0 20%),repeating-linear-gradient(red,blue 10px),linear-gradient(red,blue)"></div>`,
      ),
    ).toEqual(["conic-gradient() is not drawn", "repeating-conic-gradient() is not drawn"]);
  });

  test("a fixed background is drawn as scroll", async () => {
    expect(
      await noted(
        `<div id="n" style="width:20px;height:20px;background:linear-gradient(red,blue) fixed"></div>`,
      ),
    ).toEqual(["background-attachment: fixed is drawn as scroll"]);
  });

  test("3D transforms are flattened, with perspective and preserve-3d", async () => {
    const flat = "a 3D transform is flattened to 2D";

    expect(
      await noted(`<div id="n" style="width:20px;height:20px;transform:rotateX(40deg)"></div>`),
    ).toEqual([flat]);
    expect(
      await noted(`<div id="n" style="width:20px;height:20px;rotate:1 0 0 40deg"></div>`),
    ).toEqual([flat]);
    expect(
      await noted(`<div id="n" style="width:20px;height:20px;translate:1px 2px 3px"></div>`),
    ).toEqual([flat]);
    expect(
      await noted(
        `<div id="n" style="width:20px;height:20px;perspective:100px;transform-style:preserve-3d"><i></i></div>`,
      ),
    ).toEqual(["perspective is not drawn", "transform-style: preserve-3d is not drawn"]);
  });

  test("backdrop-filter, filter: invert() and sepia(), and the rest of what compile cannot draw", async () => {
    expect(
      await noted(
        `<div id="n" style="width:20px;height:20px;filter:blur(2px) invert(1) sepia(.5);backdrop-filter:blur(2px)"></div>`,
      ),
    ).toEqual([
      "filter: invert() is not drawn",
      "filter: sepia() is not drawn",
      "backdrop-filter is not drawn",
    ]);
    expect(await noted(`<div id="n" style="width:20px;height:20px;filter:url(#x)"></div>`)).toEqual(
      ["filter: url() is not drawn"],
    );
  });

  test("clip-path: url(#...), margin-box and mask-image that cannot be drawn", async () => {
    expect(
      await noted(
        `<div id="n" style="width:20px;height:20px;clip-path:url(#c);mask-image:url(#m);mask-mode:luminance"></div>`,
      ),
    ).toEqual(["clip-path: url is not drawn", "mask-image: url(#...) is not drawn"]);
    expect(
      await noted(
        `<div id="n" style="width:20px;height:20px;mask-image:linear-gradient(red,blue);mask-mode:luminance"></div>`,
      ),
    ).toEqual(["mask-mode: luminance is not drawn"]);
    expect(
      await noted(
        `<div id="n" style="width:20px;height:20px;clip-path:circle(50%) margin-box"></div>`,
      ),
    ).toEqual(["clip-path: margin-box is drawn as border-box"]);
  });

  test("background-clip: text and vertical writing-mode, on the element that has the text", async () => {
    const snapshot = await snap(
      `<div id="n" style="text-shadow:1px 1px red;background:red;background-clip:text;writing-mode:vertical-rl">hi<b id="k"><i id="e" style="display:block;width:5px;height:5px"></i></b></div>`,
    );

    expect(byId(snapshot, "n").notes).toEqual([
      "background-clip: text is not drawn",
      "a vertical writing-mode is not drawn",
    ]);
    // Inherited, but this element draws no text of its own.
    expect(byId(snapshot, "e").notes).toBeUndefined();
  });

  test("canvas and video", async () => {
    const snapshot = await snap(
      `<canvas id="c" width="10" height="10"></canvas><video id="v" width="10" height="10"></video>`,
    );

    expect(byId(snapshot, "c").notes).toEqual(["<canvas> is not drawn"]);
    expect(byId(snapshot, "v").notes).toEqual(["<video> is not drawn"]);
  });

  test("an open shadow root", async () => {
    const snapshot = await snap(`<div id="n" style="height:10px"></div>`);

    expect(byId(snapshot, "n").notes).toBeUndefined();

    await page.evaluate(() => {
      const root = document.getElementById("n")!.attachShadow({ mode: "open" });

      root.innerHTML = "<p>shadow</p>";
    });
    expect(byId(await grab(), "n").notes).toEqual(["a shadow root is not walked"]);
  });

  test("pseudo-element content that cannot resolve is said on the host", async () => {
    expect(
      await noted(
        `<style>#n{counter-reset:k}#n::before{content:counter(k)}#n::after{content:open-quote "x" close-quote;quotes:auto}</style><div id="n">x</div>`,
      ),
    ).toEqual(["::before counter() content is not drawn", "::after quotes: auto is drawn as “ ”"]);

    expect(
      await noted(
        `<style>#n::before{content:open-quote "x" close-quote;quotes:"<" ">"}</style><div id="n">x</div>`,
      ),
    ).toEqual([]);
  });

  test("a pseudo-element's own style is noted on its node", async () => {
    const snapshot = await snap(
      `<style>#n::before{content:"x";display:block;width:10px;height:10px;backdrop-filter:blur(1px)}</style><div id="n">y</div>`,
    );

    const [before] = byId(snapshot, "n").children.filter(
      (c): c is ElementNode => c.type === "element" && c.tag === "::before",
    );

    expect(before!.notes).toEqual(["backdrop-filter is not drawn"]);
  });
});

interface Probe {
  t: number;
  state: string;
  rate: number;
  timing: unknown;
}

describe("animated values return to their base", () => {
  const SHEET = `<style>
    @keyframes tint { from { background-color: rgb(255, 0, 0); transform: translateX(0px) } to { background-color: rgb(0, 0, 255); transform: translateX(50px) } }
    #a { width:20px;height:20px;background:rgb(0, 128, 0);opacity:.5;transform:translateY(3px);animation:tint 4s linear 1s }
    #b { width:20px;height:20px;background:rgb(10, 20, 30);transition:background-color 4s linear }
    #b.go { background-color: rgb(200, 100, 50) }
    #c { width:20px;height:20px;animation:tint 4s linear infinite }
  </style><div id="a"></div><div id="b"></div><div id="c"></div>`;

  test("each animated property is read without its animation", async () => {
    await snap(SHEET);
    await page.evaluate(() => {
      document.getElementById("b")!.classList.add("go");

      for (const animation of document.getAnimations()) animation.currentTime = 2500;
    });

    const after = await grab();

    // Mid-flight, the layout shows the animation; the base is what it returns to.
    expect(byId(after, "a").base).toEqual({
      backgroundColor: "rgb(0, 128, 0)",
      transform: "matrix(1, 0, 0, 1, 0, 3)",
      translate: "none",
      rotate: "none",
      scale: "none",
    });
    expect(byId(after, "a").background).not.toBe("rgb(0, 128, 0)");
    expect(byId(after, "b").base).toEqual({ backgroundColor: "rgb(200, 100, 50)" });
    expect(byId(after, "c").base?.backgroundColor).toBe("rgba(0, 0, 0, 0)");
    expect(byId(after, "c").base?.transform).toBe("none");
    expect(after.root.base).toBeUndefined();
  });

  test("it leaves the animations running at the same phase, with no events", async () => {
    await snap(SHEET);

    // Captured inside the page, between reading the animations' state and reading it again.
    const run = await page.evaluate<{
      events: string[];
      same: boolean;
      before: Probe[];
      after: Probe[];
    }>(`(async () => {
      const events = [];
      const animations = document.getAnimations();

      for (const animation of animations) {
        animation.currentTime = 1500;
        animation.addEventListener("finish", () => events.push("finish"));
        animation.addEventListener("cancel", () => events.push("cancel"));
      }

      // One animation paused, one with another rate and fill, to see that they come back as they were.
      animations[0].pause();
      animations[1].playbackRate = 2;
      animations[1].effect.updateTiming({ fill: "both" });

      const probe = () => animations.map((animation) => ({
        t: Number(animation.currentTime),
        state: animation.playState,
        rate: animation.playbackRate,
        timing: animation.effect.getTiming(),
      }));

      const before = probe();

      (${captureScript})(document.getElementById("root"));

      const same = document.getAnimations().every((animation, i) => animation === animations[i]);

      await new Promise((resolve) => setTimeout(resolve, 300));

      return { events, same, before, after: probe() };
    })()`);

    expect(run.same).toBe(true);
    expect(run.events).toEqual([]);
    expect(run.before.length).toBe(2);

    run.after.forEach((now, i) => {
      const was = run.before[i]!;

      expect(now.state).toBe(was.state);
      expect(now.rate).toBe(was.rate);
      expect(now.timing).toEqual(was.timing);

      // A paused animation has not moved; the others ran on by about the 300ms we waited, at their rate.
      const expected = was.state === "paused" ? 0 : 300 * was.rate;

      expect(Math.abs(now.t - was.t - expected)).toBeLessThan(120 * was.rate + 1);
    });
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
