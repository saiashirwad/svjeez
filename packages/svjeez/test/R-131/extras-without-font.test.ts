import { describe, expect, test } from "bun:test";
import { flowchart } from "svjeez/extras";

describe("extras with a font", () => {
  test("without a font, extras keep the monospace estimate", () => {
    const width = (label: string) => flowchart({ nodes: { a: label }, edges: [] }).bounds.w;
    expect(width("WWWW")).toBe(width("iiii"));
  });
});
