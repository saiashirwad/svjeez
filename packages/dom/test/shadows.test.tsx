/** @jsxImportSource svjeez */
import { describe, expect, test } from "bun:test";
import { render } from "svjeez";
import { validateSvg } from "svjeez/frames";
import { normal, outerPieces, insetPieces, softPieces } from "../src/draw/shadows.ts";
import { Dom, type Box, type Shadow, type Snapshot } from "../src/index.ts";

const card = (shadows: Shadow[], extra: Partial<Box> = {}): Box => ({
  kind: "box",
  tag: "div",
  box: { x: 40, y: 40, width: 200, height: 120 },
  radii: [12, 12, 12, 12],
  background: "rgb(255,255,255)",
  shadows,
  opacity: 1,
  clip: false,
  children: [],
  ...extra,
});

const snap = (root: Box): Snapshot => ({
  width: 280,
  height: 200,
  pad: 40,
  box: root.box,
  root,
});

const soft: Shadow = { color: "rgba(0,0,0,0.5)", x: 0, y: 8, blur: 24, spread: -4 };

describe("soft shadows", () => {
  test("the normal distribution matches known values", () => {
    expect(normal(0)).toBeCloseTo(0.5, 6);
    expect(normal(1)).toBeCloseTo(0.841345, 5);
    expect(normal(-2)).toBeCloseTo(0.02275, 5);
  });

  test("a blurred shape is four corners, four strips and a solid middle", () => {
    const pieces = softPieces({ x: 0, y: 0, width: 100, height: 60 }, [8, 8, 8, 8], 10);
    const kinds = pieces.map((p) => p.fill.kind);

    expect(kinds).toEqual([
      "radial",
      "linear",
      "radial",
      "linear",
      "radial",
      "linear",
      "radial",
      "linear",
      "solid",
    ]);

    // Each fade runs from full strength inside to nothing outside, falling all the way.
    for (const p of pieces)
      if (p.fill.kind !== "solid") {
        expect(p.fill.stops[0]).toBe(1);
        expect(p.fill.stops.at(-1)).toBe(0);
        expect(p.fill.stops.every((s, i, all) => i === 0 || s <= all[i - 1]!)).toBe(true);
      }

    // It reaches the blur past the shape on every side.
    const xs = pieces.flatMap((p) => [p.bounds.x, p.bounds.x + p.bounds.width]);

    expect(Math.min(...xs)).toBe(-10);
    expect(Math.max(...xs)).toBe(110);
  });

  test("a corner sharper than the blur fades over the blur's radius, so pieces never overlap", () => {
    const pieces = softPieces({ x: 0, y: 0, width: 100, height: 60 }, [0, 0, 0, 0], 10);
    const area = pieces.reduce((sum, p) => sum + p.bounds.width * p.bounds.height, 0);

    // Corners 20 x 20, strips 80 x 20 and 40 x 20, and a middle of 80 x 40 with no notches: all of 120 x 80, once.
    expect(area).toBe(120 * 80);
  });

  test("a shape narrower than its blur never reaches full strength", () => {
    const [, , , , , , , , middle] = softPieces(
      { x: 0, y: 0, width: 10, height: 10 },
      [0, 0, 0, 0],
      30,
    );

    expect(middle!.fill).toMatchObject({ kind: "solid" });
    expect(middle!.fill.kind === "solid" && middle!.fill.opacity).toBeLessThan(0.2);
  });

  test("an opaque box hides the pieces under it", () => {
    const hidden = outerPieces(card([soft]), soft).filter((p) => p.empty);

    expect(hidden.length).toBeGreaterThan(0);
    expect(outerPieces(card([soft], { background: undefined }), soft).some((p) => p.empty)).toBe(
      false,
    );
  });

  test("an inset shadow fades the other way and fills around the hole", () => {
    const box = card([], {
      insets: [{ color: "rgba(0,0,0,0.5)", x: 0, y: 2, blur: 8, spread: 0 }],
    });
    const pieces = insetPieces(box, box.insets![0]!);
    const strip = pieces.find((p) => p.fill.kind === "linear")!;

    expect(strip.fill.kind === "linear" && strip.fill.stops[0]).toBe(0);
    expect(strip.fill.kind === "linear" && strip.fill.stops.at(-1)).toBe(1);
    expect(pieces.at(-1)).toMatchObject({ fill: { kind: "solid", opacity: 1 }, evenodd: true });
  });

  test("draws with gradients and no filter, sharing one gradient across equal fades", () => {
    const twin = { ...soft };
    const root = card([], {
      background: undefined,
      children: [card([soft]), card([twin], { box: { x: 60, y: 60, width: 200, height: 120 } })],
    });
    const svg = render(
      { width: 280, height: 200, duration: 1, title: "shadow" },
      <Dom states={snap(root)} />,
    );

    expect(validateSvg(svg).errors).toEqual([]);
    expect(svg).not.toContain("<filter");
    expect(svg).toContain("<radialGradient");
    // Two boxes of one size and shadow: four strips and four corners, drawn twice from the same eight servers.
    expect(svg.match(/<(linear|radial)Gradient/g)).toHaveLength(8);
  });

  test("a box that grows morphs its shadow's pieces; a new blur crossfades", () => {
    const small = card([soft]);
    const tall = card([soft], { box: { x: 40, y: 40, width: 200, height: 180 } });
    const grown = render(
      { width: 280, height: 260, duration: 2, title: "shadow" },
      <Dom states={[snap(small), snap(tall)]} />,
    );

    expect(grown).toContain('attributeName="d"');
    expect(grown).not.toMatch(/opacity:/);

    const blurrier = card([{ ...soft, blur: 40 }]);
    const swapped = render(
      { width: 280, height: 200, duration: 2, title: "shadow" },
      <Dom states={[snap(small), snap(blurrier)]} />,
    );

    expect(swapped).toMatch(/opacity:/);
  });
});
