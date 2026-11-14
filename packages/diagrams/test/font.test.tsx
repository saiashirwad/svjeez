import { describe, expect, test } from "bun:test";
import { font, render, type Child } from "svjeez";
import { flowchart } from "../src/index.ts";

const sans = await font.load(
  new URL("../../svjeez/tests/fixtures/ABeeZee-Regular.ttf", import.meta.url),
);

const scene = (child: Child) =>
  render({ width: 200, height: 100, duration: 1, title: "Fonts" }, child);

const faces = (svg: string) =>
  [
    ...svg.matchAll(/@font-face\{font-family:([^;]+);[^}]*font-weight:(\d+);font-style:(\w+)\}/g),
  ].map((m) => `${m[1]} ${m[2]} ${m[3]}`);

describe("diagram fonts", () => {
  test("diagram chips fit their measured labels", () => {
    const width = (label: string) =>
      flowchart({ nodes: { a: label }, edges: [] }, { font: sans }).bounds.w;

    expect(width("WWWW") - width("iiii")).toBeCloseTo(
      sans.measure("WWWW", 14) - sans.measure("iiii", 14),
      3,
    );
    expect(faces(scene(flowchart({ nodes: { a: "A" }, edges: [] }, { font: sans }).node))).toEqual([
      "'ABeeZee' 400 normal",
    ]);
  });

  test("without a font, extras keep the monospace estimate", () => {
    const width = (label: string) => flowchart({ nodes: { a: label }, edges: [] }).bounds.w;
    expect(width("WWWW")).toBe(width("iiii"));
  });
});
