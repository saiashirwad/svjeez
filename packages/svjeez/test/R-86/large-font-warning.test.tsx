import { describe, expect, test } from "bun:test";
import { font, validateSvg } from "svjeez";
import { scene } from "../helpers/font";

describe("fontFamily", () => {
  test("a large embedded font warns", () => {
    const big = font(
      Uint8Array.from([...Buffer.from("wOF2"), ...new Uint8Array(200_000).fill(7)]),
      {
        family: "Big",
      },
    );

    expect(validateSvg(scene(<text fontFamily={big}>Hi</text>)).warnings.join("\n")).toContain(
      "An embedded font is",
    );
  });
});
