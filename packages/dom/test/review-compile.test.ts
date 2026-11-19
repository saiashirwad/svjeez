import { describe, expect, test } from "bun:test";
import { scene } from "svjeez";
import { svg } from "svjeez/tools";
import { compile, type ElementNode, type SvgNode } from "../src/index.ts";
import { pair } from "../src/compile/pair.ts";
import { box, snapshot, words } from "./fixtures.ts";

const draw = (root: ElementNode) => {
  const compiled = compile(snapshot(root));
  const [width, height] = compiled.size;

  return svg.emit(
    scene({ size: [width, height], duration: 1, title: "dom" }, () => compiled.element),
  );
};

describe("default monospace text", () => {
  test("a generic family is not quoted", () => {
    const out = draw(box({ children: [words("hi")] }));

    expect(out).toMatch(/font-family="monospace"/);
    expect(out).not.toContain("'monospace'");
  });
});

describe("inline svg with fill and stroke", () => {
  const icon = (child: SvgNode): ElementNode =>
    box({
      tag: "svg",
      rect: { x: 0, y: 0, width: 48, height: 48 },
      svg: { tag: "svg", attrs: { viewBox: "0 0 48 48" }, style: {}, children: [child] },
    });

  test("the fill is not backed off by half the stroke", () => {
    const both = draw(
      icon({
        tag: "circle",
        attrs: { cx: "20", cy: "20", r: "10" },
        style: { fill: "rgb(255, 0, 0)", stroke: "rgb(0, 0, 255)", "stroke-width": "4" },
        children: [],
      }),
    );

    const only = (style: Record<string, string>) =>
      draw(icon({ tag: "circle", attrs: { cx: "20", cy: "20", r: "10" }, style, children: [] }));

    const fillOnly = only({ fill: "rgb(255, 0, 0)", stroke: "none" });
    const grab = (out: string, tag: RegExp) => (out.match(tag) ?? [""])[0]!;

    // The fill shape in the combined drawing matches the fill-only drawing's geometry.
    const geom = (out: string) =>
      out.match(/<(?:path|circle|ellipse)[^>]*\bfill="#FF0000"[^>]*>/)?.[0] ?? "";

    expect(grab(geom(both), /\b(?:d|cx|cy|r)="[^"]*"/g)).toBe(
      grab(geom(fillOnly), /\b(?:d|cx|cy|r)="[^"]*"/g),
    );
    expect(geom(both)).not.toBe("");
  });
});

describe("lift across parents", () => {
  const column = (id: string, ...kids: ElementNode[]) =>
    box({ id, rect: { x: id === "a" ? 0 : 200, y: 0, width: 100, height: 300 }, children: kids });

  const card = (y: number) => box({ key: "card", rect: { x: 0, y, width: 80, height: 40 } });

  const board = (...columns: ElementNode[]) =>
    snapshot(
      box({ id: "board", rect: { x: 0, y: 0, width: 400, height: 300 }, children: columns }),
    );

  const anim = (prop: string) => ({
    kind: "animation" as const,
    name: "x",
    keyframes: [
      { offset: 0, easing: "linear", props: { [prop]: "0" } },
      { offset: 1, easing: "linear", props: { [prop]: "1" } },
    ],
    duration: 1,
    delay: 0,
    endDelay: 0,
    iterations: 1,
    direction: "normal" as const,
    easing: "linear",
    fill: "none" as const,
    currentTime: 0,
    playbackRate: 1,
    playState: "running" as const,
  });

  test("a filter, clip-path, mask or running opacity or transform animation on a parent stops the lift", () => {
    const traps: Partial<ElementNode>[] = [
      { filter: [{ fn: "blur", radius: 2 }] },
      { clipPath: { kind: "inset", rect: { x: 0, y: 0, width: 10, height: 10 } } },
      { masks: [{ kind: "linear", angle: 0, stops: [] }] },
      { animations: [anim("opacity")] },
      { animations: [anim("transform")] },
    ];

    for (const trap of traps) {
      const { diagnostics } = pair([
        board({ ...column("a", card(10)), ...trap }, column("b")),
        board(column("a"), column("b", card(60))),
      ]);

      expect(diagnostics).toHaveLength(1);
    }
  });
});
