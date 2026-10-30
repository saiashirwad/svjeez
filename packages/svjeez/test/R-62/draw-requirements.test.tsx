import { describe, expect, test } from "bun:test";
import { draw } from "svjeez";
import { keyframes, scene } from "../helpers/compile-scene";

describe("requirements", () => {
  test("draw adds pathLength and dasharray to its element", () => {
    const svg = scene(<path d="M0 0H10" stroke="#fff" animation={draw({ at: 0, over: 1 })} />);
    expect(svg).toContain('pathLength="1" stroke-dasharray="1"');
    expect(keyframes(svg)).toEqual([
      "0%{stroke-dashoffset:1;visibility:hidden}10%,100%{stroke-dashoffset:0;visibility:visible}",
    ]);
  });

  test("draw refuses an author value that would break it", () => {
    expect(() =>
      scene(<path d="M0 0H10" pathLength={2} animation={draw({ at: 0, over: 1 })} />),
    ).toThrow(/pathLength/);
  });
});
