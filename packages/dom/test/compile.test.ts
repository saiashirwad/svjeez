import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { chromium, type Browser } from "playwright-core";
import { scene } from "svjeez";
import { svg } from "svjeez/tools";
import {
  captureScript,
  compile,
  type Corner,
  type ElementNode,
  type Side,
  type Snapshot,
  type SvgNode,
} from "../src/index.ts";
import type { Background, Matrix, Placement, Run as Captured } from "../src/schema.ts";
import { words } from "./fixtures.ts";
import { decompose } from "../src/compile/transform.ts";

const box = (props: Partial<ElementNode> = {}): ElementNode => ({
  type: "element",
  tag: "div",
  rect: { x: 0, y: 0, width: 100, height: 60 },
  children: [],
  ...props,
});

const snapshot = (root: ElementNode): Snapshot => ({
  version: 1,
  viewport: { width: 400, height: 300 },
  root,
});

/** Compiles `root`, draws it with the core SVG backend, and hands back both. */
const draw = (root: ElementNode) => {
  const compiled = compile(snapshot(root));
  const [width, height] = compiled.size;

  const out = svg.emit(
    scene({ size: [width, height], duration: 1, title: "dom" }, () => compiled.element),
  );

  return { ...compiled, svg: out };
};

const notes = (root: ElementNode) => compile(snapshot(root)).diagnostics.map((d) => d.what);

const side = (width: number, color = "rgb(0, 0, 0)", style: Side["style"] = "solid"): Side => ({
  width,
  style,
  color,
});

const corner = (x: number, y = x): Corner => [x, y];

const leaf = (
  tag: string,
  attrs: Record<string, string> = {},
  style: Record<string, string> = {},
): SvgNode => ({
  tag,
  attrs,
  style: { fill: "rgb(255, 0, 0)", stroke: "none", ...style },
  children: [],
});

describe("boxes", () => {
  test("a rounded box with a background and a gradient, framed at its top-left", () => {
    const out = draw(
      box({
        rect: { x: 30, y: 40, width: 100, height: 60 },
        radii: [corner(8), corner(8), corner(8), corner(8)],
        background: "rgb(255, 0, 0)",
        backgrounds: [
          {
            kind: "linear",
            angle: 90,
            stops: [
              { offset: 0, color: "rgb(0, 0, 255)" },
              { offset: 1, color: "rgba(0, 0, 255, 0.5)" },
            ],
          },
        ],
      }),
    );

    expect(out.size).toEqual([100, 60]);
    expect(out.diagnostics).toEqual([]);
    expect(out.svg).toContain('width="100" height="60" rx="8" fill="#FF0000"');
    expect(out.svg).toContain('x2="100" y2="30"');
    expect(out.svg).toContain('stop-color="#0000FF80"');
    expect(out.svg).not.toContain("translate");
  });

  test("each corner keeps its own radius, and an elliptical one is a path", () => {
    const round = draw(
      box({ background: "rgb(0, 0, 0)", radii: [corner(1), corner(2), corner(3), corner(4)] }),
    );

    expect(round.svg).toContain(
      'd="M1 0H98A2 2 0 0 1 100 2V57A3 3 0 0 1 97 60H4A4 4 0 0 1 0 56V1A1 1 0 0 1 1 0Z"',
    );

    const oval = draw(
      box({ background: "rgb(0, 0, 0)", radii: [corner(10, 5), corner(0), corner(0), corner(0)] }),
    );

    expect(oval.svg).toContain("<path");
  });

  test("opacity, blend and a clip for the children", () => {
    const out = draw(
      box({
        opacity: 0.5,
        blendMode: "multiply",
        clip: { x: true, y: true },
        radii: [corner(10), corner(10), corner(10), corner(10)],
        children: [
          box({ rect: { x: 90, y: 0, width: 50, height: 20 }, background: "rgb(0, 0, 255)" }),
        ],
      }),
    );

    expect(out.svg).toContain('opacity="0.5"');
    expect(out.svg).toContain("multiply");
    expect(out.svg).toMatch(/<clipPath id="c1">\s*<path/);
    expect(out.svg).toContain('clip-path="url(#c1)"');
  });

  test("a rotated and scaled box turns about its transform origin", () => {
    const out = draw(
      box({
        background: "rgb(0, 0, 0)",
        transform: { matrix: [0, 2, -2, 0, 10, 0], origin: [50, 30] },
      }),
    );

    expect(out.svg).toContain("transform-origin:60px 30px;scale:2;rotate:90deg");
    expect(out.diagnostics).toEqual([]);
  });

  test("a skew is drawn, with no diagnostic", () => {
    const skewed = box({
      transform: { matrix: [1, 0, Math.tan(Math.PI / 6), 1, 0, 0], origin: [0, 0] },
      background: "rgb(0, 0, 0)",
    });

    expect(notes(skewed)).toEqual([]);
    expect(draw(skewed).svg).toContain("transform:skewX(30deg)");
  });

  test("decompose puts a matrix back together as translate · rotate · scale · skew", () => {
    const matrix: Matrix = [0.8, 1.4, -0.3, 2.1, 12, -7];
    const { translate, rotate, scale, skew } = decompose(matrix);
    const [r, k] = [(rotate * Math.PI) / 180, Math.tan((skew * Math.PI) / 180)];
    const [cos, sin] = [Math.cos(r), Math.sin(r)];

    const back = [
      cos * scale[0],
      sin * scale[0],
      cos * scale[0] * k - sin * scale[1],
      sin * scale[0] * k + cos * scale[1],
      ...translate,
    ];

    back.forEach((value, i) => expect(value).toBeCloseTo(matrix[i]!, 9));
  });

  test("children sit in their parent's frame", () => {
    const out = draw(
      box({
        rect: { x: 5, y: 5, width: 100, height: 60 },
        children: [
          box({ rect: { x: 30, y: 20, width: 10, height: 10 }, background: "rgb(0, 0, 0)" }),
        ],
      }),
    );

    expect(out.svg).toContain('<rect x="25" y="15" width="10" height="10"');
    expect(out.diagnostics).toEqual([]);
  });
});

describe("borders and outlines", () => {
  test("a uniform border is a stroke pulled in to sit inside the border box", () => {
    const out = draw(
      box({
        radii: [corner(10), corner(10), corner(10), corner(10)],
        border: [side(4), side(4), side(4), side(4)],
      }),
    );

    expect(out.svg).toContain(
      '<rect x="2" y="2" width="96" height="56" rx="8" fill="none" stroke="#000000" stroke-width="4"/>',
    );
  });

  test("dashed, dotted and double borders", () => {
    const four = (style: Side["style"]) =>
      draw(
        box({
          border: [
            side(3, "rgb(0, 0, 0)", style),
            side(3, "rgb(0, 0, 0)", style),
            side(3, "rgb(0, 0, 0)", style),
            side(3, "rgb(0, 0, 0)", style),
          ],
        }),
      );

    expect(four("dashed").svg).toContain('stroke-dasharray="9 9"');
    expect(four("dotted").svg).toContain('stroke-linecap="round"');
    expect(four("double").svg).toContain('<rect x="0.5" y="0.5" width="99" height="59"');
    expect(four("double").svg).toContain('<rect x="2.5" y="2.5" width="95" height="55"');
    expect(four("groove").diagnostics.map((d) => d.what)).toEqual([
      "border-style groove is drawn solid",
    ]);
  });

  test("sides of different widths and colors are wedges cut to the ring", () => {
    const out = draw(
      box({
        border: [
          side(4, "rgb(255, 0, 0)"),
          side(2, "rgb(0, 255, 0)"),
          side(4, "rgb(255, 0, 0)"),
          side(0, "rgb(0, 0, 0)", "none"),
        ],
      }),
    );

    expect(out.svg).toContain('clip-rule="evenodd"');
    expect(out.svg).toContain('<polygon points="0 0 100 0 98 4 0 4"');
    expect(out.svg).toContain('fill="#00FF00"');
  });

  test("sides of one color but different widths are a single ring", () => {
    const out = draw(box({ border: [side(4), side(1), side(4), side(1)] }));

    expect(out.svg).toContain('fill-rule="evenodd"');
    expect(out.svg).toContain("M0 0");
    expect(out.svg).not.toContain("<polygon");
  });

  test("an outline is a stroke outside the border box, past its offset", () => {
    const out = draw(
      box({ outline: { width: 2, offset: 3, color: "rgb(0, 0, 255)", style: "solid" } }),
    );

    expect(out.svg).toContain(
      '<rect x="-4" y="-4" width="108" height="68" fill="none" stroke="#0000FF" stroke-width="2"/>',
    );
  });
});

describe("shadows", () => {
  const shadow = (props: Partial<NonNullable<ElementNode["shadows"]>[number]>) => ({
    x: 2,
    y: 3,
    blur: 6,
    spread: 0,
    color: "rgba(0, 0, 0, 0.5)",
    inset: false,
    ...props,
  });

  test("a plain outer shadow is core's shadow effect, cast only outside the box", () => {
    const out = draw(box({ shadows: [shadow({})] }));

    expect(out.svg).toContain(
      '<feDropShadow dx="2" dy="3" stdDeviation="3" flood-opacity="0.5" flood-color="#000000"/>',
    );
    expect(out.svg).toContain('clip-rule="evenodd"');
  });

  test("a themed shadow's caster is opaque, so its alpha is not applied twice", () => {
    const out = draw(
      box({
        shadows: [shadow({ color: { light: "rgba(0, 0, 0, 0.2)", dark: "rgba(0, 0, 0, 0.5)" } })],
      }),
    );

    expect(out.svg).toMatch(/<feDropShadow[^>]*flood-color="var\(--c-/);
    expect(out.svg).toContain('fill="#000000" filter=');
  });

  test("a spread shadow is a bigger, blurred shape", () => {
    const out = draw(box({ shadows: [shadow({ spread: 4, x: 0, y: 0 })] }));

    expect(out.svg).toContain('<feGaussianBlur stdDeviation="3"/>');
    expect(out.svg).toContain('x="-4" y="-4" width="108" height="68"');
  });

  test("an inset shadow is a ring blurred inside the padding box", () => {
    const out = draw(
      box({
        border: [side(2), side(2), side(2), side(2)],
        shadows: [shadow({ inset: true, blur: 4 })],
      }),
    );

    expect(out.svg).toContain('<feGaussianBlur stdDeviation="2"/>');
    expect(out.svg).toMatch(/<clipPath id="c\d">\s*<path d="M2 2/);
  });
});

describe("text", () => {
  const run = {
    x: 10,
    y: 30,
    text: "Hi!",
    advances: [9, 4, 5],
    font: {
      family: '"Helvetica Neue", Arial, sans-serif',
      weight: 600,
      italic: true,
      stretch: 100,
      size: 16,
    },
    letterSpacing: 1,
    color: "rgb(10, 20, 30)",
  };

  test("a run is set at its baseline with the captured font, color and spacing", () => {
    const out = draw(box({ children: [{ type: "text", runs: [run] }] }));

    expect(out.svg).toContain("font-family=\"'Helvetica Neue', Arial, sans-serif\"");
    expect(out.svg).toContain('font-weight="600"');
    expect(out.svg).toContain('font-style="italic"');
    expect(out.svg).toContain('<text x="10" y="30"');
    expect(out.svg).toContain('letter-spacing="1"');
    expect(out.svg).toContain('fill="#0A141E"');
    expect(out.svg).toContain(">Hi!</text>");
  });

  test("a right-to-left run is an isolate whose controls take no room", () => {
    const out = draw(
      box({
        children: [
          { type: "text", runs: [{ ...run, text: "\u05e9\u05dc", advances: [9, 4], rtl: true }] },
        ],
      }),
    );

    expect(out.svg).toContain(">\u2067\u05e9\u05dc\u2069</text>");
  });

  test("decorations are thin rects as wide as the run", () => {
    const out = draw(
      box({
        children: [
          {
            type: "text",
            runs: [
              {
                ...run,
                decoration: {
                  lines: ["underline", "line-through"],
                  color: "rgb(255, 0, 0)",
                  thickness: 2,
                },
              },
            ],
          },
        ],
      }),
    );

    expect(
      out.svg.match(/<rect x="10" y="[\d.-]+" width="18" height="2" fill="#FF0000"\/>/g),
    ).toHaveLength(2);
  });
});

describe("inline svg", () => {
  const icon = (children: SvgNode[], attrs: Record<string, string> = {}): ElementNode =>
    box({
      tag: "svg",
      rect: { x: 0, y: 0, width: 48, height: 48 },
      clip: { x: true, y: true },
      svg: { tag: "svg", attrs: { viewBox: "0 0 24 24", ...attrs }, style: {}, children },
    });

  test("the primitives become core shapes in a group scaled by the viewBox", () => {
    const out = draw(
      icon([
        leaf("path", { d: "M4 4h16v16H4z" }),
        leaf(
          "rect",
          { x: "2", y: "3", width: "10", height: "6", rx: "1" },
          { fill: "none", stroke: "rgb(0, 0, 255)", "stroke-width": "2" },
        ),
        leaf("circle", { cx: "12", cy: "12", r: "4" }),
        leaf("ellipse", { cx: "12", cy: "12", rx: "6", ry: "2" }),
        leaf(
          "line",
          { x1: "0", y1: "0", x2: "24", y2: "24" },
          { stroke: "rgb(0, 0, 0)", "stroke-width": "1", "stroke-linecap": "round" },
        ),
        leaf("polyline", { points: "0,0 5,5 10,0" }, { fill: "none", stroke: "rgb(0, 0, 0)" }),
        leaf("polygon", { points: "0,0 5,5 10,0" }),
      ]),
    );

    expect(out.diagnostics).toEqual([]);
    expect(out.svg).toContain('style="transform-origin:0 0;scale:2"');
    expect(out.svg).toContain('d="M4 4L20 4L20 20L4 20Z"');
    expect(out.svg).toContain(
      '<rect x="2" y="3" width="10" height="6" rx="1" fill="none" stroke="#0000FF" stroke-width="2"',
    );
    expect(out.svg).toContain('<circle cx="12" cy="12" r="4"');
    expect(out.svg).toContain("<ellipse");
    expect(out.svg).toContain('stroke-linecap="round"');
    expect(out.svg).toContain("<polyline");
    expect(out.svg).toContain("<polygon");
  });

  test("groups, their transforms and opacity are kept", () => {
    const group: SvgNode = {
      tag: "g",
      attrs: { transform: "translate(5 6) rotate(90)" },
      style: { opacity: "0.5" },
      children: [leaf("rect", { width: "4", height: "4" })],
    };

    const out = draw(icon([group]));

    expect(out.svg).toContain('opacity="0.5"');
    expect(out.svg).toContain("rotate:90deg");
  });

  test("preserveAspectRatio fits a wide viewBox inside a square", () => {
    const out = draw(icon([leaf("rect", { width: "48", height: "24" })], { viewBox: "0 0 48 24" }));

    expect(out.svg).toContain('<rect y="12" width="48" height="24"');
  });

  test("what core can't draw is reported", () => {
    const out = draw(
      icon([
        leaf("text", {}, {}),
        leaf("path", { d: "M0 0h4v4z" }, { fill: "url(#grad)" }),
        leaf("use", { href: "#a" }),
      ]),
    );

    expect(out.diagnostics.map((d) => d.what)).toEqual([
      "<text> inside an svg is not drawn",
      "a fill that is a paint server (url(#grad)) is not drawn",
      "<use> inside an svg is not drawn",
    ]);
  });
});

describe("images", () => {
  const png =
    "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAIAAAABCAYAAAD0In+KAAAAEklEQVR4nGP4z8Dwn4GBgQEAFAMDAV5q6YwAAAAASUVORK5CYII=";

  const img = (src: string, objectFit = "fill") =>
    box({
      tag: "img",
      rect: { x: 0, y: 0, width: 40, height: 40 },
      image: { src, width: 2, height: 1, objectFit, objectPosition: "50% 50%" },
    });

  test("a data URL becomes a Picture, placed by object-fit", () => {
    const fill = draw(img(png));

    expect(fill.diagnostics).toEqual([]);
    expect(fill.svg).toContain('<image width="40" height="40"');

    const contain = draw(img(png, "contain"));

    expect(contain.svg).toContain('<image y="10" width="40" height="20"');
  });

  test("a URL that is not inlined is reported", () => {
    expect(notes(img("https://example.com/a.png"))).toEqual([
      "an <img> whose src is not a data: URL is not drawn (https://example.com/a.png)",
    ]);
  });
});

describe("form controls", () => {
  const control = (props: Partial<ElementNode>): ElementNode =>
    box({ tag: "input", rect: { x: 0, y: 0, width: 13, height: 13 }, ...props });

  const checkbox = (checked: boolean, indeterminate = false) =>
    draw(
      control({
        control: { kind: "checkbox", checked, indeterminate, accent: "rgb(0, 117, 255)" },
      }),
    );

  test("a checked checkbox is an accent box with a tick; an unchecked one is a white box", () => {
    const on = checkbox(true);
    const off = checkbox(false);

    expect(on.diagnostics).toEqual([]);
    expect(on.svg).toContain("#0075FF");
    expect(on.svg).toContain("<polyline");
    expect(off.svg).not.toContain("#0075FF");
    expect(off.svg).not.toContain("<polyline");
  });

  test("an indeterminate checkbox is a dash, not a tick", () => {
    const dash = checkbox(false, true).svg;

    expect(dash).toContain("#0075FF");
    expect(dash).toContain("<line");
    expect(dash).not.toContain("<polyline");
  });

  test("a radio is a circle, with a dot when checked", () => {
    const radio = (checked: boolean) =>
      draw(
        control({
          control: { kind: "radio", checked, indeterminate: false, accent: "rgb(255, 0, 0)" },
        }),
      ).svg;

    expect(radio(false)).toContain("<circle");
    expect(radio(false).match(/<circle/g)).toHaveLength(1);
    expect(radio(true).match(/<circle/g)).toHaveLength(2);
    expect(radio(true)).toContain("#FF0000");
  });

  test("an accent that differs by scheme becomes a theme token", () => {
    const out = draw(
      control({
        control: {
          kind: "checkbox",
          checked: true,
          indeterminate: false,
          accent: { light: "rgb(0, 117, 255)", dark: "rgb(153, 200, 255)" },
        },
      }),
    );

    expect(out.svg).toContain("var(");
  });

  test("a select's chevron is drawn in its text color", () => {
    const out = draw(
      control({
        tag: "select",
        rect: { x: 0, y: 0, width: 100, height: 30 },
        control: { kind: "select", color: "rgb(255, 0, 0)" },
        children: [words("Two", 4, 20)],
      }),
    );

    expect(out.svg).toContain("<polyline");
    expect(out.svg).toContain("#FF0000");
    expect(out.svg).toContain("Two");
  });

  test("the text of a control is ordinary text, clipped to the control", () => {
    const out = draw(
      control({
        rect: { x: 0, y: 0, width: 100, height: 30 },
        clip: { x: true, y: true },
        children: [words("Search", 8, 20)],
      }),
    );

    expect(out.svg).toContain("Search");
    expect(out.svg).toContain("clip");
  });
});

describe("keys", () => {
  test("data-key, then data-part, then id, then the tag and place", () => {
    const { element } = compile(
      snapshot(
        box({
          key: "card",
          children: [
            box({ key: "a", part: "p", id: "i" }),
            box({ part: "p", id: "i" }),
            box({ id: "i" }),
            box({}),
            box({ part: "p" }),
          ],
        }),
      ),
    );

    const keys = (el: typeof element): string[] =>
      el.type === "group"
        ? [
            ...(String(el.props.key).startsWith("@") ? [] : [String(el.props.key)]),
            ...el.children.flatMap(keys),
          ]
        : [];

    expect(keys(element)).toEqual(["card", "a", "p", "i", "div[0]", "p~2"]);
  });
});

describe("a real page", () => {
  let browser: Browser;

  beforeAll(async () => {
    browser = await chromium.launch().catch(() => chromium.launch({ channel: "chrome" }));
  }, 60_000);

  afterAll(async () => {
    await browser?.close();
  });

  test("captured, compiled and drawn", async () => {
    const page = await browser.newPage({ viewport: { width: 400, height: 300 } });

    await page.setContent(`<style>html,body{margin:0;font:16px/20px monospace}</style>
      <div id="root" style="margin:10px;width:200px;padding:8px;border:2px solid #336699;border-radius:12px;
        background:linear-gradient(90deg,#fde,#def);box-shadow:0 4px 8px rgba(0,0,0,.3);transform:rotate(3deg)">
        <p style="margin:0;text-decoration:underline">Hello <b>there</b></p>
        <svg width="24" height="24" viewBox="0 0 24 24"><circle cx="12" cy="12" r="8" fill="#c33"/></svg>
      </div>`);

    const captured = await page.evaluate<Snapshot>(
      `(${captureScript})(document.getElementById("root"))`,
    );

    await page.close();

    const out = compile(captured);
    const [width, height] = out.size;

    const drawn = svg.emit(
      scene({ size: [width, height], duration: 1, title: "page" }, () => out.element),
    );

    expect(out.diagnostics).toEqual([]);
    expect(drawn).toContain("<svg");
    expect(drawn).toContain("feDropShadow");
    expect(drawn).toContain("linearGradient");
    expect(drawn).toMatch(/rotate:2\.9\d*deg/);
    expect(drawn).toContain(">Hello</text>");
    expect(drawn).toContain("<circle");
  }, 60_000);
});

describe("pseudo-elements", () => {
  test("a synthetic ::before and ::after compile like any element, with core primitives only", () => {
    const dot = box({
      tag: "::before",
      part: "::before",
      rect: { x: 4, y: 4, width: 10, height: 10 },
      radii: [
        [5, 5],
        [5, 5],
        [5, 5],
        [5, 5],
      ],
      background: "rgb(255, 0, 0)",
    });

    const tail = box({
      tag: "::after",
      part: "::after",
      rect: { x: 20, y: 0, width: 30, height: 20 },
      background: "rgb(0, 0, 255)",
      children: [words("new")],
    });

    const out = draw(box({ children: [dot, words("item", 20), tail] }));

    expect(out.diagnostics).toEqual([]);
    expect(out.svg).toContain('rx="5"');
    expect(out.svg).toContain(">new</text>");
  });
});

describe("notes from capture", () => {
  test("each is forwarded as a diagnostic with the element's path", () => {
    const out = compile(
      snapshot(
        box({
          id: "app",
          notes: ["filter is not drawn"],
          children: [
            box({
              key: "card",
              notes: ["a 3D transform is flattened to 2D", "filter is not drawn"],
            }),
            box({ key: "plain" }),
          ],
        }),
      ),
    );

    expect(out.diagnostics).toEqual([
      { path: "app", what: "filter is not drawn" },
      { path: "app/card", what: "a 3D transform is flattened to 2D" },
      { path: "app/card", what: "filter is not drawn" },
    ]);
  });
});

describe("background images and gradient tiles", () => {
  /** A PNG's signature and header: all `picture()` reads of it. */
  const png = (width: number, height: number): string => {
    const head = Buffer.alloc(24);

    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).copy(head);
    head.write("IHDR", 12);
    head.writeUInt32BE(width, 16);
    head.writeUInt32BE(height, 20);

    return `data:image/png;base64,${head.toString("base64")}`;
  };

  const whole = (w: number, h: number) => ({ x: 0, y: 0, width: w, height: h });

  const place = (over: Partial<Placement>): Placement => ({
    size: ["auto", "auto"],
    position: [
      { percent: 0, px: 0 },
      { percent: 0, px: 0 },
    ],
    repeat: ["repeat", "repeat"],
    origin: whole(100, 60),
    clip: whole(100, 60),
    ...over,
  });

  const image = (src: string, over: Parameters<typeof place>[0]): Background => ({
    kind: "image",
    src,
    place: place(over),
  });

  const image$ = (out: { svg: string }) => out.svg.match(/<image[^>]*>/g) ?? [];

  test("cover scales the image to fill the box, centered, and cuts it to the box", () => {
    const out = draw(
      box({
        backgrounds: [
          image(png(40, 40), {
            size: "cover",
            repeat: ["no-repeat", "no-repeat"],
            position: [
              { percent: 50, px: 0 },
              { percent: 50, px: 0 },
            ],
          }),
        ],
      }),
    );

    expect(out.diagnostics).toEqual([]);
    expect(image$(out)).toEqual([expect.stringContaining('width="100" height="100"')]);
    expect(out.svg).toContain("clipPath");
    expect(out.svg).toMatch(/translate\(0[ ,]-20\)|y="-20"/);
  });

  test("contain fits inside the box, and needs no clip", () => {
    const out = draw(
      box({
        backgrounds: [
          image(png(40, 40), {
            size: "contain",
            repeat: ["no-repeat", "no-repeat"],
            position: [
              { percent: 100, px: 0 },
              { percent: 0, px: 0 },
            ],
          }),
        ],
      }),
    );

    expect(image$(out)).toEqual([expect.stringContaining('width="60" height="60"')]);
    expect(out.svg).toContain('x="40"');
    expect(out.svg).not.toContain("clipPath");
  });

  test("an explicit size with one auto axis keeps the ratio", () => {
    const out = draw(
      box({
        backgrounds: [
          image(png(40, 20), { size: [20, "auto"], repeat: ["no-repeat", "no-repeat"] }),
        ],
      }),
    );

    expect(image$(out)).toEqual([expect.stringContaining('width="20" height="10"')]);
  });

  test("a repeating image is a pattern whose cell is the tile", () => {
    const out = draw(box({ backgrounds: [image(png(30, 20), { size: [30, 20] })] }));

    expect(out.diagnostics).toEqual([]);
    expect(out.svg).toMatch(/<pattern[^>]*width="30"[^>]*height="20"/);
    expect(out.svg).toContain("url(#");
  });

  test("repeat-x repeats along one axis only", () => {
    const out = draw(
      box({
        backgrounds: [
          image(png(30, 20), {
            repeat: ["repeat", "no-repeat"],
            position: [
              { percent: 0, px: 0 },
              { percent: 100, px: 0 },
            ],
          }),
        ],
      }),
    );

    const [, width, height] = /<pattern[^>]*width="([\d.]+)"[^>]*height="([\d.]+)"/.exec(out.svg)!;

    expect(Number(width)).toBe(30);
    expect(Number(height)).toBeGreaterThanOrEqual(60);
  });

  test("round stretches the tile to a whole number across the origin box", () => {
    const out = draw(
      box({ backgrounds: [image(png(30, 20), { size: [30, 20], repeat: ["round", "repeat"] })] }),
    );

    expect(out.svg).toMatch(/<pattern[^>]*width="33\.33/);
  });

  test("space spreads whole tiles with gaps, flush to both edges", () => {
    const out = draw(
      box({ backgrounds: [image(png(30, 20), { size: [30, 20], repeat: ["space", "repeat"] })] }),
    );

    expect(out.svg).toMatch(/<pattern[^>]*width="35"/);
  });

  test("an SVG with no size is drawn at the size the background gives it", () => {
    const markup = `<svg xmlns='http://www.w3.org/2000/svg'><circle cx='5' cy='5' r='5'/></svg>`;

    const out = draw(
      box({
        backgrounds: [
          image(`data:image/svg+xml,${encodeURIComponent(markup)}`, {
            size: [20, 10],
            repeat: ["no-repeat", "no-repeat"],
          }),
        ],
      }),
    );

    expect(out.diagnostics).toEqual([]);
    expect(image$(out)).toEqual([expect.stringContaining('width="20" height="10"')]);
  });

  test("an image that was not inlined, or cannot be read, is a diagnostic", () => {
    expect(notes(box({ backgrounds: [image("http://x/a.png", {})] }))).toEqual([
      "a background or mask image url() that is not a data: URL is not drawn (http://x/a.png)",
    ]);
    expect(notes(box({ backgrounds: [image("data:text/plain,hello", {})] }))).toEqual([
      expect.stringContaining("could not read"),
    ]);
  });

  test("layers are drawn bottom first, each under its own key", () => {
    const out = draw(
      box({
        backgrounds: [
          image(png(10, 10), { size: [10, 10] }),
          { kind: "linear", angle: 90, stops: stops("red", "blue") },
        ],
      }),
    );

    expect(out.svg.indexOf("linearGradient")).toBeLessThan(out.svg.indexOf("<pattern"));
  });

  test("a gradient with a size is a tile, repeated", () => {
    const out = draw(
      box({
        backgrounds: [
          {
            kind: "linear",
            angle: 90,
            stops: stops("red", "blue"),
            place: place({ size: [20, 60] }),
          },
        ],
      }),
    );

    expect(out.svg).toMatch(/<pattern[^>]*width="20"[^>]*height="60"/);
  });

  test("a gradient clipped to the content box is cut to it, with the box's corners pulled in", () => {
    const out = draw(
      box({
        radii: [corner(10), corner(10), corner(10), corner(10)],
        backgrounds: [
          {
            kind: "linear",
            angle: 90,
            stops: stops("red", "blue"),
            place: place({
              size: [80, 40],
              repeat: ["no-repeat", "no-repeat"],
              origin: { x: 10, y: 10, width: 80, height: 40 },
              clip: { x: 10, y: 10, width: 80, height: 40 },
            }),
          },
        ],
      }),
    );

    expect(out.svg).toContain('x="10" y="10" width="80" height="40"');
  });

  test("an opaque border hides what lies beneath it, so the tile need not repeat under it", () => {
    const sides = [side(4), side(4), side(4), side(4)] as const;

    const layer: Background = {
      kind: "linear",
      angle: 90,
      stops: stops("red", "blue"),
      place: place({ size: [92, 52], origin: { x: 4, y: 4, width: 92, height: 52 } }),
    };

    expect(draw(box({ border: sides, backgrounds: [layer] })).svg).not.toContain("<pattern");

    const faint = [side(4, "rgba(0, 0, 0, 0.5)"), side(4), side(4), side(4)] as const;

    expect(draw(box({ border: faint, backgrounds: [layer] })).svg).toContain("<pattern");
  });

  const stops = (...colors: string[]) =>
    colors.map((color, i) => ({
      offset: i / (colors.length - 1),
      color: { red: "rgb(255, 0, 0)", blue: "rgb(0, 0, 255)", lime: "rgb(0, 255, 0)" }[color]!,
    }));

  test("an elliptical radial gradient is a circular one scaled in a clipped group", () => {
    const out = draw(
      box({
        backgrounds: [
          {
            kind: "radial",
            at: [50, 30],
            radius: [50, 25],
            stops: stops("red", "blue"),
          },
        ],
      }),
    );

    expect(out.diagnostics).toEqual([]);
    expect(out.svg).toContain("radialGradient");
    expect(out.svg).toContain("scale:1 0.5");
    expect(out.svg).toContain("clipPath");
  });

  test("a circular radial gradient needs neither", () => {
    const out = draw(
      box({
        backgrounds: [
          { kind: "radial", at: [50, 30], radius: [25, 25], stops: stops("red", "blue") },
        ],
      }),
    );

    expect(out.svg).toContain('r="25"');
    expect(out.svg).not.toContain("scale");
    expect(out.svg).not.toContain("clipPath");
  });

  test("a repeating linear gradient has its stops unrolled across the box", () => {
    const out = draw(
      box({
        rect: { x: 0, y: 0, width: 100, height: 100 },
        backgrounds: [
          {
            kind: "linear",
            angle: 90,
            repeating: true,
            stops: [
              { offset: 0, color: "rgb(255, 0, 0)" },
              { offset: 0.25, color: "rgb(0, 0, 255)" },
            ],
          },
        ],
      }),
    );

    expect(out.svg.match(/<stop /g)).toHaveLength(8);
    expect(out.svg).toContain('offset="0.25"');
  });

  test("a repeating radial gradient reaches the far corner", () => {
    const out = draw(
      box({
        rect: { x: 0, y: 0, width: 100, height: 100 },
        backgrounds: [
          {
            kind: "radial",
            at: [0, 0],
            radius: [100, 100],
            repeating: true,
            stops: [
              { offset: 0, color: "rgb(255, 0, 0)" },
              { offset: 0.25, color: "rgb(0, 0, 255)" },
            ],
          },
        ],
      }),
    );

    expect(out.svg.match(/<stop /g)!.length).toBeGreaterThanOrEqual(12);
    expect(out.svg).toContain('r="141.42');
  });

  test("a repeating gradient with no period is drawn once", () => {
    const out = draw(
      box({
        backgrounds: [
          {
            kind: "linear",
            angle: 90,
            repeating: true,
            stops: [
              { offset: 0.5, color: "rgb(255, 0, 0)" },
              { offset: 0.5, color: "rgb(0, 0, 255)" },
            ],
          },
        ],
      }),
    );

    expect(out.svg.match(/<stop /g)).toHaveLength(2);
    expect(out.diagnostics.map((d) => d.what)).toEqual([
      "a repeating gradient with no period, or too many repeats, is drawn once",
    ]);
  });
});

describe("filter", () => {
  const filtered = (filter: NonNullable<ElementNode["filter"]>) =>
    draw(box({ background: "rgb(255, 0, 0)", filter }));

  test("blur() is core's blur, with the same deviation", () => {
    const out = filtered([{ fn: "blur", radius: 4 }]);

    expect(out.svg).toContain('<feGaussianBlur stdDeviation="4"/>');
    expect(out.diagnostics).toEqual([]);
  });

  test("drop-shadow() is core's shadow, its blur a deviation as it is", () => {
    const out = filtered([{ fn: "drop-shadow", x: 2, y: 3, blur: 5, color: "rgba(0, 0, 0, 0.5)" }]);

    expect(out.svg).toContain(
      '<feDropShadow dx="2" dy="3" stdDeviation="5" flood-opacity="0.5" flood-color="#000000"/>',
    );
  });

  test("brightness, contrast, saturate, grayscale and hue-rotate are core's adjust, in the order written", () => {
    const out = filtered([
      { fn: "grayscale", amount: 0.25 },
      { fn: "brightness", amount: 1.5 },
      { fn: "hue-rotate", amount: 90 },
      { fn: "contrast", amount: 0.8 },
      { fn: "saturate", amount: 2 },
    ]);

    const found = [
      ...out.svg.matchAll(/<(feColorMatrix|feFuncR)[^>]*?(?:values|slope)="([^"]+)"/g),
    ].map((m) => `${m[1]} ${m[2]}`);

    expect(found).toEqual([
      "feColorMatrix 0.75",
      "feFuncR 1.5",
      "feColorMatrix 90",
      "feFuncR 0.8",
      "feColorMatrix 2",
    ]);
    expect(out.svg).toContain('intercept="0.1"');
    expect(out.diagnostics).toEqual([]);
  });

  test("opacity() is the element's opacity, so a later blur is noted", () => {
    expect(filtered([{ fn: "opacity", amount: 0.4 }]).svg).toContain('opacity="0.4"');
    expect(
      filtered([
        { fn: "opacity", amount: 0.4 },
        { fn: "blur", radius: 2 },
      ]).diagnostics.map((d) => d.what),
    ).toEqual(["filter: opacity() before blur() or drop-shadow() is drawn after them"]);
  });

  test("an invisible blur draws no filter", () => {
    expect(filtered([{ fn: "blur", radius: 0 }]).svg).not.toContain("<filter");
  });
});

describe("text-shadow", () => {
  const run = (shadows: NonNullable<Captured["shadows"]>) =>
    draw(
      box({
        children: [
          {
            type: "text",
            runs: [{ ...words("Hi").runs[0]!, shadows }],
          },
        ],
      }),
    );

  test("one shadow is core's shadow on the text", () => {
    const out = run([{ x: 2, y: 3, blur: 6, color: "rgba(0, 0, 0, 0.5)" }]);

    expect(out.svg).toContain(
      '<feDropShadow dx="2" dy="3" stdDeviation="3" flood-opacity="0.5" flood-color="#000000"/>',
    );
    expect(out.svg.match(/>Hi<\/text>/g)).toHaveLength(1);
  });

  test("several shadows are copies of the text below it, the first on top", () => {
    const out = run([
      { x: 0, y: 0, blur: 8, color: "rgb(255, 0, 0)" },
      { x: 2, y: 2, blur: 0, color: "rgb(0, 0, 255)" },
    ]);

    const fills = [...out.svg.matchAll(/<text[^>]*fill="(#[0-9A-F]+)"/g)].map((m) => m[1]);

    expect(fills).toEqual(["#0000FF", "#FF0000", "#000000"]);
    expect(out.svg).toContain('<feGaussianBlur stdDeviation="4"/>');
    expect(out.svg).not.toContain("feDropShadow");
  });
});

describe("clip-path", () => {
  const clipped = (clipPath: NonNullable<ElementNode["clipPath"]>, at = { x: 5, y: 7 }) =>
    draw(box({ rect: { ...at, width: 100, height: 60 }, background: "rgb(255, 0, 0)", clipPath }));

  test("a circle is an ellipse about its center", () => {
    const out = clipped({ kind: "ellipse", center: [50, 30], radius: [30, 30] });

    expect(out.svg).toMatch(/<clipPath[^>]*>\s*<path d="M80 30C/);
    expect(out.diagnostics).toEqual([]);
  });

  test("a polygon and an inset with corners", () => {
    expect(
      clipped({
        kind: "polygon",
        points: [
          [50, 0],
          [100, 60],
          [0, 60],
        ],
        rule: "nonzero",
      }).svg,
    ).toContain('points="50 0 100 60 0 60"');
    expect(
      clipped({
        kind: "inset",
        rect: { x: 10, y: 10, width: 50, height: 20 },
        radii: [
          [4, 4],
          [4, 4],
          [4, 4],
          [4, 4],
        ],
      }).svg,
    ).toMatch(/<clipPath[^>]*>\s*<path d="M14 10/);
  });

  test("an evenodd polygon and a path keep their fill rule, and a path starts at its reference box", () => {
    const out = clipped({
      kind: "path",
      d: "M 0 0 L 10 10 L 0 10 Z",
      at: [20, 0],
      rule: "evenodd",
    });

    expect(out.svg).toContain('clip-rule="evenodd"');
    expect(out.svg).toContain("M20 0");
    expect(
      clipped({
        kind: "polygon",
        points: [
          [0, 0],
          [10, 0],
          [10, 10],
        ],
        rule: "evenodd",
      }).svg,
    ).toContain('clip-rule="evenodd"');
  });
});

describe("mask-image", () => {
  test("a gradient is an alpha mask, placed like a background", () => {
    const out = draw(
      box({
        background: "rgb(255, 0, 0)",
        masks: [
          {
            kind: "linear",
            angle: 180,
            stops: [
              { offset: 0, color: "rgb(0, 0, 0)" },
              { offset: 1, color: "rgba(0, 0, 0, 0)" },
            ],
          },
        ],
      }),
    );

    expect(out.svg).toMatch(/<mask [^>]*mask-type="alpha"/);
    expect(out.svg).toContain("<linearGradient");
    expect(out.diagnostics).toEqual([]);
  });

  test("a sized, unrepeated layer masks out the rest of the box", () => {
    const out = draw(
      box({
        background: "rgb(255, 0, 0)",
        masks: [
          {
            kind: "linear",
            angle: 90,
            stops: [
              { offset: 0, color: "rgb(0, 0, 0)" },
              { offset: 1, color: "rgb(0, 0, 0)" },
            ],
            place: {
              size: [50, 20],
              position: [
                { percent: 100, px: 0 },
                { percent: 100, px: 0 },
              ],
              repeat: ["no-repeat", "no-repeat"],
              origin: { x: 0, y: 0, width: 100, height: 60 },
              clip: { x: 0, y: 0, width: 100, height: 60 },
            },
          },
        ],
      }),
    );

    expect(out.svg).toMatch(/<mask [\s\S]*<rect[^>]*x="50" y="40" width="50" height="20"/);
  });

  test("an image that was not inlined is a diagnostic", () => {
    expect(
      notes(
        box({
          background: "rgb(255, 0, 0)",
          masks: [
            {
              kind: "image",
              src: "http://x/m.png",
            },
          ],
        }),
      ),
    ).toEqual([
      "a background or mask image url() that is not a data: URL is not drawn (http://x/m.png)",
    ]);
  });
});
