import { describe, expect, test } from "bun:test";
import { Callout, flowchart } from "svjeez/extras";
import { sans, scene } from "../helpers/font";

describe("extras with a font", () => {
  test("a callout box fits its measured lines", () => {
    const target = flowchart({ nodes: { a: "A" }, edges: [] }).bounds;

    const box = (text: string) =>
      Number(
        /<rect x="[^"]*" y="[^"]*" width="([^"]+)"/.exec(
          scene(
            <Callout target={target} during={{ at: 0, over: 1 }} font={sans}>
              {text}
            </Callout>,
          ),
        )![1],
      );

    expect(box("WWW") - box("iii")).toBeCloseTo(
      sans.measure("WWW", 14) - sans.measure("iii", 14),
      1,
    );
  });
});
