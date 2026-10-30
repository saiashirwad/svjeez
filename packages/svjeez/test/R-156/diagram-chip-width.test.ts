import { describe, expect, test } from "bun:test";
import { flowchart } from "svjeez/extras";
import { sans } from "../helpers/font";

describe("extras with a font", () => {
  test("diagram chips fit their measured labels", () => {
    const width = (label: string) =>
      flowchart({ nodes: { a: label }, edges: [] }, { font: sans }).bounds.w;

    expect(width("WWWW") - width("iiii")).toBeCloseTo(
      sans.measure("WWWW", 14) - sans.measure("iiii", 14),
      3,
    );
  });
});
